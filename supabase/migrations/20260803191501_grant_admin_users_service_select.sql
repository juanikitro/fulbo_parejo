-- The Edge Function uses the service-role client to authorize an admin before
-- returning any aggregate. BYPASSRLS does not grant table privileges.
grant select on table public.admin_users to service_role;
