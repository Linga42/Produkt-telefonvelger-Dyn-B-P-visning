/* Tester engine/produktbilde.js direkte - ikke en forenklet kopi -
   ved å kjøre den ekte koden i et jsdom-miljø med en mocket fetch()
   som returnerer faktisk markup fra en shop.vodacom.no-produktside.

   Kjøres med: node tests/produktbilde.test.js
   (krever midlertidig `npm install jsdom --no-save`) */
const assert = require('assert');
const { JSDOM } = require('jsdom');

const EKTE_PRODUKTSIDE_HTML = `<!DOCTYPE html><html><body>
  <img src="https://img1-327a.kxcdn.com/DataImage.ashx/1000018606/160/25" alt="SAMSUNG">
  <div class="b-product-image-with-slider swiper-container">
    <div id="productImageSlider" class="b-product-image swiper-container">
      <div class="b-product-image-wrapper swiper-wrapper">
        <div class="b-product-image-slide swiper-slide swiper-slide-active"
             data-src="https://img1-327a.kxcdn.com/DataImage.ashx/1001642804"
             data-thumb="https://img1-327a.kxcdn.com/DataImage.ashx/1001642804/100/100"
             data-width="1040" data-height="1040">
          <img src="https://img1-327a.kxcdn.com/DataImage.ashx/1001642804/350/350" class="swiper-lazy swiper-lazy-loaded">
        </div>
      </div>
    </div>
  </div>
</body></html>`;

function settOppMiljo(fetchImpl) {
  const dom = new JSDOM('<!DOCTYPE html><body></body>', { url: 'https://shop.vodacom.no/' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.DOMParser = dom.window.DOMParser;
  global.sessionStorage = dom.window.sessionStorage;
  global.fetch = fetchImpl;
  delete require.cache[require.resolve('../engine/produktbilde.js')];
  require('../engine/produktbilde.js');
  return dom.window.PV.Bilde;
}

let bestatt = 0;
async function test(navn, fn) {
  try { await fn(); bestatt++; console.log('OK   -', navn); }
  catch (e) { console.log('FEIL -', navn, '\n      ', e.message); process.exitCode = 1; }
}

async function run() {
  await test('henter og bygger riktig bilde-URL fra ekte produktside-markup', async () => {
    const Bilde = settOppMiljo(async () => ({
      ok: true,
      text: async () => EKTE_PRODUKTSIDE_HTML
    }));
    const url = await Bilde.hentBilde({ ProduktID: '1006442059', Lenke: 'https://shop.vodacom.no/samsung-galaxy-s26/cat-p/c/p1006442059' });
    assert.strictEqual(url, 'https://img1-327a.kxcdn.com/DataImage.ashx/1001642804/700/700');
  });

  await test('plukker IKKE merkevare-logoen, kun .b-product-image-slide', async () => {
    const Bilde = settOppMiljo(async () => ({ ok: true, text: async () => EKTE_PRODUKTSIDE_HTML }));
    const url = await Bilde.hentBilde({ ProduktID: 'x', Lenke: 'https://shop.vodacom.no/x/p1' });
    assert.ok(!url.includes('1000018606'), 'Plukket opp logo-bildet i stedet for produktbildet');
  });

  await test('cacher resultatet - andre kall gjør IKKE et nytt fetch-kall', async () => {
    let antallKall = 0;
    const Bilde = settOppMiljo(async () => {
      antallKall++;
      return { ok: true, text: async () => EKTE_PRODUKTSIDE_HTML };
    });
    const produkt = { ProduktID: '999', Lenke: 'https://shop.vodacom.no/x/p999' };
    await Bilde.hentBilde(produkt);
    await Bilde.hentBilde(produkt);
    assert.strictEqual(antallKall, 1);
  });

  await test('kaster feil (ikke krasj) når siden ikke har noe produktbilde', async () => {
    const Bilde = settOppMiljo(async () => ({ ok: true, text: async () => '<html><body>Ingen bilder her</body></html>' }));
    await assert.rejects(
      () => Bilde.hentBilde({ ProduktID: 'z', Lenke: 'https://shop.vodacom.no/x/pz' }),
      /Fant ikke produktbilde/
    );
  });

  await test('kaster feil ved HTTP-feilstatus (f.eks. 404)', async () => {
    const Bilde = settOppMiljo(async () => ({ ok: false, status: 404 }));
    await assert.rejects(
      () => Bilde.hentBilde({ ProduktID: 'w', Lenke: 'https://shop.vodacom.no/x/pw' }),
      /HTTP 404/
    );
  });

  console.log('\n' + bestatt + ' test(er) bestått.');
  console.log('\nMERK: dette tester den ekte koden i produktbilde.js mot ekte');
  console.log('markup, men med en mocket fetch() - selve same-origin-oppførselen');
  console.log('i en faktisk nettleser på shop.vodacom.no er ikke testet her.');
}

run();
