-- Additive evolution: existing requests and operational records remain unchanged.
-- A request from the login is anonymous: do not fabricate an authenticated actor.
alter table public.pilot_audit alter column actor_id drop not null;
alter table public.pilot_audit add constraint pilot_anonymous_reset_audit_check check(
 actor_id is not null or (action='solicitou reset de senha' and entity='password_reset' and details @> '{"identity_verified":false}'::jsonb));
alter table public.pilot_authorization_requests add column password_user_id uuid references auth.users(id);
alter table public.pilot_authorization_requests add column completed_at timestamptz;
alter table public.pilot_authorization_requests drop constraint pilot_authorization_requests_kind_check;
alter table public.pilot_authorization_requests add constraint pilot_authorization_requests_kind_check
 check(kind in ('reuse','exception','cancel_cycle','cancel_certificate','reset_password'));
alter table public.pilot_authorization_requests drop constraint pilot_authorization_requests_check;
alter table public.pilot_authorization_requests add constraint pilot_authorization_requests_check check(
 (kind='reset_password' and password_user_id is not null and cycle_id is null and loading_id is null) or
 (kind='cancel_cycle' and cycle_id is not null and loading_id is null and password_user_id is null) or
 (kind in ('reuse','exception','cancel_certificate') and loading_id is not null and cycle_id is null and password_user_id is null));
alter table public.pilot_authorization_requests add constraint pilot_reset_completion_check
 check(completed_at is null or (kind='reset_password' and decision='approved' and completed_at>=decided_at));
create unique index pilot_one_open_password_reset on public.pilot_authorization_requests(password_user_id)
 where kind='reset_password' and completed_at is null and decision in ('pending','approved');
create index pilot_password_user_idx on public.pilot_authorization_requests(password_user_id);
insert into pilot_private.permissions values ('Administrador','password_resets.decide'),('Supervisor','password_resets.decide');

-- Only hashes of random one-time codes/permits; never passwords or password hashes.
create table pilot_private.password_reset_secrets(
 request_id bigint primary key references public.pilot_authorization_requests(id),
 code_hash text not null, expires_at timestamptz not null, attempts integer not null default 0 check(attempts>=0));
create table pilot_private.password_change_permits(
 user_id uuid primary key references auth.users(id), nonce_hash text not null,
 request_id bigint references public.pilot_authorization_requests(id), expires_at timestamptz not null);
create table pilot_private.password_rate_limits(key_hash text primary key, window_start timestamptz not null, attempts integer not null);
create index pilot_password_permit_request_idx on pilot_private.password_change_permits(request_id);
alter table pilot_private.password_reset_secrets enable row level security;
alter table pilot_private.password_change_permits enable row level security;
alter table pilot_private.password_rate_limits enable row level security;
revoke all on pilot_private.password_reset_secrets,pilot_private.password_change_permits,pilot_private.password_rate_limits from public,anon,authenticated;

create function pilot_private.reset_blocked(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.pilot_authorization_requests where password_user_id=p_id and kind='reset_password' and decision='approved' and completed_at is null)
$$;
create or replace function pilot_private.role() returns text language sql stable security definer set search_path='' as $$
 select role from public.pilot_profiles where id=(select auth.uid()) and active and status='Ativo'
 and not pilot_private.reset_blocked((select auth.uid()))
 and ((select auth.jwt()->>'session_id') is null or exists(select 1 from auth.sessions where id::text=(select auth.jwt()->>'session_id') and user_id=(select auth.uid())))
$$;
create function public.pilot_password_state() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('required',pilot_private.reset_blocked(auth.uid())) where auth.uid() is not null
$$;
revoke all on function public.pilot_password_state() from public,anon;
grant execute on function public.pilot_password_state() to authenticated;

-- Profile rows themselves are protected by self-only RLS. This narrow helper
-- evaluates hierarchy without granting supervisors direct profile-table access.
create function pilot_private.can_administer_password_reset(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select pilot_private.can('password_resets.decide') and p_id<>auth.uid() and exists(
 select 1 from public.pilot_profiles where id=p_id and
 (pilot_private.role()='Administrador' or role in ('Operador Técnico','Operador A','Consulta')))
$$;
revoke all on function pilot_private.can_administer_password_reset(uuid) from public,anon;
grant execute on function pilot_private.can_administer_password_reset(uuid) to authenticated;

-- Password reset identities are not operational history visible to all operators.
create policy pilot_password_requests_privacy on public.pilot_authorization_requests as restrictive for select to authenticated
 using(kind<>'reset_password' or password_user_id=(select auth.uid()) or pilot_private.can_administer_password_reset(password_user_id));

create function public.pilot_password_rate_limit(p_key text) returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 insert into pilot_private.password_rate_limits values(p_key,now(),1)
 on conflict(key_hash) do update set attempts=case when password_rate_limits.window_start<now()-interval '1 hour' then 1 else password_rate_limits.attempts+1 end,
 window_start=case when password_rate_limits.window_start<now()-interval '1 hour' then now() else password_rate_limits.window_start end returning attempts into n;
 return n<=20;
end $$;
create function public.pilot_request_password_reset(p_email text) returns void language plpgsql security definer set search_path='' as $$
declare u auth.users; p public.pilot_profiles; rid bigint;
begin
 select * into u from auth.users where lower(email)=lower(trim(p_email));
 if u.id is null or u.email_confirmed_at is null then return; end if;
 select * into p from public.pilot_profiles where id=u.id for update;
 if not p.active or p.status<>'Ativo' then return; end if;
 if exists(select 1 from public.pilot_authorization_requests where password_user_id=u.id and kind='reset_password' and decision in ('pending','approved') and completed_at is null) then return; end if;
 insert into public.pilot_authorization_requests(kind,password_user_id,requester_id,requester_name,requested_at,reason)
 values('reset_password',u.id,u.id,coalesce(nullif(p.name,''),u.email),now(),'Solicitação pela tela de login. Identidade ainda não comprovada; conferir pessoalmente antes de entregar o código.') returning id into rid;
 insert into public.pilot_audit(actor_id,action,entity,entity_id,details) values(null,'solicitou reset de senha','password_reset',rid,jsonb_build_object('user_id',u.id,'identity_verified',false));
end $$;

create function public.pilot_decide_password_reset(p_id bigint,p_approve boolean,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.pilot_authorization_requests; actor public.pilot_profiles; target public.pilot_profiles; code text; expiry timestamptz;
begin
 perform pilot_private.assert_permission('password_resets.decide');
 select * into r from public.pilot_authorization_requests where id=p_id and kind='reset_password' for update;
 if r.id is null or r.completed_at is not null or r.decision not in ('pending','approved') then raise exception 'Solicitação indisponível'; end if;
 select * into actor from public.pilot_profiles where id=auth.uid();
 select * into target from public.pilot_profiles where id=r.password_user_id;
 if not pilot_private.can_administer_password_reset(target.id) or not target.active or target.status<>'Ativo' then raise exception 'Acesso negado para este usuário'; end if;
 if length(trim(coalesce(p_reason,'')))<3 then raise exception 'Informe a justificativa da decisão'; end if;
 -- An expired/locked code may be renewed, but every renewal has an audit event.
 if r.decision='approved' and not p_approve then raise exception 'Uma aprovação já concedida não pode ser reescrita'; end if;
 if r.decision='pending' then
 update public.pilot_authorization_requests set decision=case when p_approve then 'approved' else 'rejected' end,actor_id=actor.id,actor_name=actor.name,actor_role=actor.role,decided_at=now(),decision_reason=trim(p_reason) where id=r.id;
 end if;
 if p_approve then
 delete from pilot_private.password_change_permits where request_id=r.id;
 code:=encode(extensions.gen_random_bytes(16),'hex'); expiry:=now()+interval '24 hours';
 insert into pilot_private.password_reset_secrets values(r.id,encode(extensions.digest(code,'sha256'),'hex'),expiry,0)
 on conflict(request_id) do update set code_hash=excluded.code_hash,expires_at=excluded.expires_at,attempts=0;
 end if;
 insert into public.pilot_audit(actor_id,action,entity,entity_id,details) values(actor.id,case when r.decision='approved' then 'renovou código de reset' when p_approve then 'aprovou reset de senha' else 'rejeitou reset de senha' end,'password_reset',r.id,jsonb_build_object('user_id',r.password_user_id,'reason',trim(p_reason)));
 return jsonb_build_object('code',code,'expires_at',expiry);
end $$;
revoke all on function public.pilot_decide_password_reset(bigint,boolean,text) from public,anon;
grant execute on function public.pilot_decide_password_reset(bigint,boolean,text) to authenticated;

-- Service-only bridge: the Edge Function proves current password OR the approved code.
create function public.pilot_prepare_password_change(p_user_id uuid,p_email text,p_code_hash text,p_nonce_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid; r public.pilot_authorization_requests; s pilot_private.password_reset_secrets; active_user boolean;
begin
 if p_code_hash is not null then select id into uid from auth.users where lower(email)=lower(trim(p_email)); else uid:=p_user_id; end if;
 if uid is null then return jsonb_build_object('ok',false); end if;
 select active and status='Ativo' into active_user from public.pilot_profiles where id=uid for update;
 if not coalesce(active_user,false) then return jsonb_build_object('ok',false); end if;
 if p_code_hash is not null then
 select * into r from public.pilot_authorization_requests where password_user_id=uid and kind='reset_password' and decision='approved' and completed_at is null for update;
 if r.id is null then return jsonb_build_object('ok',false); end if;
 select * into s from pilot_private.password_reset_secrets where request_id=r.id for update;
 if s.request_id is null or s.expires_at<=now() or s.attempts>=5 then return jsonb_build_object('ok',false); end if;
 if s.code_hash<>p_code_hash then update pilot_private.password_reset_secrets set attempts=attempts+1 where request_id=r.id; return jsonb_build_object('ok',false); end if;
 elsif pilot_private.reset_blocked(uid) then return jsonb_build_object('ok',false); end if;
 if exists(select 1 from pilot_private.password_change_permits where user_id=uid and expires_at>now()) then return jsonb_build_object('ok',false); end if;
 insert into pilot_private.password_change_permits values(uid,p_nonce_hash,r.id,now()+interval '60 seconds')
 on conflict(user_id) do update set nonce_hash=excluded.nonce_hash,request_id=excluded.request_id,expires_at=excluded.expires_at;
 return jsonb_build_object('ok',true,'user_id',uid);
end $$;
create function public.pilot_release_password_permit(p_nonce_hash text) returns void language sql security definer set search_path='' as $$
 delete from pilot_private.password_change_permits where nonce_hash=p_nonce_hash
$$;
revoke all on function public.pilot_password_rate_limit(text),public.pilot_request_password_reset(text),public.pilot_prepare_password_change(uuid,text,text,text),public.pilot_release_password_permit(text) from public,anon,authenticated;
grant execute on function public.pilot_password_rate_limit(text),public.pilot_request_password_reset(text),public.pilot_prepare_password_change(uuid,text,text,text),public.pilot_release_password_permit(text) to service_role;

-- Auth still hashes/stores the password. A deferred guard checks the private, one-use
-- permit against ADMIN-ONLY app_metadata written in the SAME Auth transaction.
-- Client updateUser, recovery emails and user_metadata cannot manufacture this proof.
create function pilot_private.guard_password_change() returns trigger language plpgsql security definer set search_path='' as $$
declare permit pilot_private.password_change_permits; nonce text;
begin
 select raw_app_meta_data->>'laudos_password_permit' into nonce from auth.users where id=new.id;
 select * into permit from pilot_private.password_change_permits where user_id=new.id;
 if permit.request_id is not null then perform 1 from public.pilot_authorization_requests where id=permit.request_id for update; end if;
 select * into permit from pilot_private.password_change_permits where user_id=new.id for update;
 if nonce is null or permit.user_id is null or permit.expires_at<=now() or
 permit.nonce_hash<>encode(extensions.digest(nonce,'sha256'),'hex') then raise exception 'Use o fluxo autorizado de senha do Laudos Agudos'; end if;
 if permit.request_id is not null then
 update public.pilot_authorization_requests set completed_at=now() where id=permit.request_id and decision='approved' and completed_at is null;
 if not found then raise exception 'Autorização já utilizada ou indisponível'; end if;
 delete from pilot_private.password_reset_secrets where request_id=permit.request_id;
 end if;
 delete from pilot_private.password_change_permits where user_id=new.id;
 update auth.users set raw_app_meta_data=raw_app_meta_data-'laudos_password_permit' where id=new.id;
 insert into public.pilot_audit(actor_id,action,entity,entity_id,details) values(new.id,case when permit.request_id is null then 'alterou a própria senha' else 'concluiu reset de senha' end,'password_reset',coalesce(permit.request_id,0),jsonb_build_object('user_id',new.id,'request_id',permit.request_id));
 return new;
end $$;
create constraint trigger pilot_password_change_guard after update on auth.users deferrable initially deferred for each row
 when(old.encrypted_password is distinct from new.encrypted_password) execute function pilot_private.guard_password_change();
revoke all on function pilot_private.reset_blocked(uuid),pilot_private.guard_password_change() from public,anon,authenticated;

-- Existing login uses passwords; signup confirmation uses confirmation_token.
-- Do not let the native recovery/magic-link endpoint mint a login for an active
-- account that bypasses the personally verified, approved reset process.
create function pilot_private.guard_native_recovery() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if coalesce(new.recovery_token,'')<>'' and new.recovery_token is distinct from old.recovery_token
 and exists(select 1 from public.pilot_profiles where id=new.id and active and status='Ativo') then
 raise exception 'Solicite o reset autorizado no Laudos Agudos';
 end if;
 return new;
end $$;
create trigger pilot_native_recovery_guard before update of recovery_token on auth.users for each row execute function pilot_private.guard_native_recovery();
revoke all on function pilot_private.guard_native_recovery() from public,anon,authenticated;

-- Transport mode uses the immutable cycle family plus the structured destination.
create function pilot_private.is_pipeline(p_snapshot jsonb,p_destination text) returns boolean language sql stable set search_path='' as $$
 select coalesce(p_snapshot->>'family'='Resina',false) and exists(select 1 from public.pilot_destinations where id='agudos-mdf2' and (id=p_destination or name=p_destination))
$$;
create function pilot_private.validate_transport(p_snapshot jsonb,p_destination text,p_plate text,p_carrier text) returns void language plpgsql set search_path='' as $$
begin
 if (not pilot_private.is_pipeline(p_snapshot,p_destination) and (length(trim(coalesce(p_plate,'')))<7 or length(trim(coalesce(p_carrier,'')))=0))
 or (length(trim(coalesce(p_plate,'')))>0 and length(trim(p_plate))<7) then raise exception 'Informe transportadora e placa válidas para transporte por caminhão'; end if;
end $$;
create function pilot_private.transport_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare snapshot jsonb;
begin
 if tg_op='UPDATE' and old.certificate_number is not null then return new; end if;
 select product_snapshot into snapshot from public.pilot_cycles where id=new.cycle_id;
 perform pilot_private.validate_transport(snapshot,new.destination,new.plate,new.carrier);
 return new;
end $$;
create trigger pilot_transport_guard before insert or update of plate,carrier,destination,cycle_id,state on public.pilot_loadings for each row execute function pilot_private.transport_guard();
revoke all on function pilot_private.is_pipeline(jsonb,text),pilot_private.validate_transport(jsonb,text,text,text),pilot_private.transport_guard() from public,anon,authenticated;

notify pgrst,'reload schema';

-- Existing RPCs retain their original permissions, analysis checks and audit events.
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
    length(trim(coalesce(p_trailer,''))) = 0 or
    length(trim(coalesce(p_destination,''))) = 0 or
    length(trim(coalesce(p_analyst,''))) = 0 then raise exception 'Complete os dados do carregamento'; end if;
  if jsonb_typeof(p_values) <> 'array' or jsonb_array_length(p_values) <> jsonb_array_length(c.specifications) then raise exception 'Resultados incompletos'; end if;
  if p_source='ref' and p_values <> c.reference_values then raise exception 'Resultados de referência divergentes'; end if;
  insert into public.pilot_loadings(cycle_id,plate,trailer,carrier,destination,analyst,loaded_at,values,source,observation,created_by)
    values(c.id,upper(trim(coalesce(p_plate,''))),trim(p_trailer),trim(coalesce(p_carrier,'')),trim(p_destination),trim(p_analyst),p_loaded_at,p_values,p_source,coalesce(p_observation,''),auth.uid()) returning id into result_id;
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
  if p_source not in ('own','ref') or p_loaded_at is null 
    or length(trim(coalesce(p_trailer,'')))=0
    or length(trim(coalesce(p_destination,'')))=0 or length(trim(coalesce(p_analyst,'')))=0
    or jsonb_typeof(p_values)<>'array' or jsonb_array_length(p_values)<>jsonb_array_length(c.specifications) then
    raise exception 'Dados incompletos'; end if;
  if p_source='ref' and p_values<>c.reference_values then raise exception 'Resultados de referência divergentes'; end if;
  update public.pilot_loadings set plate=upper(trim(coalesce(p_plate,''))),trailer=trim(p_trailer),carrier=trim(coalesce(p_carrier,'')),destination=trim(p_destination),
    analyst=trim(p_analyst),loaded_at=p_loaded_at,values=p_values,source=p_source,observation=coalesce(p_observation,''),
    state='Rascunho',edit_version=edit_version+1,updated_at=now() where id=p_id;
  insert into public.pilot_audit(actor_id,action,entity,entity_id) values(auth.uid(),'editou rascunho','loading',p_id);
end $function$
;
