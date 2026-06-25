# The Interactive Periodic Table

An informational, interactive periodic table of all 118 elements. Click any
element to explore it in an engaging detail view — complete with an **animated
atom model** and a hands-on **"melt it down" temperature lab**.

**Live site → https://elements.alastairrushworth.com/**

![Periodic table](https://img.shields.io/badge/elements-118-blueviolet) ![No build step](https://img.shields.io/badge/build-none-success)

## Features

- **All 118 elements** laid out in the correct periodic structure, including the
  lanthanide and actinide f-block rows.
- **Color-coded categories** (alkali metals, noble gases, transition metals, …)
  with a clickable legend that highlights every element in a group.
- **Click an element** to open a rich detail card:
  - **Animated Bohr atom** — electrons orbit on their real electron shells
    (computed from the Madelung fill order, with the well-known anomalies like
    gold, copper and chromium corrected).
  - **"Melt it down" lab** — drag the temperature slider and watch the element
    pass through **solid → liquid → gas**. Particles snap into a lattice when
    solid, pool and flow when liquid, and fill the whole beaker as a gas — and
    the motion gets more energetic the hotter it gets, even within one phase.
    Dashed lines mark the real melting and boiling points.
  - **Crystal lattice** in the meltdown beaker — the atoms sit in a 2D
    schematic of the element's real solid structure (FCC/HCP/BCC, diamond,
    simple-cubic…), labelled by name.
  - **"Most often found on Earth as"** — the dominant natural form plus a 2D
    ball-and-stick diagram of a representative species (O₂, the S₈ ring,
    rock-salt NaCl, the SiO₄ tetrahedron, native-metal clusters, oxide
    octahedra…).
  - Rich properties: full **electron configuration** (noble-gas shorthand),
    block, density, melting/boiling points, and a playful **"what would a
    250 ml glassful weigh?"** comparison against a glass of water.
  - **Name origin, common uses, and abundance**, plus an engaging,
    fact-checked fun fact for every element.
- **Deep links** — open a specific element directly with a URL hash, e.g.
  `#Fe` or `#26`. Shareable and bookmarkable.
- **Responsive** and keyboard-friendly (Esc to close a card).

## Running it

No build, no dependencies. Just open `index.html` in a browser:

```bash
open index.html          # macOS
# or serve it locally:
python3 -m http.server 8000   # then visit http://localhost:8000
```

## Project structure

```
index.html                    markup + layout
css/style.css                 dark theme, table grid, modal, animations
js/data.js                    core 118-element dataset (one object per element)
js/details.js                 name origin, common uses, abundance
js/crystals.js                solid-state crystal structure per element
js/forms.js                   natural form + molecular-structure spec
js/app.js                     rendering, atom + molecule + lattice, meltdown lab
manifest.webmanifest          PWA manifest (installable, theme colour)
robots.txt                    crawler rules + sitemap pointer
sitemap.xml                   sitemap for search engines
favicon.svg / *.png           favicons, apple-touch & PWA icons
og-image.png                  1200×630 social share preview image
.github/workflows/deploy.yml  GitHub Pages deployment
CNAME                         custom domain
```

## SEO & discoverability

`index.html` carries a full metadata head: a descriptive `<title>` and meta
description, canonical URL, Open Graph + Twitter Card tags (with a 1200×630
`og-image.png` preview), favicons/PWA icons, a web app manifest, and
`WebApplication` JSON-LD structured data. `robots.txt` and `sitemap.xml` round
it out. Opening an element also updates `document.title` for tidy, shareable
browser history.

## Deployment

Pushes to `main` are deployed to **GitHub Pages** by the Actions workflow in
`.github/workflows/deploy.yml`, served at the custom domain in `CNAME`
(https://elements.alastairrushworth.com/). It's a plain static site, so the
workflow just uploads the repo root as the Pages artifact — no build step.

## Notes on the data

Atomic masses, melting/boiling points and densities are standard reference
values. For a handful of synthetic superheavy elements some properties are
unknown or predicted; those fields are shown as "—" and the temperature lab is
disabled where melting/boiling data does not exist.

The atom diagram is a deliberately simplified **Bohr-style** shell model — real
atoms are governed by quantum orbitals, not little orbiting balls — but it's an
intuitive way to see how electron shells fill up across the table.
