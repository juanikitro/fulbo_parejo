"""Replace the unpublished rehearsal ONLY if business data still equals its baseline.

Every destination row is archived first. Source must already be write-frozen.
On failure access stays blocked for diagnosis; no write traffic is opened here.
"""
import base64, hashlib, io, json, os, tarfile, tempfile
from pathlib import Path
import boto3
from botocore.config import Config
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from restore import run, copies
import backup

assert os.environ['PGHOST'] == 'postgres.railway.internal'
assert os.environ['RAILWAY_PROJECT_ID'] == 'e928083d-6d77-4cc1-8900-d80a8c8aaca3'
assert os.environ['FINAL_SYNC_UNPUBLISHED_REHEARSAL'] == 'confirmed'
os.environ['PGOPTIONS'] = '-c statement_timeout=120000'
psql=['psql','-X','-A','-t','-v','ON_ERROR_STOP=1']
s3=boto3.client('s3',endpoint_url=os.environ['AWS_ENDPOINT_URL'],region_name=os.environ['AWS_DEFAULT_REGION'],config=Config(signature_version='s3v4',s3={'addressing_style':'virtual'}))
key=base64.b64decode(os.environ['BACKUP_ENCRYPTION_KEY'],validate=True)
def archive_dump(object_key,digest):
    payload=s3.get_object(Bucket=os.environ['BACKUP_BUCKET'],Key=object_key)['Body'].read()
    assert hashlib.sha256(payload).hexdigest()==digest and payload[:8]==b'FULBOBK1'
    plain=AESGCM(key).decrypt(payload[8:20],payload[20:],payload[:8])
    with tarfile.open(fileobj=io.BytesIO(plain),mode='r:gz') as archive:
        data=archive.extractfile('database.dump').read()
        manifest=json.load(archive.extractfile('manifest.json'))
    assert hashlib.sha256(data).hexdigest()==manifest['files']['database.dump']['sha256']
    return data,manifest
selection=['--schema=auth','--schema=fulbo_parejo']
with tempfile.TemporaryDirectory(prefix='fulbo-final-') as folder:
    root=Path(folder)
    initial,_=archive_dump('migration/20261113T154215Z-082a14b9034348b1a29e312d3d1fe1f7.tar.gz.aesgcm','b1b41b04b05f60c166ce43174b84081a7bc44750c458610f17217f8b6b3c3bd8')
    (root/'initial.dump').write_bytes(initial)
    baseline=copies(run(['pg_restore','--file=-',*selection,str(root/'initial.dump')]))
    latest,manifest=archive_dump(os.environ['RESTORE_OBJECT_KEY'],os.environ['RESTORE_SHA256'])
    assert manifest['phase']=='final-frozen', 'Not a frozen final snapshot'
    (root/'final.dump').write_bytes(latest)
    sql=run(['pg_restore','--file=-',*selection,str(root/'final.dump')])
    assert sql.count(b'CREATE TRIGGER railway_migration_freeze ') == 35, 'Missing source freeze evidence'
    expected=copies(sql)
    run(psql+['-c',"ALTER ROLE supabase_auth_admin NOLOGIN; ALTER ROLE authenticator NOLOGIN;"])
    run(psql+['-c',"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename IN ('supabase_auth_admin','authenticator') AND pid<>pg_backend_pid();"])
    current=copies(run(['pg_dump','--data-only',*selection]))
    business=lambda data:{k:v for k,v in data.items() if k.startswith('COPY fulbo_parejo.') or k.startswith('COPY auth.users ') or k.startswith('COPY auth.identities ')}
    assert business(current)==business(baseline), 'Destination contains new business data; manual reconciliation required'
    os.environ['BACKUP_PHASE']='destination-before-final-sync'
    backup.main()
    os.environ['PGOPTIONS']='-c statement_timeout=120000'
    (root/'restore.sql').write_bytes(sql)
    prepare='DROP SCHEMA fulbo_parejo CASCADE; DROP SCHEMA auth CASCADE; CREATE SCHEMA auth AUTHORIZATION supabase_admin; CREATE SCHEMA fulbo_parejo AUTHORIZATION postgres; GRANT USAGE ON SCHEMA fulbo_parejo TO authenticated,service_role; GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role,postgres; GRANT ALL ON SCHEMA auth TO supabase_auth_admin,dashboard_user;'
    run(psql+['--single-transaction','-c',prepare,'-f',str(root/'restore.sql'),'-c','DROP FUNCTION fulbo_parejo.railway_migration_freeze() CASCADE;'])
    actual=copies(run(['pg_dump','--data-only',*selection]))
    assert actual==expected, 'Final data comparison failed; destination remains blocked'
    print(json.dumps({'message':'FINAL_DATA_EXACT_MATCH','tables':len(actual),'rows':sum(x['rows'] for x in actual.values()),'archive':os.environ['RESTORE_OBJECT_KEY']}),flush=True)
    run(psql+['-c','ALTER ROLE supabase_auth_admin LOGIN; ALTER ROLE authenticator LOGIN; NOTIFY pgrst, \'reload schema\';'])
    print('FINAL_SYNC_COMPLETE',flush=True)
