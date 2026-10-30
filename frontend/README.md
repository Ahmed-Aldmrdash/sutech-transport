# SUtech Transport: front end

The PWA for students, parents, drivers and supervisors, and the admin dashboard. Arabic (right to left, the default) and English.

Built with Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4, next-intl, Zod, Leaflet and Serwist.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000/ar
```

No backend is needed. By default the app runs in **mock mode**: a mock server inside the browser (`lib/mock`) answers every API call with the same paths, roles, errors and shapes as the real FastAPI server. Its data is kept in the browser's localStorage. To start from fresh data, use "Reset demo data" in Settings.

### Demo accounts

The one-time code is always **4821**.

| Account | Who |
| --- | --- |
| `240102791` | Student without a subscription (books a seat) |
| `240102684` | Student with an active subscription |
| `parent-240102791` | Parent with two children |
| `driver` / `supervisor` | Crew of the Suez line |
| `admin` | Super admin (every admin page) |
| `transport`, `finance`, `clinic`, `affairs`, `secretary`, `abulhoul` | Each office sees only its own pages |

## Environment variables

| Variable | Default | Meaning |
| --- | --- | --- |
| `NEXT_PUBLIC_API_MODE` | `mock` | `live` talks to the FastAPI server |
| `NEXT_PUBLIC_API_BASE_URL` | empty (same origin) | FastAPI base URL in live mode |
| `NEXT_PUBLIC_WS_URL` | empty | WebSocket URL for live tracking and alerts |
| `NEXT_PUBLIC_INSTAPAY_ADDRESS` | demo placeholder in mock mode | InstaPay address shown to students |
| `NEXT_PUBLIC_BANK_ACCOUNT` | demo placeholder in mock mode | Bank account shown to students |

The InstaPay and bank details are placeholders. Finance must confirm the real values before launch. In live mode nothing is shown until they are set.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` then `npm run start` | Production build (the service worker only runs here) |
| `npm run typecheck` | TypeScript, strict |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (Vitest): time helpers, mock database, and that every translation key exists in both languages |
| `npm run e2e` | End-to-end tests (Playwright) on a phone and a desktop, against the production build. Run `npm run build` first |
| `npm run openapi` | Writes `openapi.json` from the endpoint definitions, for the Back End team |

## How the code is organised

- `app/[locale]/…`: routes only. Each area (`student`, `parent`, `driver`, `admin`) has a layout that keeps other roles out.
- `features/<name>/`: one folder per feature, with `api.ts` (endpoints), `schema.ts` (Zod types) and `components/`.
- `components/ui` and `components/layout`: shared building blocks.
- `lib/api`: `defineEndpoint`, `call()` (validates every response with Zod), and the `useApi` / `useMutation` hooks.
- `lib/mock`: the in-browser mock server (seed data, handlers, a simulated bus).
- `messages/ar.json`, `messages/en.json`: all text. A unit test fails if a key is missing in either language.

Each endpoint is defined once in its feature's `api.ts`. That one definition drives the client call, the mock server route and `openapi.json`, so the three cannot drift apart.

## Contract notes for the Back End team

- Login is two steps: `POST /api/v1/auth/otp {identifier}` sends the code, then `POST /api/v1/auth/login {identifier, code}` returns the token and the user.
- Errors are `{ code, message }`. The UI shows its own text for each `code`.
- Calls that create money or seats send an `Idempotency-Key` header.
- Every endpoint lists the roles it allows. The server must answer 403 to every other role, because the UI only hides screens.
