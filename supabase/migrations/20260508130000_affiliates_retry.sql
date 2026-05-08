-- Retry: original affiliates migration didn't apply
do $$ begin
  if not exists (select 1 from pg_type where typname = 'affiliate_status') then
    create type public.affiliate_status as enum ('pending','approved','rejected','blocked');
  end if;
  if not exists (select 1 from pg_type where typname = 'affiliate_tier') then
    create type public.affiliate_tier as enum ('bronze','silver','gold');
  end if;
  if not exists (select 1 from pg_type where typname = 'commission_status') then
    create type public.commission_status as enum ('pending','approved','paid','reversed','rejected');
  end if;
  if not exists (select 1 from pg_type where typname = 'commission_type') then
    create type public.commission_type as enum ('one_time','recurring');
  end if;
  if not exists (select 1 from pg_type where typname = 'payout_status') then
    create type public.payout_status as enum ('pending','approved','paid','rejected');
  end if;
end $$;

create table if not exists public.affiliates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  code text not null unique,
  status affiliate_status not null default 'pending',
  tier affiliate_tier not null default 'bronze',
  payout_method text,
  payout_details jsonb default '{}'::jsonb,
  min_payout_uyu integer,
  total_earned numeric not null default 0,
  total_paid numeric not null default 0,
  pending_balance numeric not null default 0,
  public_profile boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz
);
create index if not exists affiliates_status_idx on public.affiliates (status);
create index if not exists affiliates_code_idx on public.affiliates (code);

create table if not exists public.affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  ip_hash text, ua_hash text, landing_path text, referrer text,
  created_at timestamptz not null default now()
);
create index if not exists aff_clicks_idx on public.affiliate_clicks (affiliate_id, created_at desc);

create table if not exists public.affiliate_referrals (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  referred_user_id uuid not null unique,
  attributed_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days'),
  ip_hash text, active boolean not null default true
);
create index if not exists aff_ref_idx on public.affiliate_referrals (affiliate_id);

create table if not exists public.affiliate_payouts (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  amount_uyu numeric not null,
  status payout_status not null default 'pending',
  method text, external_ref text, notes text,
  created_at timestamptz not null default now(),
  approved_at timestamptz, paid_at timestamptz
);
create index if not exists aff_payouts_idx on public.affiliate_payouts (affiliate_id, created_at desc);

create table if not exists public.affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  referred_user_id uuid not null,
  payment_id uuid, subscription_id uuid, source_ref text,
  type commission_type not null, plan text not null,
  gross_amount_uyu numeric not null, rate numeric not null, commission_uyu numeric not null,
  status commission_status not null default 'pending',
  payout_id uuid references public.affiliate_payouts(id) on delete set null,
  created_at timestamptz not null default now(),
  approved_at timestamptz, paid_at timestamptz,
  unique (source_ref)
);
create index if not exists aff_com_idx on public.affiliate_commissions (affiliate_id, status, created_at desc);
create index if not exists aff_com_ref_idx on public.affiliate_commissions (referred_user_id);

drop trigger if exists affiliates_updated_at on public.affiliates;
create trigger affiliates_updated_at before update on public.affiliates
  for each row execute function public.set_updated_at();

alter table public.affiliates enable row level security;
alter table public.affiliate_clicks enable row level security;
alter table public.affiliate_referrals enable row level security;
alter table public.affiliate_commissions enable row level security;
alter table public.affiliate_payouts enable row level security;

drop policy if exists "aff_self_select" on public.affiliates;
create policy "aff_self_select" on public.affiliates for select to authenticated using (auth.uid() = user_id);
drop policy if exists "aff_admin_select" on public.affiliates;
create policy "aff_admin_select" on public.affiliates for select to authenticated using (has_role(auth.uid(),'admin'));
drop policy if exists "aff_admin_all" on public.affiliates;
create policy "aff_admin_all" on public.affiliates for all to authenticated using (has_role(auth.uid(),'admin')) with check (has_role(auth.uid(),'admin'));

drop policy if exists "aff_clicks_admin" on public.affiliate_clicks;
create policy "aff_clicks_admin" on public.affiliate_clicks for select to authenticated using (has_role(auth.uid(),'admin'));
drop policy if exists "aff_clicks_own" on public.affiliate_clicks;
create policy "aff_clicks_own" on public.affiliate_clicks for select to authenticated using (
  exists (select 1 from public.affiliates a where a.id = affiliate_id and a.user_id = auth.uid())
);

drop policy if exists "aff_ref_admin" on public.affiliate_referrals;
create policy "aff_ref_admin" on public.affiliate_referrals for select to authenticated using (has_role(auth.uid(),'admin'));
drop policy if exists "aff_ref_own" on public.affiliate_referrals;
create policy "aff_ref_own" on public.affiliate_referrals for select to authenticated using (
  exists (select 1 from public.affiliates a where a.id = affiliate_id and a.user_id = auth.uid())
);

drop policy if exists "aff_com_admin" on public.affiliate_commissions;
create policy "aff_com_admin" on public.affiliate_commissions for all to authenticated using (has_role(auth.uid(),'admin')) with check (has_role(auth.uid(),'admin'));
drop policy if exists "aff_com_own" on public.affiliate_commissions;
create policy "aff_com_own" on public.affiliate_commissions for select to authenticated using (
  exists (select 1 from public.affiliates a where a.id = affiliate_id and a.user_id = auth.uid())
);

drop policy if exists "aff_pay_admin" on public.affiliate_payouts;
create policy "aff_pay_admin" on public.affiliate_payouts for all to authenticated using (has_role(auth.uid(),'admin')) with check (has_role(auth.uid(),'admin'));
drop policy if exists "aff_pay_own" on public.affiliate_payouts;
create policy "aff_pay_own" on public.affiliate_payouts for select to authenticated using (
  exists (select 1 from public.affiliates a where a.id = affiliate_id and a.user_id = auth.uid())
);

insert into public.app_settings (key, value) values
  ('affiliate_rates', '{"starter":0.15,"pro":0.30,"premium":0.35,"subscription":0.30}'::jsonb),
  ('affiliate_cookie_days', '90'::jsonb),
  ('affiliate_min_payout_uyu', '500'::jsonb),
  ('affiliate_tier_thresholds', '{"silver":5000,"gold":25000}'::jsonb),
  ('affiliate_approve_after_days', '7'::jsonb),
  ('affiliate_package_plan_map', '{"bc2d217e-3c46-40d4-9808-a3d99de09355":"starter","ff2fe09c-093c-4d2d-ba20-8e50831ce3b9":"pro","4369e2b1-14a4-4b9b-ae58-41acce049685":"premium"}'::jsonb)
on conflict (key) do nothing;

create or replace function public.register_affiliate(_code text)
returns public.affiliates language plpgsql security definer set search_path = public as $$
declare _user uuid := auth.uid(); _slug text; _row public.affiliates;
begin
  if _user is null then raise exception 'not authenticated'; end if;
  _slug := lower(regexp_replace(coalesce(_code,''), '[^a-z0-9_-]', '', 'g'));
  if length(_slug) < 3 then raise exception 'code_too_short'; end if;
  if length(_slug) > 32 then raise exception 'code_too_long'; end if;
  if exists (select 1 from public.affiliates where code = _slug) then raise exception 'code_taken'; end if;
  insert into public.affiliates (user_id, code, status) values (_user, _slug, 'pending') returning * into _row;
  return _row;
end; $$;

create or replace function public.attribute_referral(_referred_user_id uuid, _ref_code text, _ip_hash text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare _aff public.affiliates;
begin
  if _referred_user_id is null or _ref_code is null then return false; end if;
  select * into _aff from public.affiliates where code = _ref_code and status in ('approved','pending');
  if _aff.id is null then return false; end if;
  if _aff.user_id = _referred_user_id then return false; end if;
  if exists (select 1 from public.affiliate_referrals where referred_user_id = _referred_user_id) then return false; end if;
  insert into public.affiliate_referrals (affiliate_id, referred_user_id, ip_hash) values (_aff.id, _referred_user_id, _ip_hash);
  return true;
end; $$;

create or replace function public._affiliate_rate(_plan text)
returns numeric language sql stable as $$
  select coalesce(((select value from public.app_settings where key='affiliate_rates')->>_plan)::numeric, 0);
$$;

create or replace function public.record_affiliate_commission_payment(_payment_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare _p record; _ref public.affiliate_referrals; _aff public.affiliates;
        _plan text; _rate numeric; _amount numeric; _src text; _com_id uuid; _map jsonb;
begin
  select * into _p from public.payments where id = _payment_id;
  if _p.id is null or _p.status <> 'approved' then return null; end if;
  select * into _ref from public.affiliate_referrals where referred_user_id = _p.user_id and active = true limit 1;
  if _ref.id is null then return null; end if;
  select * into _aff from public.affiliates where id = _ref.affiliate_id;
  if _aff.id is null or _aff.status in ('blocked','rejected') then return null; end if;
  if _aff.user_id = _p.user_id then return null; end if;
  _map := (select value from public.app_settings where key='affiliate_package_plan_map');
  _plan := coalesce(_map->>(_p.package_id::text), 'starter');
  _rate := public._affiliate_rate(_plan);
  if _rate <= 0 then return null; end if;
  _amount := round((_p.amount_uyu * _rate)::numeric, 2);
  _src := 'payment:' || _payment_id::text;
  insert into public.affiliate_commissions
    (affiliate_id, referred_user_id, payment_id, source_ref, type, plan, gross_amount_uyu, rate, commission_uyu, status)
    values (_aff.id, _p.user_id, _p.id, _src, 'one_time', _plan, _p.amount_uyu, _rate, _amount, 'pending')
    on conflict (source_ref) do nothing returning id into _com_id;
  if _com_id is not null then
    update public.affiliates set pending_balance = pending_balance + _amount, total_earned = total_earned + _amount where id = _aff.id;
  end if;
  return _com_id;
end; $$;

create or replace function public.record_affiliate_commission_subscription(_subscription_id uuid, _external_payment_id text, _amount numeric)
returns uuid language plpgsql security definer set search_path = public as $$
declare _sub record; _ref public.affiliate_referrals; _aff public.affiliates;
        _rate numeric; _amount_com numeric; _src text; _com_id uuid;
begin
  select * into _sub from public.subscriptions where id = _subscription_id;
  if _sub.id is null then return null; end if;
  select * into _ref from public.affiliate_referrals where referred_user_id = _sub.user_id and active = true limit 1;
  if _ref.id is null then return null; end if;
  select * into _aff from public.affiliates where id = _ref.affiliate_id;
  if _aff.id is null or _aff.status in ('blocked','rejected') then return null; end if;
  _rate := public._affiliate_rate('subscription');
  if _rate <= 0 then return null; end if;
  _amount_com := round((_amount * _rate)::numeric, 2);
  _src := 'sub:' || _subscription_id::text || ':' || coalesce(_external_payment_id,'na');
  insert into public.affiliate_commissions
    (affiliate_id, referred_user_id, subscription_id, source_ref, type, plan, gross_amount_uyu, rate, commission_uyu, status)
    values (_aff.id, _sub.user_id, _sub.id, _src, 'recurring', 'subscription', _amount, _rate, _amount_com, 'pending')
    on conflict (source_ref) do nothing returning id into _com_id;
  if _com_id is not null then
    update public.affiliates set pending_balance = pending_balance + _amount_com, total_earned = total_earned + _amount_com where id = _aff.id;
  end if;
  return _com_id;
end; $$;

create or replace function public.approve_pending_commissions()
returns integer language plpgsql security definer set search_path = public as $$
declare _days integer; _count integer;
begin
  select coalesce((value)::text::integer, 7) into _days from public.app_settings where key='affiliate_approve_after_days';
  with upd as (
    update public.affiliate_commissions set status = 'approved', approved_at = now()
      where status = 'pending' and created_at < now() - (_days || ' days')::interval returning 1
  ) select count(*) into _count from upd;
  return _count;
end; $$;

create or replace function public.request_affiliate_payout()
returns public.affiliate_payouts language plpgsql security definer set search_path = public as $$
declare _user uuid := auth.uid(); _aff public.affiliates; _min numeric; _balance numeric; _row public.affiliate_payouts;
begin
  if _user is null then raise exception 'not authenticated'; end if;
  select * into _aff from public.affiliates where user_id = _user;
  if _aff.id is null or _aff.status <> 'approved' then raise exception 'not_approved'; end if;
  select coalesce(_aff.min_payout_uyu, ((select value from public.app_settings where key='affiliate_min_payout_uyu')::text)::integer, 500) into _min;
  select coalesce(sum(commission_uyu),0) into _balance from public.affiliate_commissions where affiliate_id = _aff.id and status = 'approved';
  if _balance < _min then raise exception 'below_minimum'; end if;
  insert into public.affiliate_payouts (affiliate_id, amount_uyu, status, method)
    values (_aff.id, _balance, 'pending', _aff.payout_method) returning * into _row;
  update public.affiliate_commissions set payout_id = _row.id where affiliate_id = _aff.id and status = 'approved' and payout_id is null;
  return _row;
end; $$;

create or replace function public.admin_mark_payout_paid(_payout_id uuid, _external_ref text default null, _notes text default null)
returns void language plpgsql security definer set search_path = public as $$
declare _p record;
begin
  if not has_role(auth.uid(),'admin') then raise exception 'forbidden'; end if;
  select * into _p from public.affiliate_payouts where id = _payout_id;
  if _p.id is null then raise exception 'not_found'; end if;
  if _p.status = 'paid' then return; end if;
  update public.affiliate_payouts
    set status='paid', paid_at = now(), external_ref = coalesce(_external_ref, external_ref), notes = coalesce(_notes, notes)
    where id = _payout_id;
  update public.affiliate_commissions set status = 'paid', paid_at = now() where payout_id = _payout_id;
  update public.affiliates
    set pending_balance = greatest(pending_balance - _p.amount_uyu, 0), total_paid = total_paid + _p.amount_uyu
    where id = _p.affiliate_id;
end; $$;
