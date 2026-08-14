/* Tester CSV-parsing og defensiv validering for telefondata.
   Kjøres med: node tests/telefoner-csv.test.js

   Merk: dette dupliserer (bevisst, i forenklet form) valideringsregelen
   fra byggVarianterFraCsv() i engine/telefon-konfigurator.js, siden den
   funksjonen ligger inne i en nettleser-IIFE og ikke er direkte
   eksportert for Node. Testen bekrefter regelen (rad med manglende
   påkrevd felt hoppes over, ugyldig Fargekode får fallback), ikke den
   eksakte kjørte koden i nettleseren.

   Testene mot den ekte telefoner.csv er bevisst IKKE hardkodet mot et
   fast antall rader - filen vokser etter hvert som dere legger til
   modeller, og testen skal fortsette å bestå da. Den sjekker i stedet
   at antall gyldige rader stemmer med antall rader som faktisk har
   alle påkrevde felt utfylt, uansett hvor mange det er. */
const assert = require('assert');
const fs = require('fs');
const Papa = require('papaparse');

global.window = global.window || {};
const Kontrast = require('../engine/kontrast.js');

const PAKREVDE_FELT = ['Merke', 'Modell', 'Kapasitet', 'Farge'];
const FALLBACK_FARGE = '#cccccc';

function byggVarianterFraCsv(rows) {
  const ut = [];
  rows.forEach((row) => {
    const manglerPakrevd = PAKREVDE_FELT.some((f) => !row[f] || !String(row[f]).trim());
    if (manglerPakrevd) return;
    let hex = (row.Fargekode || '').trim();
    if (!Kontrast.parseHex(hex)) hex = FALLBACK_FARGE;
    ut.push({
      merke: row.Merke.trim(), modell: row.Modell.trim(),
      kapasitet: row.Kapasitet.trim(), farge: row.Farge.trim(),
      hex, url: (row.Lenke || '').trim(), bilde: (row.Bilde || '').trim()
    });
  });
  return ut;
}

let bestatt = 0;
function test(navn, fn) {
  try { fn(); bestatt++; console.log('OK   -', navn); }
  catch (e) { console.log('FEIL -', navn, '\n      ', e.message); process.exitCode = 1; }
}

function lesEkteCsv() {
  const csvText = fs.readFileSync(__dirname + '/../data/telefoner.csv', 'utf8');
  return Papa.parse(csvText, { header: true, skipEmptyLines: true });
}

test('ekte telefoner.csv parses uten PapaParse-feil', () => {
  const parsed = lesEkteCsv();
  assert.strictEqual(parsed.errors.length, 0);
  assert.ok(parsed.data.length > 0, 'CSV-en er tom - forventet minst én rad');
});

test('ekte telefoner.csv har korrekte kolonneoverskrifter', () => {
  const parsed = lesEkteCsv();
  assert.deepStrictEqual(parsed.meta.fields, ['Merke', 'Modell', 'Kapasitet', 'Farge', 'Fargekode', 'Lenke', 'Bilde']);
});

test('alle rader med påkrevde felt kommer med i variant-listen (uansett antall rader)', () => {
  const parsed = lesEkteCsv();
  const forventetAntall = parsed.data.filter(row =>
    PAKREVDE_FELT.every(f => row[f] && String(row[f]).trim())
  ).length;
  const variantList = byggVarianterFraCsv(parsed.data);
  assert.strictEqual(variantList.length, forventetAntall,
    'Fant ' + variantList.length + ' gyldige varianter, forventet ' + forventetAntall +
    ' ut fra hvor mange rader som har Merke/Modell/Kapasitet/Farge utfylt. ' +
    'Sjekk om en rad mangler et påkrevd felt.');
  console.log('      (' + variantList.length + ' varianter i telefoner.csv akkurat nå)');
});

test('varsler (ikke feil) om rader med ugyldig/manglende Fargekode - typisk skrivefeil', () => {
  const parsed = lesEkteCsv();
  const variantList = byggVarianterFraCsv(parsed.data);
  const medFallback = variantList.filter(v => v.hex === FALLBACK_FARGE);
  if (medFallback.length) {
    console.log('      ADVARSEL: ' + medFallback.length + ' rad(er) har ugyldig/manglende Fargekode og bruker fallback-grå:');
    medFallback.forEach(v => console.log('        - ' + v.modell + ' ' + v.farge));
  }
  // Ingen assert her med vilje - dette er informativt, ikke en hard feil,
  // siden en tom Fargekode kan være en bevisst midlertidig placeholder.
});

test('rad med manglende påkrevd felt (Modell) hoppes over, resten beholdes', () => {
  const csv = 'Merke,Modell,Kapasitet,Farge,Fargekode,Lenke,Bilde\n' +
    'Samsung,,256GB,Black,#000000,https://x/p1,x.webp\n' +
    'Samsung,Galaxy S26,256GB,White,#ffffff,https://x/p2,x.webp\n';
  const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
  const variantList = byggVarianterFraCsv(parsed.data);
  assert.strictEqual(variantList.length, 1);
  assert.strictEqual(variantList[0].farge, 'White');
});

test('ugyldig Fargekode gir trygg fallback-farge, resten av raden beholdes', () => {
  const csv = 'Merke,Modell,Kapasitet,Farge,Fargekode,Lenke,Bilde\n' +
    'Samsung,Galaxy S26,256GB,Black,ikke-en-hex,https://x/p1,x.webp\n';
  const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
  const variantList = byggVarianterFraCsv(parsed.data);
  assert.strictEqual(variantList.length, 1);
  assert.strictEqual(variantList[0].hex, FALLBACK_FARGE);
  assert.strictEqual(variantList[0].modell, 'Galaxy S26'); // resten av raden urørt
});

test('manglende Fargekode (tom verdi) gir også trygg fallback', () => {
  const csv = 'Merke,Modell,Kapasitet,Farge,Fargekode,Lenke,Bilde\n' +
    'Samsung,Galaxy S26,256GB,Black,,https://x/p1,x.webp\n';
  const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
  const variantList = byggVarianterFraCsv(parsed.data);
  assert.strictEqual(variantList[0].hex, FALLBACK_FARGE);
});

test('CSV med anførselstegn/komma i felt parses korrekt (samme konvensjon som produkter.csv)', () => {
  const csv = 'Merke,Modell,Kapasitet,Farge,Fargekode,Lenke,Bilde\n' +
    'Samsung,"Galaxy S26, Special Edition",256GB,"Black, Matte",#000000,https://x/p1,x.webp\n';
  const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
  const variantList = byggVarianterFraCsv(parsed.data);
  assert.strictEqual(variantList[0].modell, 'Galaxy S26, Special Edition');
  assert.strictEqual(variantList[0].farge, 'Black, Matte');
});

console.log('\n' + bestatt + ' test(er) bestått.');
