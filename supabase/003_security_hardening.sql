-- Defense in depth for the exposed Data API. RLS remains enabled, but direct table
-- writes are not part of the pilot contract: all changes go through checked RPCs.
revoke all on table
  public.pilot_profiles,
  public.pilot_products,
  public.pilot_tanks,
  public.pilot_cycles,
  public.pilot_loadings,
  public.pilot_approvals,
  public.pilot_audit
from anon, authenticated;

grant select on table
  public.pilot_profiles,
  public.pilot_products,
  public.pilot_tanks,
  public.pilot_cycles,
  public.pilot_loadings,
  public.pilot_approvals,
  public.pilot_audit
to authenticated;

revoke all on all sequences in schema public from anon, authenticated;

-- Prevent the platform's legacy default grants from re-opening this surface when
-- future pilot tables/functions are added through the SQL editor.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete, references, trigger, truncate on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke usage, select, update on sequences from anon, authenticated;

-- Foreign-key and list/filter indexes identified by the database advisor.
create index if not exists pilot_cycles_tank_id_idx on public.pilot_cycles(tank_id);
create index if not exists pilot_cycles_product_id_idx on public.pilot_cycles(product_id);
create index if not exists pilot_cycles_created_by_idx on public.pilot_cycles(created_by);
create index if not exists pilot_loadings_cycle_id_idx on public.pilot_loadings(cycle_id);
create index if not exists pilot_loadings_created_by_idx on public.pilot_loadings(created_by);
create index if not exists pilot_loadings_issued_by_idx on public.pilot_loadings(issued_by);
create index if not exists pilot_loadings_destination_loaded_at_idx on public.pilot_loadings(destination, loaded_at desc);
create index if not exists pilot_approvals_actor_id_idx on public.pilot_approvals(actor_id);
create index if not exists pilot_audit_actor_id_idx on public.pilot_audit(actor_id);
