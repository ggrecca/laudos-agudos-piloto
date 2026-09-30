create index if not exists pilot_profile_audit_user_id_idx
  on public.pilot_profile_audit(user_id);
create index if not exists pilot_profile_audit_actor_id_idx
  on public.pilot_profile_audit(actor_id);
create index if not exists pilot_profiles_approved_by_idx
  on public.pilot_profiles(approved_by);
