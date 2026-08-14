/*
  PRODUKTBILDE.JS
  ---------------
  Henter selve produktbildet direkte fra produktsiden (samme bilde en
  anonym besøkende ser i bildekarusellen), i stedet for at det må
  lastes opp og vedlikeholdes manuelt som en egen fil i bilder/.

  Finner bildet via `data-src` på `.b-product-image-slide` (det
  faktiske markup-mønsteret på shop.vodacom.no sine produktsider -
  `data-src` gir en ren bilde-URL UTEN størrelse, f.eks.
  ".../DataImage.ashx/1001642804", som vi selv legger en ønsket
  størrelse bak).

  Krever samme-origin (siden må kjøre på shop.vodacom.no), akkurat
  som pricing.js. Ved CORS-feil (lokal testing, annet domene) kastes
  feilen videre slik at kalleren kan falle tilbake til et manuelt
  bilde eller skjule bildeområdet.

  Dette er motor-kode. Ikke rediger.
*/
window.PV = window.PV || {};

window.PV.Bilde = (function () {
  'use strict';

  const BILDE_SELECTOR = '.b-product-image-slide[data-src]';
  const CACHE_PREFIX = 'pv_bilde_';
  const STORRELSE = '700/700'; // matcher srcset sin 2x-variant på produktsiden

  function getCached(produktId) {
    return sessionStorage.getItem(CACHE_PREFIX + produktId) || null;
  }

  function setCached(produktId, url) {
    try {
      sessionStorage.setItem(CACHE_PREFIX + produktId, url);
    } catch (e) {
      // sessionStorage kan være utilgjengelig (privat modus) - ikke kritisk
    }
  }

  async function hentBilde(produkt) {
    var cached = getCached(produkt.ProduktID);
    if (cached) return cached;

    const res = await fetch(produkt.Lenke, { credentials: "same-origin" });
    if (!res.ok) throw new Error("HTTP " + res.status);

    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const node = doc.querySelector(BILDE_SELECTOR);
    const basisUrl = node ? node.getAttribute("data-src") : null;

    if (!basisUrl) throw new Error("Fant ikke produktbilde på produktsiden");

    const url = basisUrl.replace(/\/+$/, "") + "/" + STORRELSE;
    setCached(produkt.ProduktID, url);
    return url;
  }

  return { hentBilde: hentBilde };
})();
