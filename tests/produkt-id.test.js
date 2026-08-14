/* Tester utledning av produkt-ID og kategori-ID fra Webmercs-URL-er
   (engine/produkt-id.js). Kjøres med: node tests/produkt-id.test.js */
const assert = require('assert');
const fs = require('fs');

global.window = global.window || {};
require('../engine/produkt-id.js');
const ProduktId = window.PV.ProduktId;

let bestatt = 0;
function test(navn, fn) {
  try { fn(); bestatt++; console.log('OK   -', navn); }
  catch (e) { console.log('FEIL -', navn, '\n      ', e.message); process.exitCode = 1; }
}

test('produkt-ID med kategori-tall i URL', () => {
  const url = 'https://shop.vodacom.no/lenovo-ts-tp-t16-g5-u5-325/cat-p/c36159/p1006571262';
  assert.strictEqual(ProduktId.fraUrl(url), 1006571262);
  assert.strictEqual(ProduktId.kategoriFraUrl(url), 36159);
});

test('produkt-ID uten kategori-tall i URL (generisk "c/") -> kategoriId 0', () => {
  const url = 'https://shop.vodacom.no/epos-impact-1061t-ancs/cat-p/c/p1003783171';
  assert.strictEqual(ProduktId.fraUrl(url), 1003783171);
  assert.strictEqual(ProduktId.kategoriFraUrl(url), 0);
});

test('manglende/ugyldig URL gir null/0, ikke krasj', () => {
  assert.strictEqual(ProduktId.fraUrl(''), null);
  assert.strictEqual(ProduktId.fraUrl(undefined), null);
  assert.strictEqual(ProduktId.kategoriFraUrl(''), 0);
  assert.strictEqual(ProduktId.kategoriFraUrl(undefined), 0);
});

test('URL med trailing slash/spørretegn etter produkt-ID matches fortsatt', () => {
  assert.strictEqual(ProduktId.fraUrl('https://x/p123456/'), 123456);
  assert.strictEqual(ProduktId.fraUrl('https://x/p123456?ref=abc'), 123456);
});

test('alle 19 rader i den ekte produkter.csv stemmer med URL-utledet ID/kategori', () => {
  const Papa = require('papaparse');
  const csvText = fs.readFileSync(__dirname + '/../data/produkter.csv', 'utf8');
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  assert.strictEqual(parsed.errors.length, 0);
  assert.ok(parsed.data.length > 0);
  parsed.data.forEach(row => {
    const pid = ProduktId.fraUrl(row.Lenke);
    assert.ok(pid, 'Fant ingen produkt-ID i URL for ' + row.Tittel + ' / ' + row.Modell);
  });
  console.log('      (' + parsed.data.length + ' rader i produkter.csv, alle ga gyldig produkt-ID)');
});

console.log('\n' + bestatt + ' test(er) bestått.');
