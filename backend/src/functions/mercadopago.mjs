import crypto from 'node:crypto';
import { query, transaction } from '../db.mjs';
import { uuid } from '../auth.mjs';
import { addCreditsSystem, recordAffiliateCommissionPayment, recordAffiliateCommissionSubscription } from '../rpc.mjs';

const MP_API = 'https://api.mercadopago.com';
const NOTIFY_TO = process.env.ADMIN_WHATSAPP || '59893867429';

function cleanEnv(name) {
  let value=String(process.env[name]??'').trim();
  if(value.length>=2&&((value[0]==='"'&&value.at(-1)==='"')||(value[0]==="'"&&value.at(-1)==="'"))) value=value.slice(1,-1).trim();
  return value;
}
function token() {
  const value=cleanEnv('MERCADOPAGO_ACCESS_TOKEN');
  if (!value) throw Object.assign(new Error('MERCADOPAGO_ACCESS_TOKEN no configurado'),{status:503,details:{provider:'mercadopago',stage:'auth',code:'MISSING_ACCESS_TOKEN'}});
  return value;
}
function deviceId(value) { return String(value||'').trim().replace(/[^A-Za-z0-9._:-]/g,'').slice(0,128); }
function requireUser(auth) { if (!auth?.user) throw Object.assign(new Error('No autenticado'), { status: 401 }); return auth.user; }
function requireAdmin(auth) { if (!auth?.isAdmin) throw Object.assign(new Error('No autorizado'), { status: 403 }); }
function mpError(data,status,stage='api') {
  const firstError=Array.isArray(data?.errors)?data.errors[0]:null;
  const code=data?.code||data?.error||firstError?.code||data?.cause?.[0]?.code||null;
  const message=data?.message||data?.error_message||firstError?.message||firstError?.description||data?.cause?.[0]?.description||`Mercado Pago HTTP ${status}`;
  return Object.assign(new Error(`Mercado Pago: ${message}`),{status:status>=500?502:400,details:{provider:'mercadopago',stage,httpStatus:status,code,message}});
}
async function notifyWhatsApp(text) {
  const base = process.env.EVOLUTION_API_URL, instance = process.env.EVOLUTION_INSTANCE, apiKey = process.env.EVOLUTION_API_KEY;
  if (!base || !instance || !apiKey) return;
  try { await fetch(`${base.replace(/\/$/, '')}/message/sendText/${instance}`, {method:'POST',headers:{'Content-Type':'application/json',apikey:apiKey},body:JSON.stringify({number:NOTIFY_TO,text})}); }
  catch (e) { console.error('[whatsapp]', e); }
}
async function profileLabel(userId) {
  const r = await query(`select email,display_name from profiles where id=$1`, [userId]); const p = r.rows[0]; return p?.display_name || p?.email || userId;
}
async function payerInfo(user) {
  const r=await query(`select p.display_name,p.whatsapp,u.created_at from profiles p join app_users u on u.id=p.id where p.id=$1`,[user.id]);
  const p=r.rows[0]||{}; const parts=String(p.display_name||'').trim().split(/\s+/).filter(Boolean);
  const payer={email:String(user.email||'').trim()};
  if(parts.length) payer.first_name=parts[0].slice(0,100);
  if(parts.length>=2) payer.last_name=parts.slice(1).join(' ').slice(0,100);
  return payer;
}
function mapStatus(status) {
  if (status === 'approved') return 'approved';
  if (status === 'rejected' || status === 'cancelled' || status === 'expired') return 'rejected';
  if (status === 'refunded') return 'refunded';
  return 'pending';
}
function mapOrderStatus(order) {
  if(order?.status==='processed'&&['accredited','partially_refunded'].includes(order?.status_detail)) return order.status_detail==='partially_refunded'?'approved':'approved';
  if(['refunded'].includes(order?.status)) return 'refunded';
  if(['expired','cancelled','failed'].includes(order?.status)) return 'rejected';
  return 'pending';
}

async function mpFetch(path,{method='GET',body,headers={}}={}) {
  const res=await fetch(`${MP_API}${path}`,{method,headers:{Authorization:`Bearer ${token()}`,Accept:'application/json',...(body!==undefined?{'Content-Type':'application/json'}:{}),...headers},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  const data=await res.json().catch(()=>({}));
  if(!res.ok) throw mpError(data,res.status);
  return data;
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
    await client.query(`insert into credit_transactions(id,user_id,amount,reason,type) values ($1,$2,$3,$4,'credit')`,[uuid(), payment.user_id, credits, `${reasonPrefix} #${mpPaymentId} (${credits} créditos)`]);
    await client.query(`update payments set status='approved',mp_payment_id=$2,mp_response=$3::jsonb,approved_at=coalesce($4::timestamptz,now()) where id=$1`,[payment.id, String(mpPaymentId), JSON.stringify(mpData || {}), mpData?.date_approved || null]);
    return { changed: true, payment };
  });
  if (result.changed && result.payment) recordAffiliateCommissionPayment(result.payment.id).catch((e) => console.warn('[affiliate payment]', e));
  return result;
}

// Kept under the old function name for frontend compatibility, but now uses Mercado Pago's current Checkout Pro Orders API.
export async function createPreference(body, auth, ctx = {}) {
  const user = requireUser(auth);
  const { package_id, custom_amount, return_origin } = body || {};
  let title, amountUYU, credits, packageId = null;
  if (custom_amount !== undefined && custom_amount !== null) {
    const customAmount = Number(custom_amount);
    if (!Number.isFinite(customAmount) || customAmount < 80) throw Object.assign(new Error('El monto mínimo es $80 UYU'), { status: 400 });
    amountUYU = Math.round(customAmount); credits = Math.floor(customAmount / 1.99); title = 'Recarga personalizada';
  } else {
    if (!package_id) throw Object.assign(new Error('Falta package_id o custom_amount'), { status: 400 });
    const pkgResult = await query(`select * from credit_packages where id=$1 and active=true`, [package_id]); const pkg = pkgResult.rows[0];
    if (!pkg) throw Object.assign(new Error('Paquete no disponible'), { status: 404 });
    packageId = pkg.id; amountUYU = Number(pkg.price_uyu); credits = Number(pkg.credits); title = pkg.name;
  }
  const paymentId = uuid(), amount=Number(amountUYU).toFixed(2), did=deviceId(body?.device_id);
  await query(`insert into payments(id,user_id,package_id,amount_uyu,credits,status,mp_response) values ($1,$2,$3,$4,$5,'pending',$6::jsonb)`,[paymentId, user.id, packageId, amountUYU, credits, JSON.stringify({provider:'mercadopago',api:'orders'})]);
  const origin = String(return_origin || ctx.origin || process.env.FRONTEND_URL || '').replace(/\/$/, '');
  try {
    const data=await mpFetch('/v1/orders',{
      method:'POST',
      headers:{'X-Idempotency-Key':paymentId,...(did?{'X-meli-session-id':did}:{})},
      body:{
        type:'online',
        processing_mode:'manual',
        total_amount:amount,
        external_reference:paymentId,
        payer:{email:String(user.email||'').trim()},
        items:[{title:String(title).slice(0,120),quantity:1,unit_price:amount}],
        config:{online:{success_url:`${origin}/payment/success?payment_id=${paymentId}`,failure_url:`${origin}/payment/failure?payment_id=${paymentId}`,pending_url:`${origin}/payment/pending?payment_id=${paymentId}`,auto_return:'approved'}},
      },
    });
    await query(`update payments set mp_preference_id=$2,mp_response=$3::jsonb where id=$1`, [paymentId, data.id, JSON.stringify({provider:'mercadopago',api:'orders',order:data})]);
    return { payment_id:paymentId, preference_id:data.id, order_id:data.id, init_point:data.checkout_url };
  } catch(error) {
    await query(`update payments set status='rejected',mp_response=$2::jsonb where id=$1`,[paymentId,JSON.stringify({provider:'mercadopago',api:'orders',error:error?.details||{message:String(error?.message||error)}})]).catch(()=>{});
    throw error;
  }
}

export async function createSubscription(body, auth, ctx = {}) {
  const user = requireUser(auth); token();
  const existingResult = await query(`select * from subscriptions where user_id=$1 and status in ('authorized','pending') order by created_at desc limit 1`, [user.id]);
  const existing = existingResult.rows[0];
  if (existing?.status === 'authorized') throw Object.assign(new Error('Ya tenés una suscripción activa'), { status: 409, details: existing });
  const origin = String(body?.return_origin || ctx.origin || process.env.FRONTEND_URL || '').replace(/\/$/, '');
  const monthlyCredits = 500, amountUYU = 900, planId = 'direct-monthly-500'; const did=deviceId(body?.device_id);
  const rowId=existing?.id||uuid();
  const mpBody = {reason:`${monthlyCredits} créditos mensuales KNJ PRO`,payer_email:user.email,external_reference:rowId,back_url:`${origin}/payment/success?subscription=1`,status:'pending',auto_recurring:{frequency:1,frequency_type:'months',transaction_amount:amountUYU,currency_id:'UYU'}};
  try {
    const data=await mpFetch('/preapproval',{method:'POST',headers:{...(did?{'X-meli-session-id':did}:{})},body:mpBody});
    const initPoint = data.init_point || data.sandbox_init_point;
    if (existing) await query(`update subscriptions set mp_preapproval_id=$2,preapproval_plan_id=$3,status='pending',init_point=$4,mp_response=$5::jsonb where id=$1`, [existing.id,data.id,planId,initPoint,JSON.stringify(data)]);
    else await query(`insert into subscriptions(id,user_id,mp_preapproval_id,preapproval_plan_id,status,monthly_credits,amount_uyu,init_point,mp_response) values ($1,$2,$3,$4,'pending',$5,$6,$7,$8::jsonb)`,[rowId,user.id,data.id,planId,monthlyCredits,amountUYU,initPoint,JSON.stringify(data)]);
    return { preapproval_id:data.id, init_point:initPoint };
  } catch(error) { throw error; }
}

export async function cancelSubscription(body, auth) {
  requireAdmin(auth); token();
  if (!body?.subscription_id) throw Object.assign(new Error('subscription_id requerido'), { status: 400 });
  const r = await query(`select * from subscriptions where id=$1`, [body.subscription_id]); const sub = r.rows[0];
  if (!sub) throw Object.assign(new Error('Suscripción no encontrada'), { status: 404 });
  if (!sub.mp_preapproval_id) throw Object.assign(new Error('Sin mp_preapproval_id'), { status: 400 });
  const data=await mpFetch(`/preapproval/${encodeURIComponent(sub.mp_preapproval_id)}`,{method:'PUT',body:{status:'cancelled'}});
  await query(`update subscriptions set status='cancelled',mp_response=$2::jsonb where id=$1`, [sub.id,JSON.stringify(data)]);
  return { ok:true,status:'cancelled' };
}

export async function processPayment(mpPaymentId) {
  const res = await fetch(`${MP_API}/v1/payments/${encodeURIComponent(mpPaymentId)}`, { headers:{Authorization:`Bearer ${token()}`} }); const mp = await res.json().catch(() => ({}));
  if (!res.ok) return { ignored:true,error:mp?.message || `MP ${res.status}` };
  const status = mp.status; const preapprovalId = mp.preapproval_id || mp?.point_of_interaction?.transaction_data?.preapproval_id;
  if (preapprovalId) {
    const subR = await query(`select * from subscriptions where mp_preapproval_id=$1 limit 1`, [preapprovalId]); const sub = subR.rows[0]; if (!sub) return { ignored:true };
    if (status === 'approved' && sub.last_credited_payment_id !== String(mpPaymentId)) {
      await addCreditsSystem(sub.user_id, sub.monthly_credits, `Suscripción mensual MP #${mpPaymentId} (${sub.monthly_credits} créditos)`);
      await query(`update subscriptions set last_credited_payment_id=$2,status='authorized',mp_response=$3::jsonb where id=$1`, [sub.id,String(mpPaymentId),JSON.stringify(mp)]);
      await notifyWhatsApp(`🔁 *Suscripción cobrada*\nUsuario: ${await profileLabel(sub.user_id)}\nMonto: $${sub.amount_uyu} UYU\nCréditos: ${sub.monthly_credits}\nMP ID: ${mpPaymentId}`);
      recordAffiliateCommissionSubscription(sub.id,String(mpPaymentId),Number(sub.amount_uyu)).catch(() => {});
    }
    return { subscription:true,status };
  }
  const externalRef = mp.external_reference; if (!externalRef) return { ignored:true };
  const pR = await query(`select * from payments where id=$1`, [externalRef]); const payment = pR.rows[0]; if (!payment) return { ignored:true };
  const newStatus = mapStatus(status);
  if (newStatus === 'approved') { const approved = await creditApprovedPayment(payment.id,mpPaymentId,mp); if (approved.changed) await notifyWhatsApp(`✅ *Venta aprobada*\nUsuario: ${await profileLabel(payment.user_id)}\nMonto: $${payment.amount_uyu} UYU\nCréditos: ${payment.credits}\nMP ID: ${mpPaymentId}`); }
  else { await query(`update payments set status=$2,mp_payment_id=$3,mp_response=$4::jsonb,approved_at=null where id=$1`, [payment.id,newStatus,String(mpPaymentId),JSON.stringify(mp)]); if (newStatus === 'rejected') await notifyWhatsApp(`❌ *Pago rechazado*\nUsuario: ${await profileLabel(payment.user_id)}\nMonto: $${payment.amount_uyu} UYU\nMotivo: ${mp.status_detail || 'n/a'}\nMP ID: ${mpPaymentId}`); }
  return { payment:true,status:newStatus };
}

export async function processOrder(orderId) {
  const order=await mpFetch(`/v1/orders/${encodeURIComponent(orderId)}`); const externalRef=order?.external_reference;
  if(!externalRef) return {ignored:true};
  const pR=await query(`select * from payments where id=$1 limit 1`,[externalRef]); const payment=pR.rows[0]; if(!payment) return {ignored:true};
  const status=mapOrderStatus(order); const transaction=order?.transactions?.payments?.[0]; const providerId=String(transaction?.id||order.id);
  if(status==='approved') {
    const approved=await creditApprovedPayment(payment.id,providerId,order,'Pago Mercado Pago Order');
    if(approved.changed) await notifyWhatsApp(`✅ *Venta aprobada*\nUsuario: ${await profileLabel(payment.user_id)}\nMonto: $${payment.amount_uyu} UYU\nCréditos: ${payment.credits}\nMP Order: ${order.id}`);
  } else {
    await query(`update payments set status=$2,mp_payment_id=$3,mp_response=$4::jsonb,approved_at=null where id=$1`,[payment.id,status,providerId,JSON.stringify({provider:'mercadopago',api:'orders',order})]);
  }
  return {payment:true,status,order_id:order.id};
}

export async function processPreapproval(preapprovalId) {
  const data=await mpFetch(`/preapproval/${encodeURIComponent(preapprovalId)}`);
  let subR = await query(`select * from subscriptions where mp_preapproval_id=$1 limit 1`, [preapprovalId]); let sub = subR.rows[0];
  if (!sub && data.external_reference) { subR = await query(`select * from subscriptions where id=$1 or user_id=$1 order by created_at desc limit 1`, [data.external_reference]); sub = subR.rows[0]; if (sub) await query(`update subscriptions set mp_preapproval_id=$2 where id=$1`, [sub.id,preapprovalId]); }
  if (!sub) return { ignored:true };
  await query(`update subscriptions set status=$2,next_payment_date=$3,mp_response=$4::jsonb where id=$1`, [sub.id,data.status,data.next_payment_date || null,JSON.stringify(data)]);
  if (data.status === 'authorized') await notifyWhatsApp(`🎉 *Nueva suscripción activa*\nUser: ${sub.user_id}\nPlan: ${sub.amount_uyu} UYU/mes\nPreapproval: ${preapprovalId}`);
  if (data.status === 'cancelled') await notifyWhatsApp(`🚫 *Suscripción cancelada*\nUser: ${sub.user_id}\nPreapproval: ${preapprovalId}`);
  return { subscription:true,status:data.status };
}

function verifyWebhookSignature(ctx, dataId) {
  const secret=cleanEnv('MERCADOPAGO_WEBHOOK_SECRET');
  if(!secret) return {configured:false,valid:false};
  const xSignature=String(ctx?.headers?.['x-signature']||''), xRequestId=String(ctx?.headers?.['x-request-id']||'');
  if(!xSignature||!xRequestId||!dataId) return {configured:true,valid:false};
  const parts=Object.fromEntries(xSignature.split(',').map((part)=>part.trim().split('=',2)));
  const ts=parts.ts, received=parts.v1;
  if(!ts||!received) return {configured:true,valid:false};
  const manifest=`id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const expected=crypto.createHmac('sha256',secret).update(manifest).digest('hex');
  if(expected.length!==received.length) return {configured:true,valid:false};
  return {configured:true,valid:crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(received))};
}

export async function webhook(body, ctx = {}) {
  const type = body?.type || body?.topic || ctx.query?.type || ctx.query?.topic;
  const resourceId = body?.data?.id || ctx.query?.['data.id'] || ctx.query?.data_id || ctx.query?.id;
  if (!resourceId) return { ok:true,ignored:true };
  const sig=verifyWebhookSignature(ctx,String(resourceId));
  if(sig.configured&&!sig.valid) throw Object.assign(new Error('invalid Mercado Pago webhook signature'),{status:401});
  if(!sig.configured) console.warn('[mercadopago webhook] MERCADOPAGO_WEBHOOK_SECRET no configurado; se valida el recurso consultándolo nuevamente en la API de Mercado Pago');
  if (type === 'order') await processOrder(String(resourceId));
  else if (type === 'payment' || type === 'authorized_payment' || type === 'subscription_authorized_payment') await processPayment(String(resourceId));
  else if (type === 'preapproval' || type === 'subscription_preapproval') await processPreapproval(String(resourceId));
  return { ok:true,signature_verified:sig.configured?sig.valid:false };
}

async function searchByExternalReference(externalRef) {
  const res = await fetch(`${MP_API}/v1/payments/search?external_reference=${encodeURIComponent(externalRef)}&sort=date_created&criteria=desc`, { headers:{Authorization:`Bearer ${token()}`} }); const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`MP search failed: ${data?.message || JSON.stringify(data)}`); return data?.results || [];
}
async function searchOrdersByExternalReference(externalRef) {
  const end=new Date(), begin=new Date(Date.now()-30*24*3600*1000);
  const qs=new URLSearchParams({begin_date:begin.toISOString(),end_date:end.toISOString(),external_reference:externalRef,limit:'10'});
  try { const data=await mpFetch(`/v1/orders?${qs.toString()}`); return data?.data||[]; } catch { return []; }
}

// Authenticated self-healing path used by the payment success page. Webhooks
// remain the primary source of truth, but a delayed/missed notification no
// longer requires an administrator to press Reconciliar.
export async function syncPayment(body, auth) {
  const user = requireUser(auth);
  const paymentId = String(body?.payment_id || '').trim();
  if (!paymentId) throw Object.assign(new Error('payment_id requerido'), { status: 400 });
  const r = await query(`select * from payments where id=$1 limit 1`, [paymentId]);
  const payment = r.rows[0];
  if (!payment) throw Object.assign(new Error('Pago no encontrado'), { status: 404 });
  if (payment.user_id !== user.id && !auth.isAdmin) throw Object.assign(new Error('No autorizado'), { status: 403 });
  if (payment.status === 'approved') return { status:'approved',credits:Number(payment.credits||0),already:true };

  const provider = String(payment.mp_response?.provider || 'mercadopago').toLowerCase();
  if (provider !== 'mercadopago') return { status:payment.status,credits:Number(payment.credits||0),provider,ignored:true };

  let synced = false;
  if (payment.mp_preference_id) {
    try {
      await processOrder(String(payment.mp_preference_id));
      synced = true;
    } catch (error) {
      console.warn('[mp sync order]', error?.message || error);
    }
  }
  if (!synced) {
    const orders = await searchOrdersByExternalReference(payment.id);
    if (orders.length) {
      const chosen = orders.find((x) => mapOrderStatus(x) === 'approved') || orders[0];
      await processOrder(String(chosen.id));
      synced = true;
    }
  }
  if (!synced && payment.mp_payment_id) {
    await processPayment(String(payment.mp_payment_id));
    synced = true;
  }
  if (!synced) {
    const matches = await searchByExternalReference(payment.id);
    if (matches.length) {
      const chosen = matches.find((x) => x.status === 'approved') || matches[0];
      await processPayment(String(chosen.id));
      synced = true;
    }
  }

  const refreshed = await query(`select status,credits,approved_at from payments where id=$1 limit 1`, [payment.id]);
  const current = refreshed.rows[0] || payment;
  return { status:current.status,credits:Number(current.credits||payment.credits||0),approved_at:current.approved_at||null,synced };
}

export async function reconcile(body, auth) {
  requireAdmin(auth); const target = body?.payment_id; const hours = Math.min(Math.max(Number(body?.hours)||72,1),720);
  const result = target ? await query(`select * from payments where id=$1 limit 1`, [target]) : await query(`select * from payments where status='pending' and created_at >= now()-($1::text || ' hours')::interval order by created_at desc limit 100`, [hours]);
  const results=[];
  for (const p of result.rows) {
    try {
      const orders=await searchOrdersByExternalReference(p.id);
      if(orders.length){const chosen=orders.find((x)=>mapOrderStatus(x)==='approved')||orders[0];const full=await processOrder(chosen.id);results.push({payment_id:p.id,action:'order_sync',new_status:full.status,order_id:chosen.id});continue;}
      const matches = await searchByExternalReference(p.id);
      if (!matches.length) { results.push({payment_id:p.id,action:'no_mp_payment_found'}); continue; }
      const chosen = matches.find((x)=>x.status==='approved') || matches[0]; const status = mapStatus(chosen.status);
      if (status === 'approved') { const approved = await creditApprovedPayment(p.id,String(chosen.id),chosen,'Reconciliación MP'); results.push({payment_id:p.id,action:approved.changed?'updated':'already_synced',new_status:'approved',mp_payment_id:String(chosen.id),credited:approved.changed}); }
      else { await query(`update payments set status=$2,mp_payment_id=$3,mp_response=$4::jsonb where id=$1`, [p.id,status,String(chosen.id),JSON.stringify(chosen)]); results.push({payment_id:p.id,action:'updated',new_status:status,mp_payment_id:String(chosen.id),credited:false}); }
    } catch (e) { results.push({payment_id:p.id,action:'error',error:String(e?.message||e)}); }
  }
  return { checked:result.rows.length,results };
}

export async function health() {
  const configured=Boolean(cleanEnv('MERCADOPAGO_ACCESS_TOKEN'));
  if(!configured) return {configured:false,token_ok:false,webhook_secret_configured:Boolean(cleanEnv('MERCADOPAGO_WEBHOOK_SECRET'))};
  try { await mpFetch('/users/me'); return {configured:true,token_ok:true,webhook_secret_configured:Boolean(cleanEnv('MERCADOPAGO_WEBHOOK_SECRET')),checkout_api:'orders'}; }
  catch(error) { return {configured:true,token_ok:false,webhook_secret_configured:Boolean(cleanEnv('MERCADOPAGO_WEBHOOK_SECRET')),code:error?.details?.code||null}; }
}