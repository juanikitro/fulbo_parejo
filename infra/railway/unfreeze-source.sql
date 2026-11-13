-- Run ONLY before destination accepts writes, or after reconciling all destination changes.
-- Removes this migration's 35 blocking triggers; does not remove application data.
DROP FUNCTION fulbo_parejo.railway_migration_freeze() CASCADE;
