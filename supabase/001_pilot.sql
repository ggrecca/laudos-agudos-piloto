-- Laudos Agudos pilot. No fictional quality specification is seeded.
create schema if not exists pilot_private;

create table public.pilot_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  role text not null default 'Consulta' check (role in ('Operador A','Operador Técnico','Supervisor','Administrador','Consulta')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.pilot_products (
  id bigint generated always as identity primary key,
  code text not null unique,
  name text not null,
  family text not null check (family in ('Resina','Emulsão')),
  specifications jsonb not null default '[]'::jsonb check (jsonb_typeof(specifications) = 'array'),
  version integer not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.pilot_tanks (
  id bigint generated always as identity primary key,
  code text not null unique,
  family text not null check (family in ('Resina','Emulsão')),
  active boolean not null default true
);
create table public.pilot_cycles (
  id bigint generated always as identity primary key,
  tank_id bigint not null references public.pilot_tanks(id),
  product_id bigint not null references public.pilot_products(id),
  specifications jsonb not null,
  specification_version integer not null,
  manufactured_at timestamptz not null,
  lots text not null,
  reference_values jsonb not null check (jsonb_typeof(reference_values) = 'array'),
  analyst text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id)
);
create unique index pilot_one_active_cycle_per_tank on public.pilot_cycles(tank_id) where active;
create table public.pilot_loadings (
  id bigint generated always as identity primary key,
  cycle_id bigint not null references public.pilot_cycles(id),
  plate text not null,
  trailer text not null,
  carrier text not null,
  destination text not null,
  analyst text not null,
  loaded_at timestamptz not null,
  values jsonb not null check (jsonb_typeof(values) = 'array'),
  source text not null check (source in ('own','ref')),
  observation text not null default '',
  state text not null default 'Rascunho' check (state in ('Rascunho','Aguardando autorização','Em correção','Emitido','Cancelado')),
  edit_version integer not null default 1,
  certificate_number text unique,
  issued_at timestamptz,
  issued_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now()
);
create unique index pilot_pending_plate on public.pilot_loadings(cycle_id, upper(plate), upper(trailer))
  where state in ('Rascunho','Aguardando autorização','Em correção');
create table public.pilot_approvals (
  id bigint generated always as identity primary key,
  loading_id bigint not null references public.pilot_loadings(id),
  edit_version integer not null,
  kind text not null check (kind in ('reuse','exception')),
  decision text not null check (decision in ('approved','rejected')),
  reason text not null,
  actor_id uuid not null references auth.users(id),
  decided_at timestamptz not null default now(),
  unique (loading_id,edit_version,kind)
);
create table public.pilot_audit (
  id bigint generated always as identity primary key,
  actor_id uuid not null references auth.users(id),
  action text not null,
  entity text not null,
  entity_id bigint not null,
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create sequence public.pilot_certificate_seq;

create function pilot_private.new_profile() returns trigger language plpgsql security definer
set search_path = '' as $$
begin
  insert into public.pilot_profiles(id,name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''));
  return new;
end $$;
create trigger pilot_auth_profile after insert on auth.users for each row execute function pilot_private.new_profile();

create function pilot_private.role() returns text language sql stable security definer
set search_path = '' as $$
  select role from public.pilot_profiles where id = (select auth.uid()) and active = true
$$;
create function pilot_private.assert_role(allowed text[]) returns void language plpgsql security definer
set search_path = '' as $$
begin
  if (select auth.uid()) is null or pilot_private.role() is null or not (pilot_private.role() = any(allowed)) then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;
end $$;
-- Returns true if any value is outside specification; malformed/incomplete data raises an error.
create function pilot_private.has_exception(specs jsonb, vals jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
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
      begin n := replace(v,',','.')::numeric;
      exception when invalid_text_representation then raise exception 'Resultado numérico inválido: %', s->>'name'; end;
      if (s ? 'min' and n < (s->>'min')::numeric) or (s ? 'max' and n > (s->>'max')::numeric) then abnormal := true; end if;
    end if;
  end loop;
  return abnormal;
end $$;

alter table public.pilot_profiles enable row level security;
alter table public.pilot_products enable row level security;
alter table public.pilot_tanks enable row level security;
alter table public.pilot_cycles enable row level security;
alter table public.pilot_loadings enable row level security;
alter table public.pilot_approvals enable row level security;
alter table public.pilot_audit enable row level security;
grant select on public.pilot_profiles, public.pilot_products, public.pilot_tanks,
  public.pilot_cycles, public.pilot_loadings, public.pilot_approvals, public.pilot_audit to authenticated;
create policy pilot_self_profile on public.pilot_profiles for select to authenticated using (id = (select auth.uid()));
create policy pilot_product_read on public.pilot_products for select to authenticated using (pilot_private.role() is not null);
create policy pilot_tank_read on public.pilot_tanks for select to authenticated using (pilot_private.role() is not null);
create policy pilot_cycle_read on public.pilot_cycles for select to authenticated using (
  pilot_private.role() is not null and
  (pilot_private.role() <> 'Consulta' or exists
    (select 1 from public.pilot_loadings l where l.cycle_id = id and l.state = 'Emitido')));
create policy pilot_loading_read on public.pilot_loadings for select to authenticated using (
  pilot_private.role() is not null and (pilot_private.role() <> 'Consulta' or state = 'Emitido'));
create policy pilot_approval_read on public.pilot_approvals for select to authenticated using (
  pilot_private.role() in ('Operador A','Operador Técnico','Supervisor','Administrador'));
create policy pilot_audit_read on public.pilot_audit for select to authenticated using (
  pilot_private.role() in ('Supervisor','Administrador'));

-- All writes are controlled by narrowly scoped RPC operations, never direct table writes.
create function public.pilot_save_product(p_code text,p_name text,p_family text,p_specs jsonb,p_id bigint default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare result_id bigint;
begin
  perform pilot_private.assert_role(array['Administrador']);
  if length(trim(p_code)) < 2 or length(trim(p_name)) < 2 or p_family not in ('Resina','Emulsão')
    or jsonb_typeof(p_specs) <> 'array' or jsonb_array_length(p_specs) = 0 then
    raise exception 'Produto ou especificação inválida';
  end if;
  if p_id is null then
    insert into public.pilot_products(code,name,family,specifications) values(trim(p_code),trim(p_name),p_family,p_specs) returning id into result_id;
  else
    update public.pilot_products set code=trim(p_code),name=trim(p_name),family=p_family,specifications=p_specs,version=version+1
      where id=p_id returning id into result_id;
    if result_id is null then raise exception 'Produto não encontrado'; end if;
  end if;
  insert into public.pilot_audit(actor_id,action,entity,entity_id) values(auth.uid(),'salvou produto','product',result_id);
  return result_id;
end $$;
create function public.pilot_save_tank(p_code text,p_family text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare result_id bigint;
begin
  perform pilot_private.assert_role(array['Administrador']);
  if length(trim(p_code)) < 2 or p_family not in ('Resina','Emulsão') then raise exception 'Tanque inválido'; end if;
  insert into public.pilot_tanks(code,family) values(trim(p_code),p_family) returning id into result_id;
  insert into public.pilot_audit(actor_id,action,entity,entity_id) values(auth.uid(),'cadastrou tanque','tank',result_id);
  return result_id;
end $$;
create function public.pilot_create_cycle(p_tank_id bigint,p_product_id bigint,p_manufactured_at timestamptz,p_lots text,p_reference jsonb,p_analyst text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare t public.pilot_tanks; p public.pilot_products; result_id bigint;
begin
  perform pilot_private.assert_role(array['Operador A','Operador Técnico','Supervisor','Administrador']);
  select * into t from public.pilot_tanks where id=p_tank_id and active;
  select * into p from public.pilot_products where id=p_product_id and active;
  if t.id is null or p.id is null or t.family <> p.family then raise exception 'Tanque e produto incompatíveis'; end if;
  if length(trim(coalesce(p_lots,''))) = 0 or length(trim(coalesce(p_analyst,''))) = 0 or p_manufactured_at is null then raise exception 'Complete o ciclo'; end if;
  perform pilot_private.has_exception(p.specifications,p_reference);
  insert into public.pilot_cycles(tank_id,product_id,specifications,specification_version,manufactured_at,lots,reference_values,analyst,created_by)
    values(t.id,p.id,p.specifications,p.version,p_manufactured_at,trim(p_lots),p_reference,trim(p_analyst),auth.uid()) returning id into result_id;
  insert into public.pilot_audit(actor_id,action,entity,entity_id) values(auth.uid(),'criou ciclo','cycle',result_id);
  return result_id;
end $$;
create function public.pilot_close_cycle(p_id bigint) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform pilot_private.assert_role(array['Operador Técnico','Supervisor','Administrador']);
  if exists(select 1 from public.pilot_loadings where cycle_id=p_id and state in ('Rascunho','Aguardando autorização','Em correção')) then
    raise exception 'Há carregamentos pendentes neste ciclo'; end if;
  update public.pilot_cycles set active=false where id=p_id and active;
  if not found then raise exception 'Ciclo ativo não encontrado'; end if;
  insert into public.pilot_audit(actor_id,action,entity,entity_id) values(auth.uid(),'fechou ciclo','cycle',p_id);
end $$;
create function public.pilot_create_loading(p_cycle_id bigint,p_plate text,p_trailer text,p_carrier text,p_destination text,p_analyst text,p_loaded_at timestamptz,p_values jsonb,p_source text,p_observation text default '')
returns bigint language plpgsql security definer set search_path = '' as $$
declare c public.pilot_cycles; result_id bigint;
begin
  perform pilot_private.assert_role(array['Operador A','Operador Técnico','Supervisor','Administrador']);
  select * into c from public.pilot_cycles where id=p_cycle_id and active;
  if c.id is null then raise exception 'Ciclo não está ativo'; end if;
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
end $$;
create function public.pilot_save_loading(p_id bigint,p_plate text,p_trailer text,p_carrier text,p_destination text,p_analyst text,p_loaded_at timestamptz,p_values jsonb,p_source text,p_observation text)
returns void language plpgsql security definer set search_path = '' as $$
declare l public.pilot_loadings; c public.pilot_cycles;
begin
  perform pilot_private.assert_role(array['Operador A','Operador Técnico','Supervisor','Administrador']);
  select * into l from public.pilot_loadings where id=p_id for update;
  if l.id is null or l.state not in ('Rascunho','Em correção') then raise exception 'Carregamento não pode ser editado'; end if;
  select * into c from public.pilot_cycles where id=l.cycle_id;
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
end $$;
create function public.pilot_request_approval(p_id bigint) returns void language plpgsql security definer set search_path = '' as $$
declare l public.pilot_loadings; c public.pilot_cycles; exceptional boolean;
begin
  perform pilot_private.assert_role(array['Operador A','Operador Técnico','Supervisor','Administrador']);
  select * into l from public.pilot_loadings where id=p_id for update;
  if l.id is null or l.state not in ('Rascunho','Em correção') then raise exception 'Rascunho indisponível'; end if;
  select * into c from public.pilot_cycles where id=l.cycle_id;
  exceptional := pilot_private.has_exception(c.specifications,l.values);
  if not exceptional and l.source<>'ref' then raise exception 'Este carregamento não precisa de autorização'; end if;
  update public.pilot_loadings set state='Aguardando autorização',updated_at=now() where id=p_id;
  insert into public.pilot_audit(actor_id,action,entity,entity_id) values(auth.uid(),'solicitou autorização','loading',p_id);
end $$;
create function public.pilot_decide(p_id bigint,p_kind text,p_approve boolean,p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare l public.pilot_loadings; c public.pilot_cycles; needed boolean;
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
  insert into public.pilot_approvals(loading_id,edit_version,kind,decision,reason,actor_id)
    values(p_id,l.edit_version,p_kind,case when p_approve then 'approved' else 'rejected' end,trim(p_reason),auth.uid());
  if not p_approve then update public.pilot_loadings set state='Em correção',updated_at=now() where id=p_id; end if;
  insert into public.pilot_audit(actor_id,action,entity,entity_id,details)
    values(auth.uid(),case when p_approve then 'autorizou' else 'rejeitou' end,'loading',p_id,jsonb_build_object('kind',p_kind,'reason',trim(p_reason)));
end $$;
create function public.pilot_issue(p_id bigint) returns text language plpgsql security definer set search_path = '' as $$
declare l public.pilot_loadings; c public.pilot_cycles; exceptional boolean; number text;
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
  update public.pilot_loadings set state='Emitido',certificate_number=number,issued_at=now(),issued_by=auth.uid(),updated_at=now() where id=p_id;
  insert into public.pilot_audit(actor_id,action,entity,entity_id,details) values(auth.uid(),'emitiu laudo','loading',p_id,jsonb_build_object('number',number));
  return number;
end $$;

revoke all on schema pilot_private from public, anon, authenticated;
revoke all on all functions in schema pilot_private from public, anon, authenticated;
grant usage on schema pilot_private to authenticated;
grant execute on function pilot_private.role() to authenticated;
revoke all on function public.pilot_save_product(text,text,text,jsonb,bigint),public.pilot_save_tank(text,text),
  public.pilot_create_cycle(bigint,bigint,timestamptz,text,jsonb,text),public.pilot_close_cycle(bigint),
  public.pilot_create_loading(bigint,text,text,text,text,text,timestamptz,jsonb,text,text),
  public.pilot_save_loading(bigint,text,text,text,text,text,timestamptz,jsonb,text,text),
  public.pilot_request_approval(bigint),public.pilot_decide(bigint,text,boolean,text),public.pilot_issue(bigint) from public, anon;
grant execute on function public.pilot_save_product(text,text,text,jsonb,bigint),public.pilot_save_tank(text,text),
  public.pilot_create_cycle(bigint,bigint,timestamptz,text,jsonb,text),public.pilot_close_cycle(bigint),
  public.pilot_create_loading(bigint,text,text,text,text,text,timestamptz,jsonb,text,text),
  public.pilot_save_loading(bigint,text,text,text,text,text,timestamptz,jsonb,text,text),
  public.pilot_request_approval(bigint),public.pilot_decide(bigint,text,boolean,text),public.pilot_issue(bigint) to authenticated;
