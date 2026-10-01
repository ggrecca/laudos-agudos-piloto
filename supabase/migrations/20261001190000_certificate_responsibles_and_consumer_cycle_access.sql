-- Preserve responsible identities at authorization/issuance without changing business states.
alter table public.pilot_approvals add column if not exists actor_name text, add column if not exists actor_role text;
alter table public.pilot_loadings add column if not exists issuer_name text, add column if not exists issuer_role text;
CREATE OR REPLACE FUNCTION public.pilot_decide(p_id bigint, p_kind text, p_approve boolean, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare l public.pilot_loadings; c public.pilot_cycles; needed boolean; actor_name_value text; actor_role_value text;
begin
  if p_kind='exception' then perform pilot_private.assert_role(array['Supervisor','Administrador']);
  elsif p_kind='reuse' then perform pilot_private.assert_role(array['Operador Técnico','Supervisor','Administrador']);
  else raise exception 'Tipo de autorização inválido'; end if;
  if length(trim(coalesce(p_reason,'')))=0 then raise exception 'Informe uma justificativa'; end if;
  select * into l from public.pilot_loadings where id=p_id for update;
  if l.id is null or l.state<>'Aguardando autorização' then raise exception 'Autorização indisponível'; end if;
  select * into c from public.pilot_cycles where id=l.cycle_id;
  needed := case when p_kind='reuse' then l.source='ref' else pilot_private.has_exception(c.specifications,l.values) end;
  if not needed then raise exception 'Autorização não necessária'; end if;
  select nullif(trim(name), ''), role into actor_name_value, actor_role_value
    from public.pilot_profiles where id=auth.uid();
  insert into public.pilot_approvals(loading_id,edit_version,kind,decision,reason,actor_id,actor_name,actor_role)
    values(p_id,l.edit_version,p_kind,case when p_approve then 'approved' else 'rejected' end,trim(p_reason),auth.uid(),actor_name_value,actor_role_value);
  if not p_approve then update public.pilot_loadings set state='Em correção',updated_at=now() where id=p_id; end if;
  insert into public.pilot_audit(actor_id,action,entity,entity_id,details)
    values(auth.uid(),case when p_approve then 'autorizou' else 'rejeitou' end,'loading',p_id,jsonb_build_object('kind',p_kind,'reason',trim(p_reason)));
end $function$;

CREATE OR REPLACE FUNCTION public.pilot_issue(p_id bigint)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare l public.pilot_loadings; c public.pilot_cycles; exceptional boolean; number text; issuer_name_value text; issuer_role_value text;
begin
  perform pilot_private.assert_role(array['Operador A','Operador Técnico','Supervisor','Administrador']);
  select * into l from public.pilot_loadings where id=p_id for update;
  if l.id is null or l.state not in ('Rascunho','Aguardando autorização') then raise exception 'Carregamento indisponível para emissão'; end if;
  select * into c from public.pilot_cycles where id=l.cycle_id;
  exceptional := pilot_private.has_exception(c.specifications,l.values);
  if exceptional and not exists(select 1 from public.pilot_approvals where loading_id=p_id and edit_version=l.edit_version and kind='exception' and decision='approved') then
    raise exception 'Falta autorização do supervisor'; end if;
  if l.source='ref' and not exists(select 1 from public.pilot_approvals where loading_id=p_id and edit_version=l.edit_version and kind='reuse' and decision='approved') then
    raise exception 'Falta autorização da referência'; end if;
  number := to_char(now() at time zone 'America/Sao_Paulo','YYYY') || '-' || lpad(nextval('public.pilot_certificate_seq')::text,6,'0');
  select nullif(trim(name), ''), role into issuer_name_value, issuer_role_value
    from public.pilot_profiles where id=auth.uid();
  update public.pilot_loadings set state='Emitido',certificate_number=number,issued_at=now(),issued_by=auth.uid(),issuer_name=issuer_name_value,issuer_role=issuer_role_value,updated_at=now() where id=p_id;
  insert into public.pilot_audit(actor_id,action,entity,entity_id,details) values(auth.uid(),'emitiu laudo','loading',p_id,jsonb_build_object('number',number));
  return number;
end $function$;

-- Consumer access must correlate a visible issued loading to this cycle.
alter policy pilot_cycle_read on public.pilot_cycles
using (
  pilot_private.role() is not null and (
    pilot_private.role() <> 'Consulta' or exists (
      select 1 from public.pilot_loadings l
      where l.cycle_id = pilot_cycles.id and l.state = 'Emitido'
    )
  )
);

-- Minimal certificate metadata. Profiles/approval tables remain protected by their RLS.
create or replace function public.pilot_certificate_details(p_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  l public.pilot_loadings;
  caller_role text;
  result jsonb;
begin
  caller_role := pilot_private.role();
  if auth.uid() is null or caller_role is null or caller_role not in
    ('Operador A','Operador Técnico','Supervisor','Administrador','Consulta') then
    raise exception 'Acesso não autorizado' using errcode='42501';
  end if;
  select * into l from public.pilot_loadings where id=p_id;
  if l.id is null or l.state <> 'Emitido' or
    (caller_role='Consulta' and not exists (
      select 1 from public.pilot_profiles p
      where p.id=auth.uid() and p.destination=l.destination
    )) then
    raise exception 'Laudo não disponível para este usuário' using errcode='42501';
  end if;
  select jsonb_build_object(
    'loading_id', l.id, 'edit_version', l.edit_version,
    'issuer', jsonb_build_object(
      'name', coalesce(l.issuer_name,nullif(trim(p.name),''),'Responsável não identificado'),
      'role', coalesce(l.issuer_role,p.role),
      'identity_source', case when l.issuer_name is not null then 'snapshot' when p.name is not null then 'profile' else 'unavailable' end
    ),
    'approvals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'kind', a.kind, 'reason', a.reason, 'decided_at', a.decided_at,
        'name', coalesce(a.actor_name,nullif(trim(ap.name),''),'Responsável não identificado'),
        'role', coalesce(a.actor_role,ap.role),
        'identity_source', case when a.actor_name is not null then 'snapshot' when ap.name is not null then 'profile' else 'unavailable' end
      ) order by a.decided_at,a.id)
      from public.pilot_approvals a left join public.pilot_profiles ap on ap.id=a.actor_id
      where a.loading_id=l.id and a.edit_version=l.edit_version and a.decision='approved'
    ),'[]'::jsonb)
  ) into result
  from (select 1) x left join public.pilot_profiles p on p.id=l.issued_by;
  return result;
end;
$function$;
revoke all on function public.pilot_certificate_details(bigint) from public, anon;
grant execute on function public.pilot_certificate_details(bigint) to authenticated;
