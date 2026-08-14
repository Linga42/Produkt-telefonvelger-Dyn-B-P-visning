/*
  RENDER.JS
  ---------
  Laster data/produkter.csv og data/innstillinger.json, og bygger hele
  siden: faner, søk, produktkort, antallsvelger.

  Dette er motor-kode. Ikke rediger. Vil du endre produkter eller
  gruppe-rekkefølge, gjør det i /data/ - se README.md.
*/
window.PV = window.PV || {};

(function () {
  const DATA_DIR = (window.PV_CONFIG && window.PV_CONFIG.dataBaseUrl) || "./data/";
  const PRODUCTS_FILE = DATA_DIR + "produkter.csv";
  const SETTINGS_FILE = DATA_DIR + "innstillinger.json";

  const ICON_SEARCH =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
  const ICON_CART =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>';

  async function init() {
    const header = document.getElementById("pv-header");
    const toolbar = document.getElementById("pv-toolbar");
    const app = document.getElementById("pv-app");
    if (!header || !toolbar || !app) {
      console.error(
        'Produktvelger: fant ikke #pv-header, #pv-toolbar og/eller #pv-app i DOM-en. ' +
        'Embed-koden må inneholde alle tre id-ene nøyaktig som i index.html/README ' +
        '(f.eks. <div class="pv-container"><header id="pv-header"></header>' +
        '<div id="pv-toolbar"></div><div id="pv-app"></div></div>) - en forenklet ' +
        'enkelt-div gjør at siden blir blank.'
      );
      return;
    }
    let settings, rows;

    try {
      [settings, rows] = await Promise.all([loadSettings(), loadProducts()]);
    } catch (err) {
      app.innerHTML = '<p class="pv-empty">Klarte ikke å laste produktdata. Sjekk filene i /data/.</p>';
      console.error(err);
      return;
    }

    renderHeader(settings);
    const groups = groupRows(rows, settings.gruppeRekkefolge || []);
    renderGroups(groups);
    renderToolbar(settings, Array.from(groups.keys()));
    applyFilter("", Array.from(groups.keys())[0]);
  }

  async function loadSettings() {
    const res = await fetch(SETTINGS_FILE);
    return res.json();
  }

  async function loadProducts() {
    const res = await fetch(PRODUCTS_FILE);
    const csvText = await res.text();
    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
    // ProduktID/KategoriID skrives ikke lenger inn manuelt i CSV-en -
    // begge utledes fra Lenke (se engine/produkt-id.js), samme
    // prinsipp som telefoner.csv. Støtter fortsatt en eksplisitt
    // ProduktID/KategoriID-kolonne hvis en gammel CSV skulle ha det
    // liggende igjen (radens egen verdi vinner over det utledede).
    parsed.data.forEach(row => {
      if (!row.ProduktID || !String(row.ProduktID).trim()) {
        row.ProduktID = window.PV.ProduktId.fraUrl(row.Lenke);
      }
      if (!row.KategoriID || !String(row.KategoriID).trim()) {
        row.KategoriID = window.PV.ProduktId.kategoriFraUrl(row.Lenke);
      }
    });
    return parsed.data;
  }

  function groupRows(rows, preferredOrder) {
    const groups = new Map();
    rows.forEach(row => {
      const name = (row.Gruppe || "Annet").trim();
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(row);
    });

    // "Telefon" kommer ikke fra produkter.csv (egen datakilde, egen
    // widget - se telefon-konfigurator.js) men skal likevel vises som
    // en vanlig fane sammen med de andre. Sikrer at gruppen finnes her
    // slik at den får plass i samme rekkefølge-logikk som resten.
    if (!groups.has("Telefon")) groups.set("Telefon", []);

    // Sorter etter innstillinger.json sin gruppeRekkefolge, deretter
    // eventuelle nye grupper i den rekkefølgen de dukket opp i CSV-en.
    const ordered = new Map();
    preferredOrder.forEach(name => {
      if (groups.has(name)) { ordered.set(name, groups.get(name)); groups.delete(name); }
    });
    groups.forEach((products, name) => ordered.set(name, products));

    return ordered;
  }

  // Deler en gruppes produkter i undergrupper basert på "Undergruppe"-
  // kolonnen i CSV-en. Rader uten undergruppe havner i én samlet bolk
  // uten egen overskrift. Rekkefølgen følger første opptreden i CSV-en.
  function splitBySubgroup(products) {
    const subgroups = new Map();
    products.forEach(row => {
      const name = (row.Undergruppe || "").trim();
      if (!subgroups.has(name)) subgroups.set(name, []);
      subgroups.get(name).push(row);
    });
    return subgroups;
  }

  function renderHeader(settings) {
    const header = document.getElementById("pv-header");
    header.innerHTML = `
      <h1 class="pv-title">${escapeHtml(settings.sidetittel || "")}</h1>
      <p class="pv-intro">${escapeHtml(settings.introTekst || "")}</p>
    `;
  }

  function renderToolbar(settings, groupNames) {
    const toolbar = document.getElementById("pv-toolbar");

    const searchWrap = document.createElement("div");
    searchWrap.className = "pv-search";
    searchWrap.innerHTML = `${ICON_SEARCH}<input type="text" id="pv-search-input" placeholder="${escapeHtml(settings.sokPlaceholder || "Søk...")}" />`;
    toolbar.appendChild(searchWrap);

    const tabs = document.createElement("div");
    tabs.className = "pv-tabs";
    tabs.id = "pv-tabs";
    groupNames.forEach((name, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pv-tab" + (i === 0 ? " is-active" : "");
      btn.textContent = name;
      btn.dataset.group = name;
      btn.addEventListener("click", () => {
        document.querySelectorAll(".pv-tab").forEach(b => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        document.getElementById("pv-search-input").value = "";
        applyFilter("", name);
      });
      tabs.appendChild(btn);
    });
    toolbar.appendChild(tabs);

    const searchInput = searchWrap.querySelector("input");
    searchInput.addEventListener("input", () => {
      const term = searchInput.value.trim().toLowerCase();
      if (term) {
        document.querySelectorAll(".pv-tab").forEach(b => b.classList.remove("is-active"));
        applyFilter(term, null);
      } else {
        const active = document.querySelector(".pv-tab") ;
        if (active) active.classList.add("is-active");
        applyFilter("", active ? active.dataset.group : null);
      }
    });
  }

  function renderGroups(groups) {
    const app = document.getElementById("pv-app");
    app.innerHTML = "";

    groups.forEach((products, groupName) => {
      const section = document.createElement("section");
      section.className = "pv-group";
      section.dataset.group = groupName;

      if (groupName === "Telefon") {
        // Egen widget, ikke kortstil (Krav 3) - beholder sin egen
        // utforming/interaksjon. Ingen "pv-group-title" her: widgeten
        // har allerede sin egen overskrift ("Finn din telefon"), og en
        // ekstra "Telefon"-overskrift over den ville vært redundant.
        section.innerHTML = '<div id="tk-konfigurator"><!-- fylles av telefon-konfigurator.js --></div>';
        app.appendChild(section);
        if (window.PV.Telefon) window.PV.Telefon.init();
        return;
      }

      section.innerHTML = `<h2 class="pv-group-title">${escapeHtml(groupName)}</h2>`;

      const subgroups = splitBySubgroup(products);
      const hasRealSubgroups = subgroups.size > 1 || (subgroups.size === 1 && !subgroups.has(""));

      subgroups.forEach((subProducts, subgroupName) => {
        if (hasRealSubgroups && subgroupName) {
          const h3 = document.createElement("h3");
          h3.className = "pv-subgroup-title";
          h3.textContent = subgroupName;
          section.appendChild(h3);
        }

        const grid = document.createElement("div");
        grid.className = "pv-grid";
        subProducts.forEach(p => grid.appendChild(buildCard(p)));
        section.appendChild(grid);
      });

      app.appendChild(section);
    });
  }

  function buildCard(produkt) {
    const card = document.createElement("div");
    card.className = "pv-card";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.dataset.searchText = (produkt.Tittel + " " + produkt.Modell).toLowerCase();

    card.innerHTML = `
      <div class="pv-card-accent"></div>
      <div class="pv-card-body">
        <p class="pv-card-title">${escapeHtml(produkt.Tittel)}</p>
        <p class="pv-card-model">${escapeHtml(produkt.Modell)}</p>
        <p class="pv-card-price is-loading">Henter pris...</p>
        <a class="pv-card-link" href="${escapeHtml(produkt.Lenke)}" target="_blank" rel="noopener">Se produktside</a>
      </div>
      <div class="pv-qty">
        <button type="button" class="pv-qty-btn" data-action="minus" aria-label="Reduser antall">−</button>
        <span class="pv-qty-value">0</span>
        <button type="button" class="pv-qty-btn" data-action="plus" aria-label="Øk antall">+</button>
      </div>
      <div class="pv-cta"><span class="pv-cta-icon">${ICON_CART}</span><span class="pv-cta-label">Legg i handlekurv</span></div>
    `;

    card.querySelector(".pv-card-link").addEventListener("click", e => e.stopPropagation());

    wirePrice(produkt, card.querySelector(".pv-card-price"));
    wireQuantityAndBuy(produkt, card);

    return card;
  }

  function wirePrice(produkt, priceEl) {
    window.PV.Pricing.hentPris(produkt)
      .then(price => {
        priceEl.textContent = price;
        priceEl.classList.remove("is-loading");
      })
      .catch(err => {
        console.warn("Fant ikke pris for", produkt.Modell, err);
        priceEl.textContent = "Se pris i butikk";
        priceEl.classList.remove("is-loading");
        priceEl.classList.add("is-link");
      });
  }

  function wireQuantityAndBuy(produkt, card) {
    let qty = 0;
    const qtyValueEl = card.querySelector(".pv-qty-value");

    card.querySelector('[data-action="minus"]').addEventListener("click", e => {
      e.stopPropagation();
      qty = Math.max(0, qty - 1);
      qtyValueEl.textContent = qty;
    });
    card.querySelector('[data-action="plus"]').addEventListener("click", e => {
      e.stopPropagation();
      qty += 1;
      qtyValueEl.textContent = qty;
    });

    const trigger = () => handleBuyClick(produkt, card, qtyValueEl, () => qty, () => { qty = 0; });

    card.addEventListener("click", trigger);
    card.addEventListener("keydown", e => {
      if (e.target.closest(".pv-qty-btn")) return;
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); trigger(); }
    });
  }

  async function handleBuyClick(produkt, card, qtyValueEl, getQty, resetQty) {
    const qty = getQty();
    if (qty === 0) {
      qtyValueEl.animate(
        [{ transform: "translateX(0)" }, { transform: "translateX(-3px)" }, { transform: "translateX(3px)" }, { transform: "translateX(0)" }],
        { duration: 200 }
      );
      return;
    }

    if (!produkt.ProduktID) {
      window.location.href = produkt.Lenke;
      return;
    }

    card.classList.add("is-loading");
    try {
      await window.PV.Cart.leggIKurv(produkt, qty);
      card.classList.remove("is-loading");
      card.classList.add("is-added");
      setTimeout(() => card.classList.remove("is-added"), 1400);
      resetQty();
      qtyValueEl.textContent = "0";
    } catch (err) {
      console.warn("Kunne ikke legge i kurv direkte, åpner produktsiden i stedet:", err);
      card.classList.remove("is-loading");
      window.location.href = produkt.Lenke;
    }
  }

  function applyFilter(searchTerm, activeGroup) {
    const sections = document.querySelectorAll(".pv-group");
    let anyVisible = false;

    sections.forEach(section => {
      const groupName = section.dataset.group;
      const cards = section.querySelectorAll(".pv-card");
      let sectionHasMatch = false;

      cards.forEach(card => {
        const matches = !searchTerm || card.dataset.searchText.includes(searchTerm);
        const visible = matches && (searchTerm ? true : (!activeGroup || groupName === activeGroup));
        card.style.display = visible ? "" : "none";
        if (visible) sectionHasMatch = true;
      });

      const showSection = searchTerm ? sectionHasMatch : (!activeGroup || groupName === activeGroup);
      section.classList.toggle("is-hidden", !showSection);
      if (showSection && (sectionHasMatch || !searchTerm)) anyVisible = true;
    });

    let emptyEl = document.getElementById("pv-empty");
    if (searchTerm && !anyVisible) {
      if (!emptyEl) {
        emptyEl = document.createElement("p");
        emptyEl.id = "pv-empty";
        emptyEl.className = "pv-empty";
        emptyEl.textContent = "Ingen produkter matcher søket.";
        document.getElementById("pv-app").appendChild(emptyEl);
      }
    } else if (emptyEl) {
      emptyEl.remove();
    }
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  // Vent på DOMContentLoaded normalt - MEN hvis siden allerede er ferdig
  // lastet når dette scriptet kjører (typisk når Webmercs setter inn
  // denne HTML-blokken etter at siden allerede er interaktiv/ferdig,
  // f.eks. via AJAX), har DOMContentLoaded allerede skjedd og vil
  // aldri fyres igjen. Sjekk readyState og kjør init() med en gang i
  // så fall.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
