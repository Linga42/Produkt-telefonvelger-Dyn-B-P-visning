/* Tester CSV-parsing, defensiv validering og merke/modell-matching
   for telefon-tilbehør (data/telefon-tilbehor.csv).
   Kjøres med: node tests/telefon-tilbehor-csv.test.js

   Se merknaden i telefoner-csv.test.js om hvorfor logikken er
   duplisert i forenklet form her, i stedet for importert direkte fra
   telefon-konfigurator.js sin nettleser-IIFE. */
const assert = require('assert');
const fs = require('fs');
const Papa = require('papaparse');

const UNIVERSAL_MERKE = 'universal';

function byggTilbehorFraCsv(rows) {
  const ut = [];
  rows.forEach((row) => {
    const erUniversal = (row.Merke || '').trim().toLowerCase() === UNIVERSAL_MERKE;
    const manglerPakrevd = !row.Merke || !String(row.Merke).trim() ||
      !row.Navn || !String(row.Navn).trim() ||
      !row.Lenke || !String(row.Lenke).trim() ||
      (!erUniversal && (!row.Modell || !String(row.Modell).trim()));
    if (manglerPakrevd) return;
    ut.push({
      merke: row.Merke.trim(),
      modell: erUniversal ? '' : row.Modell.trim(),
      universal: erUniversal,
      navn: row.Navn.trim(),
      url: row.Lenke.trim()
    });
  });
  return ut;
}

function hentTilbehor(TILBEHOR, merke, modell) {
  return TILBEHOR.filter(v => v.universal || (v.merke === merke && v.modell === modell));
}

let bestatt = 0;
function test(navn, fn) {
  try { fn(); bestatt++; console.log('OK   -', navn); }
  catch (e) { console.log('FEIL -', navn, '\n      ', e.message); process.exitCode = 1; }
}

function lesEkteCsv() {
  const csvText = fs.readFileSync(__dirname + '/../data/telefon-tilbehor.csv', 'utf8');
  return Papa.parse(csvText, { header: true, skipEmptyLines: true });
}

test('ekte telefon-tilbehor.csv parses uten feil', () => {
  const parsed = lesEkteCsv();
  assert.strictEqual(parsed.errors.length, 0);
  assert.ok(parsed.data.length > 0);
});

test('ekte telefon-tilbehor.csv har korrekte kolonneoverskrifter', () => {
  const parsed = lesEkteCsv();
  assert.deepStrictEqual(parsed.meta.fields, ['Merke', 'Modell', 'Navn', 'Lenke']);
});

test('alle rader med påkrevde felt kommer med (uansett antall rader)', () => {
  const parsed = lesEkteCsv();
  const TILBEHOR = byggTilbehorFraCsv(parsed.data);
  const forventet = parsed.data.filter(row => {
    const erUniversal = (row.Merke || '').trim().toLowerCase() === UNIVERSAL_MERKE;
    return row.Merke && String(row.Merke).trim() &&
      row.Navn && String(row.Navn).trim() &&
      row.Lenke && String(row.Lenke).trim() &&
      (erUniversal || (row.Modell && String(row.Modell).trim()));
  }).length;
  assert.strictEqual(TILBEHOR.length, forventet);
  console.log('      (' + TILBEHOR.length + ' tilbehørsrader akkurat nå)');
});

test('"universal" i Merke gjør tilbehøret tilgjengelig for alle merker/modeller', () => {
  const csv = 'Merke,Modell,Navn,Lenke\n' +
    'universal,,Lader,https://x/p1\n' +
    'Samsung,Galaxy S26,Deksel,https://x/p2\n';
  const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
  const TILBEHOR = byggTilbehorFraCsv(parsed.data);

  const forSamsung = hentTilbehor(TILBEHOR, 'Samsung', 'Galaxy S26');
  assert.strictEqual(forSamsung.length, 2); // Deksel + universal Lader
  assert.ok(forSamsung.some(v => v.navn === 'Lader'));
  assert.ok(forSamsung.some(v => v.navn === 'Deksel'));

  const forIphone = hentTilbehor(TILBEHOR, 'iPhone', 'iPhone 17');
  assert.strictEqual(forIphone.length, 1); // kun universal Lader, ikke Samsung-dekselet
  assert.strictEqual(forIphone[0].navn, 'Lader');
});

test('"universal" er ikke versalfølsomt (Universal/UNIVERSAL godtas også)', () => {
  const csv = 'Merke,Modell,Navn,Lenke\n' +
    'Universal,,Lader,https://x/p1\n';
  const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
  const TILBEHOR = byggTilbehorFraCsv(parsed.data);
  assert.strictEqual(TILBEHOR.length, 1);
  assert.strictEqual(TILBEHOR[0].universal, true);
});

test('rad uten Modell og uten "universal" i Merke hoppes over', () => {
  const csv = 'Merke,Modell,Navn,Lenke\n' +
    'Samsung,,Deksel,https://x/p1\n';
  const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
  const TILBEHOR = byggTilbehorFraCsv(parsed.data);
  assert.strictEqual(TILBEHOR.length, 0);
});

test('rad uten Navn eller Lenke hoppes over, resten beholdes', () => {
  const csv = 'Merke,Modell,Navn,Lenke\n' +
    'Samsung,Galaxy S26,,https://x/p1\n' +
    'Samsung,Galaxy S26,Deksel,\n' +
    'Samsung,Galaxy S26,Lommebok,https://x/p2\n';
  const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
  const TILBEHOR = byggTilbehorFraCsv(parsed.data);
  assert.strictEqual(TILBEHOR.length, 1);
  assert.strictEqual(TILBEHOR[0].navn, 'Lommebok');
});

test('tilbehør for én modell vises ikke for en annen modell av samme merke', () => {
  const csv = 'Merke,Modell,Navn,Lenke\n' +
    'Samsung,Galaxy S26,Deksel,https://x/p1\n';
  const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
  const TILBEHOR = byggTilbehorFraCsv(parsed.data);
  const forUltra = hentTilbehor(TILBEHOR, 'Samsung', 'Galaxy S26 Ultra');
  assert.strictEqual(forUltra.length, 0);
});

console.log('\n' + bestatt + ' test(er) bestått.');
