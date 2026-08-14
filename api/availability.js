const { ensureSchema, expireOldHolds } = require('../lib/db');
const { differenceInNights } = require('../lib/pricing');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const arrival = String(req.query.arrival || '');
    const departure = String(req.query.departure || '');

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

    res.status(200).json({ available: rows.length === 0, nights });
  } catch (error) {
    console.error('availability', error);
    res.status(400).json({ available: false, error: 'Controleer de gekozen datums.' });
  }
};
