# SUtech Transport — front end

The production PWA for SUtech university transport: students, parents, drivers and supervisors,
and every university office (transport, finance, clinic, student affairs, secretary general,
the bus company, super admin). One Next.js app, Arabic (RTL, default) and English, light and dark.

It runs today on an in-browser mock server. When the FastAPI server is ready, set
`NEXT_PUBLIC_API_MODE=live` and `NEXT_PUBLIC_API_BASE_URL`; screens do not change.

## Run it

Needs Node 22.12 or newer.

```bash
cd frontend
cp .env.example .env.local   # mock mode by default
npm install
npm run dev                  # http://localhost:3000 → /ar
```

Open `/ar` and sign in. In mock mode the sign-in screen has a **Demo accounts** list (one per
role) and every code is `4821`:

| Role                  | ID                      | Home                 |
| --------------------- | ----------------------- | -------------------- |
| Student               | `240102791`             | `/student`           |
| Parent                | `01098765432`           | `/parent`            |
| Driver / supervisor   | `DRV-1001` / `SUP-1001` | `/driver`            |
| Transportation office | `TRN-1001`              | `/admin`             |
| Finance               | `FIN-1001`              | `/admin/payments`    |
| Clinic                | `CLN-1001`              | `/admin/emergencies` |
| Student affairs       | `STA-1001`              | `/admin/violations`  |
| Secretary General     | `SGO-1001`              | `/admin/reports`     |
| Abu El Hol            | `BUS-1001`              | `/admin/bus-company` |
| Super admin           | `ADM-1001`              | `/admin`             |
| Disabled account      | `240100000`             | (refused)            |

While in mock mode, two developer pages are available:

- `/ar/ui` (or `/en/ui`): every base component in both languages and themes.
- `/ar/preview/<role>`: each role's real frame and menu, e.g. `/ar/preview/student`,
  `/en/preview/transport`, `/ar/preview/finance`.

Both return 404 in live mode.

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
7. One feature per branch and pull request, with clear commit messages.

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
- The session (token, `expires_at`, user) is kept in `localStorage` (`sut.session`) so it
  survives closing the app. It ends at `expires_at`, on any `401`, on sign-out, and in every
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

Then add `linesEndpoints` to `lib/api/registry.ts`, add `import "@/features/lines/mock"` to
`lib/api/mock/handlers.ts`, and run `npm run openapi`.

The contract, shared with the Back End team: everything under `/api/v1/`, `snake_case` fields,
ISO 8601 UTC times, money in integer piasters, errors as `{ code, message }`, and a bearer token
on every request except public ones. Responses are validated in both modes, so a mock or a server
that drifts from the schema fails loudly instead of showing wrong data.

## Brand assets

`public/brand/` and `public/icons/` are the official files from the team's
`05 - Design System/assets` folder (SUTech Brand Manual 2025). Fonts are Montserrat and Tajawal,
free stand-ins for Gilroy and AbdoMaster until the university provides the licensed files.
