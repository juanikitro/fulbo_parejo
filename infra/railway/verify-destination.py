"""Complete namespace ACLs from the source and verify the private destination."""
import json
import os
import subprocess

if os.environ['PGHOST'] != 'postgres.railway.internal':
    raise RuntimeError('Destination-only operation')

sql = '''
BEGIN;
ALTER SCHEMA auth OWNER TO supabase_admin;
GRANT USAGE ON SCHEMA fulbo_parejo TO authenticated, service_role;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role, postgres;
GRANT ALL ON SCHEMA auth TO supabase_auth_admin, dashboard_user;
COMMIT;
SELECT json_build_object(
 'users', (SELECT count(*) FROM auth.users),
 'identities', (SELECT count(*) FROM auth.identities),
 'policies', (SELECT count(*) FROM pg_policies WHERE schemaname='fulbo_parejo'),
 'functions', (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='fulbo_parejo'),
 'unvalidated_constraints', (SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='fulbo_parejo' AND NOT c.convalidated)
);
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}';
SELECT json_build_object('unrelated_user_visible_rosters', (SELECT count(*) FROM fulbo_parejo.rosters),
                         'unrelated_user_visible_players', (SELECT count(*) FROM fulbo_parejo.players));
ROLLBACK;
'''
result = subprocess.run(['psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-c',sql], capture_output=True, text=True)
if result.returncode:
    # Queries here contain only metadata and aggregate counts.
    print(result.stderr, flush=True)
    raise RuntimeError('Destination verification failed')
for line in result.stdout.splitlines():
    if line.startswith('{'):
        report = json.loads(line)
        if 'unrelated_user_visible_rosters' in report:
            assert report['unrelated_user_visible_rosters'] == 0 and report['unrelated_user_visible_players'] == 0
        print(json.dumps({'message': 'DESTINATION_CHECK', **report}), flush=True)
