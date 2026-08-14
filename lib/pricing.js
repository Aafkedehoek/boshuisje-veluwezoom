const LOW_RATE_CENTS = 14900;
const HIGH_RATE_CENTS = 16200;
const TOURIST_TAX_CENTS = 250;

// Rijksoverheid schoolvakanties. We hanteren het vakantietarief zodra
// minstens één van de regio's Noord, Midden of Zuid vakantie heeft.
// De laatste opgenomen officiële kalender loopt t/m de zomervakantie 2030.
const PRICING_START = '2026-01-01';
const PRICING_END = '2030-09-01';

const SCHOOL_HOLIDAY_RANGES = [
  // Schooljaar 2025-2026
  ['2026-02-14', '2026-03-01'],
  ['2026-04-25', '2026-05-03'],
  ['2026-07-04', '2026-08-30'],

  // Schooljaar 2026-2027
  ['2026-10-10', '2026-10-25'],
  ['2026-12-19', '2027-01-03'],
  ['2027-02-13', '2027-02-28'],
  ['2027-04-24', '2027-05-02'],
  ['2027-07-10', '2027-09-05'],

  // Schooljaar 2027-2028
  ['2027-10-16', '2027-10-31'],
  ['2027-12-25', '2028-01-09'],
  ['2028-02-19', '2028-03-05'],
  ['2028-04-29', '2028-05-07'],
  ['2028-07-08', '2028-09-03'],

  // Schooljaar 2028-2029
  ['2028-10-14', '2028-10-29'],
  ['2028-12-23', '2029-01-07'],
  ['2029-02-10', '2029-02-25'],
  ['2029-04-28', '2029-05-06'],
  ['2029-07-07', '2029-09-02'],

  // Schooljaar 2029-2030
  ['2029-10-13', '2029-10-28'],
  ['2029-12-22', '2030-01-06'],
  ['2030-02-16', '2030-03-03'],
  ['2030-04-27', '2030-05-05'],
  ['2030-07-06', '2030-09-01']
];

function parseDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new Error('Ongeldige datum.');
  return date;
}

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

function differenceInNights(arrival, departure) {
  return Math.round((parseDate(departure) - parseDate(arrival)) / 86400000);
}

function isSchoolHolidayNight(key) {
  return SCHOOL_HOLIDAY_RANGES.some(([start, end]) => key >= start && key <= end);
}

function quote({ arrival, departure, guests }) {
  const nights = differenceInNights(arrival, departure);
  if (!Number.isInteger(nights) || nights < 2) throw new Error('Het minimum verblijf is 2 nachten.');
  if (!Number.isInteger(guests) || guests < 1 || guests > 4) throw new Error('Aantal gasten moet tussen 1 en 4 liggen.');

  const firstNight = arrival;
  const lastNight = dateKey(new Date(parseDate(departure).getTime() - 86400000));
  if (firstNight < PRICING_START || lastNight > PRICING_END) {
    return {
      readyForPayment: false,
      nights,
      lowRateCents: LOW_RATE_CENTS,
      highRateCents: HIGH_RATE_CENTS,
      message: 'Voor deze periode zijn de officiële schoolvakantiedata nog niet volledig beschikbaar. Neem contact op voor de prijs.'
    };
  }

  let highRateNights = 0;
  let lowRateNights = 0;
  const cursor = parseDate(arrival);

  for (let i = 0; i < nights; i += 1) {
    const key = dateKey(cursor);
    if (isSchoolHolidayNight(key)) highRateNights += 1;
    else lowRateNights += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const accommodationBeforeDiscount =
    (lowRateNights * LOW_RATE_CENTS) + (highRateNights * HIGH_RATE_CENTS);
  const discountCents = nights >= 7 ? Math.round(accommodationBeforeDiscount * 0.10) : 0;
  const accommodationCents = accommodationBeforeDiscount - discountCents;
  const touristTaxCents = TOURIST_TAX_CENTS * guests * nights;
  const totalCents = accommodationCents + touristTaxCents;

  const nightlyRateCents = highRateNights === nights
    ? HIGH_RATE_CENTS
    : lowRateNights === nights
      ? LOW_RATE_CENTS
      : null;

  return {
    readyForPayment: true,
    nights,
    nightlyRateCents,
    lowRateNights,
    highRateNights,
    accommodationBeforeDiscount,
    accommodationCents,
    touristTaxCents,
    discountCents,
    totalCents
  };
}

module.exports = {
  quote,
  differenceInNights,
  isSchoolHolidayNight,
  LOW_RATE_CENTS,
  HIGH_RATE_CENTS,
  TOURIST_TAX_CENTS,
  PRICING_START,
  PRICING_END
};
