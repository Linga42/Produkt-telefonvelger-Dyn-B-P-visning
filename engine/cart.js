/*
  CART.JS
  -------
  Legger produkt rett i Webmercs sin handlekurv via BuyProductEx.

  Krever samme-origin (siden må kjøre på shop.vodacom.no, limt inn i
  Webmercs-CMS - samme prinsipp som telefonkonfiguratoren). Ved CORS-feil
  (lokal testing) kastes feilen videre slik at kalleren kan falle
  tilbake til å åpne produktsiden.

  Dette er motor-kode. Ikke rediger.
*/
window.PV = window.PV || {};

window.PV.Cart = (function () {
  const BUY_ENDPOINT = "/_common/services/commonproxywebservice.asmx/BuyProductEx";

  // Ber Webmercs sende tilbake HTML-fragmentet for handlekurv-telleren i
  // toppmenyen (samme mal/container-IDer bekreftet fra to uavhengige
  // HAR-opptak på shop.vodacom.no, så disse ser ut til å være stabile
  // sidedekkende ID-er fra master-siden, ikke sidespesifikke).
  const CONTROLS_INFO = [
    {
      TemplatePath: "~/Skins/Default/Templates/ShoppingCartBlock-Light.ascx",
      DataManagerClientId: "ShoppingCartDM_dmShoppingCart",
      ContainerId: "ctl36_ctl00_ctl05_ctl00_ctl00_container"
    },
    {
      TemplatePath: "~/Skins/Default/Templates/ShoppingCart/AjaxExtendedQuickCart.ascx",
      DataManagerClientId: "ShoppingCartDM_dmShoppingCart",
      ContainerId: "ctl36_ctl00_ctl06_ctl00_ctl00_container"
    }
  ];

  async function leggIKurv(produkt, antall) {
    const res = await fetch(BUY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      credentials: "same-origin",
      body: JSON.stringify({
        controlsInfo: CONTROLS_INFO,
        productId: Number(produkt.ProduktID),
        quantity: String(antall),
        additionalOptionsInfo: [],
        priceCode: "",
        bidTimeId: 0,
        currentCategoryId: Number(produkt.KategoriID) || 0
      })
    });

    if (!res.ok) throw new Error("Uventet svar fra handlekurv: " + res.status);

    const data = await res.json();
    if (!data.d || data.d.IsValid === false) {
      throw new Error("Webmercs avviste tillegg i handlekurv");
    }

    oppdaterKurvTeller(data.d);
    return data.d;
  }

  // Webmercs sin egen teller i toppmenyen oppdateres normalt av deres eget
  // script, som ikke fanger opp kjøp gjort via dette API-kallet. Bruk det
  // EKTE tallet serveren nettopp bekreftet (ikke gjett/tell opp selv, det
  // kan komme ut av synk med den faktiske kurven).
  function oppdaterKurvTeller(responseData) {
    try {
      if (!responseData.HtmlCode || !responseData.HtmlCode.length) return;
      const doc = new DOMParser().parseFromString(responseData.HtmlCode[0], "text/html");
      const nyTeller = doc.querySelector(".b-shopping-cart-top__counter");
      if (!nyTeller) return;

      const liveTeller = document.querySelector(".b-shopping-cart-top__counter");
      if (liveTeller) liveTeller.innerHTML = nyTeller.innerHTML;
    } catch (err) {
      console.warn("Kunne ikke oppdatere handlekurv-telleren i toppmenyen:", err);
    }
  }

  return { leggIKurv };
})();
