module.exports = async function handler(req, res) {
  const databaseReady = Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL);
  const stripeReady = Boolean(process.env.STRIPE_SECRET_KEY);
  const webhookReady = Boolean(process.env.STRIPE_WEBHOOK_SECRET);

  res.status(200).json({
    ok: databaseReady && stripeReady,
    databaseReady,
    stripeReady,
    webhookReady
  });
};
