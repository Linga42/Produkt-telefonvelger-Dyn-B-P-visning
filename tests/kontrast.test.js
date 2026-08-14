/* Enkle Node-baserte enhetstester for engine/kontrast.js.
   Kjøres med: node tests/kontrast.test.js
   Ingen testrammeverk (jest/mocha) er del av dette build-frie
   prosjektet, så testene bruker enkle assert-kall. */
const assert = require('assert');

// kontrast.js setter window.PV.Kontrast - lag en minimal 'window' for Node.
global.window = global.window || {};
const Kontrast = require('../engine/kontrast.js');

let bestatt = 0;

function test(navn, fn) {
  try {
    fn();
    bestatt++;
    console.log('OK   -', navn);
  } catch (e) {
    console.log('FEIL -', navn, '\n      ', e.message);
    process.exitCode = 1;
  }
}

test('svart bakgrunn -> hvit tekst', () => {
  const r = Kontrast.velgTekstfarge('#000000');
  assert.strictEqual(r.tekstfarge, '#ffffff');
  assert.ok(r.kontrast >= 4.5);
  assert.strictEqual(r.gyldigFarge, true);
});

test('hvit bakgrunn -> sort tekst', () => {
  const r = Kontrast.velgTekstfarge('#FFFFFF');
  assert.strictEqual(r.tekstfarge, '#000000');
  assert.ok(r.kontrast >= 4.5);
});

test('3-sifret hex (#fff) tolkes som gyldig', () => {
  const r = Kontrast.velgTekstfarge('#fff');
  assert.strictEqual(r.gyldigFarge, true);
  assert.strictEqual(r.tekstfarge, '#000000');
});

test('midtgrå bakgrunn oppnår fortsatt >=4.5:1 (matematisk alltid mulig)', () => {
  // Grenseluminans der sort/hvit kontrast er tilnærmet lik
  const r = Kontrast.velgTekstfarge('#767676');
  assert.ok(r.kontrast >= 4.5, 'kontrast var ' + r.kontrast);
});

test('ugyldig hex -> trygg standardtekst, gyldigFarge=false', () => {
  const r = Kontrast.velgTekstfarge('ikke-en-farge');
  assert.strictEqual(r.gyldigFarge, false);
  assert.strictEqual(r.kontrast, null);
  assert.strictEqual(r.tekstfarge, Kontrast.TRYGG_STANDARD_TEKST);
});

test('tom/manglende hex -> trygg standardtekst', () => {
  const r = Kontrast.velgTekstfarge('');
  assert.strictEqual(r.gyldigFarge, false);
  const r2 = Kontrast.velgTekstfarge(undefined);
  assert.strictEqual(r2.gyldigFarge, false);
});

test('faktiske fargekoder fra telefoner.csv (stikkprøve)', () => {
  // Cosmic Orange (#E8762A) - lys-middels farge, sjekk faktisk beregning
  const orange = Kontrast.velgTekstfarge('#E8762A');
  assert.ok(orange.kontrast >= 4.5);
  // Sky Blue (#C9E4F2) - veldig lys -> forvent sort tekst
  const skyBlue = Kontrast.velgTekstfarge('#C9E4F2');
  assert.strictEqual(skyBlue.tekstfarge, '#000000');
  // Deep Blue (#2E3A52) - mørk -> forvent hvit tekst
  const deepBlue = Kontrast.velgTekstfarge('#2E3A52');
  assert.strictEqual(deepBlue.tekstfarge, '#ffffff');
});

console.log('\n' + bestatt + ' test(er) bestått.');
