const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('.main-nav');
menuButton?.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(open));
});
nav?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  nav.classList.remove('open');
  menuButton?.setAttribute('aria-expanded', 'false');
}));

document.getElementById('year').textContent = new Date().getFullYear();

const form = document.getElementById('booking-form');
const status = document.getElementById('form-status');
const submitButton = form?.querySelector('button[type="submit"]');
const formNote = form?.querySelector('.form-note');
const arrivalInput = form?.querySelector('input[name="arrival"]');
const departureInput = form?.querySelector('input[name="departure"]');
const guestsInput = form?.querySelector('select[name="guests"]');

if (submitButton) submitButton.textContent = 'Controleer prijs & betaal';
if (formNote) formNote.textContent = 'Je ziet eerst de actuele totaalprijs. Daarna ga je veilig door naar Stripe om de boeking te betalen.';

const euro = cents => new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR'
}).format(cents / 100);

function todayKey() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

if (arrivalInput) arrivalInput.min = todayKey();
if (departureInput) departureInput.min = todayKey();

function selectedValues() {
  const data = new FormData(form);
  return {
    name: String(data.get('name') || '').trim(),
    email: String(data.get('email') || '').trim(),
    arrival: String(data.get('arrival') || ''),
    departure: String(data.get('departure') || ''),
    guests: Number(data.get('guests') || 1),
    message: String(data.get('message') || '').trim()
  };
}

async function checkAvailability(showPrompt = true) {
  const { arrival, departure, guests } = selectedValues();
  if (!arrival || !departure) {
    if (showPrompt) status.textContent = 'Kies eerst een aankomst- en vertrekdatum.';
    return null;
  }

  const arrivalDate = new Date(`${arrival}T00:00:00`);
  const departureDate = new Date(`${departure}T00:00:00`);
  const nights = Math.round((departureDate - arrivalDate) / 86400000);
  if (!Number.isFinite(nights) || nights < 2) {
    status.textContent = 'Het minimum verblijf is 2 nachten.';
    return null;
  }

  status.textContent = 'Beschikbaarheid en prijs worden gecontroleerd…';
  const response = await fetch(`/api/availability?arrival=${encodeURIComponent(arrival)}&departure=${encodeURIComponent(departure)}&guests=${encodeURIComponent(guests)}`);
  const result = await response.json();

  if (!response.ok) {
    status.textContent = result.error || 'Controleer de gekozen datums.';
    return null;
  }

  if (!result.available) {
    status.textContent = 'Deze periode is helaas niet beschikbaar.';
    return null;
  }

  if (!result.readyForPayment) {
    status.textContent = result.error || 'Voor deze periode kan nog niet automatisch worden afgerekend.';
    return null;
  }

  const parts = [
    `${result.nights} nachten`,
    `verblijf ${euro(result.accommodationCents)}`,
    `toeristenbelasting ${euro(result.touristTaxCents)}`
  ];
  if (result.discountCents > 0) parts.push(`weekkorting ${euro(result.discountCents)}`);
  parts.push(`totaal ${euro(result.totalCents)}`);

  status.textContent = `Beschikbaar · ${parts.join(' · ')}`;
  return result;
}

[arrivalInput, departureInput, guestsInput].forEach(input => {
  input?.addEventListener('change', () => {
    if (arrivalInput?.value && departureInput?.value) checkAvailability(false).catch(() => {
      status.textContent = 'De prijscontrole is tijdelijk niet beschikbaar.';
    });
  });
});

form?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const values = selectedValues();
  if (!values.name || !values.email) {
    status.textContent = 'Vul je naam en e-mailadres in.';
    return;
  }

  submitButton.disabled = true;
  try {
    const quote = await checkAvailability(true);
    if (!quote) return;

    status.textContent = `Totaal ${euro(quote.totalCents)}. Stripe Checkout wordt geopend…`;

    const response = await fetch('/api/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values)
    });
    const result = await response.json();

    if (!response.ok || !result.url) {
      status.textContent = result.error || 'De betaling kon niet worden gestart.';
      return;
    }

    window.location.href = result.url;
  } catch (error) {
    console.error(error);
    status.textContent = 'Er ging iets mis. Probeer het opnieuw.';
  } finally {
    submitButton.disabled = false;
  }
});
