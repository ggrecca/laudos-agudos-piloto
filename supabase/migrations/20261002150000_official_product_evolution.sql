-- Laudos Agudos: additive, historical data is never classified by guesswork.
create table pilot_private.permissions(role text not null, action text not null, primary key(role,action));
insert into pilot_private.permissions
select r,a from unnest(array['Consulta','Operador A','Operador Técnico','Supervisor','Administrador']) r
cross join unnest(array['records.view','products.view']) a;
insert into pilot_private.permissions select r,a from unnest(array['Operador A','Operador Técnico','Supervisor','Administrador']) r
cross join unnest(array['cycles.create','loadings.create','loadings.edit','certificates.issue','authorizations.request','authorizations.history','cancellations.request']) a;
insert into pilot_private.permissions select r,a from unnest(array['Operador Técnico','Supervisor','Administrador']) r
cross join unnest(array['cycles.close','authorizations.reuse','cancellations.decide']) a;
insert into pilot_private.permissions select r,a from unnest(array['Supervisor','Administrador']) r
cross join unnest(array['authorizations.exception','users.manage','audit.view']) a;
insert into pilot_private.permissions values ('Administrador','products.manage'),('Administrador','tanks.manage');
create function pilot_private.can(p_action text) returns boolean language sql stable security definer set search_path='' as $$
select auth.uid() is not null and exists(select 1 from pilot_private.permissions where role=pilot_private.role() and action=p_action)
$$;
create function pilot_private.assert_permission(p_action text) returns void language plpgsql security definer set search_path='' as $$
begin if not pilot_private.can(p_action) then raise exception 'Acesso não autorizado' using errcode='42501'; end if; end $$;
create function public.pilot_permissions() returns text[] language sql stable security definer set search_path='' as $$
select coalesce(array_agg(action order by action),'{}'::text[]) from pilot_private.permissions where role=pilot_private.role()
$$;
create function pilot_private.rank(p_role text) returns integer language sql immutable set search_path='' as $$
select case p_role when 'Administrador' then 5 when 'Supervisor' then 4 when 'Operador Técnico' then 3 when 'Operador A' then 2 when 'Consulta' then 1 else 0 end
$$;

create table public.pilot_destinations (
 id text primary key, name text not null unique, site text not null, sector text not null,
 active boolean not null default true, display_order integer not null,
 unique(site,sector)
);
insert into public.pilot_destinations(id,name,site,sector,display_order) values
('agudos-mdf1','Agudos - MDF1','Agudos','MDF1',1),
('agudos-mdf2','Agudos - MDF2','Agudos','MDF2',2),
('agudos-revestidos','Agudos - Revestidos','Agudos','Revestidos',3),
('itapetininga-mdf','Itapetininga - MDF','Itapetininga','MDF',4),
('itapetininga-mdp','Itapetininga - MDP','Itapetininga','MDP',5),
('itapetininga-revestidos','Itapetininga - Revestidos','Itapetininga','Revestidos',6),
('uberaba-mdf','Uberaba - MDF','Uberaba','MDF',7),
('uberaba-mdp','Uberaba - MDP','Uberaba','MDP',8),
('uberaba-revestidos','Uberaba - Revestidos','Uberaba','Revestidos',9),
('taquari-mdp','Taquari - MDP','Taquari','MDP',10),
('taquari-revestidos','Taquari - Revestidos','Taquari','Revestidos',11);
alter table public.pilot_loadings add column destination_id text references public.pilot_destinations(id);
-- Only exact matches, original display text is retained.
update public.pilot_loadings l set destination_id=d.id from public.pilot_destinations d where l.destination=d.name;
create index pilot_loadings_destination_id_idx on public.pilot_loadings(destination_id,loaded_at desc);

create table public.pilot_product_versions (
 product_id bigint not null references public.pilot_products(id), version integer not null check(version>0),
 data jsonb not null check(jsonb_typeof(data)='object'),
 author_id uuid references auth.users(id), author_name text,
 changed_at timestamptz, captured_at timestamptz not null default now(),
 provenance text not null check(provenance in ('recorded','legacy_capture','legacy_specification')),
 changes jsonb not null default '{}'::jsonb,
 primary key(product_id,version)
);
insert into public.pilot_product_versions(product_id,version,data,provenance)
select id,version,jsonb_build_object('code',code,'name',name,'family',family,'specifications',specifications,'active',active),'legacy_capture'
from public.pilot_products;
-- Older versions, if present, retain known specifications only. Unknown authors/dates/names are NOT fabricated.
insert into public.pilot_product_versions(product_id,version,data,provenance)
select distinct on(c.product_id,c.specification_version) c.product_id,c.specification_version,
 jsonb_build_object('specifications',c.specifications),'legacy_specification'
from public.pilot_cycles c where not exists(select 1 from public.pilot_product_versions v where v.product_id=c.product_id and v.version=c.specification_version)
order by c.product_id,c.specification_version,c.id;
alter table public.pilot_cycles add column product_snapshot jsonb;
alter table public.pilot_cycles add column snapshot_provenance text not null default 'recorded';
update public.pilot_cycles c set product_snapshot=jsonb_build_object('code',p.code,'name',p.name,'family',p.family,'specifications',c.specifications,'version',c.specification_version),snapshot_provenance='legacy_capture'
from public.pilot_products p where p.id=c.product_id;
alter table public.pilot_cycles add constraint pilot_cycles_product_version_fkey foreign key(product_id,specification_version) references public.pilot_product_versions(product_id,version);
create unique index pilot_products_normalized_code_key on public.pilot_products(lower(btrim(code)));
create index pilot_product_versions_author_id_idx on public.pilot_product_versions(author_id);
create index pilot_cycles_product_version_idx on public.pilot_cycles(product_id,specification_version);

alter table public.pilot_cycles add column status text;
alter table public.pilot_cycles add column closed_at timestamptz;
alter table public.pilot_cycles add column closed_by uuid references auth.users(id);
update public.pilot_cycles set status=case when active then 'Ativo' else 'Encerrado' end;
alter table public.pilot_cycles alter column status set default 'Ativo';
alter table public.pilot_cycles alter column status set not null;
alter table public.pilot_cycles add constraint pilot_cycles_status_check check(status in ('Ativo','Encerrado','Cancelado') and active=(status='Ativo'));
create index pilot_cycles_status_created_at_idx on public.pilot_cycles(status,created_at desc);
create index pilot_cycles_closed_by_idx on public.pilot_cycles(closed_by);

create table public.pilot_authorization_requests (
 id bigint generated always as identity primary key,
 kind text not null check(kind in ('reuse','exception','cancel_cycle','cancel_certificate')),
 cycle_id bigint references public.pilot_cycles(id), loading_id bigint references public.pilot_loadings(id),
 edit_version integer,
 requester_id uuid references auth.users(id), requester_name text, requested_at timestamptz,
 reason text not null check(length(btrim(reason))>0),
 decision text not null default 'pending' check(decision in ('pending','approved','rejected','superseded')),
 actor_id uuid references auth.users(id), actor_name text, actor_role text,
 decision_reason text, decided_at timestamptz,
 legacy boolean not null default false,
 check((kind='cancel_cycle' and cycle_id is not null and loading_id is null) or (kind<>'cancel_cycle' and loading_id is not null and cycle_id is null)),
 check((decision='pending' and actor_id is null and decided_at is null) or decision<>'pending')
);
create unique index pilot_authorization_pending_object on public.pilot_authorization_requests(kind,coalesce(cycle_id,loading_id),coalesce(edit_version,0)) where decision='pending';
create index pilot_authorization_loading_idx on public.pilot_authorization_requests(loading_id,edit_version);
create index pilot_authorization_cycle_idx on public.pilot_authorization_requests(cycle_id);
create index pilot_authorization_requester_idx on public.pilot_authorization_requests(requester_id);
create index pilot_authorization_actor_idx on public.pilot_authorization_requests(actor_id);
create index pilot_authorization_history_idx on public.pilot_authorization_requests(decision,requested_at desc);
-- Reconstruct old decisions from recorded data, request time is nullable when no audit evidence exists.
insert into public.pilot_authorization_requests(kind,loading_id,edit_version,requester_id,requester_name,requested_at,reason,decision,actor_id,actor_name,actor_role,decision_reason,decided_at,legacy)
select a.kind,a.loading_id,a.edit_version,q.actor_id,coalesce(nullif(p.name,''),u.email),q.occurred_at,
case when a.kind='reuse' then 'Uso das análises de referência do Ciclo de tanque' else 'Resultado fora da especificação' end,
a.decision,a.actor_id,coalesce(a.actor_name,nullif(ap.name,''),au.email),coalesce(a.actor_role,ap.role),a.reason,a.decided_at,true
from public.pilot_approvals a
left join lateral(select actor_id,occurred_at from public.pilot_audit where entity='loading' and entity_id=a.loading_id and action='solicitou autorização' and occurred_at<=a.decided_at order by occurred_at desc limit 1)q on true
left join public.pilot_profiles p on p.id=q.actor_id left join auth.users u on u.id=q.actor_id
left join public.pilot_profiles ap on ap.id=a.actor_id left join auth.users au on au.id=a.actor_id;

insert into public.pilot_authorization_requests(kind,loading_id,edit_version,requester_id,requester_name,requested_at,reason,legacy)
select k.kind,l.id,l.edit_version,q.actor_id,coalesce(nullif(p.name,''),u.email),q.occurred_at,
case when k.kind='reuse' then 'Uso das análises de referência do Ciclo de tanque' else 'Resultado fora da especificação' end,true
from public.pilot_loadings l join public.pilot_cycles c on c.id=l.cycle_id
cross join lateral(select 'reuse'::text kind where l.source='ref' union all select 'exception' where pilot_private.has_exception(c.specifications,l.values)) k
left join lateral(select actor_id,occurred_at from public.pilot_audit where entity='loading' and entity_id=l.id and action='solicitou autorização' order by occurred_at desc limit 1)q on true
left join public.pilot_profiles p on p.id=q.actor_id left join auth.users u on u.id=q.actor_id
where l.state='Aguardando autorização' and not exists(select 1 from public.pilot_approvals a where a.loading_id=l.id and a.edit_version=l.edit_version and a.kind=k.kind);
create function pilot_private.identity_name() returns text language sql stable security definer set search_path='' as $$
select coalesce(nullif(trim(p.name),''),u.email) from public.pilot_profiles p join auth.users u on u.id=p.id where p.id=auth.uid()
$$;

create function pilot_private.product_version() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.pilot_product_versions(product_id,version,data,author_id,author_name,changed_at,provenance,changes)
 values(new.id,new.version,jsonb_build_object('code',new.code,'name',new.name,'family',new.family,'specifications',new.specifications,'active',new.active),
 auth.uid(),pilot_private.identity_name(),now(),'recorded',jsonb_build_object('before',case when tg_op='UPDATE' then to_jsonb(old) else null end,'after',to_jsonb(new)));
 return new;
end $$;
create trigger pilot_product_version_record after insert or update on public.pilot_products for each row execute function pilot_private.product_version();

create function public.pilot_set_product_active(p_id bigint,p_active boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 perform pilot_private.assert_permission('products.manage');
 update public.pilot_products set active=p_active,version=version+1 where id=p_id and active is distinct from p_active;
 if not found and not exists(select 1 from public.pilot_products where id=p_id) then raise exception 'Produto não encontrado'; end if;
end $$;

create function public.pilot_list_users() returns table(id uuid,name text,email text,role text,status text,active boolean,created_at timestamptz) language sql stable security definer set search_path='' as $$
select p.id,p.name,u.email,p.role,p.status,p.active,p.created_at from public.pilot_profiles p join auth.users u on u.id=p.id
where pilot_private.can('users.manage') and (pilot_private.role()='Administrador' or pilot_private.rank(p.role)<pilot_private.rank(pilot_private.role()))
order by p.name,p.created_at
$$;
create function public.pilot_update_user(p_id uuid,p_name text,p_role text,p_status text,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare p public.pilot_profiles; actor text:=pilot_private.role();
begin
 perform pilot_private.assert_permission('users.manage');
 perform pg_advisory_xact_lock(hashtext('laudos_agudos_user_administration'));
 select * into p from public.pilot_profiles where id=p_id for update;
 if p.id is null then raise exception 'Usuário não encontrado'; end if;
 if p_id=auth.uid() and (p_role is distinct from p.role or p_status is distinct from p.status) then raise exception 'Não é permitido alterar o próprio perfil ou situação de acesso'; end if;
 if actor<>'Administrador' and (pilot_private.rank(p.role)>=pilot_private.rank(actor) or pilot_private.rank(p_role)>=pilot_private.rank(actor)) then raise exception 'Só é permitido administrar perfis abaixo do seu' using errcode='42501'; end if;
 if pilot_private.rank(p_role)=0 or p_status not in ('Ativo','Bloqueado','Rejeitado') or length(trim(coalesce(p_name,'')))<3 or length(trim(coalesce(p_reason,'')))<3 then raise exception 'Informe nome, perfil, situação e motivo da alteração'; end if;
 if p.role='Administrador' and p.active and (p_role<>'Administrador' or p_status<>'Ativo') and (select count(*) from public.pilot_profiles where role='Administrador' and active and status='Ativo')<=1 then raise exception 'Preserve ao menos um Administrador ativo'; end if;
 update public.pilot_profiles set name=trim(p_name),role=p_role,status=p_status,active=(p_status='Ativo'),approved_by=auth.uid(),approved_at=now(),decision_reason=trim(p_reason) where id=p_id;
 insert into public.pilot_audit(actor_id,action,entity,entity_id,details) values(auth.uid(),'alterou usuário','user',0,jsonb_build_object('user_id',p_id,'before',to_jsonb(p),'after',(select to_jsonb(x) from public.pilot_profiles x where id=p_id),'reason',trim(p_reason)));
end $$;

create function public.pilot_request_cancellation(p_kind text,p_id bigint,p_reason text) returns bigint language plpgsql security definer set search_path='' as $$
declare result bigint; c public.pilot_cycles; l public.pilot_loadings;
begin
 perform pilot_private.assert_permission('cancellations.request');
 if length(trim(coalesce(p_reason,'')))<3 then raise exception 'Informe o motivo do cancelamento'; end if;
 if p_kind='cancel_cycle' then
  select * into c from public.pilot_cycles where id=p_id for update;
  if c.id is null or c.status<>'Ativo' then raise exception 'Somente um Ciclo de tanque ativo pode ser cancelado'; end if;
  if exists(select 1 from public.pilot_loadings where cycle_id=p_id) then raise exception 'Este Ciclo de tanque possui carregamentos vinculados e não pode ser cancelado'; end if;
 elsif p_kind='cancel_certificate' then
  select * into l from public.pilot_loadings where id=p_id for update;
  if l.id is null or l.state<>'Emitido' then raise exception 'Somente um laudo emitido pode ser cancelado'; end if;
 else raise exception 'Tipo de cancelamento inválido'; end if;
 insert into public.pilot_authorization_requests(kind,cycle_id,loading_id,edit_version,requester_id,requester_name,requested_at,reason)
 values(p_kind,case when p_kind='cancel_cycle' then p_id end,case when p_kind='cancel_certificate' then p_id end,l.edit_version,auth.uid(),pilot_private.identity_name(),now(),trim(p_reason)) returning id into result;
 return result;
exception when unique_violation then raise exception 'Já existe uma solicitação de cancelamento pendente'; end $$;

create function public.pilot_decide_cancellation(p_request_id bigint,p_approve boolean,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare r public.pilot_authorization_requests; c public.pilot_cycles; l public.pilot_loadings;
begin
 perform pilot_private.assert_permission('cancellations.decide');
 if length(trim(coalesce(p_reason,'')))<3 then raise exception 'Informe a justificativa da decisão'; end if;
 -- Lock the object before the request, consistent with request/create-loading.
 select * into r from public.pilot_authorization_requests where id=p_request_id;
 if r.kind='cancel_cycle' then
  select * into c from public.pilot_cycles where id=r.cycle_id for update;
 elsif r.kind='cancel_certificate' then
  select * into l from public.pilot_loadings where id=r.loading_id for update;
 else raise exception 'Solicitação de cancelamento não encontrada'; end if;
 select * into r from public.pilot_authorization_requests where id=p_request_id for update;
 if r.decision<>'pending' then raise exception 'Esta solicitação já foi decidida'; end if;
 if p_approve and r.kind='cancel_cycle' then
  if c.status<>'Ativo' or exists(select 1 from public.pilot_loadings where cycle_id=c.id) then raise exception 'Ciclo de tanque indisponível ou com carregamentos vinculados'; end if;
  update public.pilot_cycles set active=false,status='Cancelado' where id=c.id;
 elsif p_approve then
  if l.state<>'Emitido' then raise exception 'Laudo indisponível para cancelamento'; end if;
  update public.pilot_loadings set state='Cancelado',updated_at=now() where id=l.id;
 end if;
 update public.pilot_authorization_requests set decision=case when p_approve then 'approved' else 'rejected' end,
 actor_id=auth.uid(),actor_name=pilot_private.identity_name(),actor_role=pilot_private.role(),decision_reason=trim(p_reason),decided_at=now() where id=r.id;
end $$;

create function pilot_private.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is not null then
 insert into public.pilot_audit(actor_id,action,entity,entity_id,details)
 values(auth.uid(),lower(tg_op),tg_table_name,new.id,jsonb_build_object('before',case when tg_op='UPDATE' then to_jsonb(old) else null end,'after',to_jsonb(new)));
 end if; return new;
end $$;
create trigger pilot_products_audit after insert or update on public.pilot_products for each row execute function pilot_private.audit_change();
create trigger pilot_cycles_audit after insert or update on public.pilot_cycles for each row execute function pilot_private.audit_change();
create trigger pilot_loadings_audit after insert or update on public.pilot_loadings for each row execute function pilot_private.audit_change();
create trigger pilot_requests_audit after insert or update on public.pilot_authorization_requests for each row execute function pilot_private.audit_change();

alter table public.pilot_destinations enable row level security;
alter table public.pilot_product_versions enable row level security;
alter table public.pilot_authorization_requests enable row level security;
grant select on public.pilot_destinations,public.pilot_product_versions,public.pilot_authorization_requests to authenticated;
create policy pilot_destination_read on public.pilot_destinations for select to authenticated using(pilot_private.can('records.view'));
create policy pilot_version_read on public.pilot_product_versions for select to authenticated using(pilot_private.can('products.view'));
create policy pilot_request_read on public.pilot_authorization_requests for select to authenticated using(
 pilot_private.can('authorizations.history') or (pilot_private.can('records.view') and loading_id is not null and exists(select 1 from public.pilot_loadings l where l.id=loading_id and l.certificate_number is not null)));
alter policy pilot_loading_read on public.pilot_loadings using(
 pilot_private.can('records.view') and (pilot_private.role()<>'Consulta' or (certificate_number is not null and state in ('Emitido','Cancelado'))));
alter policy pilot_cycle_read on public.pilot_cycles using(
 pilot_private.can('records.view') and (pilot_private.role()<>'Consulta' or exists(select 1 from public.pilot_loadings l where l.cycle_id=pilot_cycles.id and l.certificate_number is not null and l.state in ('Emitido','Cancelado'))));
alter policy pilot_approval_read on public.pilot_approvals using(pilot_private.can('authorizations.history'));

create function pilot_private.freeze_certificate() returns trigger language plpgsql set search_path='' as $$
begin
 if old.certificate_number is not null and (
  (to_jsonb(new)-array['state','updated_at']) is distinct from (to_jsonb(old)-array['state','updated_at']) or
  not (new.state=old.state or (old.state='Emitido' and new.state='Cancelado'))) then
 raise exception 'Laudo emitido é imutável. Solicite o cancelamento e registre o carregamento correto.'; end if;
 return new;
end $$;
create trigger pilot_certificate_immutable before update on public.pilot_loadings for each row execute function pilot_private.freeze_certificate();

create function pilot_private.destination_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare d public.pilot_destinations;
begin
 if tg_op='UPDATE' and new.destination=old.destination and old.destination_id is null then return new; end if;
 select * into d from public.pilot_destinations where active and (id=new.destination or name=new.destination);
 if d.id is null then raise exception 'Selecione uma unidade receptora válida'; end if;
 new.destination_id:=d.id; new.destination:=d.name; return new;
end $$;
create trigger pilot_destination_guard before insert or update of destination on public.pilot_loadings for each row execute function pilot_private.destination_guard();

CREATE OR REPLACE FUNCTION public.pilot_save_product(p_code text, p_name text, p_family text, p_specs jsonb, p_id bigint DEFAULT NULL::bigint)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result_id bigint;
begin
  perform pilot_private.assert_permission('products.manage');
  if length(trim(p_code)) < 2 or length(trim(p_name)) < 2 or p_family not in ('Resina','Emulsão')
    or jsonb_typeof(p_specs) <> 'array' or jsonb_array_length(p_specs) = 0 then
    raise exception 'Produto ou especificação inválida';
  end if;
  if exists(select 1 from public.pilot_products where lower(trim(code))=lower(trim(p_code)) and id is distinct from p_id) then
 raise exception 'Este código já pertence a outro produto. Abra o cadastro existente.' using errcode='23505';
 end if;
 if exists(select 1 from jsonb_array_elements(p_specs) s where length(trim(coalesce(s->>'name','')))=0 or (s ? 'min' and s ? 'max' and (s->>'min')::numeric>(s->>'max')::numeric) or (s ? 'qual' and (jsonb_typeof(s->'qual')<>'array' or jsonb_array_length(s->'qual')=0))) then raise exception 'Revise os nomes e limites das análises'; end if;
 if p_id is null then
    insert into public.pilot_products(code,name,family,specifications) values(trim(p_code),trim(p_name),p_family,p_specs) returning id into result_id;
  else
    update public.pilot_products set code=trim(p_code),name=trim(p_name),family=p_family,specifications=p_specs,version=version+1
      where id=p_id returning id into result_id;
    if result_id is null then raise exception 'Produto não encontrado'; end if;
  end if;
  insert into public.pilot_audit(actor_id,action,entity,entity_id) values(auth.uid(),'salvou produto','product',result_id);
  return result_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.pilot_save_tank(p_code text, p_family text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result_id bigint;
begin
  perform pilot_private.assert_permission('tanks.manage');
  if length(trim(p_code)) < 2 or p_family not in ('Resina','Emulsão') then raise exception 'Tanque inválido'; end if;
  insert into public.pilot_tanks(code,family) values(trim(p_code),p_family) returning id into result_id;
  insert into public.pilot_audit(actor_id,action,entity,entity_id) values(auth.uid(),'cadastrou tanque','tank',result_id);
  return result_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.pilot_update_tank(p_id bigint, p_code text, p_family text, p_active boolean)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare old public.pilot_tanks; normalized text := upper(trim(coalesce(p_code,'')));
begin
  perform pilot_private.assert_permission('tanks.manage');
  if length(normalized)<2 or p_family is null or p_family not in ('Resina','Emulsão') or p_active is null then raise exception 'Informe código, família e situação válidos.'; end if;
  select * into old from public.pilot_tanks where id=p_id for update;
  if old.id is null then raise exception 'Tanque não encontrado. Atualize a lista.'; end if;
  if exists(select 1 from public.pilot_tanks where id<>p_id and upper(trim(code))=normalized) then raise exception 'Já existe um tanque com este código.'; end if;
  if (old.code<>normalized or old.family<>p_family) and exists(select 1 from public.pilot_cycles where tank_id=p_id) then raise exception 'Código e família protegidos: o tanque possui histórico de ciclos.'; end if;
  if not p_active and exists(select 1 from public.pilot_cycles where tank_id=p_id and active) then raise exception 'Encerre o Ciclo de tanque ativo antes de desativar o tanque.'; end if;
  update public.pilot_tanks set code=normalized,family=p_family,active=p_active where id=p_id;
  insert into public.pilot_audit(actor_id,action,entity,entity_id,details)
  values(auth.uid(),'editou tanque','tank',p_id,jsonb_build_object('before',to_jsonb(old),'after',jsonb_build_object('code',normalized,'family',p_family,'active',p_active)));
  return p_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.pilot_delete_tank(p_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare old public.pilot_tanks;
begin
  perform pilot_private.assert_permission('tanks.manage');
  select * into old from public.pilot_tanks where id=p_id for update;
  if old.id is null then raise exception 'Tanque não encontrado. Atualize a lista.'; end if;
  if exists(select 1 from public.pilot_cycles where tank_id=p_id) then raise exception 'Tanque com histórico não pode ser excluído. Desative o cadastro.'; end if;
  delete from public.pilot_tanks where id=p_id;
  insert into public.pilot_audit(actor_id,action,entity,entity_id,details)
  values(auth.uid(),'excluiu tanque','tank',p_id,to_jsonb(old));
end $function$
;

CREATE OR REPLACE FUNCTION public.pilot_create_cycle(p_tank_id bigint, p_product_id bigint, p_manufactured_at timestamp with time zone, p_lots text, p_reference jsonb, p_analyst text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare t public.pilot_tanks; p public.pilot_products; result_id bigint;
begin
  perform pilot_private.assert_permission('cycles.create');
  select * into t from public.pilot_tanks where id=p_tank_id and active;
  select * into p from public.pilot_products where id=p_product_id and active for share;
  if t.id is null or p.id is null or t.family <> p.family then raise exception 'Tanque e produto incompatíveis'; end if;
  if length(trim(coalesce(p_lots,''))) = 0 or length(trim(coalesce(p_analyst,''))) = 0 or p_manufactured_at is null then raise exception 'Complete o Ciclo de tanque'; end if;
  perform pilot_private.has_exception(p.specifications,p_reference);
  insert into public.pilot_cycles(tank_id,product_id,specifications,specification_version,manufactured_at,lots,reference_values,analyst,created_by,product_snapshot)
    values(t.id,p.id,p.specifications,p.version,p_manufactured_at,trim(p_lots),p_reference,trim(p_analyst),auth.uid(),jsonb_build_object('code',p.code,'name',p.name,'family',p.family,'specifications',p.specifications,'version',p.version)) returning id into result_id;
  insert into public.pilot_audit(actor_id,action,entity,entity_id) values(auth.uid(),'criou Ciclo de tanque','cycle',result_id);
  return result_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.pilot_close_cycle(p_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform pilot_private.assert_permission('cycles.close');
 if exists(select 1 from public.pilot_authorization_requests where cycle_id=p_id and decision='pending') then raise exception 'Decida o cancelamento pendente antes de encerrar o Ciclo de tanque'; end if;
  if exists(select 1 from public.pilot_loadings where cycle_id=p_id and state in ('Rascunho','Aguardando autorização','Em correção')) then
    raise exception 'Há carregamentos pendentes neste Ciclo de tanque'; end if;
  update public.pilot_cycles set active=false,status='Encerrado',closed_at=now(),closed_by=auth.uid() where id=p_id and active;
  if not found then raise exception 'Ciclo de tanque ativo não encontrado'; end if;
  insert into public.pilot_audit(actor_id,action,entity,entity_id) values(auth.uid(),'fechou Ciclo de tanque','cycle',p_id);
end $function$
;

CREATE OR REPLACE FUNCTION public.pilot_create_loading(p_cycle_id bigint, p_plate text, p_trailer text, p_carrier text, p_destination text, p_analyst text, p_loaded_at timestamp with time zone, p_values jsonb, p_source text, p_observation text DEFAULT ''::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.pilot_cycles; result_id bigint;
begin
  perform pilot_private.assert_permission('loadings.create');
  select * into c from public.pilot_cycles where id=p_cycle_id and active for update;
  if exists(select 1 from public.pilot_authorization_requests where cycle_id=p_cycle_id and kind='cancel_cycle' and decision='pending') then raise exception 'Há um cancelamento pendente deste Ciclo de tanque'; end if;
 if c.id is null then raise exception 'Ciclo de tanque não está ativo'; end if;
 perform 1 from public.pilot_products where id=c.product_id and active for share;
 if not found then raise exception 'Produto inativo: novos carregamentos não são permitidos'; end if;
  if p_source not in ('own','ref') or p_loaded_at is null or
    length(trim(coalesce(p_plate,''))) < 7 or length(trim(coalesce(p_trailer,''))) = 0 or
    length(trim(coalesce(p_carrier,''))) = 0 or length(trim(coalesce(p_destination,''))) = 0 or
    length(trim(coalesce(p_analyst,''))) = 0 then raise exception 'Complete os dados do carregamento'; end if;
  if jsonb_typeof(p_values) <> 'array' or jsonb_array_length(p_values) <> jsonb_array_length(c.specifications) then raise exception 'Resultados incompletos'; end if;
  if p_source='ref' and p_values <> c.reference_values then raise exception 'Resultados de referência divergentes'; end if;
  insert into public.pilot_loadings(cycle_id,plate,trailer,carrier,destination,analyst,loaded_at,values,source,observation,created_by)
    values(c.id,upper(trim(p_plate)),trim(p_trailer),trim(p_carrier),trim(p_destination),trim(p_analyst),p_loaded_at,p_values,p_source,coalesce(p_observation,''),auth.uid()) returning id into result_id;
  insert into public.pilot_audit(actor_id,action,entity,entity_id) values(auth.uid(),'criou rascunho','loading',result_id);
  return result_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.pilot_save_loading(p_id bigint, p_plate text, p_trailer text, p_carrier text, p_destination text, p_analyst text, p_loaded_at timestamp with time zone, p_values jsonb, p_source text, p_observation text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare l public.pilot_loadings; c public.pilot_cycles;
begin
  perform pilot_private.assert_permission('loadings.edit');
  select * into l from public.pilot_loadings where id=p_id for update;
  if l.id is null or l.state not in ('Rascunho','Em correção') then raise exception 'Carregamento não pode ser editado'; end if;
  select * into c from public.pilot_cycles where id=l.cycle_id;
 if not c.active then raise exception 'Ciclo de tanque encerrado ou cancelado'; end if;
 update public.pilot_authorization_requests set decision='superseded',decision_reason='Rascunho alterado: solicitação substituída',decided_at=now() where loading_id=p_id and decision='pending' and kind in ('reuse','exception');
  if p_source not in ('own','ref') or p_loaded_at is null or length(trim(coalesce(p_plate,''))) < 7
    or length(trim(coalesce(p_trailer,'')))=0 or length(trim(coalesce(p_carrier,'')))=0
    or length(trim(coalesce(p_destination,'')))=0 or length(trim(coalesce(p_analyst,'')))=0
    or jsonb_typeof(p_values)<>'array' or jsonb_array_length(p_values)<>jsonb_array_length(c.specifications) then
    raise exception 'Dados incompletos'; end if;
  if p_source='ref' and p_values<>c.reference_values then raise exception 'Resultados de referência divergentes'; end if;
  update public.pilot_loadings set plate=upper(trim(p_plate)),trailer=trim(p_trailer),carrier=trim(p_carrier),destination=trim(p_destination),
    analyst=trim(p_analyst),loaded_at=p_loaded_at,values=p_values,source=p_source,observation=coalesce(p_observation,''),
    state='Rascunho',edit_version=edit_version+1,updated_at=now() where id=p_id;
  insert into public.pilot_audit(actor_id,action,entity,entity_id) values(auth.uid(),'editou rascunho','loading',p_id);
end $function$
;

CREATE OR REPLACE FUNCTION public.pilot_request_approval(p_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare l public.pilot_loadings; c public.pilot_cycles; exceptional boolean;
begin
  perform pilot_private.assert_permission('authorizations.request');
  select * into l from public.pilot_loadings where id=p_id for update;
  if l.id is null or l.state not in ('Rascunho','Em correção') then raise exception 'Rascunho indisponível'; end if;
  select * into c from public.pilot_cycles where id=l.cycle_id;
  exceptional := pilot_private.has_exception(c.specifications,l.values);
  if not exceptional and l.source<>'ref' then raise exception 'Este carregamento não precisa de autorização'; end if;
  if l.source='ref' then
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
  if l.source='ref' and not exists(select 1 from public.pilot_approvals where loading_id=p_id and edit_version=l.edit_version and kind='reuse' and decision='approved') then
    raise exception 'Falta autorização da referência'; end if;
  number := to_char(now() at time zone 'America/Sao_Paulo','YYYY') || '-' || lpad(nextval('public.pilot_certificate_seq')::text,6,'0');
  select coalesce(nullif(trim(p.name), ''),u.email), p.role into issuer_name_value, issuer_role_value
    from public.pilot_profiles p left join auth.users u on u.id=p.id where p.id=auth.uid();
  update public.pilot_loadings set state='Emitido',certificate_number=number,issued_at=now(),issued_by=auth.uid(),issuer_name=issuer_name_value,issuer_role=issuer_role_value,updated_at=now() where id=p_id;
  insert into public.pilot_audit(actor_id,action,entity,entity_id,details) values(auth.uid(),'emitiu laudo','loading',p_id,jsonb_build_object('number',number));
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
  needed := case when p_kind='reuse' then l.source='ref' else pilot_private.has_exception(c.specifications,l.values) end;
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

CREATE OR REPLACE FUNCTION public.pilot_decide_profile(p_user_id uuid, p_approve boolean, p_role text DEFAULT NULL::text, p_destination text DEFAULT NULL::text, p_reason text DEFAULT ''::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_role text;
  current_status text;
  current_role text;
  current_destination text;
  next_destination text;
begin
  actor_role := pilot_private.role();
  if not pilot_private.can('users.manage') then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'Não é permitido decidir o próprio acesso';
  end if;

  select status, role, destination
    into current_status, current_role, current_destination
    from public.pilot_profiles
    where id = p_user_id
    for update;
  if current_status is null then
    raise exception 'Solicitação de acesso não encontrada';
  end if;
  if actor_role<>'Administrador' and pilot_private.rank(current_role)>=pilot_private.rank(actor_role) then raise exception 'Acesso não autorizado' using errcode='42501'; end if;
 if current_status <> 'Pendente' then
    raise exception 'Esta solicitação já foi avaliada';
  end if;

  if p_approve then
    if p_role not in ('Consulta','Operador A','Operador Técnico','Supervisor','Administrador') then
      raise exception 'Perfil inválido para aprovação';
    end if;
    if actor_role = 'Supervisor' and pilot_private.rank(p_role)>=pilot_private.rank(actor_role) then
      raise exception 'Supervisor não pode atribuir perfil de Supervisor';
    end if;
    next_destination := current_destination;
    -- Consulta is global; the old destination column remains as historical data.



    update public.pilot_profiles
      set role = p_role,
          destination = next_destination,
          active = true,
          status = 'Ativo',
          approved_by = (select auth.uid()),
          approved_at = now(),
          decision_reason = trim(coalesce(p_reason,''))
      where id = p_user_id;

    insert into public.pilot_profile_audit(
      user_id, actor_id, action, from_status, to_status, from_role,
      to_role, from_destination, to_destination, reason
    ) values (
      p_user_id, (select auth.uid()), 'aprovou usuário', current_status, 'Ativo',
      current_role, p_role, current_destination, next_destination,
      trim(coalesce(p_reason,''))
    );
  else
    if length(trim(coalesce(p_reason,''))) < 3 then
      raise exception 'Informe o motivo da rejeição';
    end if;
    update public.pilot_profiles
      set active = false,
          status = 'Rejeitado',
          approved_by = (select auth.uid()),
          approved_at = now(),
          decision_reason = trim(p_reason)
      where id = p_user_id;

    insert into public.pilot_profile_audit(
      user_id, actor_id, action, from_status, to_status, from_role,
      to_role, from_destination, to_destination, reason
    ) values (
      p_user_id, (select auth.uid()), 'rejeitou usuário', current_status, 'Rejeitado',
      current_role, current_role, current_destination, current_destination,
      trim(p_reason)
    );
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.pilot_certificate_details(p_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if l.id is null or l.certificate_number is null or l.state not in ('Emitido','Cancelado') then
    raise exception 'Laudo não disponível para este usuário' using errcode='42501';
  end if;
  select jsonb_build_object(
    'loading_id', l.id, 'edit_version', l.edit_version,
    'issuer', jsonb_build_object(
      'name', coalesce(l.issuer_name,nullif(trim(p.name),''),u.email,'Responsável não identificado'),
      'role', coalesce(l.issuer_role,p.role),
      'identity_source', case when l.issuer_name is not null then 'snapshot' when nullif(trim(p.name),'') is not null then 'profile' when u.email is not null then 'account' else 'unavailable' end
    ),
    'approvals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'kind', a.kind, 'reason', a.reason, 'decided_at', a.decided_at,
        'name', coalesce(a.actor_name,nullif(trim(ap.name),''),au.email,'Responsável não identificado'),
        'role', coalesce(a.actor_role,ap.role),
        'identity_source', case when a.actor_name is not null then 'snapshot' when nullif(trim(ap.name),'') is not null then 'profile' when au.email is not null then 'account' else 'unavailable' end
      ) order by a.decided_at,a.id)
      from public.pilot_approvals a left join public.pilot_profiles ap on ap.id=a.actor_id left join auth.users au on au.id=a.actor_id
      where a.loading_id=l.id and a.edit_version=l.edit_version and a.decision='approved'
    ),'[]'::jsonb)
  ) into result
  from (select 1) x left join public.pilot_profiles p on p.id=l.issued_by left join auth.users u on u.id=l.issued_by;
  return result;
end;
$function$
;
do $privileges$ declare f record; begin
 for f in select p.oid::regprocedure as signature,n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='pilot_private' or (n.nspname='public' and p.proname like 'pilot_%') loop
 execute format('revoke all on function %s from public, anon',f.signature);
 if f.nspname='public' then execute format('grant execute on function %s to authenticated',f.signature); end if;
 end loop;
end $privileges$;
revoke all on pilot_private.permissions from public,anon,authenticated;
revoke insert,update,delete on public.pilot_destinations,public.pilot_product_versions,public.pilot_authorization_requests from public,anon,authenticated;

notify pgrst, 'reload schema';

grant execute on function pilot_private.can(text) to authenticated;

CREATE OR REPLACE FUNCTION public.pilot_list_pending_profiles()
 RETURNS TABLE(id uuid, name text, email text, role text, status text, destination text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p.id, p.name, u.email, p.role, p.status, p.destination, p.created_at
  from public.pilot_profiles p
  join auth.users u on u.id = p.id
  where pilot_private.can('users.manage') and (pilot_private.role()='Administrador' or pilot_private.rank(p.role)<pilot_private.rank(pilot_private.role()))
    and p.status = 'Pendente'
    and p.active = false
  order by p.created_at asc
$function$
;

revoke all on public.pilot_destinations,public.pilot_product_versions,public.pilot_authorization_requests from public,anon,authenticated;
grant select on public.pilot_destinations,public.pilot_product_versions,public.pilot_authorization_requests to authenticated;

CREATE OR REPLACE FUNCTION pilot_private.has_exception(specs jsonb, vals jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare i integer; s jsonb; v text; n numeric; abnormal boolean := false;
begin
  if jsonb_typeof(specs) <> 'array' or jsonb_array_length(specs) = 0
    or jsonb_typeof(vals) <> 'array' or jsonb_array_length(vals) <> jsonb_array_length(specs) then
    raise exception 'Resultados ou especificações incompletos';
  end if;
  for i in 0..jsonb_array_length(specs)-1 loop
    s := specs->i; v := trim(vals->>i);
    if coalesce(s->>'name','') = '' then raise exception 'Especificação sem nome'; end if;
    if coalesce(v,'') = '' then
      if coalesce((s->>'required')::boolean,true) then raise exception 'Análise obrigatória ausente: %', s->>'name'; end if;
      continue;
    end if;
    if s ? 'qual' then
      if not exists (select 1 from jsonb_array_elements_text(s->'qual') allowed where allowed = v) then abnormal := true; end if;
    else
      if v !~* '^[+-]?([0-9]+([.,][0-9]*)?|[.,][0-9]+)(e[+-]?[0-9]+)?
      exception when invalid_text_representation then raise exception 'Resultado numérico inválido: %', s->>'name'; end;
      if (s ? 'min' and n < (s->>'min')::numeric) or (s ? 'max' and n > (s->>'max')::numeric) then abnormal := true; end if;
    end if;
  end loop;
  return abnormal;
end $function$
 then
        raise exception 'Resultado numérico inválido: %', s->>'name';
      end if;
      begin n := replace(v,',','.')::numeric;
      exception when invalid_text_representation then raise exception 'Resultado numérico inválido: %', s->>'name'; end;
      if (s ? 'min' and n < (s->>'min')::numeric) or (s ? 'max' and n > (s->>'max')::numeric) then abnormal := true; end if;
    end if;
  end loop;
  return abnormal;
end $function$
;
