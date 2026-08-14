/* ==========================================================
   Telefon-konfigurator – logikk. Endres normalt IKKE utenfor
   det som trengs for CSV-lasting, kontrastberegning og prisvisning
   (se ARCHITECTURE.md og PROSJEKT-README for hvorfor).

   Produktdata (merke/modell/kapasitet/farge/fargekode/lenke/bilde)
   leses fra data/telefoner.csv, og ekstrautstyr (merke/modell/navn/
   lenke) fra data/telefon-tilbehor.csv - se README for CSV-format.

   Integrert i produktvelgeren som egen kategori/fane ("Telefon").
   render.js kaller window.PV.Telefon.init() når fanens seksjon og
   <div id="tk-konfigurator"> er satt inn i DOM-en - widgeten
   selv-initialiserer IKKE lenger på DOMContentLoaded, siden
   containeren ikke finnes før produktvelgeren har rendret ferdig.

   CSS (styles/telefon-konfigurator.css) lenkes som vanlig
   <link>-tag i index.html, på samme måte som theme.css/engine.css -
   ingen automatisk JS-injeksjon lenger.
   ========================================================== */
window.PV = window.PV || {};

window.PV.Telefon = (function () {
  'use strict';

  var DATA_DIR = (window.PV_CONFIG && window.PV_CONFIG.dataBaseUrl) || './data/';
  var TELEFON_CSV_FIL = DATA_DIR + 'telefoner.csv';
  var TILBEHOR_CSV_FIL = DATA_DIR + 'telefon-tilbehor.csv';
  var IMG_BASE = (window.PV_CONFIG && window.PV_CONFIG.imgBaseUrl) || './bilder/';

  var PAKREVDE_CSV_FELT = ['Merke', 'Modell', 'Kapasitet', 'Farge'];
  var TRYGG_FALLBACK_FARGE = '#cccccc';

  var harInitialisert = false;

  /* Bygger VARIANTER (samme form som foer, da de kom fra varianter.js)
     fra CSV-radene. Validerer defensivt: en rad som mangler et
     paakrevd tekstfelt hoppes helt over (varslet i konsollen), mens en
     ugyldig/manglende Fargekode kun gir en trygg fallback-farge for
     akkurat den raden - resten av telefonvelgeren paavirkes ikke. */
  function byggVarianterFraCsv(rows) {
    var variantList = [];
    rows.forEach(function (row, i) {
      var manglerPakrevd = PAKREVDE_CSV_FELT.some(function (felt) {
        return !row[felt] || !String(row[felt]).trim();
      });
      if (manglerPakrevd) {
        console.error('Telefon-konfigurator: telefoner.csv rad ' + (i + 2) +
          ' mangler et paakrevd felt (Merke/Modell/Kapasitet/Farge) og hoppes over.');
        return;
      }

      var hex = (row.Fargekode || '').trim();
      if (!window.PV.Kontrast.parseHex(hex)) {
        if (hex) {
          console.warn('Telefon-konfigurator: ugyldig Fargekode "' + hex + '" for ' +
            row.Modell + ' ' + row.Farge + ' (telefoner.csv rad ' + (i + 2) +
            ') - bruker fallback-farge.');
        }
        hex = TRYGG_FALLBACK_FARGE;
      }

      variantList.push({
        merke: row.Merke.trim(),
        modell: row.Modell.trim(),
        kapasitet: row.Kapasitet.trim(),
        farge: row.Farge.trim(),
        hex: hex,
        url: (row.Lenke || '').trim(),
        bilde: (row.Bilde || '').trim()
      });
    });
    return variantList;
  }

  /* Ett bilde per modell, avledet fra foerste rad i CSV-en som har et
     Bilde-felt for den modellen (tilsvarer MODELLBILDER fra foer). */
  function byggModellbilderFraVarianter(variantList) {
    var bilder = {};
    variantList.forEach(function (v) {
      if (v.bilde && !bilder[v.modell]) bilder[v.modell] = v.bilde;
    });
    return bilder;
  }

  function lastCsv(fil) {
    return fetch(fil)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status + ' ved lasting av ' + fil);
        return res.text();
      })
      .then(function (csvText) {
        var parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
        return parsed.data;
      });
  }

  /* Bygger tilbehørslisten fra data/telefon-tilbehor.csv. Kolonner:
     Merke, Modell, Navn, Lenke. Skriv "universal" i Merke-feltet for
     et tilbehør som skal være tilgjengelig for alle merker/modeller
     (Modell-feltet ignoreres da og kan stå tomt). Validerer
     defensivt - en rad som mangler Navn eller Lenke hoppes over med
     en varsel i konsollen, resten av widgeten påvirkes ikke. */
  var UNIVERSAL_MERKE = 'universal';

  function byggTilbehorFraCsv(rows) {
    var ut = [];
    rows.forEach(function (row, i) {
      var erUniversal = (row.Merke || '').trim().toLowerCase() === UNIVERSAL_MERKE;
      var manglerPakrevd = !row.Merke || !String(row.Merke).trim() ||
        !row.Navn || !String(row.Navn).trim() ||
        !row.Lenke || !String(row.Lenke).trim() ||
        (!erUniversal && (!row.Modell || !String(row.Modell).trim()));
      if (manglerPakrevd) {
        console.error('Telefon-konfigurator: telefon-tilbehor.csv rad ' + (i + 2) +
          ' mangler et påkrevd felt (Merke/Navn/Lenke, og Modell med mindre Merke="universal") og hoppes over.');
        return;
      }
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

  function init() {
    if (harInitialisert) return; // hindrer to synlige telefonvelgere ved ev. dobbeltkall
    var rot = document.getElementById('tk-konfigurator');
    if (!rot) {
      console.error('Telefon-konfigurator: fant ikke <div id="tk-konfigurator">.');
      return;
    }

    Promise.all([
      lastCsv(TELEFON_CSV_FIL),
      lastCsv(TILBEHOR_CSV_FIL)
    ]).then(function (resultater) {
      var VARIANTER = byggVarianterFraCsv(resultater[0]);
      if (!VARIANTER.length) {
        console.error('Telefon-konfigurator: fant ingen gyldige rader i telefoner.csv.');
        rot.innerHTML = '<p class="tk-feil">Klarte ikke å laste telefondata.</p>';
        return;
      }
      var MODELLBILDER = byggModellbilderFraVarianter(VARIANTER);
      var TILBEHOR = byggTilbehorFraCsv(resultater[1]); // tom liste er OK - bare ingen ekstrautstyr vises
      harInitialisert = true;
      byggWidget(rot, VARIANTER, MODELLBILDER, TILBEHOR);
    }).catch(function (err) {
      console.error('Telefon-konfigurator: klarte ikke å laste telefondata/tilbehørsdata.', err);
      rot.innerHTML = '<p class="tk-feil">Klarte ikke å laste telefondata.</p>';
    });
  }

  function byggWidget(rot, VARIANTER, MODELLBILDER, TILBEHOR) {
    rot.className = 'tk-konfigurator';
    rot.innerHTML =
      '<h2 class="tk-tittel">Finn din telefon</h2>' +
      '<div class="tk-layout">' +
        '<div class="tk-venstre">' +
          '<div class="tk-seksjon"><h3>Velg merke</h3><div id="tk-merke" class="tk-gruppe"></div></div>' +
          '<div id="tk-seksjon-modell" class="tk-seksjon tk-skjult"><h3>Velg modell</h3><div id="tk-modell" class="tk-gruppe"></div></div>' +
          '<div id="tk-seksjon-kapasitet" class="tk-seksjon tk-skjult"><h3>Velg kapasitet</h3><div id="tk-kapasitet" class="tk-gruppe"></div></div>' +
          '<div id="tk-seksjon-farge" class="tk-seksjon tk-skjult"><h3>Velg farge</h3><div id="tk-farge" class="tk-gruppe"></div></div>' +
          '<p id="tk-pris" class="tk-pris tk-skjult"></p>' +
          '<div id="tk-handling" class="tk-skjult">' +
            '<div class="tk-antall">' +
              '<button id="tk-antall-minus" class="tk-antall-knapp" type="button" aria-label="Reduser antall">\u2212</button>' +
              '<input id="tk-antall-felt" class="tk-antall-felt" type="number" value="1" min="1" max="99" aria-label="Antall" />' +
              '<button id="tk-antall-pluss" class="tk-antall-knapp" type="button" aria-label="\u00d8k antall">+</button>' +
            '</div>' +
            '<button id="tk-kjop" class="tk-sok" type="button">Kj\u00f8p</button>' +
            '<a id="tk-produktlenke" class="tk-produktlenke" href="#">Se produktside</a>' +
          '</div>' +
          '<div id="tk-seksjon-tilbehor" class="tk-seksjon tk-tilbehor tk-skjult"><h3>Ekstrautstyr</h3><div id="tk-tilbehor" class="tk-gruppe"></div></div>' +
        '</div>' +
        '<div class="tk-strek"><div id="tk-strek-fyll" class="tk-strek-fyll"></div></div>' +
        '<div class="tk-hoyre">' +
          '<div id="tk-seksjon-bilde" class="tk-bilde tk-skjult"><img id="tk-produktbilde" src="" alt="Produktbilde" /></div>' +
        '</div>' +
      '</div>';

    /* Antall steg i konfiguratoren (merke, modell, kapasitet, farge).
       Fremdriftslinjen fylles med steg/ANTALL_STEG - legges det til
       et nytt steg, oppdater kun dette tallet og stegnummeret i det
       nye stegets settFremdrift()-kall. */
    var ANTALL_STEG = 4;

    var valg = { merke: '', modell: '', kapasitet: '' };

    var el = function (id) { return document.getElementById(id); };
    var vis = function (id) { el(id).classList.remove('tk-skjult'); };
    var skjul = function (id) { el(id).classList.add('tk-skjult'); };

    /* Unike verdier i rekkefoelge fra listen */
    function unike(liste, felt) {
      var sett = [];
      liste.forEach(function (v) {
        if (sett.indexOf(v[felt]) === -1) sett.push(v[felt]);
      });
      return sett;
    }

    function filtrer() {
      return VARIANTER.filter(function (v) {
        return (!valg.merke || v.merke === valg.merke) &&
               (!valg.modell || v.modell === valg.modell) &&
               (!valg.kapasitet || v.kapasitet === valg.kapasitet);
      });
    }

    /* Moerk eller lys tekst paa fargeknapp, basert paa faktisk
       WCAG-kontrastberegning mot fargekoden (window.PV.Kontrast) -
       ikke en enkel terskel eller antakelse om moerk/lys bakgrunn.
       Ugyldig/manglende hex faller trygt tilbake til prosjektets
       vanlige tekstfarge. */
    function tekstFarge(hex) {
      return window.PV.Kontrast.velgTekstfarge(hex).tekstfarge;
    }

    function lagKnapper(gruppeId, verdier, klikk, erFarge) {
      var gruppe = el(gruppeId);
      gruppe.innerHTML = '';
      verdier.forEach(function (v) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = erFarge ? v.farge : v;
        if (erFarge) {
          b.className = 'tk-farge';
          b.style.background = v.hex;
          b.style.color = tekstFarge(v.hex);
          /* Fargenavnet vises allerede som synlig tekst i knappen
             (b.textContent over), saa dette er et supplement, ikke
             eneste kilde til et tilgjengelig navn. */
          b.setAttribute('aria-label', 'Farge: ' + v.farge);
        }
        b.addEventListener('click', function () {
          Array.prototype.forEach.call(gruppe.children, function (k) {
            k.classList.remove('tk-valgt');
          });
          b.classList.add('tk-valgt');
          klikk(v);
        });
        gruppe.appendChild(b);
      });
    }

    /* Som lagKnapper(), men velger automatisk det FØRSTE alternativet
       (samme rekkefølge som i CSV-en) med en gang knappene er bygget -
       i stedet for at brukeren må klikke selv. Brukeren kan fortsatt
       klikke et annet alternativ etterpå for å overstyre; det er bare
       forhåndsvalget som er nytt. Brukes for kapasitet og farge, slik
       at pris og bilde populeres med det samme en modell er valgt
       ("Samsung Galaxy S26" -> forhåndsvalgt 256GB/Black). Brukes
       ikke for merke/modell - de skal fortsatt velges aktivt. */
    function lagKnapperMedAutoValg(gruppeId, verdier, klikk, erFarge) {
      lagKnapper(gruppeId, verdier, klikk, erFarge);
      if (verdier.length) {
        var gruppe = el(gruppeId);
        if (gruppe.firstElementChild) gruppe.firstElementChild.classList.add('tk-valgt');
        klikk(verdier[0]);
      }
    }

    /* Fremdriftslinje: 0-1 fyller streken med jevn animasjon */
    function settFremdrift(andel) {
      el('tk-strek-fyll').style.setProperty('--tk-fremdrift', andel);
    }

    function nullstillFra(steg) {
      if (steg <= 1) { valg.modell = ''; skjul('tk-seksjon-modell'); skjul('tk-seksjon-bilde'); }
      if (steg <= 2) { valg.kapasitet = ''; skjul('tk-seksjon-kapasitet'); }
      if (steg <= 3) { skjul('tk-seksjon-farge'); }
      skjul('tk-handling');
      skjul('tk-seksjon-tilbehor');
      el('tk-antall-felt').value = 1;
      tilbakestillKjop();
      skjulPris();
      bildeForesporselId++; // ugyldiggjør ev. bildehenting som ikke har svart enda
    }

    /* ---- Pris for valgt telefonmodell (Krav 4/5). Gjenbruker
       window.PV.Pricing (samme henting/caching/feilhaandtering som
       produktkortene i produktvelgeren bruker mot .pricedetails).
       prisForesporselId hindrer at et sent svar for en modell
       brukeren har forlatt, overskriver prisen for en ny modell -
       kun svaret som matcher gjeldende id blir vist. ---- */
    var prisForesporselId = 0;

    function skjulPris() {
      var p = el('tk-pris');
      p.textContent = '';
      p.className = 'tk-pris tk-skjult';
    }

    function visPrisForVariant(variant) {
      var egenId = ++prisForesporselId;
      skjulPris();

      var pid = produktId(variant.url);
      if (!pid || !variant.url) return; // ingen gyldig produktside -> ingen pris, ingen lenke

      /* Midlertidig lastestatus - samme etablerte mønster som
         produktvelgerens kort (pv-card-price.is-loading), fjernes
         igjen naar forespørselen er ferdig (se .then/.catch). */
      var lasterEl = el('tk-pris');
      lasterEl.textContent = 'Henter pris...';
      lasterEl.className = 'tk-pris tk-pris-laster';

      window.PV.Pricing.hentPris({ ProduktID: pid, Lenke: variant.url })
        .then(function (pris) {
          if (egenId !== prisForesporselId) return; // brukeren har byttet modell i mellomtiden
          var p = el('tk-pris');
          p.textContent = pris;
          p.className = 'tk-pris';
        })
        .catch(function (err) {
          if (egenId !== prisForesporselId) return;
          /* window.PV.Pricing skiller ikke selv mellom feiltypene i
             feilmeldingen, saa vi skiller paa feilOBJEKT-typen:
             - TypeError = fetch() feilet helt (same-origin/CORS/nettverk,
               typisk lokal testing) -> vis "Se pris i butikk"-lenketekst
               naar en gyldig produktside-URL finnes.
             - Alt annet (HTTP-feilstatus, eller siden svarte men
               .pricedetails ga ingen brukbar pris) -> ingen pris og
               ingen plassholder, jf. Krav 5. */
          if (err instanceof TypeError && variant.url) {
            var p = el('tk-pris');
            p.textContent = 'Se pris i butikk';
            p.className = 'tk-pris tk-pris-lenke';
          } else {
            skjulPris(); // fjerner "Henter pris..." - ingen permanent plassholder
          }
        });
    }

    /* Steg 1: merke */
    lagKnapper('tk-merke', unike(VARIANTER, 'merke'), function (merke) {
      valg.merke = merke;
      nullstillFra(1);
      settFremdrift(1 / ANTALL_STEG);
      lagKnapper('tk-modell', unike(filtrer(), 'modell'), velgModell, false);
      vis('tk-seksjon-modell');
    }, false);

    /* Loeser relative stier mot mappen paa GitHub Pages */
    function bildeUrl(sti) {
      return /^https?:\/\//i.test(sti) ? sti : IMG_BASE + sti;
    }

    function visBilde(sti, altTekst) {
      if (sti) {
        el('tk-produktbilde').src = bildeUrl(sti);
        el('tk-produktbilde').alt = altTekst;
        vis('tk-seksjon-bilde');
      } else {
        skjul('tk-seksjon-bilde');
      }
    }

    /* Steg 2: modell -> vis modellbilde, forhåndsvelg første kapasitet
       (som igjen forhåndsvelger første farge, se lagKnapperMedAutoValg) */
    function velgModell(modell) {
      valg.modell = modell;
      nullstillFra(2);
      settFremdrift(2 / ANTALL_STEG);
      var bilder = (typeof MODELLBILDER !== 'undefined') ? MODELLBILDER : {};
      visBilde(bilder[modell] || '', modell);
      lagKnapperMedAutoValg('tk-kapasitet', unike(filtrer(), 'kapasitet'), velgKapasitet, false);
      vis('tk-seksjon-kapasitet');
    }

    /* Steg 3: kapasitet -> forhåndsvelg første farge for denne kapasiteten */
    function velgKapasitet(kapasitet) {
      valg.kapasitet = kapasitet;
      nullstillFra(3);
      settFremdrift(3 / ANTALL_STEG);
      lagKnapperMedAutoValg('tk-farge', filtrer(), velgFarge, true);
      vis('tk-seksjon-farge');
    }

    /* Steg 4: farge -> vis Kjoep-knapp og produktlenke */
    var valgtVariant = null;

    function velgFarge(variant) {
      valgtVariant = variant;
      settFremdrift(ANTALL_STEG / ANTALL_STEG);
      tilbakestillKjop();
      el('tk-produktlenke').href = variant.url;
      vis('tk-handling');
      visBildeForVariant(variant);
      visPrisForVariant(variant);
      visTilbehor(valg.merke, valg.modell);
    }

    /* Henter det faktiske produktbildet for NØYAKTIG denne fargen
       direkte fra produktsiden (window.PV.Bilde), i stedet for et
       manuelt opplastet bilde. Rekkefølge:
         1. Bilde-feltet i CSV-en, HVIS det er satt (manuell overstyring -
            nyttig hvis siden mangler bilde eller det utledede blir feil).
         2. Hentet direkte fra variantens egen produktside.
         3. Modellens statiske forhåndsvisningsbilde (MODELLBILDER), hvis noe.
         4. Skjul bildeområdet.
       bildeForesporselId hindrer at et sent svar for en variant
       brukeren har forlatt, overskriver bildet for en ny variant. */
    var bildeForesporselId = 0;

    function visBildeForVariant(variant) {
      var egenId = ++bildeForesporselId;
      var bilder = (typeof MODELLBILDER !== 'undefined') ? MODELLBILDER : {};
      var altTekst = variant.modell + ' ' + variant.farge;

      if (variant.bilde) {
        visBilde(variant.bilde, altTekst);
        return;
      }

      var pid = produktId(variant.url);
      if (!pid || !variant.url) {
        visBilde(bilder[valg.modell] || '', altTekst);
        return;
      }

      window.PV.Bilde.hentBilde({ ProduktID: pid, Lenke: variant.url })
        .then(function (url) {
          if (egenId !== bildeForesporselId) return; // brukeren har byttet variant i mellomtiden
          el('tk-produktbilde').src = url;
          el('tk-produktbilde').alt = altTekst;
          vis('tk-seksjon-bilde');
        })
        .catch(function () {
          if (egenId !== bildeForesporselId) return;
          /* Same-origin-feil (lokal testing) eller intet bilde funnet
             på siden - fall tilbake til modellens statiske
             forhåndsvisning hvis den finnes, ellers skjul stille. */
          visBilde(bilder[valg.modell] || '', altTekst);
        });
    }

    /* ---- Kjoep: legger varen i handlekurven via webshoppens
       eget endepunkt. Produkt-ID hentes fra produkt-URL-en
       (tallet etter /p paa slutten). Feiler kallet - f.eks.
       ved lokal testing utenfor shoppen - sendes kunden til
       produktsiden i stedet. ---- */
    function produktId(url) {
      return window.PV.ProduktId.fraUrl(url);
    }

    function tilbakestillKjop() {
      var k = el('tk-kjop');
      k.disabled = false;
      k.textContent = 'Kj\u00f8p';
      k.classList.remove('tk-kjopt');
    }

    /* Finner containeren rundt handlekurv-blokken i headeren,
       slik at BuyProductEx kan re-rendre den (oppdaterer telleren).
       To strategier: (1) gaa opp fra kurvblokken til naermeste
       element med id som slutter paa 'container', (2) let gjennom
       alle *container-elementer etter ett som inneholder kurvblokken.
       [class*=] fanger ogsaa varianter som __inner/__counter. */
    function finnKurvContainer() {
      var blokk = document.querySelector('[class*="b-shopping-cart-top"]');
      var n = blokk;
      while (n && n !== document.body) {
        if (n.id && /container$/i.test(n.id)) return n;
        n = n.parentElement;
      }
      var kandidater = document.querySelectorAll('[id$="container"]');
      for (var i = 0; i < kandidater.length; i++) {
        if (kandidater[i].querySelector('[class*="b-shopping-cart-top"]')) {
          return kandidater[i];
        }
      }
      return null;
    }

    /* Reserveloesning: oppdater tellertallet direkte, med antall */
    function oppdaterTellerManuelt(antall) {
      var teller = document.querySelector('[class*="b-shopping-cart-top__counter"]');
      if (!teller) return;
      var s = teller.querySelector('span');
      if (s) {
        s.textContent = (parseInt(s.textContent, 10) || 0) + antall;
      } else {
        teller.innerHTML = '<span>' + antall + '</span>';
      }
    }

    /* ---- Antallsvelger: deles av hovedvelgeren og hver
       tilbehoersrad (se lagAntallsleser lenger ned). ---- */
    function lesOgKlemAntall(feltEl) {
      var n = parseInt(feltEl.value, 10);
      if (isNaN(n) || n < 1) n = 1;
      if (n > 99) n = 99;
      feltEl.value = n;
      return n;
    }

    /* Kobler minus/pluss-knapper og tallfeltet sammen.
       Returnerer en les()-funksjon som gir gjeldende, gyldige antall. */
    function lagAntallsleser(minusEl, plussEl, feltEl) {
      var les = function () { return lesOgKlemAntall(feltEl); };
      minusEl.addEventListener('click', function () { feltEl.value = Math.max(1, les() - 1); });
      plussEl.addEventListener('click', function () { feltEl.value = Math.min(99, les() + 1); });
      feltEl.addEventListener('change', les);
      return les;
    }

    var lesAntall = lagAntallsleser(el('tk-antall-minus'), el('tk-antall-pluss'), el('tk-antall-felt'));

    /* ---- Felles: legg ett produkt i handlekurven.
       oppdaterKurv=true lar tjenesten re-rendre minihandlekurven
       (gjoeres kun paa siste kall i en serie).
       fallbackAntall: hvor mye den manuelle telleren skal oekes
       med hvis re-rendringen ikke er mulig (default = antall). ---- */
    function leggIKurv(id, antall, oppdaterKurv, fallbackAntall) {
      var kurv = oppdaterKurv ? finnKurvContainer() : null;
      var controlsInfo = kurv ? [{
        TemplatePath: '~/Skins/Default/Templates/ShoppingCartBlock-Light.ascx',
        DataManagerClientId: 'ShoppingCartDM_dmShoppingCart',
        ContainerId: kurv.id
      }] : [];

      return fetch('/_common/services/commonproxywebservice.asmx/BuyProductEx', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          controlsInfo: controlsInfo,
          productId: id,
          quantity: String(antall),
          additionalOptionsInfo: [],
          priceCode: '',
          bidTimeId: 0,
          currentCategoryId: 0
        })
      }).then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      }).then(function (json) {
        if (kurv && json && json.d && json.d.HtmlCode && json.d.HtmlCode[0]) {
          kurv.innerHTML = json.d.HtmlCode[0];
        } else if (oppdaterKurv) {
          oppdaterTellerManuelt(fallbackAntall || antall);
        }
        return json;
      });
    }

    /* ---- Kjoep av telefonen ---- */
    el('tk-kjop').addEventListener('click', function () {
      if (!valgtVariant) return;
      var k = el('tk-kjop');
      var id = produktId(valgtVariant.url);
      if (!id) { window.location.href = valgtVariant.url; return; }

      k.disabled = true;
      k.textContent = 'Legger i handlekurven...';

      leggIKurv(id, lesAntall(), true).then(function () {
        k.textContent = 'Lagt i handlekurven';
        k.classList.add('tk-kjopt');
        el('tk-produktlenke').textContent = 'G\u00e5 til handlekurven';
        el('tk-produktlenke').href = '/shoppingcart';
      }).catch(function () {
        /* Fallback: aapne produktsiden saa kunden kan kjoepe der */
        window.location.href = valgtVariant.url;
      });
    });

    /* ---- Ekstrautstyr: enkeltprodukter med egen antallsvelger.
       Data kommer fra data/telefon-tilbehor.csv (Merke, Modell, Navn,
       Lenke). En rad med Merke="universal" gjelder for alle
       merker/modeller (f.eks. lader). ---- */
    function hentTilbehor(merke, modell) {
      return TILBEHOR.filter(function (vare) {
        return vare.universal || (vare.merke === merke && vare.modell === modell);
      });
    }

    function visTilbehor(merke, modell) {
      var ting = hentTilbehor(merke, modell);
      var gruppe = el('tk-tilbehor');
      gruppe.innerHTML = '';
      if (!ting.length) { skjul('tk-seksjon-tilbehor'); return; }

      ting.forEach(function (vare) {
        /* Rad: [- antall +] [knapp med navn] */
        var rad = document.createElement('div');
        rad.className = 'tk-tilbehor-rad';

        var antallBoks = document.createElement('div');
        antallBoks.className = 'tk-antall tk-antall-liten';
        var minus = document.createElement('button');
        minus.type = 'button'; minus.className = 'tk-antall-knapp';
        minus.textContent = '\u2212';
        minus.setAttribute('aria-label', 'Reduser antall');
        var felt = document.createElement('input');
        felt.type = 'number'; felt.className = 'tk-antall-felt';
        felt.value = 1; felt.min = 1; felt.max = 99;
        felt.setAttribute('aria-label', 'Antall');
        var pluss = document.createElement('button');
        pluss.type = 'button'; pluss.className = 'tk-antall-knapp';
        pluss.textContent = '+';
        pluss.setAttribute('aria-label', '\u00d8k antall');
        antallBoks.appendChild(minus);
        antallBoks.appendChild(felt);
        antallBoks.appendChild(pluss);

        var lesRadAntall = lagAntallsleser(minus, pluss, felt);

        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'tk-pakke';
        b.textContent = vare.navn;

        b.addEventListener('click', function () {
          /* CSV-en (telefon-tilbehor.csv) gir kun én Lenke per rad, så
             hvert tilbehør er ett enkeltprodukt. Koden håndterer
             fortsatt vare.produkter (flere URL-er i én "pakke") hvis
             det skulle bli aktuelt igjen senere - men ingen rad i
             dagens CSV-format kan uttrykke det. */
          var urler = vare.produkter || (vare.url ? [vare.url] : []);
          var ider = urler.map(produktId).filter(Boolean);
          if (!ider.length) {
            console.error('Telefon-konfigurator: "' + vare.navn +
              '" mangler gyldige produkt-URL-er (forventer /p<tall>). Sjekk telefon-tilbehor.csv.');
            b.textContent = 'Ikke tilgjengelig enn\u00e5';
            b.disabled = true;
            setTimeout(function () {
              b.textContent = vare.navn;
              b.disabled = false;
            }, 3000);
            return;
          }
          var antall = lesRadAntall();
          b.disabled = true;
          b.textContent = 'Legger i handlekurven...';

          /* Legg produktene i kurven ett og ett med valgt antall;
             bare siste kall re-rendrer minihandlekurven */
          var kjede = Promise.resolve();
          ider.forEach(function (id, i) {
            kjede = kjede.then(function () {
              /* Siste kall re-rendrer kurven; hvis re-rendring
                 feiler dekker fallback hele serien (antall x produkter) */
              return leggIKurv(id, antall, i === ider.length - 1, antall * ider.length);
            });
          });
          kjede.then(function () {
            b.textContent = 'Lagt i handlekurven';
            b.classList.add('tk-kjopt');
            setTimeout(function () {
              b.textContent = vare.navn;
              b.classList.remove('tk-kjopt');
              b.disabled = false;
              felt.value = 1;
            }, 3000);
          }).catch(function () {
            b.disabled = false;
            b.textContent = vare.navn + ' (feilet - pr\u00f8v igjen)';
          });
        });

        rad.appendChild(antallBoks);
        rad.appendChild(b);

        /* Lenke til produktsiden (foerste produkt hvis pakke) */
        var lenkeUrl = vare.url || (vare.produkter && vare.produkter[0]) || '';

        /* Krav 6: pris mellom produktnavnet og "Se produktside".
           Kun for enkeltprodukter (vare.url) - en pakke med flere
           produkter (vare.produkter) har ikke én entydig pris å vise,
           så prisraden hoppes over for pakker. Samme henting/cache/
           feilregler som for telefonmodellen (window.PV.Pricing) -
           inkl. samme TypeError-skille: same-origin/nettverksfeil
           (typisk lokal testing) -> "Se pris i butikk", mens en
           vellykket forespørsel uten brukbar pris -> ingen prisrad. */
        if (vare.url) {
          var pakkeId = produktId(vare.url);
          if (pakkeId) {
            var prisEl = document.createElement('span');
            prisEl.className = 'tk-tilbehor-pris';
            window.PV.Pricing.hentPris({ ProduktID: pakkeId, Lenke: vare.url })
              .then(function (pris) {
                prisEl.textContent = 'Pris: ' + pris;
              })
              .catch(function (err) {
                if (err instanceof TypeError) {
                  prisEl.textContent = 'Se pris i butikk';
                  prisEl.classList.add('tk-tilbehor-pris-lenke');
                } else if (prisEl.parentNode) {
                  prisEl.parentNode.removeChild(prisEl);
                }
              });
            rad.appendChild(prisEl);
          }
        }

        if (lenkeUrl) {
          var pl = document.createElement('a');
          pl.className = 'tk-produktlenke';
          pl.href = lenkeUrl;
          pl.textContent = 'Se produktside';
          rad.appendChild(pl);
        }
        gruppe.appendChild(rad);
      });
      vis('tk-seksjon-tilbehor');
    }
  }

  return { init: init };
})();