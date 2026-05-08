## Sistema de Afiliados Completo

Sistema modular escalable integrado con MercadoPago (suscripciones + pagos únicos) y PayPal existentes.

### 1. Base de datos (migraciones)

**Tablas nuevas:**

- `affiliates` — perfil del afiliado
  - `id`, `user_id` (FK auth.users), `code` (único, slug personalizable), `status` (pending/approved/rejected/blocked), `tier` (bronze/silver/gold), `payout_method` (paypal_email / mp_email / bank_info jsonb), `min_payout_uyu` (default 500), `total_earned`, `total_paid`, `pending_balance`, `created_at`, `approved_at`, `notes`

- `affiliate_clicks` — tracking de clics
  - `id`, `affiliate_id`, `ip_hash`, `user_agent_hash`, `landing_path`, `referrer`, `created_at`

- `affiliate_referrals` — atribución usuario→afiliado (90 días cookie)
  - `id`, `affiliate_id`, `referred_user_id` (único), `attributed_at`, `ip_hash`, `expires_at` (90d desde primer clic, se "fija" al registrar)

- `affiliate_commissions` — comisiones generadas
  - `id`, `affiliate_id`, `referred_user_id`, `payment_id` (FK payments) o `subscription_id`, `type` (one_time/recurring), `plan` (starter/pro/premium/subscription), `gross_amount_uyu`, `rate` (0.15/0.30/0.35), `commission_uyu`, `status` (pending/approved/paid/reversed), `created_at`, `approved_at`, `paid_at`, `payout_id`

- `affiliate_payouts` — pagos al afiliado
  - `id`, `affiliate_id`, `amount_uyu`, `status` (pending/approved/paid/rejected), `method`, `external_ref`, `notes`, `created_at`, `paid_at`

- `affiliate_settings` — config global (en `app_settings` con keys)
  - `affiliate_rates` (json: starter, pro, premium, subscription_recurring)
  - `affiliate_cookie_days` (90)
  - `affiliate_min_payout_uyu`
  - `affiliate_tier_thresholds` (bronze/silver/gold por total_earned)

**Funciones SQL (SECURITY DEFINER):**
- `attribute_referral(referred_user_id, ref_code, ip)` — crea fila en `affiliate_referrals` solo si no existe; valida que `referred_user_id != affiliate.user_id` (anti auto-referido).
- `record_affiliate_commission(payment_id)` — invocada por webhooks MP/PayPal cuando un pago se aprueba; busca referral del comprador, calcula comisión según plan, inserta en `affiliate_commissions`. Bloquea si afiliado está blocked.
- `record_subscription_renewal_commission(subscription_id, mp_payment_id)` — al recibir pago recurrente.
- `compute_affiliate_balance(affiliate_id)` — devuelve pending/approved/paid.
- `recalc_affiliate_tier(affiliate_id)` — actualiza tier según total acumulado.

**RLS:**
- Afiliado ve solo lo suyo. Admin todo. Inserts vía edge functions (service role).

### 2. Edge Functions

- `affiliate-track-click` (verify_jwt=false) — registra clic, devuelve set-cookie `kj_ref` 90 días.
- `affiliate-register` — solicitar ser afiliado (crea perfil pending).
- `affiliate-update-profile` — editar slug/payout method.
- `affiliate-stats` — métricas del dashboard del afiliado.
- `affiliate-admin` — operaciones admin (approve, reject, block, set tier, edit rates, approve payouts, export csv).
- `affiliate-request-payout` — solicitar retiro si `pending_balance >= min`.
- `affiliate-leaderboard` (público) — top 10.
- Modificar `mp-webhook`, `paypal-webhook`, `mp-create-preference` para llamar a `record_affiliate_commission` cuando el pago entra en `approved` (one-time) y a `record_subscription_renewal_commission` en cada pago recurrente.
- Hook `notify-new-user` extendido o nueva `affiliate-emails` para enviar correos: bienvenida afiliado, nueva comisión, pago enviado.

### 3. Frontend

**Rutas nuevas:**

- `/affiliates` (público) — landing del programa con CTA "Ser afiliado".
- `/app/affiliate` — dashboard afiliado (protected):
  - Cards: clics, conversiones, registros, ventas, ingresos generados, balance pendiente, total pagado, usuarios activos.
  - Gráfico de evolución (recharts).
  - Tabla de comisiones recientes.
  - Tabla de payouts.
  - Botón "Solicitar retiro".
  - Sección link/código + copiar + QR.
  - Badge de tier + progreso al siguiente.
- `/app/affiliate/onboarding` — formulario inicial.
- `/admin/affiliates` — panel admin (tabs: Afiliados / Comisiones / Payouts / Settings / Top / Export).
- Componente global `<AffiliateRefCapture/>` montado en `App.tsx`:
  - Lee `?ref=` del URL; llama `affiliate-track-click`; guarda en cookie `kj_ref` (90d).
  - Al detectar usuario autenticado nuevo (no atribuido aún), llama `attribute_referral`.

**Componentes:**
- `AffiliateStatsCards`, `AffiliateChart`, `CommissionsTable`, `PayoutsTable`, `TierBadge`, `Leaderboard`, `AffiliateLinkBox`, admin tables.
- Modo oscuro ya soportado, animaciones con framer-motion (ya disponible o agregar).

### 4. Anti-fraude

- Hash de IP + UA en clics y referrals.
- Bloquear si `referred_user_id == affiliate.user_id` (mismo auth user).
- Bloquear si email del referido coincide con email del afiliado (dominio + local-part normalizado).
- Bloquear si misma IP hash que el afiliado ya generó >N referrals en 24h (configurable).
- Comisiones pasan a `pending` automáticamente y solo a `approved` después de N días (configurable, default 7) para permitir reversos por refund.
- Admin puede marcar afiliado `blocked` → todas sus comisiones futuras se rechazan.

### 5. Tracking & atribución

- URL: `misitio.com/?ref=<code>` o `/?ref=<code>` en cualquier ruta.
- Cookie HttpOnly NO posible desde el browser puro → usar cookie JS `kj_ref` + localStorage de respaldo, 90 días.
- En signup (`AuthPage`), tras `auth.signUp` exitoso, llamar a `attribute_referral` con el code.
- Atribución se mantiene incluso si compra días después: el referral queda guardado por usuario, los webhooks consultan tabla.

### 6. Integración con suscripciones MP

- En `mp-webhook` cuando llega `payment` con `metadata.subscription` o `external_reference` apunta a una suscripción aprobada y se acreditan créditos mensuales → llamar `record_subscription_renewal_commission`.
- Si `preapproval` cambia a `cancelled`/`paused` → no se crean comisiones nuevas; las existentes ya pagadas no se revierten.
- Upgrade/downgrade: la comisión se calcula sobre el `transaction_amount` real cobrado en cada renovación → upgrades pagan más, downgrades menos automáticamente.

### 7. Pagos al afiliado

- Estados: `pending` (afiliado pidió retiro), `approved` (admin OK), `paid` (admin marca pagado con ref externa), `rejected`.
- Mínimo configurable global + override por afiliado.
- Historial visible en dashboard.
- Pago manual por admin (PayPal / MP / bank); el sistema solo registra, no transfiere automáticamente (out of scope).

### 8. Emails (SendGrid ya configurado)

- `affiliate_welcome` — al aprobar.
- `affiliate_commission_new` — al crear comisión.
- `affiliate_payout_sent` — al marcar payout `paid`.
- Plantillas en tabla `email_templates` o hardcoded en edge function.

### 9. Niveles + badges + leaderboard

- Tiers por total acumulado: Bronze (0+), Silver (5.000 UYU+), Gold (25.000 UYU+) — configurable.
- Cada tier puede tener rate boost configurable (futuro, scaffolding listo).
- Leaderboard público top 10 (solo nombre/avatar y total_earned redondeado, opt-in con flag `public_profile`).

### Detalle técnico

- Stack: React + Vite + Supabase (Lovable Cloud) + Edge Functions Deno + Tailwind + shadcn — sin nuevas deps obligatorias.
- Todas las inserciones críticas vía RPC SECURITY DEFINER o service role en edge.
- Webhooks idempotentes (lookup por `payment_id` antes de crear comisión).
- Validaciones Zod en edge functions.
- Logs de auditoría en `affiliate_commissions.status` historiados via campo `status_history jsonb` opcional.

### Orden de implementación (en este loop)

1. Migraciones SQL (tablas + RPCs + RLS + seed `app_settings`).
2. Edge functions nuevas + parches a webhooks MP/PayPal.
3. Componente captura `?ref=` en `App.tsx` + hook signup.
4. Dashboard afiliado + onboarding.
5. Panel admin afiliados.
6. Landing `/affiliates`.
7. Emails.
8. Pruebas humo.

### Fuera de alcance (por ahora)

- Pago automático real al afiliado (transferencias salientes MP/PayPal payouts API) — admin lo hace manual.
- Fingerprinting avanzado (FingerprintJS) — usamos hash IP+UA simple.
- Multi-currency — todo en UYU.
