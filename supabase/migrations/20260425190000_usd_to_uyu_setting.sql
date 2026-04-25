insert into public.app_settings (key, value)
values ('usd_to_uyu', '40'::jsonb)
on conflict (key) do nothing;
