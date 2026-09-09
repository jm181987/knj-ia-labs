import http from 'node:http';
import { ensureSchema } from './db.mjs';
import { getAuthContext, login, register, bootstrapAdmin, publicUser } from './auth.mjs';
import { executeData } from './data.mjs';
import { executeRpc } from './rpc.mjs';
import { startUpload, uploadPart, finishUpload, removeObjects, getObject } from './storage.mjs';
import { wavespeedModels, wavespeedBalance, wavespeedGenerate, translateModel } from './functions/providers.mjs';
import { createPreference, createSubscription as createMpSubscription, cancelSubscription, webhook as mpWebhook, reconcile, health as mpHealth } from './functions/mercadopago.mjs';
import { config as paypalConfig, createOrder, captureOrder, createSubscription as createPaypalSubscription, webhook as paypalWebhook } from './functions/paypal.mjs';
import { publicAffiliate, selfAffiliate, adminAffiliate } from './functions/affiliate.mjs';
import { deletePayment, deleteSubscription, deleteUser, setPassword } from './functions/admin.mjs';
import { notifyNewUser, whatsappTest, sendBulkEmail, metaCapiEvent, translateTestimonials } from './functions/comms.mjs';

const MAX_JSON_BYTES = 60 * 1024 * 1024;
let readyPromise;

function ensureReady() {
  if (!readyPromise) {
    readyPromise = (async () => {
      await ensureSchema();
      if (process.env.ADMIN_PASSWORD) await bootstrapAdmin();
    })().catch((error) => {
      readyPromise = undefined;
      throw error;
    });
  }
  return readyPromise;
}

function corsHeaders() {
  const configured = String(process.env.CORS_ORIGINS || '').split(',').map((v) => v.trim()).filter(Boolean);
  return {
    'Access-Control-Allow-Origin': configured.length === 1 ? configured[0] : '*',
    'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey, paypal-transmission-id, paypal-transmission-time, paypal-transmission-sig, paypal-cert-url, paypal-auth-algo, x-signature, x-request-id',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

function sendJson(res, status, body) {
  res.writeHead(status, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function sendRaw(res, status, body, contentType = 'text/plain; charset=utf-8', extra = {}) {
  res.writeHead(status, { ...corsHeaders(), 'Content-Type': contentType, ...extra });
  res.end(body);
}

async function readJson(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_JSON_BYTES) throw Object.assign(new Error('Payload too large'), { status: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) return {};
  try { return JSON.parse(text); }
  catch { throw Object.assign(new Error('Invalid JSON'), { status: 400 }); }
}

function requestBase(req) {
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  return host ? `${proto}://${host}` : '';
}

function requestContext(req, url) {
  return {
    origin: String(req.headers.origin || ''),
    apiBase: process.env.PUBLIC_API_URL || requestBase(req),
    query: Object.fromEntries(url.searchParams.entries()),
    headers: Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v[0] : v])),
    ip: String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim(),
    userAgent: String(req.headers['user-agent'] || ''),
  };
}

async function authFor(req) {
  return getAuthContext(req.headers.authorization || '');
}

async function mePayload(auth) {
  if (!auth?.user) return null;
  const { query } = await import('./db.mjs');
  const profile = await query('select display_name,whatsapp,avatar_url from profiles where id=$1', [auth.user.id]);
  return publicUser(auth.user, profile.rows[0] || {});
}

const functionHandlers = {
  'wavespeed-models': async (body) => wavespeedModels(body),
  'wavespeed-balance': async (_body, auth) => wavespeedBalance(auth),
  'wavespeed-generate': async (body, auth) => wavespeedGenerate(body, auth),
  'translate-model': async (body) => translateModel(body),
  'translate-testimonials': async (body, auth) => translateTestimonials(body, auth),
  'mp-create-preference': async (body, auth, ctx) => createPreference(body, auth, ctx),
  'mp-create-subscription': async (body, auth, ctx) => createMpSubscription(body, auth, ctx),
  'mp-cancel-subscription': async (body, auth) => cancelSubscription(body, auth),
  'mp-reconcile-payments': async (body, auth) => reconcile(body, auth),
  'mp-webhook': async (body, _auth, ctx) => mpWebhook(body, ctx),
  'mp-health': async () => mpHealth(),
  'paypal-config': async () => paypalConfig(),
  'paypal-create-order': async (body, auth) => createOrder(body, auth),
  'paypal-capture-order': async (body, auth) => captureOrder(body, auth),
  'paypal-create-subscription': async (body, auth, ctx) => createPaypalSubscription(body, auth, ctx),
  'paypal-webhook': async (body, _auth, ctx) => paypalWebhook(body, ctx),
  'affiliate-public': async (body, _auth, ctx) => publicAffiliate(body, ctx),
  'affiliate-self': async (body, auth, ctx) => selfAffiliate(body, auth, ctx),
  'affiliate-admin': async (body, auth) => adminAffiliate(body, auth),
  'admin-delete-payment': async (body, auth) => deletePayment(body, auth),
  'admin-delete-subscription': async (body, auth) => deleteSubscription(body, auth),
  'admin-delete-user': async (body, auth) => deleteUser(body, auth),
  'admin-set-password': async (body, auth) => setPassword(body, auth),
  'notify-new-user': async (body, auth) => notifyNewUser(body, auth),
  'whatsapp-test': async (body, auth) => whatsappTest(body, auth),
  'send-bulk-email': async (body, auth) => sendBulkEmail(body, auth),
  'meta-capi-event': async (body, auth, ctx) => metaCapiEvent(body, auth, ctx),
};

export async function handler(req, res) {
  const url = new URL(req.url || '/', requestBase(req) || 'http://localhost');
  if (req.method === 'OPTIONS') return sendRaw(res, 204, '');

  try {
    if (url.pathname === '/api/health') {
      await ensureReady();
      return sendJson(res, 200, { ok: true, database: 'postgresql', supabase: false });
    }

    await ensureReady();

    if (url.pathname === '/api/auth/login' && req.method === 'POST') {
      const body = await readJson(req);
      const result = await login(body.email, body.password);
      const user = await mePayload({ user: result.user, isAdmin: false });
      return sendJson(res, 200, { user: user || result.user, token: result.token });
    }

    if (url.pathname === '/api/auth/signup' && req.method === 'POST') {
      const body = await readJson(req);
      const result = await register({
        email: body.email,
        password: body.password,
        displayName: body.display_name ?? body.displayName,
        whatsapp: body.whatsapp,
      });
      return sendJson(res, 200, result);
    }

    if (url.pathname === '/api/auth/me' && req.method === 'GET') {
      const auth = await authFor(req);
      if (!auth.user) return sendJson(res, 401, { error: 'No autenticado' });
      return sendJson(res, 200, { user: await mePayload(auth), isAdmin: auth.isAdmin });
    }

    if (url.pathname === '/api/auth/logout' && req.method === 'POST') {
      return sendJson(res, 200, { ok: true });
    }

    if (url.pathname === '/api/data' && req.method === 'POST') {
      const auth = await authFor(req);
      const body = await readJson(req);
      return sendJson(res, 200, await executeData(body, auth));
    }

    if (url.pathname.startsWith('/api/rpc/') && req.method === 'POST') {
      const auth = await authFor(req);
      const name = decodeURIComponent(url.pathname.slice('/api/rpc/'.length));
      const body = await readJson(req);
      return sendJson(res, 200, { data: await executeRpc(name, body || {}, auth) });
    }

    if (url.pathname === '/api/storage/start' && req.method === 'POST') {
      return sendJson(res, 200, await startUpload(await authFor(req), await readJson(req)));
    }
    if (url.pathname === '/api/storage/part' && req.method === 'POST') {
      return sendJson(res, 200, await uploadPart(await authFor(req), await readJson(req)));
    }
    if (url.pathname === '/api/storage/finish' && req.method === 'POST') {
      return sendJson(res, 200, await finishUpload(await authFor(req), await readJson(req)));
    }
    if (url.pathname === '/api/storage/remove' && req.method === 'POST') {
      const body = await readJson(req);
      return sendJson(res, 200, { data: await removeObjects(await authFor(req), body.bucket, body.paths) });
    }
    if (url.pathname.startsWith('/api/storage/object/') && req.method === 'GET') {
      const rest = url.pathname.slice('/api/storage/object/'.length);
      const slash = rest.indexOf('/');
      if (slash < 1) return sendJson(res, 400, { error: 'Ruta inválida' });
      const bucket = decodeURIComponent(rest.slice(0, slash));
      const objectPath = rest.slice(slash + 1).split('/').map(decodeURIComponent).join('/');
      const object = await getObject(bucket, objectPath);
      if (!object) return sendJson(res, 404, { error: 'Archivo no encontrado' });
      res.writeHead(200, {
        ...corsHeaders(),
        'Content-Type': object.content_type || 'application/octet-stream',
        'Content-Length': String(object.size_bytes || object.data.length),
        'Cache-Control': 'public, max-age=31536000, immutable',
      });
      return res.end(object.data);
    }

    if (url.pathname.startsWith('/api/functions/') && req.method === 'POST') {
      const name = decodeURIComponent(url.pathname.slice('/api/functions/'.length));
      const fn = functionHandlers[name];
      if (!fn) return sendJson(res, 404, { error: `Función no encontrada: ${name}` });
      const body = await readJson(req);
      const auth = await authFor(req);
      const result = await fn(body, auth, requestContext(req, url));
      if (result?.__raw) return sendRaw(res, 200, result.body, result.contentType || 'text/plain');
      return sendJson(res, 200, result ?? null);
    }

    return sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    console.error('[api]', error);
    const status = Number(error?.status || 500);
    return sendJson(res, status, {
      error: error instanceof Error ? error.message : String(error),
      ...(error?.details ? { details: error.details } : {}),
    });
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const port = Number(process.env.PORT || 3001);
  const server = http.createServer(handler);
  server.listen(port, '0.0.0.0', () => console.log(`[api] listening on :${port}`));
}
