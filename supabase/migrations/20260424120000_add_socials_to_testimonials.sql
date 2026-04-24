alter table public.testimonials
  add column if not exists instagram_url text,
  add column if not exists facebook_url text,
  add column if not exists linkedin_url text,
  add column if not exists twitter_url text,
  add column if not exists tiktok_url text,
  add column if not exists youtube_url text,
  add column if not exists website_url text;
