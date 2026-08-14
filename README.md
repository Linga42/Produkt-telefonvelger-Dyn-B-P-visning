# Produktvelger

En liten produktside med antallsvelger, faner/søk og direkte "legg i
handlekurv" mot shop.vodacom.no (Webmercs).

## Filstruktur

```
produktvelger/
├── index.html                 IKKE rediger - limet som binder alt sammen
├── config.js                  ✅ REDIGER - dataBaseUrl/imgBaseUrl (lokal vs. live)
├── data/
│   ├── produkter.csv          ✅ REDIGER - legg til/fjern produkter her
│   ├── telefoner.csv          ✅ REDIGER - telefonvarianter, se eget avsnitt under
│   ├── telefon-tilbehor.csv   ✅ REDIGER - tilbehør per telefon, se eget avsnitt under
│   └── innstillinger.json     ✅ REDIGER - tekster og gruppe-rekkefølge
├── bilder/                    ✅ REDIGER - telefon-produktbilder (.webp)
├── styles/
│   ├── theme.css               ✅ REDIGER - farger, fonter, avstander
│   ├── engine.css               ⚠️  IKKE rediger - strukturell styling
│   └── telefon-konfigurator.css ⚠️  IKKE rediger - telefonvelgerens egen stil
├── engine/
│   ├── pricing.js               ⚠️  IKKE rediger - prishenting (kort)
│   ├── produktbilde.js          ⚠️  IKKE rediger - henter produktbilde fra webshoppen
│   ├── cart.js                  ⚠️  IKKE rediger - handlekurv-logikk (kort)
│   ├── produkt-id.js            ⚠️  IKKE rediger - utleder produkt-/kategori-ID fra URL
│   ├── kontrast.js              ⚠️  IKKE rediger - WCAG-kontrastberegning
│   ├── telefon-konfigurator.js  ⚠️  IKKE rediger - telefonvelger-logikk
│   └── render.js                ⚠️  IKKE rediger - bygger siden
└── tests/                      Node-baserte enhetstester (valgfritt, se under)
```

✅ = trygt for alle å redigere
⚠️ = teknisk logikk - endringer her kan knekke siden

## Legge til et nytt produkt

Åpne `data/produkter.csv` og legg til en ny rad nederst:

```
Gruppe,Undergruppe,Tittel,Modell,Lenke
Datamaskiner,Bærbar,Kontor PC,Lenovo ThinkCentre M75,https://shop.vodacom.no/.../p1006999999
```

- **Gruppe**: hvilken fane produktet skal vises i. Skriver du inn et
  gruppenavn som ikke finnes fra før (f.eks. "Nettverksutstyr"),
  opprettes en helt ny fane automatisk - du trenger ikke røre noen kode.
  ("Telefon" er reservert til telefonvelgeren, se under - en CSV-rad
  med Gruppe=Telefon her vil bli overstyrt av telefonvelger-seksjonen.)
- **Undergruppe** (valgfri): deler produktene inne i én gruppe i
  underoverskrifter, f.eks. "Bærbar" og "Stasjonær" under
  "Datamaskiner". La feltet stå tomt for produkter som ikke trenger
  underinndeling (f.eks. skjermer). Nye undergruppenavn dukker
  automatisk opp som egne overskrifter, i den rekkefølgen de først
  opptrer i CSV-en - ingen kode å røre her heller.
- **Tittel**: kort betegnelse, vises øverst på kortet (f.eks. "Kontor PC").
- **Modell**: produktnavnet, vises under tittelen. Inneholder modellen
  et komma eller anførselstegn (f.eks. tommestørrelse i parentes),
  sett hele feltet i anførselstegn: `"Lenovo L14 (14"")"`.
- **Lenke**: full URL til produktsiden. Brukes til fallback-lenke,
  prisvisning OG til å utlede produkt-ID/kategori-ID automatisk (se
  under) - så det er den ENESTE identifikatoren du trenger å lime inn.

**Ingen `ProduktID`- eller `KategoriID`-kolonne lenger.** Begge
utledes automatisk fra `Lenke` (`engine/produkt-id.js`), ut fra det
faste mønsteret i Webmercs sine egne produkt-URL-er:

```
.../cat-p/c36159/p1006571262   -> produkt-ID 1006571262, kategori-ID 36159
.../cat-p/c/p1003783171        -> produkt-ID 1003783171, kategori-ID 0 (ingen tall = generisk)
```

Har en gammel rad likevel en `ProduktID`/`KategoriID`-kolonne liggende
igjen fra før, brukes den verdien i stedet for å overstyre - så det er
trygt å ikke rydde opp gamle rader med en gang.

## Telefonvelgeren ("Telefon"-fanen)

Telefonvelgeren fra det tidligere frittstående "Telefon Konfigurator"-
prosjektet er integrert som en egen fane, ikke som produktkort - den
beholder sin egen fire-stegs utforming (merke → modell → kapasitet →
farge).

**Legge til/endre telefonvarianter:** rediger `data/telefoner.csv`.
Kolonner:

```
Merke,Modell,Kapasitet,Farge,Fargekode,Lenke,Bilde
Samsung,Galaxy S26,256GB,Black,#2C2C2E,https://shop.vodacom.no/.../p1006442059,Samsung-Galaxy-S26.webp
```

- **Merke/Modell/Kapasitet/Farge**: påkrevde. En rad som mangler ett
  av disse hoppes over (varsel i konsollen), resten av widgeten
  påvirkes ikke.
- **Fargekode**: gyldig CSS-fargeverdi (HEX, f.eks. `#2C2C2E`) brukt
  som bakgrunn på fargeknappen. Tekstfargen på knappen (sort/hvit)
  beregnes automatisk med faktisk WCAG-kontrastberegning
  (`engine/kontrast.js`) - ikke en enkel terskel. Ugyldig eller
  manglende Fargekode gir en trygg fallback-grå i stedet for å
  ødelegge resten av telefonvelgeren.
- **Lenke** (ekstra felt utover de fem påkrevde): full URL til
  produktsiden - brukes til kjøp-i-handlekurv, "Se produktside",
  prisvisning OG produktbilde, akkurat som `Lenke` i `produkter.csv`.
- **Bilde** (valgfritt overstyringsfelt): la stå TOM i normale
  tilfeller. Produktbildet for den nøyaktige fargen hentes automatisk
  direkte fra selve produktsiden (`engine/produktbilde.js`) - ingen
  manuell opplasting nødvendig lenger. Fyll bare inn et filnavn i
  `bilder/`-mappen her hvis du trenger å overstyre - f.eks. hvis
  produktsiden mangler bilde eller viser feil bilde for akkurat den
  varianten.

**Hvordan produktbildet hentes:** når en farge velges, henter
widgeten variantens egen produktside (samme-origin, samme prinsipp
som prisvisningen) og leser ut bilde-URL-en direkte fra siden sitt
eget markup. Feiler dette (samme-origin kreves, så dette skjer ALLTID
ved lokal testing og ved forhåndsvisning direkte på GitHub Pages -
begge har et annet domene enn shop.vodacom.no) faller den tilbake til
et eventuelt `Bilde`-felt i CSV-en, deretter til ingenting - aldri et
permanent ødelagt bilde-ikon. Det ekte webshop-bildet kan derfor kun
bekreftes å fungere når siden faktisk kjører limt inn på
shop.vodacom.no - en forhåndsvisning på GitHub Pages vil alltid vise
enten `Bilde`-fallbacken (hvis satt) eller ingenting, uansett hvor
riktig koden er.

**Legge til/endre ekstrautstyr (Deksel, Lommebok, Skjermbeskytter,
Lader):** rediger `data/telefon-tilbehor.csv`. Kolonner:

```
Merke,Modell,Navn,Lenke
Samsung,Galaxy S26,Deksel,https://shop.vodacom.no/.../p1006489662
universal,,Lader,https://shop.vodacom.no/.../p1003746319
```

- **Merke**: må matche `Merke` i `telefoner.csv` nøyaktig (f.eks.
  `Samsung`, `iPhone`) - ELLER skriv `universal` (uavhengig av store/
  små bokstaver) for et tilbehør som skal vises for ALLE merker og
  modeller (f.eks. laderen).
- **Modell**: må matche `Modell` i `telefoner.csv` nøyaktig. Kan stå
  tomt når Merke er `universal` - feltet ignoreres da uansett.
- **Navn**: knappeteksten, f.eks. "Deksel".
- **Lenke**: full URL til produktsiden - brukes til kjøp, "Se
  produktside" og prisvisning, akkurat som i `telefoner.csv`.

En rad som mangler Navn eller Lenke hoppes over (varsel i
konsollen). Én rad = ett enkeltprodukt - CSV-formatet støtter
foreløpig ikke "pakker" med flere produkter under én knapp (det
gjorde den tidligere JS-baserte varianten i prinsippet, men ingen
faktiske data brukte det).

**Rekkefølge på Telefon-fanen** styres av samme
`gruppeRekkefolge`-liste i `data/innstillinger.json` som de andre
fanene.

## Endre rekkefølge på fanene

Åpne `data/innstillinger.json` og juster listen `gruppeRekkefolge`.
Grupper som ikke står der havner automatisk til slutt.

## Endre tekster på siden

`sidetittel`, `introTekst` og `sokPlaceholder` i
`data/innstillinger.json`.

## Justere farger/fonter

`styles/theme.css` inneholder alle fargene og fontene som en liste med
navngitte verdier (CSS-variabler) øverst i filen. Endre verdien, ikke
navnet på variabelen.

## Lokal testing

Denne siden bruker `fetch()` til å laste `data/`- og `bilder/`-filene,
så den må kjøres via en lokal webserver (ikke bare dobbeltklikkes):

```
# I mappen produktvelger/
python -m http.server 8000
```

Åpne deretter http://localhost:8000 i nettleseren.

**Husk:** `config.js` peker som standard på den *live*
GitHub Pages-adressen for både `dataBaseUrl` og `imgBaseUrl`. Sett
begge til `"./data/"` og `"./bilder/"` midlertidig for å teste mot
filene i denne mappen lokalt - se kommentaren i `config.js`.

**Merk:** "Legg i handlekurv", live pris og telefonvelgerens
"Kjøp"-knapp krever at siden kjører på shop.vodacom.no sitt eget
domene (samme prinsipp som telefon-konfiguratoren opprinnelig hadde -
limes inn som HTML-innhold i Webmercs-CMS). Ved lokal testing vises
"Se pris i butikk" i stedet for pris der en gyldig produktlenke
finnes, og klikk på et kort/kjøp-knapp åpner produktsiden i stedet
for å legge det i kurven direkte. Dette er forventet oppførsel, ikke
en feil.

## Tester

`tests/` inneholder enkle Node-baserte enhetstester (ingen
testrammeverk, ingen build-steg - i tråd med prosjektets
build-frie filosofi) for kontrastberegningen og CSV-valideringen:

```
npm install papaparse jsdom --no-save   # kun nødvendig for testene, brukes ikke i produksjon
node tests/kontrast.test.js
node tests/telefoner-csv.test.js
node tests/telefon-tilbehor-csv.test.js
node tests/produkt-id.test.js
node tests/produktbilde.test.js
```

## Publisering

### 1. Push til GitHub

Last opp hele `Produktvelger/`-mappen (inkl. `bilder/` og `data/`) til
GitHub Pages-repoet. Push til hovedgrenen - det finnes ingen CI eller
staging, det du pusher er det som til slutt blir live.

### 2. Sett `config.js` til live-adressene

**Viktig, lett å glemme:** `config.js` peker som standard på den
*live* GitHub Pages-URL-en for `dataBaseUrl` og `imgBaseUrl` - de må
IKKE stå på `./data/`/`./bilder/` (det er kun for lokal testing på
localhost). Er de satt til relative stier når siden limes inn på
shop.vodacom.no, klarer den ikke å finne data-/bildefilene sine
(HTML-en kjører jo da fra `shop.vodacom.no` sitt domene, ikke fra
GitHub Pages). Dobbeltsjekk før publisering:

```js
window.PV_CONFIG = {
  dataBaseUrl: "https://linga42.github.io/Produkt-telefonvelger/data/",
  imgBaseUrl: "https://linga42.github.io/Produkt-telefonvelger/bilder/"
};
```

### 3. Vent på GitHub Pages-cachen

Endringer er normalt live innen ca. 10 minutter etter push (GitHub
Pages sin egen cache). Sjekk gjerne direkte på
`https://linga42.github.io/Produkt-telefonvelger/` før du limer noe inn
i Webmercs, så du vet at siden i seg selv fungerer.

### 4. Lim inn i Webmercs

To måter å bygge den inn på, avhengig av hvordan siden skal sitte i
Webmercs-CMS-en:

**A) Direkte som HTML-innhold** (samme prinsipp som telefon-
konfiguratoren opprinnelig brukte) - limes rett inn i forsiden eller
en Info-seksjon i Webmercs sin editor. **De tre id-ene inni
`pv-container` (`pv-header`, `pv-toolbar`, `pv-app`) er påkrevd
akkurat som vist** - `render.js` leter etter disse spesifikke
elementene og feiler stille (blank side) hvis de mangler eller er
forenklet til én enkelt div:

```html
<div class="pv-container">
  <header class="pv-header" id="pv-header"></header>
  <div class="pv-toolbar" id="pv-toolbar"></div>
  <div id="pv-app"></div>
</div>
<link rel="stylesheet" href="https://linga42.github.io/Produkt-telefonvelger/styles/theme.css">
<link rel="stylesheet" href="https://linga42.github.io/Produkt-telefonvelger/styles/engine.css">
<link rel="stylesheet" href="https://linga42.github.io/Produkt-telefonvelger/styles/telefon-konfigurator.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js"></script>
<script src="https://linga42.github.io/Produkt-telefonvelger/config.js"></script>
<script src="https://linga42.github.io/Produkt-telefonvelger/engine/produkt-id.js"></script>
<script src="https://linga42.github.io/Produkt-telefonvelger/engine/pricing.js"></script>
<script src="https://linga42.github.io/Produkt-telefonvelger/engine/produktbilde.js"></script>
<script src="https://linga42.github.io/Produkt-telefonvelger/engine/cart.js"></script>
<script src="https://linga42.github.io/Produkt-telefonvelger/engine/kontrast.js"></script>
<script src="https://linga42.github.io/Produkt-telefonvelger/engine/telefon-konfigurator.js"></script>
<script src="https://linga42.github.io/Produkt-telefonvelger/engine/render.js"></script>
```

Dette er den ANBEFALTE måten: siden kjører da direkte på
`shop.vodacom.no` sitt eget domene, som er en forutsetning for at
same-origin-avhengige funksjoner (live pris og "legg i handlekurv")
skal virke i det hele tatt - se punkt under.

**B) Som iframe** - enklere å lime inn, men "legg i handlekurv" og
live pris vil IKKE fungere (iframen kjører fortsatt på
`github.io`-domenet, ikke `shop.vodacom.no`, så same-origin-kravet
brytes). Bruk kun denne varianten hvis produktvelgeren skal fungere
som en ren "se produkter og klikk deg videre"-side:

```html
<iframe
  src="https://linga42.github.io/Produkt-telefonvelger/index.html"
  style="width:100%; border:0; min-height:1200px;"
  title="Produktvelger">
</iframe>
```

### 5. Samme-origin-påminnelse

"Legg i handlekurv", "Kjøp"-knappen i telefonvelgeren og live pris er
alle avhengige av at siden faktisk kjører på `shop.vodacom.no` sitt
eget domene (alternativ A over) - ikke en iframe, ikke lokal testing.
Er dette ikke oppfylt, faller alt automatisk tilbake til lenker til
produktsiden i stedet ("Se pris i butikk" / åpne produktsiden) - det
er forventet oppførsel, ikke en feil, se "Lokal testing" over.
