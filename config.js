/*
  CONFIG.JS
  ---------
  Det ENESTE du trenger å endre når du går fra lokal testing til å
  publisere widgeten på shop.vodacom.no.

  - Lokal testing (localhost): la stå som "./data/" og "./bilder/"
  - Live på Webmercs: MÅ være full GitHub Pages-URL til data-/bilde-
    mappen, siden HTML-en limes rett inn i en side på shop.vodacom.no
    sitt eget domene (ikke en iframe), og da må dataene/bildene
    hentes fra en full adresse i stedet for en relativ sti.

  Eksempel når repoet er publisert:
  dataBaseUrl: "https://dittbrukernavn.github.io/Produkt-telefonvelger/data/"
  imgBaseUrl:  "https://dittbrukernavn.github.io/Produkt-telefonvelger/bilder/"
*/
window.PV_CONFIG = {
  dataBaseUrl: "https://linga42.github.io/Produkt-telefonvelger/data/",
  imgBaseUrl: "https://linga42.github.io/Produkt-telefonvelger/bilder/"
};
