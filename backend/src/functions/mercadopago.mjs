import { query, transaction } from '../db.mjs';
import { uuid } from '../auth.mjs';
import { addCreditsSystem, recordAffiliateCommissionPayment, recordAffiliateCommissionSubscription } from '../rpc.mjs';

const MP_API = 'https://api.mercadopago.com';
const NOTIFY_TO = process.env.ADMIN_WHATSAPP || '59893867429';

function token() {
  const value = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!value) throw new Error('MERCADOPAGO_ACCESS_TOKEN no configurado');
  return value;
}
function requireUser(auth) {
  if (!auth?.user) throw Object.assign(new Error('No autenticado'), { status: 401 });
  return auth.user;
}
function requireAdmin(auth) {
  if (!auth?.isAdmin) throw Object.assign(new Error('No autorizado'), { status: 403 });
}
async function notifyWhatsApp(text) {
  const base = process.env.EVOLUTION_API_URL;
  const instance = process.env.EVOLUTION_INSTANCE;
  const apiKey = process.env.EVOLUTION_API_KEY;
  if (!base || !instance || !apiKey) return;
  try {
    await fetch(`${base.replace(/\/$/, '')}/message/sendText/${instance}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: apiKey },
      body: JSON.stringify({ number: NOTIFY_TO, text }),
    });
  } catch (e) { console.error('[whatsapp]', e); }
}
async function profileLabel(userId) {
  const r = await query(`select email,display_name from profiles where id=$1`, [userId]);
  const p = r.rows[0];
  return p?.display_name || p?.email || userId;
}
function mapStatus(status) {
  if (status === 'approved') return 'approved';
  if (status === 'rejected' || status === 'cancelled') return 'rejected';
  if (status === 'refunded') return 'refunded';
  return 'pending';
}

async function creditApprovedPayment(paymentId, mpPaymentId, mpData, reasonPrefix = 'Pago Mercado Pago') {
  const result = await transaction(async (client) => {
    const locked = await client.query(`select * from payments where id=$1 for update`, [paymentId]);
    const payment = locked.rows[0];
    if (!payment) return { changed: false, payment: null };
    if (payment.status === 'approved') return { changed: false, payment };
    const credits = Number(payment.credits || 0);
    const bal = await client.query(`select balance from user_credits where user_id=$1 for update`, [payment.user_id]);
    if (!bal.rowCount) await client.query(`insert into user_credits(user_id,balance) values ($1,0)`, [payment.user_id]);
    await client.query(`update user_credits set balance=balance+$2 where user_id=$1`, [payment.user_id, credits]);
    await client.query(
      `insert into credit_transactions(id,user_id,amount,reason,type) values ($1,$2,$3,$4,'credit')`,
      [uuid(), payment.user_id, credits, `${reasonPrefix} #${mpPaymentId} (${credits} créditos)`],
    );
    await client.query(
      `update payments set status='approved',mp_payment_id=$2,mp_response=$3::jsonb,approved_at=coalesce($4::timestamptz,now()) where id=$1`,
      [payment.id, String(mpPaymentId), JSON.stringify(mpData || {}), mpData?.date_approved || null],
    );
    return { changed: true, payment };
  });
  if (result.changed && result.payment) {
    recordAffiliateCommissionPayment(result.payment.id).catch((e) => console.warn('[affiliate payment]', e));
  }
  return result;
}

export async function createPreference(body, auth, ctx = {}) {
  const user = requireUser(auth);
  const MP_TOKEN = token();
  const { package_id, custom_amount, return_origin, device_id } = body || {};
  let title, description, itemId, amountUYU, credits, packageId = null;
  if (custom_amount !== undefined && custom_amount !== null) {
    const amount = Number(custom_amount);
    if (!Number.isFinite(amount) || amount < 80) throw Object.assign(new Error('El monto mínimo es $80 UYU'), { status: 400 });
    amountUYU = Math.round(amount); credits = Math.floor(amount / 1.99); itemId = 'custom';
    title = 'Recarga personalizada'; description = `${credits} créditos para KNJ Pro`;
  } else {
    if (!package_id) throw Object.assign(new Error('Falta package_id o custom_amount'), { status: 400 });
    const pkgResult = await query(`select * from credit_packages where id=$1 and active=true`, [package_id]);
    const pkg = pkgResult.rows[0];
    if (!pkg) throw Object.assign(new Error('Paquete no disponible'), { status: 404 });
    packageId = pkg.id; amountUYU = Number(pkg.price_uyu); credits = Number(pkg.credits);
    itemId = pkg.id; title = pkg.name; description = `${pkg.credits} créditos para KNJ Pro`;
  }
  const paymentId = uuid();
  await query(
    `insert into payments(id,user_id,package_id,amount_uyu,credits,status) values ($1,$2,$3,$4,$5,'pending')`,
    [paymentId, user.id, packageId, amountUYU, credits],
  );
  const origin = String(return_origin || ctx.origin || process.env.FRONTEND_URL || '').replace(/\/$/, '');
  const apiBase = String(process.env.PUBLIC_API_URL || ctx.apiBase || origin).replace(/\/$/, '');
  const mpRes = await fetch(`${MP_API}/checkout/preferences`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${MP_TOKEN}`, 'Content-Type':'application/json', ...(device_id ? { 'X-meli-session-id': String(device_id) } : {}) },
    body: JSON.stringify({
      items:[{ id:itemId,title,description,quantity:1,currency_id:'UYU',unit_price:amountUYU }],
      payer:{ email:user.email }, external_reference:paymentId,
      back_urls:{
        success:`${origin}/payment/success?payment_id=${paymentId}`,
        failure:`${origin}/payment/failure?payment_id=${paymentId}`,
        pending:`${origin}/payment/pending?payment_id=${paymentId}`,
      },
      auto_return:'approved', notification_url:`${apiBase}/api/functions/mp-webhook`, statement_descriptor:'KNJ Pro',
      metadata:{ payment_id:paymentId,user_id:user.id,credits },
    }),
  });
  const data = await mpRes.json().catch(() => ({}));
  if (!mpRes.ok) {
    await query(`update payments set status='rejected',mp_response=$2::jsonb where id=$1`, [paymentId, JSON.stringify(data)]);
    throw Object.assign(new Error(`MP: ${data?.message || JSON.stringify(data)}`), { status: 502 });
  }
  await query(`update payments set mp_preference_id=$2,mp_response=$3::jsonb where id=$1`, [paymentId, data.id, JSON.stringify(data)]);
  return { payment_id:paymentId, preference_id:data.id, init_point:data.init_point, sandbox_init_point:data.sandbox_init_point };
}

export async function createSubscription(body, auth, ctx = {}) {
  const user = requireUser(auth); const MP_TOKEN = token();
  const existingResult = await query(`select * from subscriptions where user_id=$1 and status in ('authorized','pending') order by created_at desc limit 1`, [user.id]);
  const existing = existingResult.rows[0];
  if (existing?.status === 'authorized') throw Object.assign(new Error('Ya tenés una suscripción activa'), { status: 409, details: existing });
  const origin = String(body?.return_origin || ctx.origin || process.env.FRONTEND_URL || '').replace(/\/$/, '');
  const monthlyCredits = 500, amountUYU = 900, planId = '19cf7b307f8741a6b5ff8933619d6277';
  const mpBody = {
    reason:`${monthlyCredits} créditos mensuales KNJ PRO`, payer_email:user.email, external_reference:user.id,
    back_url:`${origin}/payment/success?subscription=1`, status:'pending',
    auto_recurring:{ frequency:1,frequency_type:'months',transaction_amount:amountUYU,currency_id:'UYU' },
  };
  const res = await fetch(`${MP_API}/preapproval`, {
    method:'POST', headers:{ Authorization:`Bearer ${MP_TOKEN}`,'Content-Type':'application/json', ...(body?.device_id ? {'X-meli-session-id':String(body.device_id)} : {}) },
    body:JSON.stringify(mpBody),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(`Mercado Pago: ${data?.message || data?.cause?.[0]?.description || JSON.stringify(data)}`), { status: 400 });
  const initPoint = data.init_point || data.sandbox_init_point;
  if (existing) {
    await query(`update subscriptions set mp_preapproval_id=$2,status='pending',init_point=$3,mp_response=$4::jsonb where id=$1`, [existing.id,data.id,initPoint,JSON.stringify(data)]);
  } else {
    await query(
      `insert into subscriptions(id,user_id,mp_preapproval_id,preapproval_plan_id,status,monthly_credits,amount_uyu,init_point,mp_response)
       values ($1,$2,$3,$4,'pending',$5,$6,$7,$8::jsonb)`,
      [uuid(),user.id,data.id,planId,monthlyCredits,amountUYU,initPoint,JSON.stringify(data)],
    );
  }
  return { preapproval_id:data.id, init_point:initPoint };
}

export async function cancelSubscription(body, auth) {
  requireAdmin(auth); const MP_TOKEN = token();
  if (!body?.subscription_id) throw Object.assign(new Error('subscription_id requerido'), { status: 400 });
  const r = await query(`select * from subscriptions where id=$1`, [body.subscription_id]);
  const sub = r.rows[0];
  if (!sub) throw Object.assign(new Error('Suscripción no encontrada'), { status: 404 });
  if (!sub.mp_preapproval_id) throw Object.assign(new Error('Sin mp_preapproval_id'), { status: 400 });
  const res = await fetch(`${MP_API}/preapproval/${sub.mp_preapproval_id}`, {
    method:'PUT', headers:{Authorization:`Bearer ${MP_TOKEN}`,'Content-Type':'application/json'}, body:JSON.stringify({status:'cancelled'}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(`MP: ${data?.message || JSON.stringify(data)}`), { status: 502 });
  await query(`update subscriptions set status='cancelled',mp_response=$2::jsonb where id=$1`, [sub.id,JSON.stringify(data)]);
  return { ok:true,status:'cancelled' };
}

export async function processPayment(mpPaymentId) {
  const MP_TOKEN = token();
  const res = await fetch(`${MP_API}/v1/payments/${mpPaymentId}`, { headers:{Authorization:`Bearer ${MP_TOKEN}`} });
  const mp = await res.json().catch(() => ({}));
  if (!res.ok) return { ignored:true,error:mp?.message || `MP ${res.status}` };
  const status = mp.status;
  const preapprovalId = mp.preapproval_id || mp?.point_of_interaction?.transaction_data?.preapproval_id;
  if (preapprovalId) {
    const subR = await query(`select * from subscriptions where mp_preapproval_id=$1 limit 1`, [preapprovalId]);
    const sub = subR.rows[0]; if (!sub) return { ignored:true };
    if (status === 'approved' && sub.last_credited_payment_id !== String(mpPaymentId)) {
      await addCreditsSystem(sub.user_id, sub.monthly_credits, `Suscripción mensual MP #${mpPaymentId} (${sub.monthly_credits} créditos)`);
      await query(`update subscriptions set last_credited_payment_id=$2,status='authorized',mp_response=$3::jsonb where id=$1`, [sub.id,String(mpPaymentId),JSON.stringify(mp)]);
      await notifyWhatsApp(`🔁 *Suscripción cobrada*\nUsuario: ${await profileLabel(sub.user_id)}\nMonto: $${sub.amount_uyu} UYU\nCréditos: ${sub.monthly_credits}\nMP ID: ${mpPaymentId}`);
      recordAffiliateCommissionSubscription(sub.id,String(mpPaymentId),Number(sub.amount_uyu)).catch(() => {});
    }
    return { subscription:true,status };
  }
  const externalRef = mp.external_reference;
  if (!externalRef) return { ignored:true };
  const pR = await query(`select * from payments where id=$1`, [externalRef]); const payment = pR.rows[0];
  if (!payment) return { ignored:true };
  const newStatus = mapStatus(status);
  if (newStatus === 'approved') {
    const approved = await creditApprovedPayment(payment.id,mpPaymentId,mp);
    if (approved.changed) await notifyWhatsApp(`✅ *Venta aprobada*\nUsuario: ${await profileLabel(payment.user_id)}\nMonto: $${payment.amount_uyu} UYU\nCréditos: ${payment.credits}\nMP ID: ${mpPaymentId}`);
  } else {
    await query(`update payments set status=$2,mp_payment_id=$3,mp_response=$4::jsonb,approved_at=null where id=$1`, [payment.id,newStatus,String(mpPaymentId),JSON.stringify(mp)]);
    if (newStatus === 'rejected') await notifyWhatsApp(`❌ *Pago rechazado*\nUsuario: ${await profileLabel(payment.user_id)}\nMonto: $${payment.amount_uyu} UYU\nMotivo: ${mp.status_detail || 'n/a'}\nMP ID: ${mpPaymentId}`);
  }
  return { payment:true,status:newStatus };
}

export async function processPreapproval(preapprovalId) {
  const MP_TOKEN = token();
  const res = await fetch(`${MP_API}/preapproval/${preapprovalId}`, { headers:{Authorization:`Bearer ${MP_TOKEN}`} });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ignored:true,error:data?.message || `MP ${res.status}` };
  let subR = await query(`select * from subscriptions where mp_preapproval_id=$1 limit 1`, [preapprovalId]);
  let sub = subR.rows[0];
  if (!sub && data.external_reference) {
    subR = await query(`select * from subscriptions where user_id=$1 order by created_at desc limit 1`, [data.external_reference]);
    sub = subR.rows[0];
    if (sub) await query(`update subscriptions set mp_preapproval_id=$2 where id=$1`, [sub.id,preapprovalId]);
  }
  if (!sub) return { ignored:true };
  await query(`update subscriptions set status=$2,next_payment_date=$3,mp_response=$4::jsonb where id=$1`, [sub.id,data.status,data.next_payment_date || null,JSON.stringify(data)]);
  if (data.status === 'authorized') await notifyWhatsApp(`🎉 *Nueva suscripción activa*\nUser: ${sub.user_id}\nPlan: ${sub.amount_uyu} UYU/mes\nPreapproval: ${preapprovalId}`);
  if (data.status === 'cancelled') await notifyWhatsApp(`🚫 *Suscripción cancelada*\nUser: ${sub.user_id}\nPreapproval: ${preapprovalId}`);
  return { subscription:true,status:data.status };
}

export async function webhook(body, ctx = {}) {
  const type = body?.type || body?.topic || ctx.query?.type || ctx.query?.topic;
  const resourceId = body?.data?.id || ctx.query?.['data.id'] || ctx.query?.id;
  if (!resourceId) return { ok:true,ignored:true };
  if (type === 'payment' || type === 'authorized_payment' || type === 'subscription_authorized_payment') await processPayment(String(resourceId));
  else if (type === 'preapproval' || type === 'subscription_preapproval') await processPreapproval(String(resourceId));
  return { ok:true };
}

async function searchByExternalReference(externalRef) {
  const res = await fetch(`${MP_API}/v1/payments/search?external_reference=${encodeURIComponent(externalRef)}&sort=date_created&criteria=desc`, { headers:{Authorization:`Bearer ${token()}`} });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`MP search failed: ${data?.message || JSON.stringify(data)}`);
  return data?.results || [];
}
export async function reconcile(body, auth) {
  requireAdmin(auth);
  const target = body?.payment_id; const hours = Math.min(Math.max(Number(body?.hours)||72,1),720);
  const result = target
    ? await query(`select * from payments where id=$1 limit 1`, [target])
    : await query(`select * from payments where status='pending' and created_at >= now()-($1::text || ' hours')::interval order by created_at desc limit 100`, [hours]);
  const results=[];
  for (const p of result.rows) {
    try {
      const matches = await searchByExternalReference(p.id);
      if (!matches.length) { results.push({payment_id:p.id,action:'no_mp_payment_found'}); continue; }
      const chosen = matches.find((x)=>x.status==='approved') || matches[0];
      const status = mapStatus(chosen.status);
      if (status === 'approved') {
        const approved = await creditApprovedPayment(p.id,String(chosen.id),chosen,'Reconciliación MP');
        results.push({payment_id:p.id,action:approved.changed?'updated':'already_synced',new_status:'approved',mp_payment_id:String(chosen.id),credited:approved.changed});
      } else {
        await query(`update payments set status=$2,mp_payment_id=$3,mp_response=$4::jsonb where id=$1`, [p.id,status,String(chosen.id),JSON.stringify(chosen)]);
        results.push({payment_id:p.id,action:'updated',new_status:status,mp_payment_id:String(chosen.id),credited:false});
      }
    } catch (e) { results.push({payment_id:p.id,action:'error',error:String(e?.message||e)}); }
  }
  return { checked:result.rows.length,results };
}
