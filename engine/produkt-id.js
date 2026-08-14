/*
  PRODUKT-ID.JS
  -------------
  Utleder Webmercs sine interne numeriske ID-er (produkt-ID og
  kategori-ID) direkte fra en produkt-URL, i stedet for at de må
  skrives inn manuelt som egne CSV-kolonner.

  Bekreftet mønster fra faktiske shop.vodacom.no-URL-er:
    .../cat-p/c36159/p1006571262   -> produktId=1006571262, kategoriId=36159
    .../cat-p/c/p1003783171        -> produktId=1003783171, kategoriId=0 (ingen tall = generisk kategori)

  Brukes av engine/render.js (produkter.csv) og
  engine/telefon-konfigurator.js (telefoner.csv/telefon-tilbehor.csv) -
  én kilde til sannhet for regelen, i stedet for at hver fil har sin
  egen kopi av regex-en.

  Dette er motor-kode. Ikke rediger.
*/
window.PV = window.PV || {};

window.PV.ProduktId = (function () {
  'use strict';

  function fraUrl(url) {
    if (!url) return null;
    var m = String(url).match(/\/p(\d+)(?:[/?#]|$)/);
    return m ? parseInt(m[1], 10) : null;
  }

  function kategoriFraUrl(url) {
    if (!url) return 0;
    var m = String(url).match(/\/cat-p\/c(\d+)\//);
    return m ? parseInt(m[1], 10) : 0;
  }

  return { fraUrl: fraUrl, kategoriFraUrl: kategoriFraUrl };
})();
