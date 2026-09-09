import crypto from 'node:crypto';
import { query } from '../db.mjs';
import { uuid } from '../auth.mjs';

const NOTIFY_TO = process.env.ADMIN_WHATSAPP || '59893867429';
function requireUser(auth) { if (!auth?.user) throw Object.assign(new Error('No autenticado'), { status: 401 }); return auth.user; }
function requireAdmin(auth) { requireUser(auth); if (!auth.isAdmin) throw Object.assign(new Error('forbidden'), { status: 403 }); }

async function evolutionSend(text, number = NOTIFY_TO) {
  const base = process.env.EVOLUTION_API_URL, instance = process.env.EVOLUTION_INSTANCE, key = process.env.EVOLUTION_API_KEY;
  if (!base || !instance || !key) return { ok: false, error: 'not_configured' };
  const res = await fetch(`${base.replace(/\/$/, '')}/message/sendText/${instance}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: key },
    body: JSON.stringify({ number, text }),
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, response: body };
}

export async function notifyNewUser(body, auth) {
  requireUser(auth);
  // Prevent forged notifications for another account.
  const profile = await query(`select email,display_name,whatsapp from profiles where id=$1`, [auth.user.id]);
  const p = profile.rows[0] || {};
  const text = `🆕 *Nuevo registro en KNJ PRO*\nNombre: ${p.display_name || body?.display_name || '—'}\nEmail: ${p.email || auth.user.email || '—'}\nWhatsApp: ${p.whatsapp || body?.whatsapp || '—'}\n${new Date().toLocaleString('es-UY')}`;
  const result = await evolutionSend(text);
  return { ok: result.ok, ...(result.error ? { error: result.error } : {}) };
}

export async function whatsappTest(body, auth) {
  requireAdmin(auth);
  return evolutionSend(typeof body?.text === 'string' ? body.text : `🧪 *Test desde KNJ IA Labs*\nIntegración con Evolution API funcionando.\n${new Date().toLocaleString('es-UY')}`);
}

function placeholders(text, r) {
  return String(text || '').replaceAll('{{name}}', r.name || '').replaceAll('{{email}}', r.email || '').replaceAll('{{credits}}', String(r.credits ?? 0)).replaceAll('{{first_name}}', String(r.name || '').split(' ')[0] || '');
}
async function recipients(segment) {
  const profiles = await query(`select p.id,p.email,p.display_name,coalesce(c.balance,0) balance from profiles p left join user_credits c on c.user_id=p.id where p.email is not null`);
  const payments = await query(`select user_id,status from payments`);
  const subs = await query(`select user_id,status from subscriptions`);
  const statuses = new Map();
  for (const p of payments.rows) { if (!statuses.has(p.user_id)) statuses.set(p.user_id, new Set()); statuses.get(p.user_id).add(p.status); }
  const activeSubs = new Set(subs.rows.filter((s) => ['authorized','active'].includes(String(s.status||'').toLowerCase())).map((s) => s.user_id));
  const all = profiles.rows.map((p) => ({ user_id:p.id,email:p.email,name:p.display_name||p.email.split('@')[0],credits:Number(p.balance||0) }));
  if (segment === 'paid') return all.filter((r) => statuses.get(r.user_id)?.has('approved'));
  if (segment === 'pending_failed') return all.filter((r) => { const s=statuses.get(r.user_id); return !!s && (s.has('pending')||s.has('rejected')||s.has('failed')) && !s.has('approved'); });
  if (segment === 'active_subscribers') return all.filter((r) => activeSubs.has(r.user_id));
  if (segment === 'registered_no_pay') return all.filter((r) => !statuses.has(r.user_id));
  return segment === 'all_registered' ? all : [];
}
async function sendGrid(to, name, subject, html) {
  const key=process.env.SENDGRID_API_KEY, from=process.env.SENDGRID_FROM_EMAIL, fromName=process.env.SENDGRID_FROM_NAME||'Equipo';
  if(!key||!from) throw new Error('SendGrid no configurado (faltan secretos)');
  const res=await fetch('https://api.sendgrid.com/v3/mail/send',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({personalizations:[{to:[{email:to,name}]}],from:{email:from,name:fromName},subject,content:[{type:'text/html',value:html}]})});
  if(!res.ok) throw new Error(`SendGrid ${res.status}: ${(await res.text()).slice(0,300)}`);
  return res.headers.get('x-message-id')||null;
}
async function logEmail({templateId,segment,recipient,subject,status,error=null,sg=null,campaignId}) {
  await query(`insert into email_sends(id,template_id,segment,recipient_email,recipient_user_id,subject,status,error,sendgrid_message_id,sent_at,metadata) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,[uuid(),templateId,segment,recipient.email,recipient.user_id,subject,status,error,sg,status==='sent'?new Date():null,JSON.stringify({campaign_id:campaignId})]);
}
export async function sendBulkEmail(body, auth) {
  requireAdmin(auth);
  const action=body?.action, segment=body?.segment, subject=String(body?.subject||''), html=String(body?.html||''), templateId=body?.template_id||null;
  if(!subject||!html) throw Object.assign(new Error('subject y html requeridos'),{status:400});
  if(action==='test'){
    const email=String(body?.test_email||auth.user.email||''); if(!email) throw new Error('test_email requerido');
    const p=await query(`select display_name from profiles where id=$1`,[auth.user.id]); const r={user_id:auth.user.id,email,name:p.rows[0]?.display_name||email.split('@')[0],credits:0}; const campaign=uuid();
    try{const s=placeholders(subject,r),h=placeholders(html,r),sg=await sendGrid(email,r.name,s,h);await logEmail({templateId,segment:'test',recipient:r,subject:s,status:'sent',sg,campaignId:campaign});return{ok:true,sent:1,sendgrid_message_id:sg};}catch(e){await logEmail({templateId,segment:'test',recipient:r,subject:placeholders(subject,r),status:'failed',error:String(e.message||e).slice(0,500),campaignId:campaign});throw e;}
  }
  const list=await recipients(segment);
  if(action==='preview') return{ok:true,total:list.length,sample:list.slice(0,5).map((r)=>({email:r.email,name:r.name,subject_rendered:placeholders(subject,r)}))};
  if(action==='send'){
    const campaign=uuid();let sent=0,failed=0;const errors=[];
    for(const r of list){const s=placeholders(subject,r),h=placeholders(html,r);try{const sg=await sendGrid(r.email,r.name,s,h);await logEmail({templateId,segment,recipient:r,subject:s,status:'sent',sg,campaignId:campaign});sent++;}catch(e){const msg=String(e.message||e);await logEmail({templateId,segment,recipient:r,subject:s,status:'failed',error:msg.slice(0,500),campaignId:campaign});failed++;errors.push({email:r.email,error:msg});}await new Promise((resolve)=>setTimeout(resolve,60));}
    return{ok:true,campaign_id:campaign,total:list.length,sent,failed,errors:errors.slice(0,20)};
  }
  throw Object.assign(new Error('acción inválida'),{status:400});
}

export async function metaCapiEvent(body, _auth, ctx={}) {
  const pixel=process.env.META_PIXEL_ID, access=process.env.META_PIXEL_ACCESS_TOKEN||process.env.META_CAPI_ACCESS_TOKEN;
  if(!pixel||!access) throw Object.assign(new Error('Meta Pixel no configurado'),{status:500});
  const event=body?.eventName||'PageView';const allowed=new Set(['PageView','ViewContent','Lead','CompleteRegistration','InitiateCheckout','AddPaymentInfo','Subscribe','Purchase']);if(!allowed.has(event))throw Object.assign(new Error('Evento no permitido'),{status:400});
  const userData={};if(ctx.ip)userData.client_ip_address=ctx.ip;if(ctx.userAgent)userData.client_user_agent=ctx.userAgent;if(body?.fbp)userData.fbp=body.fbp;if(body?.fbc)userData.fbc=body.fbc;if(body?.email)userData.em=crypto.createHash('sha256').update(String(body.email).trim().toLowerCase()).digest('hex');
  const payload={data:[{event_name:event,event_time:Math.floor(Date.now()/1000),event_id:body?.eventId||uuid(),event_source_url:body?.eventSourceUrl,action_source:'website',user_data:userData,...(body?.customData&&typeof body.customData==='object'?{custom_data:body.customData}:{})}]};
  const res=await fetch(`https://graph.facebook.com/v20.0/${pixel}/events?access_token=${encodeURIComponent(access)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const result=await res.json().catch(()=>({}));if(!res.ok)throw Object.assign(new Error(result?.error?.message||'Meta CAPI error'),{status:res.status});return{ok:true,result};
}

async function translateText(text,lang){const key=process.env.LOVABLE_API_KEY;if(!key)throw new Error('LOVABLE_API_KEY missing');const target=lang==='en'?'English':'Brazilian Portuguese';const res=await fetch('https://ai.gateway.lovable.dev/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:'google/gemini-2.5-flash',messages:[{role:'system',content:`Translate the user's text to ${target}. Preserve tone, punctuation and emojis. Return only translated text.`},{role:'user',content:text}]})});if(!res.ok)throw new Error(`AI ${res.status}: ${await res.text()}`);const d=await res.json();return String(d?.choices?.[0]?.message?.content||'').trim();}
export async function translateTestimonials(body, auth){requireAdmin(auth);const params=[];let sql=`select id,message,role,message_en,message_pt,role_en,role_pt from testimonials`;if(body?.id){params.push(body.id);sql+=` where id=$1`;}const rows=(await query(sql,params)).rows;let updated=0;for(const r of rows){const force=!!body?.force,patch={};const needs=(v)=>force||!v||!String(v).trim();if(r.message&&needs(r.message_en))patch.message_en=await translateText(r.message,'en');if(r.message&&needs(r.message_pt))patch.message_pt=await translateText(r.message,'pt');if(r.role&&needs(r.role_en))patch.role_en=await translateText(r.role,'en');if(r.role&&needs(r.role_pt))patch.role_pt=await translateText(r.role,'pt');const keys=Object.keys(patch);if(keys.length){const vals=[r.id,...keys.map(k=>patch[k])];await query(`update testimonials set ${keys.map((k,i)=>`"${k}"=$${i+2}`).join(',')} where id=$1`,vals);updated++;}}return{ok:true,processed:rows.length,updated};}
