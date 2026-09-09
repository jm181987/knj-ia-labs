-- KNJ IA Labs: ejecutar este archivo SIN modificarlo en origen y destino.
-- Guardar ambas salidas y compararlas antes de cualquier cutover.
-- Sólo contiene SELECTs.

\pset pager off
\timing on

\echo '=== IDENTIDAD / ACCESO ==='
SELECT 'profiles' AS metric, count(*)::numeric AS value FROM public.profiles
UNION ALL SELECT 'user_roles', count(*) FROM public.user_roles
UNION ALL SELECT 'admins', count(*) FROM public.user_roles WHERE role::text = 'admin'
UNION ALL SELECT 'users_with_credits', count(*) FROM public.user_credits;

\echo '=== CREDITOS ==='
SELECT
  count(*) AS rows,
  coalesce(sum(balance), 0) AS total_balance,
  coalesce(min(balance), 0) AS min_balance,
  coalesce(max(balance), 0) AS max_balance
FROM public.user_credits;

SELECT
  type,
  count(*) AS rows,
  coalesce(sum(amount), 0) AS total_amount
FROM public.credit_transactions
GROUP BY type
ORDER BY type;

SELECT
  count(*) AS transactions,
  coalesce(sum(amount), 0) AS net_transaction_amount
FROM public.credit_transactions;

\echo '=== PAGOS ==='
SELECT
  status,
  count(*) AS rows,
  coalesce(sum(amount_uyu), 0) AS amount_uyu,
  coalesce(sum(credits), 0) AS credits
FROM public.payments
GROUP BY status
ORDER BY status;

SELECT
  count(*) FILTER (WHERE mp_payment_id IS NOT NULL) AS with_mp_payment_id,
  count(DISTINCT mp_payment_id) FILTER (WHERE mp_payment_id IS NOT NULL) AS distinct_mp_payment_id,
  count(*) FILTER (WHERE mp_preference_id IS NOT NULL) AS with_mp_preference_id,
  count(DISTINCT mp_preference_id) FILTER (WHERE mp_preference_id IS NOT NULL) AS distinct_mp_preference_id
FROM public.payments;

SELECT mp_payment_id, count(*) AS duplicates
FROM public.payments
WHERE mp_payment_id IS NOT NULL
GROUP BY mp_payment_id
HAVING count(*) > 1
ORDER BY duplicates DESC, mp_payment_id;

\echo '=== SUSCRIPCIONES ==='
SELECT
  status,
  count(*) AS rows,
  coalesce(sum(amount_uyu), 0) AS amount_uyu,
  coalesce(sum(monthly_credits), 0) AS monthly_credits
FROM public.subscriptions
GROUP BY status
ORDER BY status;

SELECT
  count(*) FILTER (WHERE mp_preapproval_id IS NOT NULL) AS with_mp_preapproval_id,
  count(DISTINCT mp_preapproval_id) FILTER (WHERE mp_preapproval_id IS NOT NULL) AS distinct_mp_preapproval_id,
  count(*) FILTER (WHERE last_credited_payment_id IS NOT NULL) AS with_last_credited_payment_id,
  count(DISTINCT last_credited_payment_id) FILTER (WHERE last_credited_payment_id IS NOT NULL) AS distinct_last_credited_payment_id
FROM public.subscriptions;

SELECT mp_preapproval_id, count(*) AS duplicates
FROM public.subscriptions
WHERE mp_preapproval_id IS NOT NULL
GROUP BY mp_preapproval_id
HAVING count(*) > 1
ORDER BY duplicates DESC, mp_preapproval_id;

\echo '=== GENERACIONES ==='
SELECT status::text AS status, type::text AS type, count(*) AS rows
FROM public.generations
GROUP BY status, type
ORDER BY status, type;

SELECT
  count(*) FILTER (WHERE task_id IS NOT NULL) AS with_task_id,
  count(DISTINCT task_id) FILTER (WHERE task_id IS NOT NULL) AS distinct_task_id
FROM public.generations;

\echo '=== AFILIADOS ==='
SELECT
  status::text AS status,
  tier::text AS tier,
  count(*) AS rows,
  coalesce(sum(total_earned), 0) AS total_earned,
  coalesce(sum(total_paid), 0) AS total_paid,
  coalesce(sum(pending_balance), 0) AS pending_balance
FROM public.affiliates
GROUP BY status, tier
ORDER BY status, tier;

SELECT
  status::text AS status,
  type::text AS type,
  count(*) AS rows,
  coalesce(sum(gross_amount_uyu), 0) AS gross_amount_uyu,
  coalesce(sum(commission_uyu), 0) AS commission_uyu
FROM public.affiliate_commissions
GROUP BY status, type
ORDER BY status, type;

SELECT
  status::text AS status,
  count(*) AS rows,
  coalesce(sum(amount_uyu), 0) AS amount_uyu
FROM public.affiliate_payouts
GROUP BY status
ORDER BY status;

\echo '=== HUERFANOS RESPECTO A PROFILES ==='
SELECT 'user_credits_without_profile' AS check_name, count(*) AS rows
FROM public.user_credits c
LEFT JOIN public.profiles p ON p.id = c.user_id
WHERE p.id IS NULL
UNION ALL
SELECT 'user_roles_without_profile', count(*)
FROM public.user_roles r
LEFT JOIN public.profiles p ON p.id = r.user_id
WHERE p.id IS NULL
UNION ALL
SELECT 'payments_without_profile', count(*)
FROM public.payments x
LEFT JOIN public.profiles p ON p.id = x.user_id
WHERE p.id IS NULL
UNION ALL
SELECT 'subscriptions_without_profile', count(*)
FROM public.subscriptions x
LEFT JOIN public.profiles p ON p.id = x.user_id
WHERE p.id IS NULL
UNION ALL
SELECT 'credit_transactions_without_profile', count(*)
FROM public.credit_transactions x
LEFT JOIN public.profiles p ON p.id = x.user_id
WHERE p.id IS NULL
UNION ALL
SELECT 'affiliates_without_profile', count(*)
FROM public.affiliates x
LEFT JOIN public.profiles p ON p.id = x.user_id
WHERE p.id IS NULL;

\echo '=== REFERENCIAS DE AFILIADOS ==='
SELECT 'clicks_without_affiliate' AS check_name, count(*) AS rows
FROM public.affiliate_clicks x
LEFT JOIN public.affiliates a ON a.id = x.affiliate_id
WHERE a.id IS NULL
UNION ALL
SELECT 'referrals_without_affiliate', count(*)
FROM public.affiliate_referrals x
LEFT JOIN public.affiliates a ON a.id = x.affiliate_id
WHERE a.id IS NULL
UNION ALL
SELECT 'commissions_without_affiliate', count(*)
FROM public.affiliate_commissions x
LEFT JOIN public.affiliates a ON a.id = x.affiliate_id
WHERE a.id IS NULL
UNION ALL
SELECT 'payouts_without_affiliate', count(*)
FROM public.affiliate_payouts x
LEFT JOIN public.affiliates a ON a.id = x.affiliate_id
WHERE a.id IS NULL;

\echo '=== VENTANA TEMPORAL ==='
SELECT 'profiles' AS table_name, min(created_at) AS oldest, max(created_at) AS newest FROM public.profiles
UNION ALL SELECT 'credit_transactions', min(created_at), max(created_at) FROM public.credit_transactions
UNION ALL SELECT 'payments', min(created_at), max(created_at) FROM public.payments
UNION ALL SELECT 'subscriptions', min(created_at), max(created_at) FROM public.subscriptions
UNION ALL SELECT 'generations', min(created_at), max(created_at) FROM public.generations
UNION ALL SELECT 'affiliate_commissions', min(created_at), max(created_at) FROM public.affiliate_commissions
ORDER BY table_name;

\echo '=== FIN DE VALIDACION ==='