/*
  PRICING.JS
  ----------
  Henter uinnlogget listepris direkte fra produktsiden (samme pris en
  anonym besøkende ser), og cacher resultatet i sessionStorage.

  Krever samme-origin (siden må kjøre på shop.vodacom.no). Ved CORS-feil
  (lokal testing, annet domene) faller kallet tilbake via onError.

  Dette er motor-kode. Ikke rediger.
*/
window.PV = window.PV || {};

window.PV.Pricing = (function () {
  const PRICE_SELECTOR = ".b-prod-price .pricedetails";
  const CACHE_PREFIX = "pv_price_";

  function getCached(produktId) {
    const raw = sessionStorage.getItem(CACHE_PREFIX + produktId);
    return raw ? JSON.parse(raw) : null;
  }

  function setCached(produktId, price) {
    try {
      sessionStorage.setItem(CACHE_PREFIX + produktId, JSON.stringify(price));
    } catch (e) {
      // sessionStorage kan være utilgjengelig (privat modus) - ikke kritisk
    }
  }

  async function hentPris(produkt) {
    const cached = getCached(produkt.ProduktID);
    if (cached) return cached;

    const res = await fetch(produkt.Lenke, { credentials: "same-origin" });
    if (!res.ok) throw new Error("HTTP " + res.status);

    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const node = doc.querySelector(PRICE_SELECTOR);
    const price = node ? node.textContent.replace(/\s+/g, " ").trim() : null;

    if (!price) throw new Error("Fant ikke prisfelt i produktsiden");

    setCached(produkt.ProduktID, price);
    return price;
  }

  return { hentPris };
})();
