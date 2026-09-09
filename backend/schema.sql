-- KNJ IA Labs standalone PostgreSQL schema.
-- No Supabase extensions, auth schema, RLS helpers, Edge Functions or Storage are required.

create table if not exists app_users (
  id uuid primary key,
  email text not null,
  password_hash text not null,
  email_confirmed boolean not null default true,
  token_version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists app_users_email_unique on app_users (lower(email));

create table if not exists profiles (
  id uuid primary key references app_users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  whatsapp text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_roles (
  id uuid primary key,
  user_id uuid not null references app_users(id) on delete cascade,
  role text not null check (role in ('admin','user')),
  created_at timestamptz not null default now(),
  unique(user_id, role)
);

create table if not exists user_credits (
  user_id uuid primary key references app_users(id) on delete cascade,
  balance integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists credit_transactions (
  id uuid primary key,
  user_id uuid not null references app_users(id) on delete cascade,
  amount integer not null,
  reason text not null,
  type text not null,
  generation_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists credit_transactions_user_created_idx on credit_transactions(user_id, created_at desc);

create table if not exists app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists pricing (
  key text primary key,
  credits integer not null,
  description text,
  updated_at timestamptz not null default now()
);

create table if not exists credit_packages (
  id uuid primary key,
  name text not null,
  description text,
  credits integer not null,
  price_uyu numeric not null,
  price_usd numeric,
  active boolean not null default true,
  highlighted boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists generations (
  id uuid primary key,
  user_id uuid references app_users(id) on delete set null,
  task_id text,
  prompt text not null,
  negative_prompt text,
  model text,
  type text not null check (type in ('image','video')),
  status text not null default 'pending' check (status in ('pending','processing','completed','failed')),
  result_urls jsonb,
  reference_image_url text,
  parameters jsonb,
  mode text,
  duration text,
  image_count integer,
  aspect_ratio text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists generations_task_unique on generations(task_id) where task_id is not null;
create index if not exists generations_user_created_idx on generations(user_id, created_at desc);

create table if not exists payments (
  id uuid primary key,
  user_id uuid not null references app_users(id) on delete cascade,
  amount_uyu numeric not null,
  credits integer not null,
  package_id uuid references credit_packages(id) on delete set null,
  status text not null default 'pending',
  mp_payment_id text,
  mp_preference_id text,
  mp_response jsonb,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists payments_mp_payment_unique on payments(mp_payment_id) where mp_payment_id is not null;
create index if not exists payments_user_created_idx on payments(user_id, created_at desc);

create table if not exists subscriptions (
  id uuid primary key,
  user_id uuid not null references app_users(id) on delete cascade,
  preapproval_plan_id text not null,
  mp_preapproval_id text,
  last_credited_payment_id text,
  init_point text,
  status text not null default 'pending',
  amount_uyu numeric not null default 0,
  monthly_credits integer not null default 0,
  next_payment_date timestamptz,
  mp_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists subscriptions_mp_preapproval_unique on subscriptions(mp_preapproval_id) where mp_preapproval_id is not null;
create index if not exists subscriptions_user_created_idx on subscriptions(user_id, created_at desc);

create table if not exists paypal_orders (
  id uuid primary key,
  user_id uuid not null references app_users(id) on delete cascade,
  kind text not null check (kind in ('order','subscription')),
  paypal_order_id text,
  paypal_subscription_id text,
  paypal_plan_id text,
  package_id uuid references credit_packages(id) on delete set null,
  amount_usd numeric not null,
  credits integer not null,
  status text not null default 'pending',
  paypal_response jsonb,
  last_credited_capture_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz
);
create unique index if not exists paypal_orders_order_unique on paypal_orders(paypal_order_id) where paypal_order_id is not null;
create unique index if not exists paypal_orders_sub_unique on paypal_orders(paypal_subscription_id) where paypal_subscription_id is not null;
create index if not exists paypal_orders_user_created_idx on paypal_orders(user_id, created_at desc);

create table if not exists rate_limits (
  user_id uuid primary key references app_users(id) on delete cascade,
  window_start timestamptz not null,
  count integer not null default 0
);

create table if not exists testimonials (
  id uuid primary key,
  name text not null,
  role text,
  role_en text,
  role_pt text,
  message text not null,
  message_en text,
  message_pt text,
  photo_url text,
  active boolean not null default true,
  sort_order integer not null default 0,
  facebook_url text,
  instagram_url text,
  linkedin_url text,
  tiktok_url text,
  twitter_url text,
  website_url text,
  youtube_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists email_templates (
  id uuid primary key,
  name text not null,
  subject text not null,
  html text not null,
  created_by uuid references app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists email_sends (
  id uuid primary key,
  campaign_id uuid,
  template_id uuid references email_templates(id) on delete set null,
  segment text,
  recipient_email text not null,
  recipient_user_id uuid references app_users(id) on delete set null,
  subject text not null,
  status text not null default 'pending',
  error text,
  error_message text,
  sendgrid_message_id text,
  sg_message_id text,
  metadata jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists email_sends_created_idx on email_sends(created_at desc);

create table if not exists affiliates (
  id uuid primary key,
  user_id uuid not null unique references app_users(id) on delete cascade,
  code text not null unique,
  status text not null default 'pending' check (status in ('pending','approved','rejected','blocked')),
  tier text not null default 'bronze' check (tier in ('bronze','silver','gold')),
  payout_method text,
  payout_details jsonb not null default '{}'::jsonb,
  min_payout_uyu integer,
  total_earned numeric not null default 0,
  total_paid numeric not null default 0,
  pending_balance numeric not null default 0,
  public_profile boolean not null default false,
  notes text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists affiliate_clicks (
  id uuid primary key,
  affiliate_id uuid not null references affiliates(id) on delete cascade,
  ip_hash text,
  ua_hash text,
  landing_path text,
  referrer text,
  created_at timestamptz not null default now()
);
create index if not exists affiliate_clicks_aff_created_idx on affiliate_clicks(affiliate_id, created_at desc);

create table if not exists affiliate_referrals (
  id uuid primary key,
  affiliate_id uuid not null references affiliates(id) on delete cascade,
  referred_user_id uuid not null unique references app_users(id) on delete cascade,
  attributed_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days'),
  ip_hash text,
  active boolean not null default true
);

create table if not exists affiliate_payouts (
  id uuid primary key,
  affiliate_id uuid not null references affiliates(id) on delete cascade,
  amount_uyu numeric not null,
  status text not null default 'pending' check (status in ('pending','approved','paid','rejected')),
  method text,
  external_ref text,
  notes text,
  approved_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists affiliate_commissions (
  id uuid primary key,
  affiliate_id uuid not null references affiliates(id) on delete cascade,
  referred_user_id uuid not null references app_users(id) on delete cascade,
  payment_id uuid references payments(id) on delete set null,
  subscription_id uuid references subscriptions(id) on delete set null,
  source_ref text unique,
  type text not null check (type in ('one_time','recurring')),
  plan text not null,
  gross_amount_uyu numeric not null,
  rate numeric not null,
  commission_uyu numeric not null,
  status text not null default 'pending' check (status in ('pending','approved','paid','reversed','rejected')),
  payout_id uuid references affiliate_payouts(id) on delete set null,
  approved_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists affiliate_commissions_aff_status_idx on affiliate_commissions(affiliate_id, status, created_at desc);

-- PostgreSQL-backed object storage. Files are uploaded in chunks so this also works
-- behind hosts with small request limits.
create table if not exists storage_objects (
  bucket text not null,
  path text not null,
  owner_id uuid references app_users(id) on delete set null,
  content_type text not null default 'application/octet-stream',
  size_bytes bigint not null,
  data bytea not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(bucket, path)
);

create table if not exists storage_uploads (
  id uuid primary key,
  bucket text not null,
  path text not null,
  owner_id uuid not null references app_users(id) on delete cascade,
  content_type text not null,
  expected_size bigint not null,
  created_at timestamptz not null default now()
);

create table if not exists storage_upload_parts (
  upload_id uuid not null references storage_uploads(id) on delete cascade,
  part_no integer not null,
  data bytea not null,
  primary key(upload_id, part_no)
);

create table if not exists password_resets (
  id uuid primary key,
  user_id uuid not null references app_users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function knj_set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare r record;
begin
  for r in select unnest(array[
    'app_users','profiles','user_credits','app_settings','pricing','credit_packages',
    'generations','payments','subscriptions','paypal_orders','testimonials',
    'email_templates','affiliates','storage_objects'
  ]) as table_name
  loop
    execute format('drop trigger if exists %I_updated_at on %I', r.table_name, r.table_name);
    execute format('create trigger %I_updated_at before update on %I for each row execute function knj_set_updated_at()', r.table_name, r.table_name);
  end loop;
end $$;

-- Versioned configuration defaults. Existing values are never overwritten.
insert into app_settings(key, value) values
  ('welcome_credits', '10'::jsonb),
  ('pricing_markup', '3'::jsonb),
  ('pricing_credits_per_usd', '37'::jsonb),
  ('pricing_mp_fee_pct', '7.99'::jsonb),
  ('usd_to_uyu', '40'::jsonb),
  ('paypal_subscription_plan_id', '""'::jsonb),
  ('paypal_subscription_price_usd', '22.50'::jsonb),
  ('paypal_subscription_credits', '500'::jsonb),
  ('paypal_usd_per_credit', '0.05'::jsonb),
  ('paypal_min_usd', '2'::jsonb),
  ('paypal_webhook_id', '""'::jsonb),
  ('affiliate_rates', '{"starter":0.15,"pro":0.30,"premium":0.35,"subscription":0.30}'::jsonb),
  ('affiliate_cookie_days', '90'::jsonb),
  ('affiliate_min_payout_uyu', '500'::jsonb),
  ('affiliate_tier_thresholds', '{"silver":5000,"gold":25000}'::jsonb),
  ('affiliate_approve_after_days', '7'::jsonb),
  ('affiliate_package_plan_map', '{"bc2d217e-3c46-40d4-9808-a3d99de09355":"starter","ff2fe09c-093c-4d2d-ba20-8e50831ce3b9":"pro","4369e2b1-14a4-4b9b-ae58-41acce049685":"premium"}'::jsonb)
on conflict (key) do nothing;

insert into credit_packages(id, name, description, credits, price_uyu, active, highlighted, sort_order) values
  ('0a26fd7c-8021-4be6-b606-e6e33061170b','Basic',null,50,199,true,false,0),
  ('bc2d217e-3c46-40d4-9808-a3d99de09355','Starter',null,150,399,true,false,1),
  ('ff2fe09c-093c-4d2d-ba20-8e50831ce3b9','Pro',null,500,949,true,true,2),
  ('4369e2b1-14a4-4b9b-ae58-41acce049685','Premium',null,1500,2749,true,false,3),
  ('a39f4c58-0a9f-4a23-8972-a0e02b1f08db','Ultra',null,5000,8999,true,false,4)
on conflict (id) do nothing;
