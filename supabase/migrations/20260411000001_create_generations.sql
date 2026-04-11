create type generation_type as enum ('video', 'image');
create type generation_status as enum ('pending', 'processing', 'completed', 'failed');

create table public.generations (
  id uuid primary key default gen_random_uuid(),
  type generation_type not null,
  prompt text not null,
  negative_prompt text,
  model text,
  duration text,
  aspect_ratio text,
  mode text,
  image_count integer default 1,
  reference_image_url text,
  task_id text,
  status generation_status not null default 'pending',
  result_urls jsonb default '[]'::jsonb,
  error_message text,
  parameters jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.generations enable row level security;

create policy "Allow all select" on public.generations for select using (true);
create policy "Allow all insert" on public.generations for insert with check (true);
create policy "Allow all update" on public.generations for update using (true);
create policy "Allow all delete" on public.generations for delete using (true);
