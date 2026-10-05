-- Laudos Agudos: dispense only reference reuse authorization for structured Agudos destinations.
-- Existing loadings, approvals, product snapshots and generic destinations are preserved.
alter table public.pilot_destinations add column reference_reuse_requires_approval boolean not null default true;
update public.pilot_destinations set reference_reuse_requires_approval=false
where id in ('agudos-mdf1','agudos-mdf2','agudos-revestidos');

create function pilot_private.requires_reuse_authorization(p_source text, p_destination_id text)
returns boolean language sql stable set search_path='' as $$
 select p_source='ref' and coalesce((
  select d.reference_reuse_requires_approval from public.pilot_destinations d where d.id=p_destination_id
 ),true)
$$;
revoke all on function pilot_private.requires_reuse_authorization(text,text) from public,anon,authenticated;

CREATE OR REPLACE FUNCTION public.pilot_request_approval(p_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare l public.pilot_loadings; c public.pilot_cycles; exceptional boolean; reuse_required boolean;
begin
  perform pilot_private.assert_permission('authorizations.request');
  select * into l from public.pilot_loadings where id=p_id for update;
  if l.id is null or l.state not in ('Rascunho','Em correção') then raise exception 'Rascunho indisponível'; end if;
  select * into c from public.pilot_cycles where id=l.cycle_id;
  exceptional := pilot_private.has_exception(c.specifications,l.values);
  reuse_required := pilot_private.requires_reuse_authorization(l.source,l.destination_id);
  if not exceptional and not reuse_required then raise exception 'Este carregamento não precisa de autorização'; end if;
  if reuse_required then
 insert into public.pilot_authorization_requests(kind,loading_id,edit_version,requester_id,requester_name,requested_at,reason)
 values('reuse',p_id,l.edit_version,auth.uid(),pilot_private.identity_name(),now(),'Uso das análises de referência do Ciclo de tanque');
 end if;
 if exceptional then
 insert into public.pilot_authorization_requests(kind,loading_id,edit_version,requester_id,requester_name,requested_at,reason)
 values('exception',p_id,l.edit_version,auth.uid(),pilot_private.identity_name(),now(),'Resultados fora da especificação: '||(select string_agg((s->>'name')||' = '||(l.values->>((ord-1)::integer)), '; ' order by ord) from jsonb_array_elements(c.specifications) with ordinality x(s,ord) where pilot_private.has_exception(jsonb_build_array(s),jsonb_build_array(l.values->((ord-1)::integer)))));
 end if;
 update public.pilot_loadings set state='Aguardando autorização',updated_at=now() where id=p_id;
  insert into public.pilot_audit(actor_id,action,entity,entity_id) values(auth.uid(),'solicitou autorização','loading',p_id);
end $function$
;

CREATE OR REPLACE FUNCTION public.pilot_issue(p_id bigint)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare l public.pilot_loadings; c public.pilot_cycles; exceptional boolean; number text; issuer_name_value text; issuer_role_value text;
begin
  perform pilot_private.assert_permission('certificates.issue');
  select * into l from public.pilot_loadings where id=p_id for update;
  if l.id is null or l.state not in ('Rascunho','Aguardando autorização') then raise exception 'Carregamento indisponível para emissão'; end if;
  select * into c from public.pilot_cycles where id=l.cycle_id;
  exceptional := pilot_private.has_exception(c.specifications,l.values);
  if exceptional and not exists(select 1 from public.pilot_approvals where loading_id=p_id and edit_version=l.edit_version and kind='exception' and decision='approved') then
    raise exception 'Falta autorização do supervisor'; end if;
  if pilot_private.requires_reuse_authorization(l.source,l.destination_id) and not exists(select 1 from public.pilot_approvals where loading_id=p_id and edit_version=l.edit_version and kind='reuse' and decision='approved') then
    raise exception 'Falta autorização da referência'; end if;
  number := to_char(now() at time zone 'America/Sao_Paulo','YYYY') || '-' || lpad(nextval('public.pilot_certificate_seq')::text,6,'0');
  select coalesce(nullif(trim(p.name), ''),u.email), p.role into issuer_name_value, issuer_role_value
    from public.pilot_profiles p left join auth.users u on u.id=p.id where p.id=auth.uid();
  update public.pilot_loadings set state='Emitido',certificate_number=number,issued_at=now(),issued_by=auth.uid(),issuer_name=issuer_name_value,issuer_role=issuer_role_value,updated_at=now() where id=p_id;
  insert into public.pilot_audit(actor_id,action,entity,entity_id,details) values(auth.uid(),'emitiu laudo','loading',p_id,jsonb_build_object('number',number));
  -- An earlier pending reuse request is retained as superseded, never deleted or approved automatically.
  if l.source='ref' and not pilot_private.requires_reuse_authorization(l.source,l.destination_id) then
    update public.pilot_authorization_requests
      set decision='superseded',
          decision_reason='Reaproveitamento dispensado de autorização para esta unidade de Agudos na emissão do laudo',
          decided_at=now()
      where loading_id=p_id and edit_version=l.edit_version and kind='reuse' and decision='pending';
  end if;
  return number;
end $function$
;

CREATE OR REPLACE FUNCTION public.pilot_decide(p_id bigint, p_kind text, p_approve boolean, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare l public.pilot_loadings; c public.pilot_cycles; needed boolean; actor_name_value text; actor_role_value text;
begin
  if p_kind='exception' then perform pilot_private.assert_permission('authorizations.exception');
  elsif p_kind='reuse' then perform pilot_private.assert_permission('authorizations.reuse');
  else raise exception 'Tipo de autorização inválido'; end if;
  if length(trim(coalesce(p_reason,'')))=0 then raise exception 'Informe uma justificativa'; end if;
  select * into l from public.pilot_loadings where id=p_id for update;
  if l.id is null or l.state<>'Aguardando autorização' then raise exception 'Autorização indisponível'; end if;
  select * into c from public.pilot_cycles where id=l.cycle_id;
  needed := case when p_kind='reuse' then pilot_private.requires_reuse_authorization(l.source,l.destination_id)
    or (l.source='ref' and exists(select 1 from public.pilot_authorization_requests r where r.loading_id=p_id and r.edit_version=l.edit_version and r.kind='reuse' and r.decision='pending'))
    else pilot_private.has_exception(c.specifications,l.values) end;
  if not needed then raise exception 'Autorização não necessária'; end if;
  select coalesce(nullif(trim(p.name), ''),u.email), p.role into actor_name_value, actor_role_value
    from public.pilot_profiles p left join auth.users u on u.id=p.id where p.id=auth.uid();
  insert into public.pilot_approvals(loading_id,edit_version,kind,decision,reason,actor_id,actor_name,actor_role)
    values(p_id,l.edit_version,p_kind,case when p_approve then 'approved' else 'rejected' end,trim(p_reason),auth.uid(),actor_name_value,actor_role_value);
  update public.pilot_authorization_requests set decision=case when p_approve then 'approved' else 'rejected' end,actor_id=auth.uid(),actor_name=actor_name_value,actor_role=actor_role_value,decision_reason=trim(p_reason),decided_at=now()
 where loading_id=p_id and edit_version=l.edit_version and kind=p_kind and decision='pending';
 if not p_approve then
 update public.pilot_authorization_requests set decision='superseded',decision_reason='Outra autorização desta versão foi rejeitada',decided_at=now() where loading_id=p_id and edit_version=l.edit_version and kind<>p_kind and decision='pending';
 end if;
 if not p_approve then update public.pilot_loadings set state='Em correção',updated_at=now() where id=p_id; end if;
  insert into public.pilot_audit(actor_id,action,entity,entity_id,details)
    values(auth.uid(),case when p_approve then 'autorizou' else 'rejeitou' end,'loading',p_id,jsonb_build_object('kind',p_kind,'reason',trim(p_reason)));
end $function$
;

-- Keep the existing public RPC ACL and permissions; the helper remains private.
revoke all on function public.pilot_request_approval(bigint),public.pilot_issue(bigint),public.pilot_decide(bigint,text,boolean,text) from public,anon;
grant execute on function public.pilot_request_approval(bigint),public.pilot_issue(bigint),public.pilot_decide(bigint,text,boolean,text) to authenticated;
notify pgrst, 'reload schema';
