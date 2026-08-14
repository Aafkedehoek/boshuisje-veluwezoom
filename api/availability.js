const { ensureSchema, expireOldHolds } = require('../lib/db');
const { differenceInNights, quote } = require('../lib/pricing');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const arrival = String(req.query.arrival || '');
    const departure = String(req.query.departure || '');
    const guests = Number(req.query.guests || 1);

    const nights = differenceInNights(arrival, departure);
    if (!Number.isInteger(nights) || nights < 2) {
      return res.status(400).json({ available: false, error: 'Het minimum verblijf is 2 nachten.' });
    }

    const sql = await ensureSchema();
    await expireOldHolds(sql);

    const rows = await sql`
      SELECT id
      FROM bookings
      WHERE status IN ('hold', 'paid')
        AND arrival < ${departure}::date
        AND departure > ${arrival}::date
      LIMIT 1
    `;

    if (rows.length) {
      return res.status(200).json({ available: false, nights });
    }

    const price = quote({ arrival, departure, guests });
    if (!price.readyForPayment) {
      return res.status(200).json({
        available: true,
        nights,
        readyForPayment: false,
        error: price.message
      });
    }

    res.status(200).json({
      available: true,
      readyForPayment: true,
      nights: price.nights,
      lowRateNights: price.lowRateNights,
      highRateNights: price.highRateNights,
      accommodationCents: price.accommodationCents,
      touristTaxCents: price.touristTaxCents,
      discountCents: price.discountCents,
      totalCents: price.totalCents
    });
  } catch (error) {
    console.error('availability', error);
    res.status(400).json({ available: false, error: 'Controleer de gekozen datums.' });
  }
};
