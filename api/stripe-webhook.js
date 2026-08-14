const Stripe = require('stripe');
const { ensureSchema, getConfig } = require('../lib/db');

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function markPaid(sql, session) {
  const bookingRef = session.client_reference_id || session.metadata?.booking_ref;
  if (!bookingRef) return;

  await sql`
    UPDATE bookings
    SET status = 'paid', paid_at = COALESCE(paid_at, NOW()), hold_expires_at = NULL
    WHERE booking_ref = ${bookingRef}
      AND stripe_session_id = ${session.id}
      AND status IN ('hold', 'paid')
  `;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method not allowed');

  try {
    const sql = await ensureSchema();
    const signingSecret = process.env.STRIPE_WEBHOOK_SECRET || await getConfig(sql, 'stripe_webhook_secret');
    if (!signingSecret) return res.status(500).end('Webhook is niet geconfigureerd');

    const signature = req.headers['stripe-signature'];
    if (!signature) return res.status(400).end('Stripe signature ontbreekt');

    const rawBody = await readRawBody(req);
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const event = stripe.webhooks.constructEvent(rawBody, signature, signingSecret);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      if (session.payment_status === 'paid') await markPaid(sql, session);
    }

    if (event.type === 'checkout.session.async_payment_succeeded') {
      await markPaid(sql, event.data.object);
    }

    if (event.type === 'checkout.session.expired') {
      const session = event.data.object;
      const bookingRef = session.client_reference_id || session.metadata?.booking_ref;
      if (bookingRef) {
        await sql`
          UPDATE bookings
          SET status = 'expired'
          WHERE booking_ref = ${bookingRef}
            AND stripe_session_id = ${session.id}
            AND status = 'hold'
        `;
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('stripe-webhook', error);
    res.status(400).end('Webhook verwerking mislukt');
  }
};

module.exports.config = { api: { bodyParser: false } };
