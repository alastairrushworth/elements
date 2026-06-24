/* Interactive Periodic Table — rendering, atom animation, meltdown widget. */
(function () {
  "use strict";

  const CATEGORIES = [
    { key: "nonmetal", label: "Reactive nonmetal" },
    { key: "noble-gas", label: "Noble gas" },
    { key: "alkali-metal", label: "Alkali metal" },
    { key: "alkaline-earth-metal", label: "Alkaline earth" },
    { key: "metalloid", label: "Metalloid" },
    { key: "post-transition-metal", label: "Post-transition metal" },
    { key: "transition-metal", label: "Transition metal" },
    { key: "lanthanide", label: "Lanthanide" },
    { key: "actinide", label: "Actinide" },
    { key: "unknown", label: "Unknown / predicted" },
  ];

  const SHELL_NAMES = ["K", "L", "M", "N", "O", "P", "Q"];
  const ROMAN_CAT = {}; // populated below for quick lookup
  CATEGORIES.forEach((c) => (ROMAN_CAT[c.key] = c.label));

  // Concrete colors mirroring the CSS custom properties (used for canvas/SVG fills).
  const CAT_COLORS = {
    "nonmetal": "#4cc9f0",
    "noble-gas": "#b794f6",
    "alkali-metal": "#ff6b6b",
    "alkaline-earth-metal": "#ffa94d",
    "metalloid": "#38d9a9",
    "post-transition-metal": "#74c0fc",
    "transition-metal": "#ffd43b",
    "lanthanide": "#f783ac",
    "actinide": "#e599f7",
    "unknown": "#94a3b8",
  };

  const tableEl = document.getElementById("table");
  const legendEl = document.getElementById("legend");
  const overlay = document.getElementById("overlay");

  let activeFilter = null;
  let atomTimer = null;

  /* ---------- Electron configuration engine ---------- */
  // Subshells in Madelung fill order: [principal n, azimuthal l] (s=0,p=1,d=2,f=3).
  const SUBSHELL_ORDER = [
    [1, 0], [2, 0], [2, 1], [3, 0], [3, 1], [4, 0], [3, 2], [4, 1],
    [5, 0], [4, 2], [5, 1], [6, 0], [4, 3], [5, 2], [6, 1], [7, 0],
    [5, 3], [6, 2], [7, 1],
  ];
  const LBL = ["s", "p", "d", "f"];
  const NOBLE = [[2, "He"], [10, "Ne"], [18, "Ar"], [36, "Kr"], [54, "Xe"], [86, "Rn"]];
  const CORE_Z = { He: 2, Ne: 10, Ar: 18, Kr: 36, Xe: 54, Rn: 86 };

  // Real configurations that break the simple Aufbau fill order.
  // { core: noble-gas symbol, val: [[n, l, electrons], ...] } — val sits above the core.
  const ANOMALIES = {
    24: { core: "Ar", val: [[3, 2, 5], [4, 0, 1]] },                 // Cr
    29: { core: "Ar", val: [[3, 2, 10], [4, 0, 1]] },               // Cu
    41: { core: "Kr", val: [[4, 2, 4], [5, 0, 1]] },                // Nb
    42: { core: "Kr", val: [[4, 2, 5], [5, 0, 1]] },                // Mo
    44: { core: "Kr", val: [[4, 2, 7], [5, 0, 1]] },                // Ru
    45: { core: "Kr", val: [[4, 2, 8], [5, 0, 1]] },                // Rh
    46: { core: "Kr", val: [[4, 2, 10]] },                          // Pd
    47: { core: "Kr", val: [[4, 2, 10], [5, 0, 1]] },               // Ag
    57: { core: "Xe", val: [[5, 2, 1], [6, 0, 2]] },                // La
    58: { core: "Xe", val: [[4, 3, 1], [5, 2, 1], [6, 0, 2]] },     // Ce
    64: { core: "Xe", val: [[4, 3, 7], [5, 2, 1], [6, 0, 2]] },     // Gd
    78: { core: "Xe", val: [[4, 3, 14], [5, 2, 9], [6, 0, 1]] },    // Pt
    79: { core: "Xe", val: [[4, 3, 14], [5, 2, 10], [6, 0, 1]] },   // Au
    89: { core: "Rn", val: [[6, 2, 1], [7, 0, 2]] },                // Ac
    90: { core: "Rn", val: [[6, 2, 2], [7, 0, 2]] },                // Th
    91: { core: "Rn", val: [[5, 3, 2], [6, 2, 1], [7, 0, 2]] },     // Pa
    92: { core: "Rn", val: [[5, 3, 3], [6, 2, 1], [7, 0, 2]] },     // U
    93: { core: "Rn", val: [[5, 3, 4], [6, 2, 1], [7, 0, 2]] },     // Np
    96: { core: "Rn", val: [[5, 3, 7], [6, 2, 1], [7, 0, 2]] },     // Cm
    103: { core: "Rn", val: [[5, 3, 14], [7, 0, 2], [7, 1, 1]] },   // Lr
  };

  function idealSubshells(z) {
    const cap = (l) => 2 * (2 * l + 1); // s=2, p=6, d=10, f=14
    let rem = z;
    const list = [];
    for (const [n, l] of SUBSHELL_ORDER) {
      if (rem <= 0) break;
      const f = Math.min(cap(l), rem);
      list.push([n, l, f]);
      rem -= f;
    }
    return list;
  }

  function subshellConfig(z) {
    const a = ANOMALIES[z];
    if (!a) return idealSubshells(z);
    const core = idealSubshells(CORE_Z[a.core]).map((s) => s.slice());
    return core.concat(a.val.map((v) => v.slice()));
  }

  // electrons per principal shell — drives the animated atom diagram
  function electronShells(z) {
    const totals = {};
    subshellConfig(z).forEach(([n, , c]) => (totals[n] = (totals[n] || 0) + c));
    return Object.keys(totals).sort((a, b) => a - b).map((k) => totals[k]);
  }

  const SUP = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
  const sup = (num) => String(num).split("").map((d) => SUP[d]).join("");

  // full electron configuration in noble-gas shorthand, e.g. [Xe] 4f¹⁴ 5d¹⁰ 6s¹
  function fullConfig(z) {
    const all = subshellConfig(z).slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let core = null;
    for (const [cz, symbol] of NOBLE) if (cz < z) core = [cz, symbol];
    const coreKeys = new Set();
    if (core) idealSubshells(core[0]).forEach(([n, l]) => coreKeys.add(n + "-" + l));
    const parts = [];
    if (core) parts.push("[" + core[1] + "]");
    all.forEach(([n, l, c]) => {
      if (coreKeys.has(n + "-" + l)) return;
      parts.push(n + LBL[l] + sup(c));
    });
    return parts.join(" ");
  }

  /* ---------- Derived position info ---------- */
  function blockOf(el) {
    if (el.cat === "lanthanide" || el.cat === "actinide") return "f";
    if (el.sym === "He") return "s";
    const g = el.x;
    if (g <= 2) return "s";
    if (g <= 12) return "d";
    return "p";
  }

  /* ---------- Build the table ---------- */
  function buildTable() {
    const frag = document.createDocumentFragment();

    ELEMENTS.forEach((el) => {
      const cell = document.createElement("button");
      cell.className = "cell";
      cell.style.setProperty("--cat-color", `var(--c-${el.cat})`);
      cell.style.gridColumn = el.x;
      cell.style.gridRow = el.y;
      cell.dataset.n = el.n;
      cell.dataset.cat = el.cat;
      cell.setAttribute("aria-label", `${el.name}, element ${el.n}`);
      cell.innerHTML =
        `<span class="num">${el.n}</span>` +
        `<span class="sym">${el.sym}</span>` +
        `<span class="nm">${el.name}</span>`;
      cell.addEventListener("click", () => openElement(el));
      frag.appendChild(cell);
    });

    // f-block connector labels in main grid (period 6 & 7, group 3)
    frag.appendChild(makePlaceholder("57–71", 3, 6));
    frag.appendChild(makePlaceholder("89–103", 3, 7));

    tableEl.appendChild(frag);
  }

  function makePlaceholder(text, x, y) {
    const d = document.createElement("div");
    d.className = "placeholder";
    d.style.gridColumn = x;
    d.style.gridRow = y;
    d.textContent = text;
    return d;
  }

  /* ---------- Legend ---------- */
  function buildLegend() {
    CATEGORIES.forEach((c) => {
      const btn = document.createElement("button");
      btn.dataset.cat = c.key;
      btn.innerHTML = `<span class="dot" style="background:var(--c-${c.key})"></span>${c.label}`;
      btn.addEventListener("click", () => toggleFilter(c.key, btn));
      legendEl.appendChild(btn);
    });
  }

  function toggleFilter(cat, btn) {
    const buttons = legendEl.querySelectorAll("button");
    if (activeFilter === cat) {
      activeFilter = null;
      buttons.forEach((b) => {
        b.classList.remove("active");
        b.style.background = "";
      });
    } else {
      activeFilter = cat;
      buttons.forEach((b) => {
        const on = b.dataset.cat === cat;
        b.classList.toggle("active", on);
        b.style.background = on ? `var(--c-${cat})` : "";
      });
    }
    applyVisuals();
  }

  /* ---------- Category highlighting ---------- */
  function applyVisuals() {
    document.querySelectorAll(".cell").forEach((cell) => {
      const el = ELEMENTS[+cell.dataset.n - 1];
      const matchesFilter = !activeFilter || el.cat === activeFilter;
      cell.classList.toggle("dim", !matchesFilter);
      cell.classList.toggle("match", matchesFilter && !!activeFilter);
    });
  }

  /* ---------- Open element detail ---------- */
  function openElement(el) {
    const color = CAT_COLORS[el.cat] || "#4cc9f0";
    const modal = overlay.querySelector(".modal");
    modal.style.setProperty("--accent", color);

    document.getElementById("m-number").textContent = "№ " + el.n;
    document.getElementById("m-mass").textContent = formatMass(el.mass) + " u";
    document.getElementById("m-symbol").textContent = el.sym;
    document.getElementById("m-name").textContent = el.name;
    document.getElementById("m-cat").textContent = ROMAN_CAT[el.cat] || el.cat;
    document.getElementById("m-fact").textContent = el.fact;

    const shells = electronShells(el.n);
    const config = shells.map((c, i) => `${SHELL_NAMES[i] || i + 1}:${c}`).join("  ");
    document.getElementById("m-config").textContent =
      `${shells.length} shell${shells.length > 1 ? "s" : ""} · ${config}`;

    buildExtra(el);
    buildProps(el);
    drawAtom(el, shells, color);
    setupMeltdown(el, color);

    document.getElementById("discovery-note").textContent =
      el.year === "ancient"
        ? `${el.name} — known since ancient times`
        : `${el.name} — discovered ${el.year} by ${el.by}`;

    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    document.getElementById("close-btn").focus();
    history.replaceState(null, "", "#" + el.sym);
  }

  function formatMass(m) {
    return m >= 100 ? m.toFixed(2) : m.toFixed(3);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // Name origin / common uses / abundance, from js/details.js (keyed by symbol).
  function buildExtra(el) {
    const host = document.getElementById("m-extra");
    const d = (typeof DETAILS !== "undefined" && DETAILS[el.sym]) || null;
    if (!d) { host.innerHTML = ""; return; }
    const rows = [
      { icon: "🏷️", k: "Name origin", v: d.origin },
      { icon: "🛠️", k: "Common uses", v: d.uses },
      { icon: "🌍", k: "Abundance", v: d.abundance },
    ].filter((r) => r.v);
    host.innerHTML = rows
      .map(
        (r) =>
          `<div class="xfact"><span class="xicon">${r.icon}</span>` +
          `<div><div class="xk">${r.k}</div><div class="xv">${escapeHtml(r.v)}</div></div></div>`
      )
      .join("");
  }

  function buildProps(el) {
    const phaseIcon = { solid: "🧊", liquid: "💧", gas: "🌫️" }[el.phase] || "❓";
    const glass = glassWeight(el);
    const rows = [
      { k: "State at room temp", v: `${phaseIcon} ${cap(el.phase)}` },
      { k: "A 250 ml glassful weighs", v: glass },
      { k: "Melting point", v: kelvin(el.melt) },
      { k: "Boiling point", v: kelvin(el.boil) },
      { k: "Density", v: el.density != null ? `${el.density} g/${el.phase === "gas" && el.density < 12 ? "L" : "cm³"}` : "—" },
      { k: "Atomic mass", v: formatMass(el.mass) + " u" },
      { k: "Block", v: `${blockOf(el)}-block` },
      { k: "Electron configuration", v: `<span class="config">${fullConfig(el.n)}</span>` },
    ];
    document.getElementById("m-props").innerHTML = rows
      .map((r) => `<div class="prop"><div class="k">${r.k}</div><div class="v">${r.v}</div></div>`)
      .join("");
  }

  // What would a 250 ml glass of this element weigh, with a water comparison?
  // Real gases store density in g/L; everything else in g/cm³.
  function glassWeight(el) {
    if (el.density == null) return "—";
    const isGas = el.phase === "gas" && el.density < 12;
    const grams = isGas ? el.density * 0.25 : el.density * 250; // 0.25 L vs 250 cm³

    let weight;
    if (grams >= 1000) weight = (grams / 1000).toFixed(2) + " kg";
    else if (grams >= 10) weight = grams.toFixed(0) + " g";
    else if (grams >= 1) weight = grams.toFixed(1) + " g";
    else weight = grams.toFixed(2) + " g";

    // a 250 ml glass of water weighs 250 g
    let cmp;
    if (isGas) {
      cmp = `≈ ${fmtInt(Math.round(250 / grams))}× lighter than water`;
    } else {
      const r = grams / 250;
      if (r >= 1.05) cmp = `≈ ${r.toFixed(1)}× a glass of water`;
      else if (r <= 0.95) cmp = `≈ ${(1 / r).toFixed(1)}× lighter than water`;
      else cmp = `about the same as water`;
    }
    return `${weight} <span class="sub">${cmp}</span>`;
  }

  function fmtInt(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function cap(s) {
    return s ? s[0].toUpperCase() + s.slice(1) : "Unknown";
  }
  function kelvin(k) {
    if (k == null) return "—";
    const c = (k - 273.15).toFixed(0);
    return `${k} K <span style="color:var(--muted);font-weight:400">(${c}°C)</span>`;
  }

  /* ---------- Atom model (animated SVG) ---------- */
  function drawAtom(el, shells, color) {
    const svg = document.getElementById("atom");
    if (atomTimer) cancelAnimationFrame(atomTimer);
    svg.innerHTML = "";
    const NS = "http://www.w3.org/2000/svg";

    const maxR = 150;
    const minR = 34;
    const step = shells.length > 1 ? (maxR - minR) / (shells.length - 1) : 0;

    // shells (orbit rings)
    const orbits = [];
    shells.forEach((count, i) => {
      const r = shells.length === 1 ? minR + 26 : minR + step * i;
      const ring = document.createElementNS(NS, "circle");
      ring.setAttribute("r", r);
      ring.setAttribute("cx", 0);
      ring.setAttribute("cy", 0);
      ring.setAttribute("fill", "none");
      ring.setAttribute("stroke", "rgba(255,255,255,0.14)");
      ring.setAttribute("stroke-width", "1");
      svg.appendChild(ring);

      const group = document.createElementNS(NS, "g");
      svg.appendChild(group);
      const electrons = [];
      for (let e = 0; e < count; e++) {
        const dot = document.createElementNS(NS, "circle");
        dot.setAttribute("r", "4.5");
        dot.setAttribute("fill", color || "#4cc9f0");
        dot.style.filter = `drop-shadow(0 0 4px ${color || "#4cc9f0"})`;
        group.appendChild(dot);
        electrons.push(dot);
      }
      // speed: inner shells faster; alternate direction
      const dir = i % 2 === 0 ? 1 : -1;
      const speed = dir * (0.6 - i * 0.06);
      orbits.push({ r, count, electrons, phase: (i * Math.PI) / 5, speed });
    });

    // nucleus
    const glow = document.createElementNS(NS, "circle");
    glow.setAttribute("r", "26");
    glow.setAttribute("fill", color || "#4cc9f0");
    glow.setAttribute("opacity", "0.18");
    svg.appendChild(glow);

    const nucleus = document.createElementNS(NS, "circle");
    nucleus.setAttribute("r", "20");
    nucleus.setAttribute("fill", color || "#4cc9f0");
    nucleus.style.filter = `drop-shadow(0 0 10px ${color || "#4cc9f0"})`;
    svg.appendChild(nucleus);

    const label = document.createElementNS(NS, "text");
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("dominant-baseline", "central");
    label.setAttribute("font-size", "16");
    label.setAttribute("font-weight", "800");
    label.setAttribute("fill", "#0b0f1a");
    label.textContent = el.sym;
    svg.appendChild(label);

    let t = 0;
    function frame() {
      t += 0.016;
      orbits.forEach((o) => {
        const base = o.phase + t * o.speed;
        o.electrons.forEach((dot, idx) => {
          const a = base + (idx * 2 * Math.PI) / o.count;
          dot.setAttribute("cx", (Math.cos(a) * o.r).toFixed(2));
          dot.setAttribute("cy", (Math.sin(a) * o.r).toFixed(2));
        });
      });
      atomTimer = requestAnimationFrame(frame);
    }
    frame();
  }

  /* ---------- Meltdown widget ---------- */
  let beakerState = null;

  function setupMeltdown(el, color) {
    const wrap = document.getElementById("meltdown");
    const slider = document.getElementById("temp-slider");
    const beaker = document.getElementById("beaker");
    const meltLine = document.getElementById("melt-line");
    const boilLine = document.getElementById("boil-line");
    const particlesEl = document.getElementById("particles");

    const hasData = el.melt != null && el.boil != null;
    wrap.classList.toggle("no-data", !hasData);

    // build particles
    particlesEl.innerHTML = "";
    const N = 26;
    const dots = [];
    for (let i = 0; i < N; i++) {
      const p = document.createElement("div");
      p.className = "particle";
      p.style.background = color || "#4cc9f0";
      p.style.boxShadow = `0 0 8px ${color || "#4cc9f0"}`;
      particlesEl.appendChild(p);
      dots.push({ el: p, x: Math.random(), y: Math.random(), vx: 0, vy: 0, hx: Math.random(), hy: Math.random() });
    }

    // scale: 0..max where max comfortably above boil
    const maxT = hasData ? Math.max(el.boil * 1.4, 600) : 6000;
    slider.max = Math.round(maxT);
    slider.disabled = !hasData;

    if (hasData) {
      meltLine.style.bottom = pctOfHeight(el.melt, maxT) + "%";
      boilLine.style.bottom = pctOfHeight(el.boil, maxT) + "%";
      meltLine.querySelector("span").textContent = `melts ${el.melt} K`;
      boilLine.querySelector("span").textContent = `boils ${el.boil} K`;
      meltLine.style.display = boilLine.style.display = "";
    } else {
      meltLine.style.display = boilLine.style.display = "none";
    }

    // start near room temperature (clamped)
    const start = Math.min(298, Math.round(maxT));
    slider.value = start;

    // stop any previous particle loop before starting a new one
    if (beakerState && beakerState.animLoop) cancelAnimationFrame(beakerState.animLoop);

    beakerState = { el, dots, color: color || "#4cc9f0", hasData, maxT };
    updateMeltdown(start);
    animateParticles();

    slider.oninput = () => updateMeltdown(+slider.value);
  }

  function pctOfHeight(t, maxT) {
    return Math.max(2, Math.min(96, (t / maxT) * 100));
  }

  function updateMeltdown(temp) {
    const s = beakerState;
    if (!s) return;
    const el = s.el;
    document.getElementById("temp-value").textContent = `${temp} K`;
    document.getElementById("temp-sub").textContent = `${(temp - 273.15).toFixed(0)} °C`;

    let state;
    if (!s.hasData) {
      state = el.phase;
    } else if (temp < el.melt) {
      state = "solid";
    } else if (temp < el.boil) {
      state = "liquid";
    } else {
      state = "gas";
    }

    // continuous within-state thermal energy, 0 (cold edge) → 1 (hot edge)
    let f;
    if (!s.hasData) {
      f = Math.min(1, temp / 4000);
    } else if (state === "solid") {
      f = el.melt ? temp / el.melt : 0.3; // approaches 1 as it nears melting
    } else if (state === "liquid") {
      f = (temp - el.melt) / Math.max(1, el.boil - el.melt);
    } else {
      f = (temp - el.boil) / Math.max(1, s.maxT - el.boil);
    }
    s.energy = Math.max(0, Math.min(1, f));
    s.state = state;
    s.temp = temp;

    const meta = stateMeta(state);
    document.getElementById("state-icon").textContent = meta.icon;
    document.getElementById("state-label").textContent = meta.label;
  }

  function stateMeta(state) {
    switch (state) {
      case "solid": return { icon: "🧊", label: "Solid" };
      case "liquid": return { icon: "💧", label: "Liquid" };
      case "gas": return { icon: "🌫️", label: "Gas" };
      default: return { icon: "❓", label: "Unknown" };
    }
  }

  function animateParticles() {
    const beaker = document.getElementById("beaker");
    function frame() {
      const s = beakerState;
      if (!s) return;
      const W = beaker.clientWidth;
      const H = beaker.clientHeight;
      const state = s.state || "solid";
      const e = s.energy || 0; // 0..1 within the current phase
      const dots = s.dots;
      const cols = 8;

      dots.forEach((d, i) => {
        if (state === "solid") {
          // fixed lattice; vibration grows from a faint shiver to a violent jiggle near melting
          const col = i % cols;
          const row = Math.floor(i / cols);
          const baseX = 0.16 + col * (0.68 / (cols - 1));
          const baseY = 0.12 + row * 0.19;
          const vib = 0.003 + e * 0.05;
          d.x += (baseX - d.x) * 0.25 + (Math.random() - 0.5) * vib;
          d.y += (baseY - d.y) * 0.25 + (Math.random() - 0.5) * vib;
        } else if (state === "liquid") {
          // pooled, flowing; sloshes harder as it approaches the boil
          const kick = 0.006 + e * 0.03;
          d.vx += (Math.random() - 0.5) * kick;
          d.vy += (Math.random() - 0.5) * kick + 0.003; // gentle gravity
          d.vx *= 0.92; d.vy *= 0.92;
          d.x += d.vx; d.y += d.vy;
          if (d.y < 0.4) d.y += 0.02; // keep pooled in the lower part
        } else {
          // gas; free particles that fly faster and faster the hotter it gets
          const kick = 0.03 + e * 0.13;
          d.vx += (Math.random() - 0.5) * kick;
          d.vy += (Math.random() - 0.5) * kick;
          d.vx *= 0.995; d.vy *= 0.995;
          d.x += d.vx; d.y += d.vy;
        }
        // bounce off the walls
        if (d.x < 0.04) { d.x = 0.04; d.vx = Math.abs(d.vx); }
        if (d.x > 0.96) { d.x = 0.96; d.vx = -Math.abs(d.vx); }
        if (d.y < 0.04) { d.y = 0.04; d.vy = Math.abs(d.vy); }
        if (d.y > 0.96) { d.y = 0.96; d.vy = -Math.abs(d.vy); }

        d.el.style.left = (d.x * W - 4.5) + "px";
        d.el.style.top = ((1 - d.y) * H - 4.5) + "px";
        d.el.style.opacity = state === "gas" ? 0.65 + e * 0.3 : 1;
      });

      beakerState.animLoop = requestAnimationFrame(frame);
    }
    frame();
  }

  /* ---------- Close handling ---------- */
  function closeModal() {
    overlay.hidden = true;
    document.body.style.overflow = "";
    if (atomTimer) cancelAnimationFrame(atomTimer);
    if (beakerState && beakerState.animLoop) cancelAnimationFrame(beakerState.animLoop);
    beakerState = null;
    history.replaceState(null, "", location.pathname + location.search);
  }

  /* ---------- Deep-linking (#Fe or #26) ---------- */
  function handleHash() {
    const raw = decodeURIComponent(location.hash.replace(/^#/, "")).trim();
    if (!raw) return;
    const el = ELEMENTS.find(
      (e) => e.sym.toLowerCase() === raw.toLowerCase() || String(e.n) === raw
    );
    if (el) openElement(el);
  }

  document.getElementById("close-btn").addEventListener("click", closeModal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !overlay.hidden) closeModal();
  });

  /* ---------- Init ---------- */
  buildTable();
  buildLegend();
  handleHash();
  window.addEventListener("hashchange", handleHash);
})();
