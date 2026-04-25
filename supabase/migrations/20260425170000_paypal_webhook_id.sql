insert into public.app_settings (key, value)
values ('paypal_webhook_id', '"0DL80246AP5384054"'::jsonb)
on conflict (key) do update set value = excluded.value;
