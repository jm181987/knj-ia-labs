import { query, transaction } from './db.mjs';
import { uuid } from './auth.mjs';

const ID_TABLES = new Set([
  'user_roles','credit_transactions','credit_packages','generations','payments','subscriptions',
  'paypal_orders','testimonials','email_templates','email_sends','affiliates','affiliate_clicks',
  'affiliate_referrals','affiliate_payouts','affiliate_commissions',
]);

const TABLES = {
  profiles: { own: 'id', userWrite: true },
  user_roles: { own: 'user_id' },
  user_credits: { own: 'user_id' },
  credit_transactions: { own: 'user_id' },
  app_settings: { publicRead: true, adminWrite: true },
  pricing: { publicRead: true, adminWrite: true },
  credit_packages: { publicRead: true, adminWrite: true },
  generations: { own: 'user_id', userWrite: true },
  payments: { own: 'user_id' },
  subscriptions: { own: 'user_id' },
  paypal_orders: { own: 'user_id' },
  rate_limits: { own: 'user_id' },
  testimonials: { publicRead: true, adminWrite: true, publicActiveOnly: true },
  email_templates: { adminOnly: true },
  email_sends: { adminOnly: true },
  affiliates: { own: 'user_id' },
  affiliate_clicks: { affiliateOwned: true },
  affiliate_referrals: { affiliateOwned: true },
  affiliate_commissions: { affiliateOwned: true },
  affiliate_payouts: { affiliateOwned: true },
};

const COL_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
function ident(value) {
  if (!COL_RE.test(String(value || ''))) throw new Error(`Invalid identifier: ${value}`);
  return `"${value}"`;
}

function tableMeta(table) {
  const meta = TABLES[table];
  if (!meta) {
    const error = new Error(`Table not available: ${table}`);
    error.status = 400;
    throw error;
  }
  return meta;
}

function selectedColumns(value) {
  const raw = String(value || '*').trim();
  if (raw === '*') return '*';
  const cols = raw.split(',').map((x) => x.trim()).filter(Boolean);
  if (!cols.length) return '*';
  // Existing application queries use flat columns. Nested PostgREST relationships are
  // intentionally rejected instead of accepting raw SQL from the browser.
  return cols.map((col) => ident(col)).join(', ');
}

function addParam(params, value) {
  params.push(value);
  return `$${params.length}`;
}

function filterSql(filter, params) {
  const col = ident(filter.column);
  const op = filter.op;
  const value = filter.value;
  if (op === 'eq') return `${col} = ${addParam(params, value)}`;
  if (op === 'neq') return `${col} <> ${addParam(params, value)}`;
  if (op === 'gt') return `${col} > ${addParam(params, value)}`;
  if (op === 'gte') return `${col} >= ${addParam(params, value)}`;
  if (op === 'lt') return `${col} < ${addParam(params, value)}`;
  if (op === 'lte') return `${col} <= ${addParam(params, value)}`;
  if (op === 'like') return `${col} like ${addParam(params, value)}`;
  if (op === 'ilike') return `${col} ilike ${addParam(params, value)}`;
  if (op === 'contains') return `${col} @> ${addParam(params, JSON.stringify(value))}::jsonb`;
  if (op === 'in') {
    const values = Array.isArray(value) ? value : [];
    if (!values.length) return 'false';
    return `${col} in (${values.map((v) => addParam(params, v)).join(', ')})`;
  }
  if (op === 'is') {
    if (value === null) return `${col} is null`;
    if (value === true) return `${col} is true`;
    if (value === false) return `${col} is false`;
    return `${col} is not distinct from ${addParam(params, value)}`;
  }
  if (op === 'not') {
    const nested = { ...filter, op: filter.operator || 'eq' };
    return `not (${filterSql(nested, params)})`;
  }
  throw new Error(`Unsupported filter operator: ${op}`);
}

function authorizationSql(table, meta, auth, action, params) {
  const isRead = action === 'select';
  if (auth?.isAdmin) return null;
  if (meta.adminOnly || (action !== 'select' && meta.adminWrite)) {
    const error = new Error('No autorizado');
    error.status = auth?.user ? 403 : 401;
    throw error;
  }
  if (isRead && meta.publicRead) {
    if (meta.publicActiveOnly && !auth?.user) return `"active" = true`;
    return null;
  }
  if (!auth?.user) {
    const error = new Error('No autenticado');
    error.status = 401;
    throw error;
  }
  if (action !== 'select' && !meta.userWrite) {
    const error = new Error('No autorizado');
    error.status = 403;
    throw error;
  }
  if (meta.own) return `${ident(meta.own)} = ${addParam(params, auth.user.id)}`;
  if (meta.affiliateOwned) {
    return `"affiliate_id" in (select id from affiliates where user_id = ${addParam(params, auth.user.id)})`;
  }
  const error = new Error('No autorizado');
  error.status = 403;
  throw error;
}

function whereParts(table, meta, auth, action, filters, orGroups, params) {
  const parts = [];
  const authClause = authorizationSql(table, meta, auth, action, params);
  if (authClause) parts.push(authClause);
  for (const filter of filters || []) parts.push(filterSql(filter, params));
  for (const group of orGroups || []) {
    const inner = (group || []).map((f) => filterSql(f, params));
    if (inner.length) parts.push(`(${inner.join(' or ')})`);
  }
  return parts;
}

function normalizeRows(payload) {
  return Array.isArray(payload) ? payload : [payload];
}

function prepareRows(table, rows, auth, action) {
  return rows.map((input) => {
    const row = { ...(input || {}) };
    if (ID_TABLES.has(table) && !row.id) row.id = uuid();
    if (action === 'insert' || action === 'upsert') {
      const meta = TABLES[table];
      if (!auth?.isAdmin && auth?.user && meta?.userWrite && meta.own) {
        row[meta.own] = auth.user.id;
      }
      if (table === 'email_templates' && auth?.user && !row.created_by) row.created_by = auth.user.id;
    }
    return row;
  });
}

function buildInsert(table, rows, params) {
  const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  if (!keys.length) throw new Error('Insert payload is empty');
  const valuesSql = rows.map((row) => {
    const values = keys.map((key) => addParam(params, row[key] === undefined ? null : row[key]));
    return `(${values.join(', ')})`;
  });
  return {
    columns: keys.map(ident).join(', '),
    values: valuesSql.join(', '),
  };
}

export async function executeData(request, auth) {
  const table = String(request.table || '');
  const action = String(request.action || 'select');
  const meta = tableMeta(table);
  const params = [];
  const filters = Array.isArray(request.filters) ? request.filters : [];
  const orGroups = Array.isArray(request.orGroups) ? request.orGroups : [];
  const select = selectedColumns(request.select);
  const order = Array.isArray(request.order) ? request.order : [];
  const limit = request.limit == null ? null : Math.max(0, Math.min(Number(request.limit) || 0, 5000));
  const offset = request.offset == null ? null : Math.max(0, Number(request.offset) || 0);

  if (action === 'select') {
    const where = whereParts(table, meta, auth, action, filters, orGroups, params);
    const orderSql = order.length
      ? ` order by ${order.map((o) => `${ident(o.column)} ${o.ascending === false ? 'desc' : 'asc'}`).join(', ')}`
      : '';
    const limitSql = limit != null ? ` limit ${limit}` : '';
    const offsetSql = offset != null ? ` offset ${offset}` : '';
    const sql = `select ${select} from ${ident(table)}${where.length ? ` where ${where.join(' and ')}` : ''}${orderSql}${limitSql}${offsetSql}`;
    const result = await query(sql, params);
    return { data: result.rows, count: request.count === 'exact' ? result.rowCount : null };
  }

  if (action === 'insert' || action === 'upsert') {
    // authorizationSql validates the write permission even though inserts do not have a WHERE clause.
    authorizationSql(table, meta, auth, action, params);
    params.length = 0;
    const rows = prepareRows(table, normalizeRows(request.payload), auth, action);
    const built = buildInsert(table, rows, params);
    let conflict = '';
    if (action === 'upsert') {
      const keys = String(request.onConflict || '').split(',').map((x) => x.trim()).filter(Boolean);
      if (!keys.length) throw new Error('upsert requires onConflict');
      const updateCols = [...new Set(rows.flatMap((row) => Object.keys(row)))].filter((k) => !keys.includes(k));
      conflict = ` on conflict (${keys.map(ident).join(', ')}) do update set ${updateCols.length
        ? updateCols.map((k) => `${ident(k)} = excluded.${ident(k)}`).join(', ')
        : `${ident(keys[0])} = excluded.${ident(keys[0])}`}`;
    }
    const sql = `insert into ${ident(table)} (${built.columns}) values ${built.values}${conflict} returning ${select}`;
    const result = await query(sql, params);
    return { data: result.rows };
  }

  if (action === 'update') {
    const payload = { ...(request.payload || {}) };
    delete payload.id;
    const keys = Object.keys(payload);
    if (!keys.length) return { data: [] };
    const setSql = keys.map((key) => `${ident(key)} = ${addParam(params, payload[key])}`).join(', ');
    const where = whereParts(table, meta, auth, action, filters, orGroups, params);
    if (!where.length && !auth?.isAdmin) throw new Error('Update requires a scoped filter');

    let sql;
    if (order.length || limit != null) {
      if (!ID_TABLES.has(table)) throw new Error('Ordered/limited update requires an id column');
      const orderSql = order.length
        ? ` order by ${order.map((o) => `${ident(o.column)} ${o.ascending === false ? 'desc' : 'asc'}`).join(', ')}`
        : '';
      const limitSql = limit != null ? ` limit ${limit}` : '';
      sql = `update ${ident(table)} set ${setSql} where id in (select id from ${ident(table)}${where.length ? ` where ${where.join(' and ')}` : ''}${orderSql}${limitSql}) returning ${select}`;
    } else {
      sql = `update ${ident(table)} set ${setSql}${where.length ? ` where ${where.join(' and ')}` : ''} returning ${select}`;
    }
    const result = await query(sql, params);
    return { data: result.rows };
  }

  if (action === 'delete') {
    const where = whereParts(table, meta, auth, action, filters, orGroups, params);
    if (!where.length && !auth?.isAdmin) throw new Error('Delete requires a scoped filter');
    const sql = `delete from ${ident(table)}${where.length ? ` where ${where.join(' and ')}` : ''} returning ${select}`;
    const result = await query(sql, params);
    return { data: result.rows };
  }

  throw new Error(`Unsupported data action: ${action}`);
}

export async function adminCleanBusinessData() {
  return transaction(async (client) => {
    // Used only by the explicit bootstrap command, never from a public API route.
    await client.query(`truncate table
      storage_upload_parts, storage_uploads, storage_objects,
      affiliate_commissions, affiliate_payouts, affiliate_referrals, affiliate_clicks, affiliates,
      email_sends, email_templates, paypal_orders, subscriptions, payments, generations,
      credit_transactions, user_credits, user_roles, profiles, password_resets, rate_limits, app_users
      cascade`);
  });
}
