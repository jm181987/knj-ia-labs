import { query, transaction } from './db.mjs';
import { uuid } from './auth.mjs';

export async function hasRole(userId, role) {
  if (!userId) return false;
  const result = await query(`select 1 from user_roles where user_id=$1 and role=$2 limit 1`, [userId, role]);
  return result.rowCount > 0;
}

export async function checkAndIncrementRateLimit(userId, maxPerMinute = 10) {
  if (!userId) return false;
  return transaction(async (client) => {
    const now = new Date();
    const result = await client.query(`select window_start,count from rate_limits where user_id=$1 for update`, [userId]);
    if (!result.rowCount) {
      await client.query(`insert into rate_limits(user_id,window_start,count) values ($1,$2,1)`, [userId, now]);
      return true;
    }
    const row = result.rows[0];
    if (now.getTime() - new Date(row.window_start).getTime() >= 60_000) {
      await client.query(`update rate_limits set window_start=$2,count=1 where user_id=$1`, [userId, now]);
      return true;
    }
    if (Number(row.count) >= Number(maxPerMinute)) return false;
    await client.query(`update rate_limits set count=count+1 where user_id=$1`, [userId]);
    return true;
  });
}

export async function adjustCredits({ userId, amount, reason, type, generationId = null }) {
  const n = Math.abs(Number(amount) || 0);
  if (!userId || n <= 0) throw new Error('invalid_credit_amount');
  const debit = type === 'debit';
  return transaction(async (client) => {
    const current = await client.query(`select balance from user_credits where user_id=$1 for update`, [userId]);
    if (!current.rowCount) {
      await client.query(`insert into user_credits(user_id,balance) values ($1,0)`, [userId]);
    }
    const balance = Number(current.rows[0]?.balance || 0);
    if (debit && balance < n) throw new Error('insufficient_credits');
    const delta = debit ? -n : n;
    const updated = await client.query(
      `update user_credits set balance=balance+$2 where user_id=$1 returning balance`,
      [userId, delta],
    );
    await client.query(
      `insert into credit_transactions(id,user_id,amount,reason,type,generation_id)
       values ($1,$2,$3,$4,$5,$6)`,
      [uuid(), userId, delta, String(reason || ''), debit ? 'debit' : type || 'credit', generationId],
    );
    return Number(updated.rows[0].balance);
  });
}

export const addCreditsSystem = (userId, amount, reason) =>
  adjustCredits({ userId, amount, reason, type: 'credit' });
export const debitCreditsForUser = (userId, amount, reason) =>
  adjustCredits({ userId, amount, reason, type: 'debit' });
export const refundCreditsForUser = (userId, amount, reason, generationId = null) =>
  adjustCredits({ userId, amount, reason, type: 'refund', generationId });

async function setting(key, fallback) {
  const result = await query(`select value from app_settings where key=$1`, [key]);
  return result.rows[0]?.value ?? fallback;
}

export async function affiliateRate(plan) {
  const rates = await setting('affiliate_rates', {});
  return Number(rates?.[plan] || 0);
}

export async function registerAffiliate(userId, code) {
  const slug = String(code || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 33);
  if (slug.length < 3) throw new Error('code_too_short');
  if (slug.length > 32) throw new Error('code_too_long');
  const exists = await query(`select 1 from affiliates where code=$1`, [slug]);
  if (exists.rowCount) throw new Error('code_taken');
  const result = await query(
    `insert into affiliates(id,user_id,code,status) values ($1,$2,$3,'pending') returning *`,
    [uuid(), userId, slug],
  );
  return result.rows[0];
}

export async function attributeReferral(referredUserId, refCode, ipHash = null) {
  if (!referredUserId || !refCode) return false;
  const affiliate = await query(
    `select * from affiliates where code=$1 and status in ('approved','pending') limit 1`,
    [String(refCode).toLowerCase()],
  );
  const aff = affiliate.rows[0];
  if (!aff || aff.user_id === referredUserId) return false;
  const exists = await query(`select 1 from affiliate_referrals where referred_user_id=$1`, [referredUserId]);
  if (exists.rowCount) return false;
  const days = Math.max(1, Number(await setting('affiliate_cookie_days', 90)) || 90);
  await query(
    `insert into affiliate_referrals(id,affiliate_id,referred_user_id,ip_hash,expires_at)
     values ($1,$2,$3,$4,now()+($5::text || ' days')::interval)`,
    [uuid(), aff.id, referredUserId, ipHash, days],
  );
  return true;
}

export async function recordAffiliateCommissionPayment(paymentId) {
  return transaction(async (client) => {
    const paymentResult = await client.query(`select * from payments where id=$1`, [paymentId]);
    const payment = paymentResult.rows[0];
    if (!payment || payment.status !== 'approved') return null;
    const refResult = await client.query(
      `select r.*,a.user_id as affiliate_user_id,a.status as affiliate_status,a.id as aff_id
         from affiliate_referrals r join affiliates a on a.id=r.affiliate_id
        where r.referred_user_id=$1 and r.active=true and r.expires_at>now()
        limit 1`,
      [payment.user_id],
    );
    const ref = refResult.rows[0];
    if (!ref || ['blocked','rejected'].includes(ref.affiliate_status) || ref.affiliate_user_id === payment.user_id) return null;
    const settings = await client.query(`select key,value from app_settings where key in ('affiliate_package_plan_map','affiliate_rates')`);
    const map = Object.fromEntries(settings.rows.map((r) => [r.key, r.value]));
    const plan = map.affiliate_package_plan_map?.[String(payment.package_id)] || 'starter';
    const rate = Number(map.affiliate_rates?.[plan] || 0);
    if (rate <= 0) return null;
    const commission = Math.round(Number(payment.amount_uyu) * rate * 100) / 100;
    const sourceRef = `payment:${payment.id}`;
    const id = uuid();
    const inserted = await client.query(
      `insert into affiliate_commissions
        (id,affiliate_id,referred_user_id,payment_id,source_ref,type,plan,gross_amount_uyu,rate,commission_uyu,status)
       values ($1,$2,$3,$4,$5,'one_time',$6,$7,$8,$9,'pending')
       on conflict(source_ref) do nothing returning id`,
      [id, ref.aff_id, payment.user_id, payment.id, sourceRef, plan, payment.amount_uyu, rate, commission],
    );
    if (!inserted.rowCount) return null;
    await client.query(
      `update affiliates set pending_balance=pending_balance+$2,total_earned=total_earned+$2 where id=$1`,
      [ref.aff_id, commission],
    );
    return id;
  });
}

export async function recordAffiliateCommissionSubscription(subscriptionId, externalPaymentId, amount) {
  return transaction(async (client) => {
    const subResult = await client.query(`select * from subscriptions where id=$1`, [subscriptionId]);
    const sub = subResult.rows[0];
    if (!sub) return null;
    const refResult = await client.query(
      `select r.*,a.user_id as affiliate_user_id,a.status as affiliate_status,a.id as aff_id
         from affiliate_referrals r join affiliates a on a.id=r.affiliate_id
        where r.referred_user_id=$1 and r.active=true and r.expires_at>now() limit 1`,
      [sub.user_id],
    );
    const ref = refResult.rows[0];
    if (!ref || ['blocked','rejected'].includes(ref.affiliate_status) || ref.affiliate_user_id === sub.user_id) return null;
    const ratesResult = await client.query(`select value from app_settings where key='affiliate_rates'`);
    const rate = Number(ratesResult.rows[0]?.value?.subscription || 0);
    if (rate <= 0) return null;
    const commission = Math.round(Number(amount) * rate * 100) / 100;
    const sourceRef = `sub:${subscriptionId}:${externalPaymentId || 'na'}`;
    const id = uuid();
    const inserted = await client.query(
      `insert into affiliate_commissions
        (id,affiliate_id,referred_user_id,subscription_id,source_ref,type,plan,gross_amount_uyu,rate,commission_uyu,status)
       values ($1,$2,$3,$4,$5,'recurring','subscription',$6,$7,$8,'pending')
       on conflict(source_ref) do nothing returning id`,
      [id, ref.aff_id, sub.user_id, sub.id, sourceRef, amount, rate, commission],
    );
    if (!inserted.rowCount) return null;
    await client.query(`update affiliates set pending_balance=pending_balance+$2,total_earned=total_earned+$2 where id=$1`, [ref.aff_id, commission]);
    return id;
  });
}

export async function approvePendingCommissions() {
  const days = Math.max(0, Number(await setting('affiliate_approve_after_days', 7)) || 7);
  const result = await query(
    `update affiliate_commissions set status='approved',approved_at=now()
      where status='pending' and created_at < now()-($1::text || ' days')::interval
      returning id`,
    [days],
  );
  return result.rowCount;
}

export async function requestAffiliatePayout(userId) {
  return transaction(async (client) => {
    const affResult = await client.query(`select * from affiliates where user_id=$1 for update`, [userId]);
    const aff = affResult.rows[0];
    if (!aff || aff.status !== 'approved') throw new Error('not_approved');
    const settingResult = await client.query(`select value from app_settings where key='affiliate_min_payout_uyu'`);
    const minimum = Number(aff.min_payout_uyu ?? settingResult.rows[0]?.value ?? 500);
    const balanceResult = await client.query(
      `select coalesce(sum(commission_uyu),0) as balance from affiliate_commissions
        where affiliate_id=$1 and status='approved' and payout_id is null`,
      [aff.id],
    );
    const balance = Number(balanceResult.rows[0]?.balance || 0);
    if (balance < minimum) throw new Error('below_minimum');
    const id = uuid();
    const payout = await client.query(
      `insert into affiliate_payouts(id,affiliate_id,amount_uyu,status,method)
       values ($1,$2,$3,'pending',$4) returning *`,
      [id, aff.id, balance, aff.payout_method],
    );
    await client.query(
      `update affiliate_commissions set payout_id=$2 where affiliate_id=$1 and status='approved' and payout_id is null`,
      [aff.id, id],
    );
    return payout.rows[0];
  });
}

export async function adminMarkPayoutPaid(payoutId, externalRef = null, notes = null) {
  return transaction(async (client) => {
    const payoutResult = await client.query(`select * from affiliate_payouts where id=$1 for update`, [payoutId]);
    const payout = payoutResult.rows[0];
    if (!payout) throw new Error('payout_not_found');
    if (payout.status === 'paid') return;
    await client.query(
      `update affiliate_payouts set status='paid',paid_at=now(),approved_at=coalesce(approved_at,now()),external_ref=$2,notes=coalesce($3,notes) where id=$1`,
      [payoutId, externalRef, notes],
    );
    await client.query(`update affiliate_commissions set status='paid',paid_at=now() where payout_id=$1 and status='approved'`, [payoutId]);
    await client.query(
      `update affiliates set total_paid=total_paid+$2,pending_balance=greatest(0,pending_balance-$2) where id=$1`,
      [payout.affiliate_id, payout.amount_uyu],
    );
  });
}

export async function cleanupOldGenerations() {
  const result = await query(
    `delete from generations where created_at < now()-interval '30 days' and status in ('completed','failed') returning id`,
  );
  return result.rowCount;
}

export async function executeRpc(name, args, auth) {
  const userId = auth?.user?.id;
  switch (name) {
    case 'has_role':
      if (!userId && !auth?.isAdmin) return false;
      if (!auth?.isAdmin && args?._user_id !== userId) throw Object.assign(new Error('No autorizado'), { status: 403 });
      return hasRole(args?._user_id || userId, args?._role);
    case 'check_and_increment_rate_limit':
      if (!userId) throw Object.assign(new Error('No autenticado'), { status: 401 });
      if (!auth.isAdmin && args?._user_id && args._user_id !== userId) throw Object.assign(new Error('No autorizado'), { status: 403 });
      return checkAndIncrementRateLimit(args?._user_id || userId, args?._max_per_minute || 10);
    case 'consume_credits':
      if (!userId) throw Object.assign(new Error('No autenticado'), { status: 401 });
      return debitCreditsForUser(userId, args?._amount, args?._reason);
    case 'add_credits_system':
      if (!auth?.isAdmin) throw Object.assign(new Error('No autorizado'), { status: 403 });
      return addCreditsSystem(args?._user_id, args?._amount, args?._reason);
    case 'debit_credits_for_user':
      if (!auth?.isAdmin) throw Object.assign(new Error('No autorizado'), { status: 403 });
      return debitCreditsForUser(args?._user_id, args?._amount, args?._reason);
    case 'refund_credits_for_user':
      if (!auth?.isAdmin) throw Object.assign(new Error('No autorizado'), { status: 403 });
      return refundCreditsForUser(args?._user_id, args?._amount, args?._reason, args?._generation_id || null);
    case '_affiliate_rate':
      return affiliateRate(args?._plan);
    case 'register_affiliate':
      if (!userId) throw Object.assign(new Error('No autenticado'), { status: 401 });
      return registerAffiliate(userId, args?._code);
    case 'attribute_referral':
      if (!userId && !auth?.isAdmin) throw Object.assign(new Error('No autenticado'), { status: 401 });
      if (!auth?.isAdmin && args?._referred_user_id !== userId) throw Object.assign(new Error('No autorizado'), { status: 403 });
      return attributeReferral(args?._referred_user_id || userId, args?._ref_code, args?._ip_hash || null);
    case 'record_affiliate_commission_payment':
      if (!auth?.isAdmin) throw Object.assign(new Error('No autorizado'), { status: 403 });
      return recordAffiliateCommissionPayment(args?._payment_id);
    case 'record_affiliate_commission_subscription':
      if (!auth?.isAdmin) throw Object.assign(new Error('No autorizado'), { status: 403 });
      return recordAffiliateCommissionSubscription(args?._subscription_id, args?._external_payment_id, args?._amount);
    case 'approve_pending_commissions':
      if (!auth?.isAdmin) throw Object.assign(new Error('No autorizado'), { status: 403 });
      return approvePendingCommissions();
    case 'request_affiliate_payout':
      if (!userId) throw Object.assign(new Error('No autenticado'), { status: 401 });
      return requestAffiliatePayout(userId);
    case 'admin_mark_payout_paid':
      if (!auth?.isAdmin) throw Object.assign(new Error('No autorizado'), { status: 403 });
      await adminMarkPayoutPaid(args?._payout_id, args?._external_ref, args?._notes);
      return null;
    case 'cleanup_old_generations':
      if (!auth?.isAdmin) throw Object.assign(new Error('No autorizado'), { status: 403 });
      return cleanupOldGenerations();
    default:
      throw Object.assign(new Error(`RPC no disponible: ${name}`), { status: 404 });
  }
}
