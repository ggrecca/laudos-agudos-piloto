-- Save and transition together: failures roll back the draft and its edit version.
create or replace function public.pilot_submit_loading(
  p_loading jsonb,
  p_action text default 'draft',
  p_id bigint default null
) returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  loading_id bigint;
begin
  if p_action is null or p_action not in ('draft', 'request', 'issue') then
    raise exception 'Ação de carregamento inválida';
  end if;
  if p_id is null then
    loading_id := public.pilot_create_loading(
      (p_loading->>'cycle_id')::bigint,
      p_loading->>'plate', p_loading->>'trailer', p_loading->>'carrier',
      p_loading->>'destination', p_loading->>'analyst',
      (p_loading->>'loaded_at')::timestamptz,
      p_loading->'values', p_loading->>'source',
      coalesce(p_loading->>'observation', '')
    );
  else
    loading_id := p_id;
    perform public.pilot_save_loading(
      p_id, p_loading->>'plate', p_loading->>'trailer', p_loading->>'carrier',
      p_loading->>'destination', p_loading->>'analyst',
      (p_loading->>'loaded_at')::timestamptz,
      p_loading->'values', p_loading->>'source',
      coalesce(p_loading->>'observation', '')
    );
  end if;
  if p_action = 'request' then
    perform public.pilot_request_approval(loading_id);
  elsif p_action = 'issue' then
    perform public.pilot_issue(loading_id);
  end if;
  return loading_id;
end;
$$;
revoke all on function public.pilot_submit_loading(jsonb, text, bigint) from public, anon;
grant execute on function public.pilot_submit_loading(jsonb, text, bigint) to authenticated;
