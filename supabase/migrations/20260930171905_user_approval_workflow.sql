-- User access requests are created as pending and become operational only after
-- a Supervisor or Administrator reviews and assigns a role.

alter table public.pilot_profiles
  alter column active set default false;

alter table public.pilot_profiles
  add column status text not null default 'Pendente'
    check (status in ('Pendente','Ativo','Rejeitado','Bloqueado')),
  add column approved_by uuid references auth.users(id),
  add column approved_at timestamptz,
  add column decision_reason text not null default '';

-- Preserve already active pilot accounts when introducing the approval gate.
update public.pilot_profiles
set status = case when active then 'Ativo' else 'Pendente' end
where status = 'Pendente';

create index if not exists pilot_profiles_status_created_at_idx
  on public.pilot_profiles(status, created_at);

create table public.pilot_profile_audit (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid not null references auth.users(id),
  action text not null check (action in ('aprovou usuário','rejeitou usuário')),
  from_status text not null,
  to_status text not null,
  from_role text not null,
  to_role text not null,
  from_destination text,
  to_destination text,
  reason text not null default '',
  occurred_at timestamptz not null default now()
);

alter table public.pilot_profile_audit enable row level security;
revoke all on table public.pilot_profile_audit from anon, authenticated;
grant select on table public.pilot_profile_audit to authenticated;
create policy pilot_profile_audit_read on public.pilot_profile_audit
  for select to authenticated
  using (pilot_private.role() in ('Supervisor','Administrador'));

create or replace function pilot_private.new_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.pilot_profiles(id, name, active, status)
    values (
      new.id,
      coalesce(trim(new.raw_user_meta_data->>'full_name'), ''),
      false,
      'Pendente'
    );
  return new;
end $$;

create or replace function pilot_private.role() returns text
language sql stable security definer set search_path = '' as $$
  select role
  from public.pilot_profiles
  where id = (select auth.uid())
    and active = true
    and status = 'Ativo'
$$;

create or replace function public.pilot_list_pending_profiles()
returns table (
  id uuid,
  name text,
  email text,
  role text,
  status text,
  destination text,
  created_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select p.id, p.name, u.email, p.role, p.status, p.destination, p.created_at
  from public.pilot_profiles p
  join auth.users u on u.id = p.id
  where pilot_private.role() in ('Supervisor','Administrador')
    and p.status = 'Pendente'
    and p.active = false
  order by p.created_at asc
$$;

create function public.pilot_decide_profile(
  p_user_id uuid,
  p_approve boolean,
  p_role text default null,
  p_destination text default null,
  p_reason text default ''
)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  actor_role text;
  current_status text;
  current_role text;
  current_destination text;
  next_destination text;
begin
  actor_role := pilot_private.role();
  if actor_role not in ('Supervisor','Administrador') then
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
  if current_status <> 'Pendente' then
    raise exception 'Esta solicitação já foi avaliada';
  end if;

  if p_approve then
    if p_role not in ('Consulta','Operador A','Operador Técnico','Supervisor') then
      raise exception 'Perfil inválido para aprovação';
    end if;
    if actor_role = 'Supervisor' and p_role = 'Supervisor' then
      raise exception 'Supervisor não pode atribuir perfil de Supervisor';
    end if;
    next_destination := nullif(trim(coalesce(p_destination,'')), '');
    if p_role = 'Consulta' and next_destination is null then
      raise exception 'Informe o destino para um perfil de Consulta';
    end if;
    if p_role <> 'Consulta' then
      next_destination := null;
    end if;

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
end $$;

revoke all on function public.pilot_list_pending_profiles() from public, anon;
grant execute on function public.pilot_list_pending_profiles() to authenticated;
revoke all on function public.pilot_decide_profile(uuid,boolean,text,text,text) from public, anon;
grant execute on function public.pilot_decide_profile(uuid,boolean,text,text,text) to authenticated;
