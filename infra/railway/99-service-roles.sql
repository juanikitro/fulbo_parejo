-- Separate database credentials for Auth and PostgREST. Never use postgres
-- credentials in these services or in the frontend.
\getenv authpass AUTH_DB_PASSWORD
\getenv restpass REST_DB_PASSWORD
ALTER USER supabase_auth_admin WITH PASSWORD :'authpass';
ALTER USER authenticator WITH PASSWORD :'restpass';
