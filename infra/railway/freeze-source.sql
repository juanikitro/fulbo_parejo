SET lock_timeout='15s';
CREATE FUNCTION fulbo_parejo.railway_migration_freeze() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $f$
BEGIN RAISE EXCEPTION 'Fulboparejo migration: source writes paused' USING ERRCODE='55000'; END;
$f$;
DO $block$
DECLARE item record; total integer:=0;
BEGIN
 FOR item IN SELECT c.oid,n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('auth','fulbo_parejo') AND c.relkind='r' AND NOT (n.nspname='auth' AND c.relname='schema_migrations') ORDER BY n.nspname,c.relname LOOP
  EXECUTE format('CREATE TRIGGER railway_migration_freeze BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON %I.%I FOR EACH STATEMENT EXECUTE FUNCTION fulbo_parejo.railway_migration_freeze()',item.nspname,item.relname);
  total:=total+1;
 END LOOP;
 IF total<>35 THEN RAISE EXCEPTION 'Expected 35 protected tables, got %',total; END IF;
END;$block$;
