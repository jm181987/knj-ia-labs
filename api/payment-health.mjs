import { config as paypalConfig } from '../backend/src/functions/paypal.mjs';
import { health as mercadoPagoHealth } from '../backend/src/functions/mercadopago.mjs';

export default async function handler(_req, res) {
  try {
    const [paypal, mercadopago] = await Promise.all([
      paypalConfig(),
      mercadoPagoHealth(),
    ]);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      paypal: {
        mode: paypal.mode,
        oauth_ok: paypal.oauth_ok === true,
        oauth_code: paypal.oauth_code || null,
        alternate_mode_match: paypal.alternate_mode_match === true,
        webhook_configured: paypal.webhook_configured === true,
      },
      mercadopago: {
        configured: mercadopago.configured === true,
        token_ok: mercadopago.token_ok === true,
        webhook_secret_configured: mercadopago.webhook_secret_configured === true,
        checkout_api: mercadopago.checkout_api || null,
        code: mercadopago.code || null,
      },
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error?.message || error) });
  }
}
