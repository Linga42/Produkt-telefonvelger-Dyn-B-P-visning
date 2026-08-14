/*
  KONTRAST.JS
  -----------
  Liten, gjenbrukbar hjelper for tilgjengelig tekstfarge oppå en
  vilkårlig bakgrunnsfarge, etter WCAG 2.x sin metode for relativ
  luminans og kontrastforhold.

  Brukes av telefon-konfigurator.js til å velge sort/hvit tekst på
  fargeknappene, men er bevisst holdt fri for DOM-avhengigheter slik
  at den kan testes isolert (se tests/kontrast.test.js).

  Dette er motor-kode. Ikke rediger uten grunn - se ARCHITECTURE.md.
*/
window.PV = window.PV || {};

window.PV.Kontrast = (function () {
  "use strict";

  var TRYGG_STANDARD_TEKST = "#14181C"; // matcher --color-ink i theme.css
  var MIN_KONTRAST_NORMAL_TEKST = 4.5;

  // Godtar '#RGB' eller '#RRGGBB' (med eller uten #). Returnerer
  // null for alt som ikke er en gyldig HEX-fargekode.
  function parseHex(hex) {
    if (typeof hex !== "string") return null;
    var s = hex.trim().replace(/^#/, "");
    if (/^[0-9a-fA-F]{3}$/.test(s)) {
      s = s.split("").map(function (c) { return c + c; }).join("");
    }
    if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;
    return {
      r: parseInt(s.substr(0, 2), 16),
      g: parseInt(s.substr(2, 2), 16),
      b: parseInt(s.substr(4, 2), 16)
    };
  }

  // WCAG-kanal: sRGB 0-255 -> lineær 0-1
  function linearKanal(kanal8bit) {
    var c = kanal8bit / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  // Relativ luminans (WCAG 2.x), 0 (svart) - 1 (hvit)
  function relativLuminans(rgb) {
    return 0.2126 * linearKanal(rgb.r) +
           0.7152 * linearKanal(rgb.g) +
           0.0722 * linearKanal(rgb.b);
  }

  // Kontrastforhold mellom to relative luminanser, alltid >= 1
  function kontrastforhold(lysestLuminans, morkestLuminans) {
    return (lysestLuminans + 0.05) / (morkestLuminans + 0.05);
  }

  /*
    Hovedfunksjon: gitt en HEX-bakgrunnsfarge, returner et objekt
    { tekstfarge, kontrast, oppnarMinimum, gyldigFarge }.

    - tekstfarge: '#000000' eller '#ffffff', ev. TRYGG_STANDARD_TEKST
      hvis fargen er ugyldig.
    - kontrast: det faktiske kontrastforholdet for valgt tekstfarge
      (null hvis fargen var ugyldig).
    - oppnarMinimum: true hvis kontrast >= 4.5:1.
    - gyldigFarge: false hvis inputen ikke kunne tolkes som en
      HEX-farge (kaller bør da falle tilbake til prosjektets vanlige
      visning i stedet for å stole på tekstfarge/kontrast).

    Merk: for ETHVERT bakgrunnsfarge vil enten sort eller hvit tekst
    oppnå minst ~4.58:1 (produktet av kontrasten mot sort og mot hvit
    er konstant = 21, så det høyeste av de to er alltid >= sqrt(21)).
    Terskelen på 4.5:1 er derfor i praksis alltid oppnåelig - unntaket
    er kun når inputfargen ikke er gyldig i utgangspunktet.
  */
  function velgTekstfarge(bakgrunnHex) {
    var rgb = parseHex(bakgrunnHex);
    if (!rgb) {
      return {
        tekstfarge: TRYGG_STANDARD_TEKST,
        kontrast: null,
        oppnarMinimum: false,
        gyldigFarge: false
      };
    }

    var bakgrunnLuminans = relativLuminans(rgb);
    var kontrastMotSort = kontrastforhold(bakgrunnLuminans, 0);
    var kontrastMotHvit = kontrastforhold(1, bakgrunnLuminans);

    var brukHvit = kontrastMotHvit >= kontrastMotSort;
    var valgtKontrast = brukHvit ? kontrastMotHvit : kontrastMotSort;

    return {
      tekstfarge: brukHvit ? "#ffffff" : "#000000",
      kontrast: valgtKontrast,
      oppnarMinimum: valgtKontrast >= MIN_KONTRAST_NORMAL_TEKST,
      gyldigFarge: true
    };
  }

  return {
    parseHex: parseHex,
    relativLuminans: relativLuminans,
    kontrastforhold: kontrastforhold,
    velgTekstfarge: velgTekstfarge,
    TRYGG_STANDARD_TEKST: TRYGG_STANDARD_TEKST,
    MIN_KONTRAST_NORMAL_TEKST: MIN_KONTRAST_NORMAL_TEKST
  };
})();

// Node/CommonJS-eksport for testing (se tests/kontrast.test.js) - påvirker
// ikke nettleserbruk siden module ikke finnes der.
if (typeof module !== "undefined" && module.exports) {
  module.exports = window.PV.Kontrast;
}
