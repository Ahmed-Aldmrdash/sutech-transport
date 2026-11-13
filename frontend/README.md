# SUtech Transport — front end

The production PWA for SUtech university transport: students, parents, drivers and supervisors,
and every university office (transport, finance, clinic, student affairs, secretary general,
the bus company, super admin). One Next.js app, Arabic (RTL, default) and English, light and dark.

It runs today on an in-browser mock server. When the FastAPI server is ready, set
`NEXT_PUBLIC_API_MODE=live`, `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_MAP_TILE_URL`; screens
do not change. If uploaded files (receipts, documents, photos) are served from another domain
than the API (a storage bucket's signed links), list it in `NEXT_PUBLIC_FILE_ORIGINS` so the
Content-Security-Policy lets those images load. A production build refuses to start without
`NEXT_PUBLIC_API_MODE` (it never falls back to the mock), and a live production build refuses
to start without the API address or a map tile provider (OpenStreetMap's own servers are for
development only). See `.env.example`.

All names, IDs and phone numbers in the mock are made up (fake mobiles start `0100000`);
`src/lib/demo-data-privacy.test.ts` fails if a real-looking one is added.

## Run it

Needs Node 22.12 or newer.

```bash
cd frontend
cp .env.example .env.local   # mock mode by default
npm install
npm run dev                  # http://localhost:3000 → /ar
```

Open `/ar` and sign in with one of these mock accounts. Each request makes a new random code
(the old one stops working), and in mock mode the code step shows it in place of the SMS:

| Role                     | ID                      | Home                       |
| ------------------------ | ----------------------- | -------------------------- |
| Student (no booking)     | `240100101`             | `/student`                 |
| Student (subscribed)     | `240100102`             | `/student`                 |
| Parent                   | `01000002000`           | `/parent`                  |
| Parent (line 7 child)    | `01000002001`           | `/parent`                  |
| Driver / supervisor      | `DRV-1001` / `SUP-1001` | `/driver`                  |
| Transportation office    | `TRN-1001`              | `/admin`                   |
| Finance                  | `FIN-1001`              | `/admin/payments`          |
| Clinic                   | `CLN-1001`              | `/admin/emergencies`       |
| Student affairs          | `STA-1001`              | `/admin/violations`        |
| Secretary General        | `SGO-1001`              | `/admin/secretary-general` |
| Abu El Hol (bus company) | `BUS-1001`              | `/admin/bus-company`       |
| Super admin              | `ADM-1001`              | `/admin`                   |
| Disabled account         | `240100000`             | (refused)                  |

Each role lands on its own working page and its menu shows only the pages it may open. The only
page still marked "Coming soon" is the student's AI assistant (built by the AI team).

Student pages in mock mode:

- Bookings and receipts are kept in the browser (`localStorage`), so they survive a refresh.
- The mock finance office approves a receipt 20 seconds after it arrives. A reference number
  ending in `0000` is rejected instead, so you can see the rejected state.
- Only lines 5, 6, 9, 12 and 15 have free seats; every other bus is full.
- To start over, clear the site data in the browser.

Two developer pages (on in `npm run dev`; in a build only with `NEXT_PUBLIC_DEV_PAGES=true`):

- `/ar/ui` (or `/en/ui`): every base component in both languages and themes.
- `/ar/preview/<role>`: each role's real frame and menu, e.g. `/ar/preview/student`,
  `/en/preview/transport_admin`, `/ar/preview/finance`.

Both return 404 in live mode and in a normal production build.

## Scripts

| Command           | What it does                                                         |
| ----------------- | -------------------------------------------------------------------- |
| `npm run dev`     | Dev server (Turbopack). The service worker is off in dev.            |
| `npm run build`   | Production build, including the service worker.                      |
| `npm run check`   | Types, lint, formatting and unit tests: run before every push.       |
| `npm test`        | Unit and component tests (Vitest).                                   |
| `npm run e2e`     | Builds, starts and runs Playwright on a laptop and a phone viewport. |
| `npm run tokens`  | Regenerates `src/styles/tokens.css` from `design/tokens.json`.       |
| `npm run openapi` | Regenerates `openapi.json` (the contract for the Back End team).     |
| `npm run format`  | Prettier, with Tailwind class sorting.                               |

CI (`.github/workflows/frontend.yml`) runs `check` and `e2e` on every pull request.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind CSS 4 · next-intl · Zod 4 ·
Serwist (PWA) · lucide-react · Vitest + Testing Library · Playwright. Leaflet arrives with the
tracking pages.

## Folders

```
design/tokens.json        the design system's tokens, exported as is (source of truth)
openapi.json              generated API contract for the FastAPI team
src/
  app/[locale]/           thin pages only: they compose features
  app/serwist/            serves the service worker
  sw/sw.ts                the service worker (offline page, caching)
  features/<name>/        one folder per feature
    api.ts                its endpoints (defineEndpoint) + typed functions screens call
    schema.ts             Zod schemas: the shape of its data
    mock.ts               mock-server answers for its endpoints
    components/           its screens and parts
    *.test.ts(x)          its tests
  components/ui/          base components (buttons, fields, cards, tables, dialogs, toasts, …)
  components/layout/      app frame: sidebar, top bar, bottom bar, phone menu, switches
  components/brand/       official logo mark and pattern (never redrawn)
  i18n/                   locales, routing, locale-aware Link/router
  lib/api/                HTTP client, endpoint definitions, errors, mock server, OpenAPI
  lib/auth/roles.ts       the 11 roles
  lib/theme/              light/dark/device theme without a flash
  lib/format.ts           money (piasters), dates and times (always Cairo time)
  messages/ar.json, en.json
  styles/tokens.css       generated CSS variables, light + dark
e2e/                      Playwright tests
```

## Rules

1. One job per component; split it past ~150 lines.
2. Screens never call `fetch`. They call their feature's `api.ts`, which goes through
   `callEndpoint`.
3. No text in code: every string comes from `messages/ar.json` and `messages/en.json` (a test
   fails if the two files differ in keys or placeholders).
4. No magic values: statuses and kinds are `as const` objects (`Role.Student`,
   `ServiceStatus.Ok`).
5. Clear English names, no abbreviations.
6. Prettier formats, ESLint blocks mistakes (`npm run check` must be green).
7. `main` is the only long-lived branch. Each task gets one short branch and one pull request
   into `main`; the branch is deleted once it is merged.

Design rules that the code enforces:

- Only design-system colours exist as Tailwind classes (`bg-brand`, `text-ink-muted`,
  `bg-teal-soft`, …); Tailwind's default palette is switched off.
- Type scale: `text-display`, `text-h1` … `text-caption`, `text-numeric`. Arabic gets the
  `ar-*` sizes automatically through `:lang(ar)`.
- Logical properties only (`ms-`, `pe-`, `start-`, `end-`) so RTL and LTR share one layout.
  Directional icons flip with `rtl:-scale-x-100`.
- Every tappable control is at least 48px on phones; every control has the teal focus ring.
- Every screen has a loading state, an error state (`ErrorState`, with retry) and, for lists,
  an empty state (`EmptyState`).

## Sign-in and roles

- Two steps for every role (contract: `POST /auth/otp`, then `POST /auth/login`), then
  `GET /me` once per visit and `POST /auth/logout`. Code in `features/auth`.
- The session token never reaches the page: in live mode the server sets an HttpOnly, Secure
  cookie and every request uses `credentials: "include"`. The page keeps only `expires_at` and the
  user in `localStorage` (`sut.session`), so the frame shows at once after closing the app; `GET /me`
  checks it with the server. Signing out also removes the person's saved picks (`sut.*` keys) and
  the service worker's caches. The service worker never caches `/api/` answers. It ends at `expires_at`, on any `401`, on sign-out, and in every
  open tab at once. An expired session returns the user to the page they were on after sign-in.
- `app/[locale]/(app)/` holds every signed-in page. `SignedInFrame` renders nothing until the
  session is read and `canOpen(role, path)` passes; any other role's page redirects to the user's
  own home. Office roles see only their own `/admin/*` pages; the super admin sees all of them.
  The server must still reject every request outside the caller's role.

## Adding an endpoint

```ts
// features/lines/schema.ts
export const lineSchema = z.object({
  line_id: z.string(),
  name: z.string(),
  price_piasters: z.number().int(),
});

// features/lines/api.ts
export const listLinesEndpoint = defineEndpoint({
  id: "lines.list",
  method: HttpMethod.Get,
  path: "/lines",
  summary: "Lines open for booking this term.",
  tag: "lines",
  access: [Role.Student, Role.Transport],
  response: z.array(lineSchema),
});
export const listLines = (options?: RequestOptions) => callEndpoint(listLinesEndpoint, {}, options);
export const linesEndpoints = [listLinesEndpoint];

// features/lines/mock.ts
registerMock(listLinesEndpoint, () => mockLines);
```

Then add `linesEndpoints` to `lib/api/registry.ts`, map each endpoint id to its feature in
`lib/api/mock/mock-routing.ts` (and the feature's loader in `lib/api/mock/handlers.ts`, if new),
and run `npm run openapi`. In mock mode the client loads only the mock of the feature it calls;
a test checks every endpoint is mapped.

The contract, shared with the Back End team: everything under `/api/v1/`, `snake_case` fields,
ISO 8601 UTC times, money in integer piasters, errors as `{ code, message }`, and the session cookie
on every request except public ones. `openapi.json` is the source of truth for fields. Responses are validated in both modes, so a mock or a server
that drifts from the schema fails loudly instead of showing wrong data.

## Brand assets

`public/brand/` and `public/icons/` are the official files from the team's
`05 - Design System/assets` folder (SUTech Brand Manual 2025). Fonts are Montserrat and Tajawal,
free stand-ins for Gilroy and AbdoMaster until the university provides the licensed files.
