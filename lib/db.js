const { neon } = require('@neondatabase/serverless');

function getDatabaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL || '';
}

function getSql() {
  const url = getDatabaseUrl();
  if (!url) throw new Error('Database environment variable ontbreekt.');
  return neon(url);
}

async function ensureSchema() {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS bookings (
      id BIGSERIAL PRIMARY KEY,
      booking_ref TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      arrival DATE NOT NULL,
      departure DATE NOT NULL,
      guests INTEGER NOT NULL,
      nights INTEGER NOT NULL,
      nightly_rate_cents INTEGER NOT NULL,
      accommodation_cents INTEGER NOT NULL,
      tourist_tax_cents INTEGER NOT NULL,
      discount_cents INTEGER NOT NULL DEFAULT 0,
      total_cents INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'hold',
      stripe_session_id TEXT UNIQUE,
      hold_expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      paid_at TIMESTAMPTZ
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS bookings_dates_idx ON bookings (arrival, departure, status)`;
  return sql;
}

async function expireOldHolds(sql) {
  await sql`
    UPDATE bookings
    SET status = 'expired'
    WHERE status = 'hold'
      AND hold_expires_at IS NOT NULL
      AND hold_expires_at < NOW()
  `;
}

module.exports = { getSql, ensureSchema, expireOldHolds };
