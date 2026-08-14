const Stripe = require('stripe');
const { ensureSchema, getConfig, setConfig } = require('../lib/db');

module.exports = async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: 'Stripe is nog niet gekoppeld.' });
    }

    const sql = await ensureSchema();
    const existingSecret = await getConfig(sql, 'stripe_webhook_secret');
    const existingId = await getConfig(sql, 'stripe_webhook_id');

    if (existingSecret && existingId) {
      return res.status(200).json({ configured: true, alreadyConfigured: true });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const endpoint = await stripe.webhookEndpoints.create({
      url: 'https://www.boshuisjeveluwezoom.nl/api/stripe-webhook',
      enabled_events: [
        'checkout.session.completed',
        'checkout.session.async_payment_succeeded',
        'checkout.session.expired'
      ]
    });

    await setConfig(sql, 'stripe_webhook_id', endpoint.id);
    await setConfig(sql, 'stripe_webhook_secret', endpoint.secret);

    res.status(200).json({ configured: true, alreadyConfigured: false });
  } catch (error) {
    console.error('setup-stripe-webhook', error);
    res.status(500).json({ error: 'Kon de Stripe-webhook niet instellen.' });
  }
};
