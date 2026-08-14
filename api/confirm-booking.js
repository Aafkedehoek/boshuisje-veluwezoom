const Stripe = require('stripe');
const { ensureSchema } = require('../lib/db');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const sessionId = String(req.query.session_id || '');
    if (!sessionId.startsWith('cs_')) return res.status(400).json({ error: 'Ongeldige betaalsessie.' });

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const bookingRef = session.client_reference_id || session.metadata?.booking_ref;
    if (!bookingRef) return res.status(404).json({ error: 'Boeking niet gevonden.' });

    const sql = await ensureSchema();
    if (session.payment_status === 'paid') {
      await sql`
        UPDATE bookings
        SET status = 'paid', paid_at = COALESCE(paid_at, NOW()), hold_expires_at = NULL
        WHERE booking_ref = ${bookingRef}
          AND stripe_session_id = ${session.id}
          AND status IN ('hold', 'paid')
      `;
    }

    const rows = await sql`
      SELECT booking_ref, arrival, departure, guests, nights, total_cents, status
      FROM bookings
      WHERE booking_ref = ${bookingRef}
      LIMIT 1
    `;

    if (!rows.length) return res.status(404).json({ error: 'Boeking niet gevonden.' });

    res.status(200).json({
      bookingRef: rows[0].booking_ref,
      arrival: rows[0].arrival,
      departure: rows[0].departure,
      guests: rows[0].guests,
      nights: rows[0].nights,
      totalCents: rows[0].total_cents,
      status: rows[0].status,
      paid: session.payment_status === 'paid'
    });
  } catch (error) {
    console.error('confirm-booking', error);
    res.status(500).json({ error: 'De boeking kon niet worden gecontroleerd.' });
  }
};
