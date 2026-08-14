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

form?.addEventListener('submit', (event) => {
  event.preventDefault();

  const data = new FormData(form);
  const name = String(data.get('name') || '').trim();
  const email = String(data.get('email') || '').trim();
  const arrival = String(data.get('arrival') || '');
  const departure = String(data.get('departure') || '');
  const guests = String(data.get('guests') || '');
  const message = String(data.get('message') || '').trim();

  if (!arrival || !departure) {
    status.textContent = 'Vul een aankomst- en vertrekdatum in.';
    return;
  }

  const arrivalDate = new Date(`${arrival}T00:00:00`);
  const departureDate = new Date(`${departure}T00:00:00`);
  const nights = Math.round((departureDate - arrivalDate) / 86400000);

  if (!Number.isFinite(nights) || nights < 2) {
    status.textContent = 'Het minimum verblijf is 2 nachten.';
    return;
  }

  const subject = `Boeking Boshuisje Veluwezoom - ${arrival} t/m ${departure}`;
  const body = [
    'Hallo,',
    '',
    'Ik wil graag Boshuisje Veluwezoom boeken.',
    '',
    `Naam: ${name}`,
    `E-mail: ${email}`,
    `Aankomst: ${arrival}`,
    `Vertrek: ${departure}`,
    `Aantal nachten: ${nights}`,
    `Aantal gasten: ${guests}`,
    message ? `Bericht: ${message}` : '',
    '',
    'Ik ontvang graag een bevestiging van de beschikbaarheid en boeking.'
  ].filter(Boolean).join('\n');

  status.textContent = 'Je e-mailprogramma wordt geopend. Verstuur de e-mail om je boeking aan te vragen.';
  window.location.href = `mailto:aafkedehoek92@hotmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
});
