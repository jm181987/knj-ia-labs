-- Email templates (saved in DB, reusable)
create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null,
  html text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.email_templates enable row level security;

create policy "Admins manage templates"
  on public.email_templates for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create trigger email_templates_updated_at
  before update on public.email_templates
  for each row execute function public.set_updated_at();

-- Log of sent emails
create table if not exists public.email_sends (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid,
  template_id uuid references public.email_templates(id) on delete set null,
  segment text not null,
  recipient_email text not null,
  recipient_user_id uuid,
  subject text not null,
  status text not null default 'pending',
  error_message text,
  sg_message_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.email_sends enable row level security;

create policy "Admins view all email_sends"
  on public.email_sends for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create index if not exists idx_email_sends_campaign on public.email_sends(campaign_id);
create index if not exists idx_email_sends_created on public.email_sends(created_at desc);
