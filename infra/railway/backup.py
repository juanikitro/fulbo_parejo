"""Read-only PostgreSQL archive, encrypted before upload to a private bucket.

No retention deletions or source writes. This captures a preliminary snapshot;
the migration's final snapshot must run after the separately verified write freeze.
"""
import base64
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile
from datetime import datetime, timezone
import uuid

import boto3
from botocore.config import Config
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def run(args, output=None):
    # Do not print stderr: database errors may include sensitive row contents.
    result = subprocess.run(args, stdout=output or subprocess.PIPE,
                            stderr=subprocess.PIPE, check=False)
    if result.returncode:
        raise RuntimeError(f"{args[0]} failed with exit code {result.returncode}; no backup declared successful")
    return result.stdout


def main():
    os.umask(0o077)
    key = base64.b64decode(os.environ["BACKUP_ENCRYPTION_KEY"], validate=True)
    if len(key) != 32:
        raise ValueError("BACKUP_ENCRYPTION_KEY must encode 32 bytes")
    s3 = boto3.client("s3", endpoint_url=os.environ["AWS_ENDPOINT_URL"],
                      region_name=os.environ["AWS_DEFAULT_REGION"],
                      config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"},
                                    connect_timeout=10, read_timeout=30, retries={"max_attempts": 2}))
    bucket = os.environ["BACKUP_BUCKET"]
    print("BACKUP_BUCKET_CHECK", flush=True)
    s3.head_bucket(Bucket=bucket)
    with tempfile.TemporaryDirectory(prefix="fulbo-backup-") as folder:
        root = Path(folder)
        if os.environ['PGHOST'] == 'postgres.railway.internal':
            os.environ['PGSSLMODE'] = 'disable'  # Railway private WireGuard network
        else:
            ca = root / "source-ca.crt"
            ca.write_text(os.environ["SOURCE_CA_PEM"], encoding="ascii")
            os.environ["PGSSLROOTCERT"] = str(ca)
            os.environ["PGSSLMODE"] = "verify-full"
        os.environ["PGOPTIONS"] = "-c default_transaction_read_only=on"
        # Supabase-managed schemas must be explicitly included, as in its CLI
        # data export; the default archive selection can omit managed data.
        print("BACKUP_DATABASE_EXPORT", flush=True)
        run(["pg_dump", "--format=custom", "--schema=*", "--exclude-schema=pg_*",
             "--exclude-schema=information_schema", "--file", str(root / "database.dump")])
        toc = run(["pg_restore", "--list", str(root / "database.dump")])
        required_tables = ["admin_users", "match_participants", "match_results", "matches",
                           "players", "roster_access", "roster_invitations", "roster_preferences", "rosters"]
        if any(f"TABLE DATA fulbo_parejo {name} ".encode() not in toc for name in required_tables) or b"TABLE DATA auth users " not in toc:
            print(json.dumps({"event": "ARCHIVE_CONTENT_CHECK_FAILED", "data_entries": [
                line for line in toc.decode().splitlines() if "TABLE DATA" in line
            ]}), flush=True)
            raise RuntimeError("Archive does not contain required application and user data")
        (root / "archive-toc.txt").write_bytes(toc)
        print("BACKUP_ROLE_EXPORT", flush=True)
        with (root / "roles.sql").open("wb") as output:
            run(["pg_dumpall", "--roles-only", "--no-role-passwords"], output)
        # Include exact archive hashes, never plaintext data or credentials in logs.
        manifest = {"format": 1, "created_at": datetime.now(timezone.utc).isoformat(),
                    "phase": os.environ.get("BACKUP_PHASE", "preliminary"),
                    "source": os.environ['PGHOST'], "files": {}}
        for name in ["database.dump", "roles.sql", "archive-toc.txt"]:
            payload = (root / name).read_bytes()
            manifest["files"][name] = {"bytes": len(payload), "sha256": hashlib.sha256(payload).hexdigest()}
        (root / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
        bundle = io.BytesIO()
        with tarfile.open(fileobj=bundle, mode="w:gz") as archive:
            for name in ["database.dump", "roles.sql", "archive-toc.txt", "manifest.json"]:
                archive.add(root / name, arcname=name)
        plaintext = bundle.getvalue()
        nonce = os.urandom(12)
        header = b"FULBOBK1"
        encrypted = header + nonce + AESGCM(key).encrypt(nonce, plaintext, header)
        digest = hashlib.sha256(encrypted).hexdigest()
        now = datetime.now(timezone.utc)
        scheduled = manifest['phase'] == 'scheduled'
        prefix = 'daily/' if scheduled else 'migration/'
        object_key = prefix + now.strftime("%Y%m%dT%H%M%SZ") + "-" + uuid.uuid4().hex + ".tar.gz.aesgcm"
        print("BACKUP_ENCRYPTED_UPLOAD", flush=True)
        s3.put_object(Bucket=bucket, Key=object_key, Body=encrypted,
                      ContentType="application/octet-stream", Metadata={"sha256": digest})
        downloaded = s3.get_object(Bucket=bucket, Key=object_key)["Body"].read()
        if hashlib.sha256(downloaded).hexdigest() != digest:
            raise RuntimeError("Remote backup checksum mismatch")
        recovered = AESGCM(key).decrypt(downloaded[8:20], downloaded[20:], downloaded[:8])
        if recovered != plaintext:
            raise RuntimeError("Backup decrypt verification failed")
        print(json.dumps({"event": "ENCRYPTED_BACKUP_ROUNDTRIP_OK", "key": object_key,
                          "bytes": len(encrypted), "sha256": digest,
                          "phase": manifest["phase"], "database_restore_tested": False}), flush=True)
        if scheduled:
            if now.weekday() == 6:
                weekly = 'weekly/' + object_key.removeprefix('daily/')
                s3.put_object(Bucket=bucket, Key=weekly, Body=encrypted,
                              ContentType='application/octet-stream', Metadata={'sha256': digest})
                assert hashlib.sha256(s3.get_object(Bucket=bucket, Key=weekly)['Body'].read()).hexdigest() == digest
            # Delete only these job-owned prefixes after the new dump is verified.
            # Keep newest snapshot for seven daily dates and four weekly dates.
            for owned_prefix, keep in [('daily/', 7), ('weekly/', 4)]:
                objects=[]
                for page in s3.get_paginator('list_objects_v2').paginate(Bucket=bucket,Prefix=owned_prefix):
                    objects.extend(page.get('Contents', []))
                dates=set()
                removed=0
                for obj in sorted(objects,key=lambda item:item['Key'],reverse=True):
                    name=obj['Key'].removeprefix(owned_prefix)
                    if not (len(name)>8 and name[:8].isdigit() and name.endswith('.tar.gz.aesgcm')):
                        continue
                    date=name[:8]
                    if date not in dates and len(dates)<keep:
                        dates.add(date)
                    else:
                        s3.delete_object(Bucket=bucket,Key=obj['Key'])
                        removed+=1
                print(json.dumps({'message':'BACKUP_RETENTION','prefix':owned_prefix,'kept_dates':len(dates),'removed':removed}),flush=True)


if __name__ == "__main__":
    main()
