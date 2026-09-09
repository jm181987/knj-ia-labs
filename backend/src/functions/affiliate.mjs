import crypto from 'node:crypto';
import { query } from '../db.mjs';
import { uuid } from '../auth.mjs';
import {
  registerAffiliate, attributeReferral, requestAffiliatePayout,
  adminMarkPayoutPaid, approvePendingCommissions,
} from '../rpc.mjs';

function requireUser(auth){if(!auth?.user)throw Object.assign(new Error('unauth'),{status:401});return auth.user;}
function requireAdmin(auth){if(!auth?.isAdmin)throw Object.assign(new Error('forbidden'),{status:403});}
const sha=(s)=>crypto.createHash('sha256').update(String(s)).digest('hex');

export async function publicAffiliate(body,ctx={}){
  const action=body?.action||ctx.query?.action;
  if(action==='track'){
    const code=String(body?.code||'').toLowerCase(); if(!code)return{ok:false};
    const r=await query(`select id,status from affiliates where code=$1 limit 1`,[code]);const aff=r.rows[0];
    if(!aff||['blocked','rejected'].includes(aff.status))return{ok:false};
    await query(`insert into affiliate_clicks(id,affiliate_id,ip_hash,ua_hash,landing_path,referrer) values($1,$2,$3,$4,$5,$6)`,[uuid(),aff.id,ctx.ip?sha(ctx.ip):null,ctx.userAgent?sha(ctx.userAgent):null,body?.path||null,body?.referrer||null]);
    return{ok:true};
  }
  if(action==='lookup'){
    const code=String(body?.code||ctx.query?.code||'').toLowerCase();const r=await query(`select status from affiliates where code=$1 limit 1`,[code]);const row=r.rows[0];return{valid:!!row&&!['blocked','rejected'].includes(row.status)};
  }
  if(action==='leaderboard'){
    const r=await query(`select code,tier,total_earned,public_profile from affiliates where public_profile=true and status='approved' order by total_earned desc limit 10`);return{leaderboard:r.rows};
  }
  throw Object.assign(new Error('unknown_action'),{status:400});
}

export async function selfAffiliate(body,auth,ctx={}){
  const user=requireUser(auth), action=body?.action;
  if(action==='me'){
    const r=await query(`select * from affiliates where user_id=$1 limit 1`,[user.id]);const aff=r.rows[0];if(!aff)return{affiliate:null};
    const [clicks,refs,comms,payouts]=await Promise.all([
      query(`select count(*)::int as count from affiliate_clicks where affiliate_id=$1`,[aff.id]),
      query(`select * from affiliate_referrals where affiliate_id=$1`,[aff.id]),
      query(`select * from affiliate_commissions where affiliate_id=$1 order by created_at desc limit 50`,[aff.id]),
      query(`select * from affiliate_payouts where affiliate_id=$1 order by created_at desc`,[aff.id]),
    ]);
    const sales=comms.rows.filter(c=>!['rejected','reversed'].includes(c.status));
    return{affiliate:aff,stats:{clicks:Number(clicks.rows[0]?.count||0),referrals:refs.rows.length,conversions:sales.length,gross_sales_uyu:sales.reduce((a,c)=>a+Number(c.gross_amount_uyu),0),pending_balance:Number(aff.pending_balance),approved_balance:comms.rows.filter(c=>c.status==='approved').reduce((a,c)=>a+Number(c.commission_uyu),0),total_paid:Number(aff.total_paid),total_earned:Number(aff.total_earned)},commissions:comms.rows,payouts:payouts.rows};
  }
  if(action==='register')return{affiliate:await registerAffiliate(user.id,String(body?.code||''))};
  if(action==='update_payout'){
    const r=await query(`update affiliates set payout_method=$2,payout_details=$3::jsonb,public_profile=$4 where user_id=$1 returning id`,[user.id,body?.method||null,JSON.stringify(body?.details||{}),!!body?.public_profile]);if(!r.rowCount)throw Object.assign(new Error('no_affiliate'),{status:404});return{ok:true};
  }
  if(action==='request_payout'){
    try{return{payout:await requestAffiliatePayout(user.id)}}catch(e){if(/below_minimum|not_approved/.test(String(e?.message)))return{error:e.message};throw e;}
  }
  if(action==='attribute'){
    const code=String(body?.code||'').toLowerCase();if(!code)return{ok:false};return{ok:await attributeReferral(user.id,code,ctx.ip?sha(ctx.ip):null)};
  }
  throw Object.assign(new Error('unknown_action'),{status:400});
}

export async function adminAffiliate(body,auth){
  requireAdmin(auth);const action=body?.action;
  if(action==='list'){
    const r=await query(`select a.*,json_build_object('id',p.id,'email',p.email,'display_name',p.display_name) as profile from affiliates a left join profiles p on p.id=a.user_id order by a.created_at desc`);return{affiliates:r.rows};
  }
  if(action==='stats'){
    const [a,c,p]=await Promise.all([query(`select count(*)::int total,count(*) filter(where status='approved')::int approved,count(*) filter(where status='blocked')::int blocked from affiliates`),query(`select coalesce(sum(commission_uyu),0) total,coalesce(sum(commission_uyu) filter(where status='pending'),0) pending from affiliate_commissions`),query(`select coalesce(sum(amount_uyu) filter(where status='paid'),0) paid from affiliate_payouts`)]);return{total_affiliates:a.rows[0]?.total||0,approved:a.rows[0]?.approved||0,blocked:a.rows[0]?.blocked||0,total_commissions:Number(c.rows[0]?.total||0),pending_commissions:Number(c.rows[0]?.pending||0),paid_payouts:Number(p.rows[0]?.paid||0)};
  }
  if(action==='set_status'){await query(`update affiliates set status=$2,approved_at=case when $2='approved' then now() else approved_at end where id=$1`,[body?.affiliate_id,body?.status]);return{ok:true};}
  if(action==='set_tier'){await query(`update affiliates set tier=$2 where id=$1`,[body?.affiliate_id,body?.tier]);return{ok:true};}
  if(action==='delete'){await query(`delete from affiliates where id=$1`,[body?.affiliate_id]);return{ok:true};}
  if(action==='update_rates'){await query(`update app_settings set value=$2::jsonb where key='affiliate_rates'`,['affiliate_rates',JSON.stringify(body?.rates||{})]);return{ok:true};}
  if(action==='list_payouts'){
    const r=await query(`select p.*,json_build_object('code',a.code,'user_id',a.user_id) as affiliates from affiliate_payouts p join affiliates a on a.id=p.affiliate_id order by p.created_at desc limit 200`);return{payouts:r.rows};
  }
  if(action==='approve_payout'){await query(`update affiliate_payouts set status='approved',approved_at=now() where id=$1`,[body?.payout_id]);return{ok:true};}
  if(action==='mark_paid'){await adminMarkPayoutPaid(body?.payout_id,body?.external_ref||null,body?.notes||null);return{ok:true};}
  if(action==='approve_pending_commissions')return{count:await approvePendingCommissions()};
  if(action==='list_commissions'){
    const r=await query(`select c.*,json_build_object('code',a.code,'user_id',a.user_id) as affiliates from affiliate_commissions c join affiliates a on a.id=c.affiliate_id order by c.created_at desc limit 500`);return{commissions:r.rows};
  }
  if(action==='export_csv'){
    const r=await query(`select * from affiliate_commissions order by created_at desc`);const headers=['id','affiliate_id','referred_user_id','plan','gross_amount_uyu','rate','commission_uyu','status','created_at'];const rows=r.rows.map(c=>headers.map(h=>JSON.stringify(c[h]??'')).join(','));return{__raw:true,contentType:'text/csv',body:[headers.join(','),...rows].join('\n')};
  }
  throw Object.assign(new Error('unknown_action'),{status:400});
}
