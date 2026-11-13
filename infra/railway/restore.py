"""Restore a verified archive ONLY into the empty, private Fulbo destination.

Auth remains stopped throughout this rehearsal. Source credentials are not used.
The archive retains Supabase internals for recovery, but only Auth and the
application schema are imported into the compatible destination image.
"""
import base64
import hashlib
import io
import json
import os
from pathlib import Path
import re
import subprocess
import tarfile
import tempfile

import boto3
from botocore.config import Config
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def run(args):
    result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode:
        # Print SQL error category, not statement/data contents or credentials.
        errors = re.findall(rb"(?:ERROR|FATAL):\s*([^\n]+)", result.stderr)
        safe = [e.decode(errors="replace") for e in errors
                if not any(word in e.lower() for word in [b"password", b"key", b"row", b"value"])]
        print(json.dumps({"message": "RESTORE_COMMAND_FAILED", "program": args[0], "errors": safe}), flush=True)
        raise RuntimeError(f"{args[0]} exited {result.returncode}")
    return result.stdout


def copies(sql):
    """Hash COPY row multisets without logging their contents."""
    result = {}
    current = None
    rows = []
    for line in sql.splitlines():
        if current is not None:
            if line == b"\\.":
                result[current.decode()] = {"rows": len(rows), "sha256": hashlib.sha256(b"\n".join(sorted(rows))).hexdigest()}
                current = None
                rows = []
            else:
                rows.append(line)
        elif line.startswith(b"COPY ") and line.endswith(b" FROM stdin;"):
            current = line
    if current is not None:
        raise RuntimeError("Unterminated COPY in archive")
    if not result:
        raise RuntimeError("No COPY data found")
    return result


def main():
    os.umask(0o077)
    if os.environ["PGHOST"] != "postgres.railway.internal" or os.environ["RAILWAY_PROJECT_ID"] != "e928083d-6d77-4cc1-8900-d80a8c8aaca3":
        raise RuntimeError("Restore is restricted to the private Fulbo destination")
    os.environ["PGOPTIONS"] = "-c statement_timeout=120000"
    psql = ["psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1"]
    guard = run(psql + ["-c", "SELECT (SELECT count(*) FROM auth.users), (SELECT count(*) FROM pg_namespace WHERE nspname='fulbo_parejo');"]).strip()
    if guard != b"0|0":
        raise RuntimeError("Destination is not empty; refusing to replace existing users or application data")
    s3 = boto3.client("s3", endpoint_url=os.environ["AWS_ENDPOINT_URL"], region_name=os.environ["AWS_DEFAULT_REGION"],
                      config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}, connect_timeout=10, read_timeout=30))
    payload = s3.get_object(Bucket=os.environ["BACKUP_BUCKET"], Key=os.environ["RESTORE_OBJECT_KEY"])["Body"].read()
    if hashlib.sha256(payload).hexdigest() != os.environ["RESTORE_SHA256"] or payload[:8] != b"FULBOBK1":
        raise RuntimeError("Archive checksum or format mismatch")
    key = base64.b64decode(os.environ["BACKUP_ENCRYPTION_KEY"], validate=True)
    plaintext = AESGCM(key).decrypt(payload[8:20], payload[20:], payload[:8])
    with tempfile.TemporaryDirectory(prefix="fulbo-restore-") as folder:
        root = Path(folder)
        with tarfile.open(fileobj=io.BytesIO(plaintext), mode="r:gz") as archive:
            manifest = json.load(archive.extractfile("manifest.json"))
            data = archive.extractfile("database.dump").read()
        if hashlib.sha256(data).hexdigest() != manifest["files"]["database.dump"]["sha256"]:
            raise RuntimeError("Inner database checksum mismatch")
        dump = root / "database.dump"
        dump.write_bytes(data)
        selection = ["--schema=auth", "--schema=fulbo_parejo"]
        sql = run(["pg_restore", "--file=-", *selection, str(dump)])
        print(json.dumps({"message": "RESTORE_ARCHIVE_SCHEMA", "auth_schema": b"CREATE SCHEMA auth;" in sql,
                          "auth_users_table": b"CREATE TABLE auth.users" in sql,
                          "app_schema": b"CREATE SCHEMA fulbo_parejo;" in sql,
                          "app_table": b"CREATE TABLE fulbo_parejo.players" in sql}), flush=True)
        expected = copies(sql)
        restore_sql = root / "restore.sql"
        restore_sql.write_bytes(sql)
        print("RESTORE_TRANSACTION_START", flush=True)
        # The destination is empty and inaccessible to clients. Replacing its
        # initial Auth schema preserves every source table, including migrations,
        # rather than discarding rows to fit an older bundled schema.
        prepare = "DROP SCHEMA auth CASCADE;"
        if b"CREATE SCHEMA auth;" not in sql:
            prepare += " CREATE SCHEMA auth AUTHORIZATION supabase_auth_admin;"
        if b"CREATE SCHEMA fulbo_parejo;" not in sql:
            prepare += " CREATE SCHEMA fulbo_parejo AUTHORIZATION postgres;"
        run(psql + ["--single-transaction", "-c", prepare, "-f", str(restore_sql)])
        restored = run(["pg_dump", "--data-only", *selection])
        actual = copies(restored)
        if actual != expected:
            differing = sorted(set(actual) ^ set(expected) | {k for k in actual.keys() & expected.keys() if actual[k] != expected[k]})
            print(json.dumps({"message": "RESTORE_DATA_MISMATCH", "tables": differing}), flush=True)
            raise RuntimeError("Restored row multisets differ from archive; do not open traffic")
        rls = run(psql + ["-c", "SELECT count(*), count(*) FILTER (WHERE relrowsecurity) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='fulbo_parejo' AND c.relkind='r';"]).strip()
        if rls != b"9|9":
            raise RuntimeError("Expected nine application tables protected by RLS")
        print(json.dumps({"message": "RESTORE_DATA_EXACT_MATCH", "tables": len(actual),
                          "rows": sum(t["rows"] for t in actual.values()), "app_rls_tables": 9,
                          "archive": os.environ["RESTORE_OBJECT_KEY"]}), flush=True)


if __name__ == "__main__":
    main()
