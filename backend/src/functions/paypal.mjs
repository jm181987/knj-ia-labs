import { query, transaction } from '../db.mjs';
import { uuid } from '../auth.mjs';
import { recordAffiliateCommissionPayment, recordAffiliateCommissionSubscription } from '../rpc.mjs';

const NOTIFY_TO = process.env.ADMIN_WHATSAPP || '59893867429';

function cleanEnv(name) {
  let value = String(process.env[name] ?? '').trim();
  if (value.length >= 2) {
    const first = value[0], last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) value = value.slice(1, -1).trim();
  }
  return value;
}
function paypalMode() { return cleanEnv('PAYPAL_MODE').toLowerCase() === 'sandbox' ? 'sandbox' : 'live'; }
function base() { return paypalMode() === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com'; }
function requireUser(auth) { if (!auth?.user) throw Object.assign(new Error('No autenticado'), {status:401}); return auth.user; }
async function notify(text) {
  const url=process.env.EVOLUTION_API_URL, instance=process.env.EVOLUTION_INSTANCE, key=process.env.EVOLUTION_API_KEY;
  if (!url||!instance||!key) return;
  try { await fetch(`${url.replace(/\/$/,'')}/message/sendText/${instance}`,{method:'POST',headers:{'Content-Type':'application/json',apikey:key},body:JSON.stringify({number:NOTIFY_TO,text})}); } catch(e){ console.error('[paypal whatsapp]',e); }
}
async function profileLabel(userId) {
  const r=await query(`select email,display_name from profiles where id=$1`,[userId]); const p=r.rows[0]; return p?.display_name||p?.email||userId;
}

let cachedAccessToken = '';
let cachedAccessTokenUntil = 0;
let accessTokenPromise = null;

export async function accessToken() {
  const id=cleanEnv('PAYPAL_CLIENT_ID'), secret=cleanEnv('PAYPAL_CLIENT_SECRET');
  if(!id||!secret) throw Object.assign(new Error('PayPal no configurado: faltan PAYPAL_CLIENT_ID o PAYPAL_CLIENT_SECRET'), {status:503, details:{provider:'paypal',stage:'oauth',code:'MISSING_CREDENTIALS'}});
  if (cachedAccessToken && Date.now() < cachedAccessTokenUntil) return cachedAccessToken;
  if (accessTokenPromise) return accessTokenPromise;

  accessTokenPromise = (async () => {
    const mode=paypalMode();
    const res=await fetch(`${base()}/v1/oauth2/token`,{
      method:'POST',
      headers:{
        Authorization:`Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
        'Content-Type':'application/x-www-form-urlencoded',
        Accept:'application/json',
        'Accept-Language':'en_US',
      },
      body:'grant_type=client_credentials',
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok||!data.access_token) {
      const code=String(data?.error||`HTTP_${res.status}`);
      const modeLabel=mode==='sandbox'?'Sandbox':'Live';
      console.error('[paypal oauth]', { status:res.status, code, mode });
      throw Object.assign(
        new Error(`PayPal rechazó la autenticación (${modeLabel}). Verifica que PAYPAL_CLIENT_ID y PAYPAL_CLIENT_SECRET sean de la misma app ${modeLabel} y que PAYPAL_MODE sea correcto.`),
        {status:502, details:{provider:'paypal',stage:'oauth',code,httpStatus:res.status,mode}},
      );
    }
    const expiresIn=Math.max(60,Number(data.expires_in)||300);
    cachedAccessToken=String(data.access_token);
    cachedAccessTokenUntil=Date.now()+Math.max(30,expiresIn-60)*1000;
    return cachedAccessToken;
  })();

  try { return await accessTokenPromise; }
  finally { accessTokenPromise=null; }
}

export function config() { return { client_id:cleanEnv('PAYPAL_CLIENT_ID'), mode:paypalMode()==='sandbox'?'sandbox':'production' }; }
async function getSetting(key,fallback) { const r=await query(`select value from app_settings where key=$1`,[key]); return r.rows[0]?.value??fallback; }

async function approvePayment(internalId, providerId, providerData, reason) {
  const outcome=await transaction(async(client)=>{
    const r=await client.query(`select * from payments where id=$1 for update`,[internalId]); const p=r.rows[0];
    if(!p) return {changed:false,payment:null}; if(p.status==='approved') return {changed:false,payment:p};
    const bal=await client.query(`select balance from user_credits where user_id=$1 for update`,[p.user_id]);
    if(!bal.rowCount) await client.query(`insert into user_credits(user_id,balance) values($1,0)`,[p.user_id]);
    await client.query(`update user_credits set balance=balance+$2 where user_id=$1`,[p.user_id,p.credits]);
    await client.query(`insert into credit_transactions(id,user_id,amount,reason,type) values($1,$2,$3,$4,'credit')`,[uuid(),p.user_id,p.credits,reason]);
    await client.query(`update payments set status='approved',mp_payment_id=$2,mp_response=$3::jsonb,approved_at=now() where id=$1`,[p.id,providerId,JSON.stringify(providerData)]);
    return {changed:true,payment:p};
  });
  if(outcome.changed&&outcome.payment) recordAffiliateCommissionPayment(outcome.payment.id).catch(()=>{});
  return outcome;
}

export async function createOrder(body,auth) {
  const user=requireUser(auth); const {package_id,custom_amount_usd,cmid}=body||{};
  let amountUsd=0,credits=0,pkgId=null,title='';
  if(custom_amount_usd!==undefined&&custom_amount_usd!==null){
    const min=Number(await getSetting('paypal_min_usd',2)), ratio=Number(await getSetting('paypal_usd_per_credit',.05)), amt=Number(custom_amount_usd);
    if(!Number.isFinite(amt)||amt<min) throw Object.assign(new Error(`Mínimo $${min} USD`),{status:400});
    amountUsd=Math.round(amt*100)/100; credits=Math.floor(amountUsd/ratio); title='Recarga personalizada';
  } else {
    if(!package_id) throw Object.assign(new Error('Falta package_id o custom_amount_usd'),{status:400});
    const r=await query(`select * from credit_packages where id=$1 and active=true`,[package_id]); const p=r.rows[0]; if(!p) throw Object.assign(new Error('Paquete no disponible'),{status:404});
    amountUsd=p.price_usd!=null?Number(p.price_usd):Math.round((Number(p.price_uyu)/40)*100)/100; credits=Number(p.credits); pkgId=p.id; title=p.name;
  }
  const internalId=uuid();
  await query(`insert into payments(id,user_id,package_id,amount_uyu,credits,status,mp_response) values($1,$2,$3,$4,$5,'pending',$6::jsonb)`,[internalId,user.id,pkgId,amountUsd,credits,JSON.stringify({provider:'paypal',currency:'USD'})]);
  const token=await accessToken();
  const res=await fetch(`${base()}/v2/checkout/orders`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...(cmid?{'PayPal-Client-Metadata-Id':String(cmid)}:{})},body:JSON.stringify({intent:'CAPTURE',purchase_units:[{reference_id:internalId,description:`${credits} créditos - ${title}`.slice(0,127),amount:{currency_code:'USD',value:amountUsd.toFixed(2)}}]})});
  const data=await res.json().catch(()=>({}));
  if(!res.ok){await query(`update payments set status='rejected',mp_response=$2::jsonb where id=$1`,[internalId,JSON.stringify(data)]);throw Object.assign(new Error(data?.message||'PayPal error'),{status:502});}
  await query(`update payments set mp_preference_id=$2,mp_response=$3::jsonb where id=$1`,[internalId,data.id,JSON.stringify({provider:'paypal',currency:'USD',order:data})]);
  return {id:data.id,internal_id:internalId};
}

export async function captureOrder(body,auth) {
  const user=requireUser(auth); const id=body?.paypal_order_id; if(!id) throw Object.assign(new Error('Falta paypal_order_id'),{status:400});
  const r=await query(`select * from payments where mp_preference_id=$1 limit 1`,[id]); const order=r.rows[0]; if(!order) throw Object.assign(new Error('Orden no encontrada'),{status:404}); if(order.user_id!==user.id&&!auth.isAdmin) throw Object.assign(new Error('Forbidden'),{status:403});
  if(order.status==='approved') return {status:'approved',credits:order.credits,already:true};
  const token=await accessToken();
  const res=await fetch(`${base()}/v2/checkout/orders/${encodeURIComponent(id)}/capture`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...(body?.cmid?{'PayPal-Client-Metadata-Id':String(body.cmid)}:{})}});
  const data=await res.json().catch(()=>({}));
  if(!res.ok||data?.status!=='COMPLETED'){await query(`update payments set status='rejected',mp_response=$2::jsonb where id=$1`,[order.id,JSON.stringify({provider:'paypal',currency:'USD',capture:data})]);throw Object.assign(new Error(data?.message||'Captura falló'),{status:400});}
  const captureId=data?.purchase_units?.[0]?.payments?.captures?.[0]?.id||id;
  const approved=await approvePayment(order.id,String(captureId),{provider:'paypal',currency:'USD',capture:data},`PayPal #${id} (${order.credits} créditos)`);
  if(approved.changed) await notify(`✅ *Venta PayPal aprobada*\nUsuario: ${await profileLabel(order.user_id)}\nMonto: $${order.amount_uyu} USD\nCréditos: ${order.credits}\nPayPal Order: ${id}`);
  return {status:'approved',credits:order.credits};
}

async function ensurePlan(token,priceUsd) {
  const existing=String(await getSetting('paypal_subscription_plan_id','')||'').replace(/^"|"$/g,''); if(existing) return existing;
  let res=await fetch(`${base()}/v1/catalogs/products`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({name:'KNJ Pro - Suscripción mensual',description:'500 créditos por mes',type:'SERVICE',category:'SOFTWARE'})});
  const product=await res.json().catch(()=>({})); if(!res.ok) throw new Error(`PayPal product error: ${JSON.stringify(product)}`);
  res=await fetch(`${base()}/v1/billing/plans`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({product_id:product.id,name:'KNJ Pro Mensual',status:'ACTIVE',billing_cycles:[{frequency:{interval_unit:'MONTH',interval_count:1},tenure_type:'REGULAR',sequence:1,total_cycles:0,pricing_scheme:{fixed_price:{value:priceUsd.toFixed(2),currency_code:'USD'}}}],payment_preferences:{auto_bill_outstanding:true,setup_fee_failure_action:'CONTINUE',payment_failure_threshold:3}})});
  const plan=await res.json().catch(()=>({})); if(!res.ok) throw new Error(`PayPal plan error: ${JSON.stringify(plan)}`);
  await query(`insert into app_settings(key,value) values('paypal_subscription_plan_id',$1::jsonb) on conflict(key) do update set value=excluded.value`,[JSON.stringify(plan.id)]); return plan.id;
}

export async function createSubscription(body,auth,ctx={}) {
  const user=requireUser(auth); const price=Number(await getSetting('paypal_subscription_price_usd',22.5)), credits=Number(await getSetting('paypal_subscription_credits',500)); const token=await accessToken(); const plan=await ensurePlan(token,price);
  const rowId=uuid(); await query(`insert into subscriptions(id,user_id,preapproval_plan_id,amount_uyu,monthly_credits,status,mp_response) values($1,$2,$3,$4,$5,'pending',$6::jsonb)`,[rowId,user.id,plan,price,credits,JSON.stringify({provider:'paypal',currency:'USD'})]);
  const origin=String(body?.return_origin||ctx.origin||process.env.FRONTEND_URL||'').replace(/\/$/,'');
  const res=await fetch(`${base()}/v1/billing/subscriptions`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...(body?.cmid?{'PayPal-Client-Metadata-Id':String(body.cmid)}:{})},body:JSON.stringify({plan_id:plan,custom_id:rowId,subscriber:{email_address:user.email},application_context:{brand_name:'KNJ Pro',user_action:'SUBSCRIBE_NOW',return_url:`${origin}/payment/success?paypal_sub=1`,cancel_url:`${origin}/payment/failure?paypal_sub=1`}})});
  const data=await res.json().catch(()=>({})); if(!res.ok){await query(`update subscriptions set status='rejected',mp_response=$2::jsonb where id=$1`,[rowId,JSON.stringify(data)]);throw Object.assign(new Error(data?.message||'PayPal error'),{status:502});}
  const approve=(data.links||[]).find((x)=>x.rel==='approve'); await query(`update subscriptions set mp_preapproval_id=$2,init_point=$3,mp_response=$4::jsonb where id=$1`,[rowId,data.id,approve?.href||null,JSON.stringify({provider:'paypal',currency:'USD',subscription:data})]); return {subscription_id:data.id,approve_url:approve?.href};
}

async function verifyWebhook(headers,event,webhookId) {
  if(!webhookId) return true; const token=await accessToken();
  const res=await fetch(`${base()}/v1/notifications/verify-webhook-signature`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({auth_algo:headers['paypal-auth-algo'],cert_url:headers['paypal-cert-url'],transmission_id:headers['paypal-transmission-id'],transmission_sig:headers['paypal-transmission-sig'],transmission_time:headers['paypal-transmission-time'],webhook_id:webhookId,webhook_event:event})});
  const data=await res.json().catch(()=>({})); return data.verification_status==='SUCCESS';
}
export async function webhook(event,ctx={}) {
  const webhookId=String(await getSetting('paypal_webhook_id','')||'').replace(/^"|"$/g,'');
  if(!(await verifyWebhook(ctx.headers||{},event,webhookId))) throw Object.assign(new Error('invalid webhook signature'),{status:401});
  const type=event?.event_type, resource=event?.resource||{};
  if(type==='PAYMENT.CAPTURE.COMPLETED') {
    const orderId=resource?.supplementary_data?.related_ids?.order_id||resource.id; const r=await query(`select * from payments where mp_preference_id=$1 limit 1`,[orderId]); const order=r.rows[0];
    if(order&&order.status!=='approved'){const a=await approvePayment(order.id,String(resource.id||orderId),event,`PayPal webhook ${orderId} (${order.credits} créditos)`);if(a.changed)await notify(`✅ *Venta PayPal aprobada*\nUsuario: ${await profileLabel(order.user_id)}\nMonto: $${order.amount_uyu} USD\nCréditos: ${order.credits}`);}
  }
  if(type==='BILLING.SUBSCRIPTION.ACTIVATED') {
    const r=await query(`update subscriptions set status='active',mp_response=$2::jsonb where mp_preapproval_id=$1 returning *`,[resource.id,JSON.stringify(event)]); const row=r.rows[0]; if(row) await notify(`🎉 *Suscripción PayPal activa*\nUsuario: ${await profileLabel(row.user_id)}\nPlan: $${row.amount_uyu} USD/mes\nSub: ${resource.id}`);
  }
  if(type==='PAYMENT.SALE.COMPLETED'||type==='BILLING.SUBSCRIPTION.PAYMENT.COMPLETED') {
    const subId=resource.billing_agreement_id||resource.id, captureId=String(resource.id); const r=await query(`select * from subscriptions where mp_preapproval_id=$1 limit 1`,[subId]); const row=r.rows[0];
    if(row&&row.last_credited_payment_id!==captureId){
      await transaction(async(client)=>{const lock=await client.query(`select * from subscriptions where id=$1 for update`,[row.id]);const s=lock.rows[0];if(!s||s.last_credited_payment_id===captureId)return;const bal=await client.query(`select balance from user_credits where user_id=$1 for update`,[s.user_id]);if(!bal.rowCount)await client.query(`insert into user_credits(user_id,balance)values($1,0)`,[s.user_id]);await client.query(`update user_credits set balance=balance+$2 where user_id=$1`,[s.user_id,s.monthly_credits]);await client.query(`insert into credit_transactions(id,user_id,amount,reason,type)values($1,$2,$3,$4,'credit')`,[uuid(),s.user_id,s.monthly_credits,`Suscripción PayPal ${subId} - capture ${captureId}`]);await client.query(`update subscriptions set last_credited_payment_id=$2,status='active' where id=$1`,[s.id,captureId]);});
      await notify(`🔁 *Cobro PayPal*\nUsuario: ${await profileLabel(row.user_id)}\nMonto: $${row.amount_uyu} USD\nCréditos: ${row.monthly_credits}`); recordAffiliateCommissionSubscription(row.id,captureId,Number(row.amount_uyu)).catch(()=>{});
    }
  }
  if(['BILLING.SUBSCRIPTION.CANCELLED','BILLING.SUBSCRIPTION.SUSPENDED','BILLING.SUBSCRIPTION.EXPIRED'].includes(type)) await query(`update subscriptions set status='cancelled',mp_response=$2::jsonb where mp_preapproval_id=$1`,[resource.id,JSON.stringify(event)]);
  return {ok:true};
}
