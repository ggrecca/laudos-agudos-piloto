-- Consumer accounts only see certificates addressed to their assigned destination.
alter table public.pilot_profiles add column destination text;
drop policy pilot_loading_read on public.pilot_loadings;
create policy pilot_loading_read on public.pilot_loadings for select to authenticated using (
  pilot_private.role() is not null and (
    pilot_private.role() <> 'Consulta' or (
      state = 'Emitido' and destination = (
        select p.destination from public.pilot_profiles p where p.id = (select auth.uid()) and p.active
      )
    )
  )
);
