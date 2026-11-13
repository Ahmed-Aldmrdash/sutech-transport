# SUtech Transport: Design System v1.1

*2026-10-30 · v1.1 adds app bar, lists, controls, overlays, feedback states, admin dashboard, icons and PWA assets · Based on the official **SUTech Brand Manual 2025** and the live sut.edu.eg components. Raw research: `research/design-findings.md`.*

| File | What it is |
|---|---|
| `tokens.css` | CSS variables (follows the app's `frontend/design/tokens.json`, the source of truth): brand scales, semantic roles, type, radius, shadow, space, motion. Light + dark, EN + AR. |
| `tailwind.preset.js` | Tailwind preset that maps every token, for the Next.js PWA. |
| `style-guide.html` | Live preview of everything. Open it in a browser and use the **عربي** and **Dark mode** buttons. |
| `assets/` | `sutech-mark.svg` (official 3-shape mark), `sutech-mark-white.svg` (for purple/dark backgrounds), `sutech-logo.svg` (full colored logo), `pattern.svg` (brand tile pattern), `pwa/` (app icons, favicon, splash) |
| `previews/` | Screenshots: style guide EN light, AR dark, mobile AR; admin dashboard light + dark |
| `DESIGN-SYSTEM.ar.md` | This document in Arabic (for the team) |
| `research/` | Website analysis + the official SUTech Brand Manual 2025 PDF |

## Decisions (and why)

1. **Colours come from the brand manual, not the website.** The website's teal is `#257A88`; the manual's official teal is **`#257988`**. Tints come only from the manual's 100/80/60/40/20 % scales.
2. **Purple is primary, teal is "moving/info", coral is "the bus / highlight".**
   - Purple `#58286E` → brand, primary buttons, your route.
   - Teal `#257988` → live tracking, "on route", links, secondary buttons.
   - Coral `#CF644B` → live-bus pin, icon tiles, highlights.
3. **Coral never carries small white text.** White on coral is 3.77:1, which fails WCAG AA. Coral fills get dark text (`--on-accent`), and coral *text* uses `--coral-ink #B4472E` (5.4:1).
4. **Fonts: Montserrat (EN) + Tajawal (AR)**, free stand-ins for the official Gilroy and AbdoMaster, which are paid. Montserrat is what sut.edu.eg itself uses. To switch to the official fonts, add `@font-face` and edit `--font-latin` / `--font-arabic`. Nothing else changes.
5. **Arabic is first-class.**
   - `lang="ar" dir="rtl"` swaps the font order, removes uppercase and letter-spacing, and makes body lines taller.
   - Use logical properties (`inset-inline-start`, `padding-inline`, `text-align: start`) and flip directional icons with `.flip`.
6. **Flat, like both university sites.**
   - One resting shadow (`--shadow-sm`), one raised shadow (`--shadow-md` = sut.edu.eg's `0 4px 20px rgba(0,0,0,.1)`), and `--shadow-lg` only for sheets and dialogs.
   - Frosted glass (`--glass`) only on top of maps or photos.
7. **Radius ladder:** 4 (icon tiles, eyebrows) · 8 (buttons, inputs; same as both sites) · 12 (cards) · 20 (pass, sheets, map) · pill (status chips only).
8. **Dark mode** uses a purple-black base (`#16101A`) and lifts brand colours to their 40 % tints so they stay readable. The demo's old tokens `--sun*` (yellow) are retired; use `--accent*` instead.

## Semantic tokens (use these in components, never raw hex)

| Role | Token | Light | Dark |
|---|---|---|---|
| Primary action, your route | `--brand` / `--brand-2` (hover) / `--brand-soft` / `--on-brand` | `#58286E` / `#2F103D` / `#F3EEF6` / white | `#BFA1CE` / `#D6C4E0` / `#33243D` / `#16101A` |
| Live / on-route / info | `--info` / `--info-ink` / `--info-soft` | `#257988` / `#1D6170` / `#E9F3F5` | `#7AB8C0` / `#97CDD3` / `#173339` |
| Live-bus pin, icon tiles | `--accent` / `--accent-ink` / `--accent-soft` | `#CF644B` / `#B4472E` / `#FDF0EC` | `#E69583` / `#F1AE9F` / `#3A221C` |
| Success · Warning · Error/SOS | `--ok` `--warn` `--bad` (+ `-soft`, `-ink`) | `#1E8752` · `#A8670D` · `#C62828` (text `#A61F1F`) | `#4CC08A` · `#E3A848` · `#EF7A6E` |
| Headings / body / secondary | `--ink` / `--text` / `--muted` | `#1F1A24` / `#3B3D42` / `#6D6E6F` | `#F3F1F5` / `#DCD8E0` / `#A7A3AD` |
| Page / card / divider | `--bg` / `--surface` / `--line` | `#F7F7F7` / `#FFFFFF` / `#E7E7E7` | `#16101A` / `#211A26` / `#362E3C` |

Every text/background pair above passes **WCAG AA (≥ 4.5:1)**. The status chips use `-ink` on `-soft` (5.5–5.9:1).

## Type scale (mobile-first)

| Token | Size / line | Weight | Use |
|---|---|---|---|
| `--t-display` | 32/38 | 800 | Hero numbers and sentences ("Bus 7 arrives in 4 min") |
| `--t-h1` | 26/32 | 800 | Screen titles |
| `--t-h2` | 20/28 | 800 | Card titles, route names |
| `--t-h3` | 17/24 | 700 | Section labels |
| `--t-body` | 16/26 (AR 16/28) | 400 | Body text, the minimum for anything a driver reads |
| `--t-body-sm` | 14/22 | 400 | Secondary text |
| `--t-caption` | 12/18 | 500 | Meta, timestamps |
| `--t-eyebrow` | 11/16 | 600, UPPERCASE, +0.8px | sut.edu.eg-style section labels (EN only) |
| `--t-button` | 14/20 | 700, UPPERCASE, +0.6px | Buttons (sentence case in AR) |
| `--t-number` | 28/32 | 800 | ETA minutes, counts. Use `tabular-nums` for times |

Headings use negative tracking in English (from sut.edu.eg). Arabic always uses 0.

## Component rules

- **Buttons:** height 48 (`--tap`), radius 8, UPPERCASE in EN.
  - Primary = `--brand` fill.
  - Secondary = `--info` fill.
  - Outline = brand 1.5px border.
  - Danger (`--bad`) only for SOS and cancel actions.
  - Use at most one primary button per screen.
- **Icon-tile button** (sut.edu.eg signature): a label followed by a 44px coral tile with an arrow, radius 4. On hover the tile turns `--ink`.
- **Status chips:** pill, `-soft` background, `-ink` text, with a 7px dot. The dot pulses for "Live".
- **Trip card:** route name (h2), ETA as `--t-number` in brand, and a stop timeline. Stops are teal when done and coral (with a soft ring) for the current one.
- **Transport pass:** `--grad-brand` with `pattern.svg` overlay, radius 20, `--shadow-md`, QR in a white frame.
- **Map:** your route = `--map-route` (purple, 7px); other lines = teal dotted; live bus = coral pin. Overlays use `--glass` with `--blur-glass`.
- **Bottom nav:** 4 items max. The active item gets a brand-soft pill behind its icon.
- **Pattern:** use `assets/pattern.svg` (the 3 logo shapes at 8 % white) only on brand-coloured surfaces: splash, pass, headers, empty states. Never on white.
- **Logo:** follow the manual. Never rotate, flip, recolour or stretch it, or change the symbol-to-wordmark spacing. Use the colour mark on white or light surfaces, and `sutech-mark-white.svg` on purple, teal, dark-mode or photo backgrounds (the purple shape disappears on purple and dark backgrounds otherwise).

### More components (v1.1)
- **App bar:** height 56 (`--appbar-h`). Inner screens use a `--surface` bar with back + title + up to 2 icon buttons (44px, round hover). Home uses `--grad-brand` with the **white** mark.
- **Lists:** rows are at least 64px with a 40px tinted icon tile (`brand-soft` / `info-soft` / `accent-soft`). Title is 16/600, subtitle 14 muted. Trailing slot holds a chip, a chevron (`.flip` in RTL) or a value. Section headers use the eyebrow style.
- **Switch:** 48×28, brand when on. **Checkbox / radio:** 22px, radius 6 / round, brand when checked. Labels are always clickable and the whole row is at least 48px tall.
- **Form states:** default border `--line-strong`. Focus: `--focus` border + 3px `--info-soft` ring. Error: `--bad` border + `--bad-ink` help text with a `circle-alert` icon. Help text is 12px muted. Phone/ID inputs use `dir="ltr"` in Arabic.
- **Toast:** `--ink` background, `--surface` text, success icon `--ok`, optional single action, auto-hides after 4s. Sits above the bottom nav (`--z-toast`).
- **Banner:** inline and persistent; `warn` / `info` / `bad` soft background with `-ink` text. Use it for delays, route changes and offline mode.
- **Dialog:** only for destructive or irreversible confirmation. Radius 20, `--shadow-lg`, backdrop `--scrim`; the safe action is a ghost button and the destructive one is danger.
- **Bottom sheet:** radius 20 on top, grabber 40×4, max-width 560, slides up in 400ms. Use it for seat choice, stop choice and trip actions.
- **Skeleton:** `--skeleton` → `--skeleton-hi` shimmer (1.4s). Keep the same shapes as the real card and set `aria-busy="true"` on the container.
- **Empty / error state:** a 120px round tint (`brand-soft` / `bad-soft`) holding a 44px Lucide icon, an h2 title, one line of muted text and one button.

### Admin dashboard (desktop)
- **Layout:** sidebar `--sidebar-w` 248px on `--surface` with an end border. The active item is `brand-soft` + brand text; the incidents count is a `--bad` pill. Under 900px the sidebar hides and the content stacks.
- **Top row:** h1 title, then Export (outline) + primary action at 40px height.
- **Filters:** a search field (max 320px) plus filter chips (36px, pill; the active one is `brand-soft`).
- **KPI tiles:** caption + icon, `--t-number` value, trend in `ok-ink` / `bad-ink`.
- **Charts:** plain SVG or any chart library, coloured only with `--chart-1 … --chart-5`:
  - Order: purple, teal, coral, purple-60, gray (dark mode lifts them to purple-40, teal-40, coral-60, purple-20, gray-20). Every series is at least 3:1 against the card background.
  - Grid lines use `--chart-grid` and axis labels `--chart-axis`.
  - Targets are a dashed `--chart-3` line, and area fills use series colour at 10%.
- **Table:** header row on `--surface-2` with 12px bold muted labels. Rows are 14px, hover `--surface-2`. Numbers are right-aligned with tabular figures. Status uses the chips; occupancy is a 64×6 bar in `--info`. A pager sits at the bottom.

### Icons
- **Lucide** only (`lucide` / `lucide-react`). Stroke 2, round caps, `currentColor`.
- Sizes: 20px in buttons and lists, 24px in the app bar, bottom nav and icon grid, 44px in empty states.
- Flip directional icons (arrow-left/right, chevron-left/right) in RTL with `.flip` (`transform: scaleX(-1)`).
- Core set: `bus, bus-front, route, map-pin, navigation, locate-fixed, clock, calendar, ticket, id-card, qr-code, wallet, users, armchair, bell, bell-ring, triangle-alert, siren, settings, search, sliders-horizontal, circle-check, circle-alert, info, wifi-off, moon, sun, languages`.

### PWA icons & splash (`assets/pwa/`)
| File | Size | Use |
|---|---|---|
| `icon-512.png`, `icon-192.png` | 512, 192 | manifest `purpose: "any"`; mark at 70% on white |
| `icon-maskable-512.png`, `icon-maskable-192.png` | 512, 192 | manifest `purpose: "maskable"`; mark at 56% (inside the safe zone) |
| `apple-touch-icon.png` | 180 | iOS home screen |
| `favicon.svg`, `favicon-32.png` | vector, 32 | browser tab |
| `splash-light-1170x2532.png`, `splash-dark-1170x2532.png` | 1170×2532 | iOS startup image / in-app splash: mark + "SUtech Transport" + "Access the Future" |

Other mark files: `assets/sutech-mark.svg` (colour, for white or light backgrounds) and `assets/sutech-mark-white.svg` (for purple, teal, dark or photo backgrounds).
```json
{ "name": "SUtech Transport", "short_name": "SUtech Bus", "display": "standalone",
  "background_color": "#F7F7F7", "theme_color": "#58286E",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icon-maskable-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
    { "src": "/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" } ] }
```
```html
<meta name="theme-color" content="#58286E" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#16101A" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple-touch-icon.png">
```

## Hooking it into the PWA
```css
/* app/globals.css */
@import "../design-system/tokens.css";
```
```js
// tailwind.config.js
module.exports = { presets: [require('./design-system/tailwind.preset.js')], content: ['./app/**/*.{ts,tsx}'] };
```
Then use classes such as `bg-brand text-brand-on rounded-md shadow-md text-h2`. Dark mode and RTL come from the `<html>` attributes. For dark mode, Tailwind's `dark:` variant is not needed.

## Changes in v3 (8 Nov 2026, from the front end audit)

The app's `frontend/design/tokens.json` is the single source of truth; `tokens.css` here follows it.

- **Error/SOS red stays `#C62828`, not Elsewedy `#D71921`.** It is the clearer one: 5.6:1 on white and 4.5:1 on its soft tint, where `#D71921` gives 5.2:1 and 4.1:1 (fails AA on the SOS buttons).
- **Red text uses `--bad-ink`** (`#A61F1F` light, `#EF7A6E` dark), never `--bad` on `--bad-soft`.
- **Dark-mode brand is the 20 % tint `#BFA1CE`** (hover `#D6C4E0`). The 40 % tint `#A583B6` was 4.46:1 on `--brand-soft`.
- **Live-bus pin is coral** with a dark icon (`--on-accent`), as the map rule says.
- **`--qr-ink`** `#1F1A24`: QR modules are always dark on the white frame, in both themes.
- A unit test checks every text/background pair in both themes for 4.5:1.
