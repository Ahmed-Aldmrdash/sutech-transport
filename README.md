# SUtech Transport

The university transport system for **SUtech (Elsewedy University of Technology)**. It serves
students, parents, drivers and bus supervisors, and every university office involved: transport,
finance, clinic, student affairs, the Secretary General, the bus company (Abu El Hol) and a super
admin. It is one installable web app (PWA) in Arabic (default, RTL) and English, with light and
dark modes.

> **نظام مواصلات جامعة السويدي للتكنولوجيا.** الطالب بيحجز ويدفع وبياخد كارنيه رقمي ويتابع
> الباص لايف، وولي الأمر بيوافق ويتابع، والسواق والمشرف بيسجلوا الرحلة والـ SOS، وكل مكتب في
> الجامعة ليه صفحاته. التطبيق واحد، عربي وإنجليزي، وبيتسطب على الموبايل.

## Status

| Part                    | State                                                                                                                                  |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Front end (`frontend/`) | Done for every role. Runs on an in-browser mock server, fully tested (see the [final test report](docs/reports/FINAL-TEST-REPORT.md)). |
| Back end (FastAPI)      | Next: built by the Back End team from the [API agreement](docs/backend-agreement/) and `frontend/openapi.json`.                        |
| AI assistant            | Built by the AI team; the student page shows "Coming soon" until then.                                                                 |

## Repository layout

```
frontend/              The production PWA (Next.js, TypeScript, Tailwind, next-intl)
  openapi.json         Every endpoint the front end calls: the contract for the back end
docs/
  backend-agreement/   Front end ↔ back end agreement (Arabic + English, kept in sync)
  design-system/       Colours, type, tokens and a live style guide (open style-guide.html)
  reports/             Test reports (Arabic)
index.html             The first clickable demo (static, kept for the public demo link)
.github/workflows/     CI: types, lint, format, unit tests, then build + end-to-end tests
```

## Run the front end

Needs Node 22.12 or newer.

```bash
cd frontend
cp .env.example .env.local   # mock mode: no back end needed
npm install
npm run dev                  # http://localhost:3000
```

Sign in with a demo account (the code appears on the screen in mock mode): student `240100102`,
parent `01000002001`, driver `DRV-1001`, transport office `TRN-1001`, super admin `ADM-1001`.
The full list, the rules and the architecture are in [frontend/README.md](frontend/README.md).

To judge speed, use a production build: `npm run build && npm run start`.

## For the Back End team

1. Read the [agreement](docs/backend-agreement/SUtech-Frontend-Backend-Agreement.en.md)
   ([بالعربي](docs/backend-agreement/SUtech-Frontend-Backend-Agreement.ar.md)).
2. Implement the endpoints in `frontend/openapi.json` (regenerate it with `npm run openapi`).
3. Point the app at your server: `NEXT_PUBLIC_API_MODE=live`,
   `NEXT_PUBLIC_API_BASE_URL=<your server>`, `NEXT_PUBLIC_MAP_TILE_URL=<map tiles>`.
   No screen changes are needed.
4. Section 5 of the [final test report](docs/reports/FINAL-TEST-REPORT.md) lists what the server
   must do (session cookie, roles, WebSocket, reports).

## How we work

- `main` is the only long-lived branch and is always green.
- Each task gets one short branch and one pull request into `main`. CI must pass before merging,
  and the branch is deleted after the merge.
- `npm run check` (types, lint, format, unused code, unit tests) and `npm run e2e` must pass
  locally before a pull request.
- All names, IDs and phone numbers in the demo data are made up; a test blocks real-looking ones.
