const LOW_RATE_CENTS = 14900;
const HIGH_RATE_CENTS = 16200;
const TOURIST_TAX_CENTS = 250;

function parseDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new Error('Ongeldige datum.');
  return date;
}

function differenceInNights(arrival, departure) {
  return Math.round((parseDate(departure) - parseDate(arrival)) / 86400000);
}

function getNightlyRateCents() {
  // Zolang hoogseizoendata nog niet zijn vastgelegd, rekenen we niet automatisch af.
  // Dit voorkomt dat een gast een verkeerde seizoensprijs betaalt.
  return null;
}

function quote({ arrival, departure, guests }) {
  const nights = differenceInNights(arrival, departure);
  if (!Number.isInteger(nights) || nights < 2) throw new Error('Het minimum verblijf is 2 nachten.');
  if (!Number.isInteger(guests) || guests < 1 || guests > 4) throw new Error('Aantal gasten moet tussen 1 en 4 liggen.');

  const nightlyRateCents = getNightlyRateCents(arrival, departure);
  if (nightlyRateCents == null) {
    return {
      readyForPayment: false,
      nights,
      lowRateCents: LOW_RATE_CENTS,
      highRateCents: HIGH_RATE_CENTS,
      message: 'De exacte seizoensprijs voor deze datums moet nog worden ingesteld.'
    };
  }

  const accommodationBeforeDiscount = nightlyRateCents * nights;
  const discountCents = nights >= 7 ? Math.round(accommodationBeforeDiscount * 0.10) : 0;
  const accommodationCents = accommodationBeforeDiscount - discountCents;
  const touristTaxCents = TOURIST_TAX_CENTS * guests * nights;
  const totalCents = accommodationCents + touristTaxCents;

  return {
    readyForPayment: true,
    nights,
    nightlyRateCents,
    accommodationCents,
    touristTaxCents,
    discountCents,
    totalCents
  };
}

module.exports = { quote, differenceInNights, LOW_RATE_CENTS, HIGH_RATE_CENTS, TOURIST_TAX_CENTS };
