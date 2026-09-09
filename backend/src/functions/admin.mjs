import { query } from '../db.mjs';
import { changePassword } from '../auth.mjs';

function requireAdmin(auth) {
  if (!auth?.user) throw Object.assign(new Error('No autenticado'), { status: 401 });
  if (!auth?.isAdmin) throw Object.assign(new Error('Forbidden: admin role required'), { status: 403 });
}

export async function deletePayment(body, auth) {
  requireAdmin(auth);
  const id = body?.payment_id;
  if (!id || typeof id !== 'string') throw Object.assign(new Error('payment_id required'), { status: 400 });
  await query(`delete from payments where id=$1`, [id]);
  return { success: true };
}

export async function deleteSubscription(body, auth) {
  requireAdmin(auth);
  const id = body?.subscription_id;
  if (!id || typeof id !== 'string') throw Object.assign(new Error('subscription_id required'), { status: 400 });
  await query(`delete from subscriptions where id=$1`, [id]);
  return { success: true };
}

export async function deleteUser(body, auth) {
  requireAdmin(auth);
  const id = body?.user_id;
  if (!id || typeof id !== 'string') throw Object.assign(new Error('user_id required'), { status: 400 });
  if (id === auth.user.id) throw Object.assign(new Error('No podés eliminar tu propia cuenta.'), { status: 403 });
  const target = await query(`select email from app_users where id=$1`, [id]);
  if (!target.rowCount) throw Object.assign(new Error('Usuario no encontrado'), { status: 404 });
  const protectedEmail = String(process.env.ADMIN_EMAIL || 'jorgitom18@gmail.com').trim().toLowerCase();
  if (String(target.rows[0].email || '').toLowerCase() === protectedEmail) {
    throw Object.assign(new Error('Este usuario es super admin y no puede ser eliminado.'), { status: 403 });
  }
  await query(`delete from app_users where id=$1`, [id]);
  return { success: true };
}

export async function setPassword(body, auth) {
  requireAdmin(auth);
  const id = body?.user_id;
  const password = body?.new_password;
  if (!id || typeof id !== 'string') throw Object.assign(new Error('user_id required'), { status: 400 });
  if (!password || typeof password !== 'string' || password.length < 6) {
    throw Object.assign(new Error('new_password required (min 6 chars)'), { status: 400 });
  }
  const user = await changePassword(id, password);
  if (!user) throw Object.assign(new Error('Usuario no encontrado'), { status: 404 });
  return { success: true };
}
