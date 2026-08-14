const crypto = require('crypto');
const Stripe = require('stripe');
const { ensureSchema, expireOldHolds } = require('../lib/db');
const { quote } = require('../lib/pricing');

function bodyOf(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let sql;
  let bookingRef;

  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: 'Stripe is nog niet gekoppeld.' });
    }

    const body = bodyOf(req);
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim();
    const arrival = String(body.arrival || '');
    const departure = String(body.departure || '');
    const guests = Number(body.guests);

    if (!name || !email || !arrival || !departure) {
      return res.status(400).json({ error: 'Vul alle verplichte gegevens in.' });
    }

    const price = quote({ arrival, departure, guests });
    if (!price.readyForPayment) {
      return res.status(409).json({
        code: 'season_pricing_not_configured',
        error: price.message,
        nights: price.nights,
        lowRateCents: price.lowRateCents,
        highRateCents: price.highRateCents
      });
    }

    sql = await ensureSchema();
    await expireOldHolds(sql);

    const conflict = await sql`
      SELECT id FROM bookings
      WHERE status IN ('hold', 'paid')
        AND arrival < ${departure}::date
        AND departure > ${arrival}::date
      LIMIT 1
    `;
    if (conflict.length) {
      return res.status(409).json({ code: 'not_available', error: 'Deze periode is helaas niet meer beschikbaar.' });
    }

    bookingRef = `BVV-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const holdExpires = new Date(Date.now() + 30 * 60 * 1000);

    await sql`
      INSERT INTO bookings (
        booking_ref, name, email, arrival, departure, guests, nights,
        nightly_rate_cents, accommodation_cents, tourist_tax_cents,
        discount_cents, total_cents, status, hold_expires_at
      ) VALUES (
        ${bookingRef}, ${name}, ${email}, ${arrival}::date, ${departure}::date,
        ${guests}, ${price.nights}, ${price.nightlyRateCents}, ${price.accommodationCents},
        ${price.touristTaxCents}, ${price.discountCents}, ${price.totalCents}, 'hold', ${holdExpires.toISOString()}
      )
    `;

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: email,
      client_reference_id: bookingRef,
      expires_at: Math.floor(holdExpires.getTime() / 1000),
      success_url: `https://www.boshuisjeveluwezoom.nl/bedankt.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: 'https://www.boshuisjeveluwezoom.nl/#boeken',
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: price.totalCents,
          product_data: {
            name: `Boshuisje Veluwezoom · ${arrival} t/m ${departure}`,
            description: `${price.nights} nachten, ${guests} gast${guests === 1 ? '' : 'en'} · inclusief toeristenbelasting`
          }
        }
      }],
      metadata: {
        booking_ref: bookingRef,
        arrival,
        departure,
        guests: String(guests),
        nights: String(price.nights)
      }
    });

    await sql`
      UPDATE bookings
      SET stripe_session_id = ${session.id}
      WHERE booking_ref = ${bookingRef}
    `;

    res.status(200).json({ url: session.url, bookingRef });
  } catch (error) {
    console.error('create-checkout', error);

    if (sql && bookingRef) {
      try {
        await sql`UPDATE bookings SET status = 'cancelled' WHERE booking_ref = ${bookingRef} AND status = 'hold'`;
      } catch (cleanupError) {
        console.error('create-checkout-cleanup', cleanupError);
      }
    }

    if (error?.code === '23P01') {
      return res.status(409).json({ code: 'not_available', error: 'Deze periode is helaas net door iemand anders gekozen.' });
    }

    res.status(500).json({ error: 'De betaling kon niet worden gestart. Probeer het opnieuw.' });
  }
};
