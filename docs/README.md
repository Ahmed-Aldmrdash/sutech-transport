# Documentation

Everything written for the SUTech Transportation System, in one place.
Most documents exist in **English** and **العربية**, kept in sync.

## Start here

| Document | Language | Who it is for |
| --- | --- | --- |
| [Project overview](../README.md) | [EN](../README.md) · [AR](../README.ar.md) | Everyone: what the system is, screenshots, team |
| [Front end guide](../frontend/README.md) | EN | Developers: run it, demo accounts, scripts, architecture |
| [AI assistant](../assistant/README.md) | EN | The Data & AI team |
| [Back end foundation](../mohamed-ali/backend/README.md) | EN | The Back End team: setup, migrations, conventions |
| [Contributing](../CONTRIBUTING.md) | EN | Anyone opening a pull request |

## For the Back End team

| Document | Language |
| --- | --- |
| Front end ↔ back end agreement: roles, every endpoint, live events, server rules, error codes | [EN](backend-agreement/SUtech-Frontend-Backend-Agreement.en.md) · [AR](backend-agreement/SUtech-Frontend-Backend-Agreement.ar.md) |
| Machine-readable API contract (OpenAPI 3) | [`frontend/openapi.json`](../frontend/openapi.json) |

## Design

| Document | Language |
| --- | --- |
| Design system: colours, type, spacing, components, based on the official SUTech brand manual | [EN](design-system/DESIGN-SYSTEM.md) · [AR](design-system/DESIGN-SYSTEM.ar.md) |
| Design tokens (CSS variables) | [`tokens.css`](design-system/tokens.css) |
| Live style guide (download and open in a browser) | [`style-guide.html`](design-system/style-guide.html) |
| Logo files (SVG + PNG) | [`assets/brand/`](assets/brand/) |

## Reports

| Report | Language |
| --- | --- |
| [Final front end test report](reports/FINAL-TEST-REPORT.md): every role on phone and laptop, what the server must do | AR |
| [User test report, round 2](reports/USER-TEST-REPORT-2.md) | AR |
| [Front end security review](reports/frontend-security-review.ar.pdf) (Cyber Security team) | AR |

## Folders

```
docs/
  assets/            Banner and logo (brand/)
  backend-agreement/ The API agreement with the Back End team
  design-system/     Design system, tokens, style guide
  reports/           Test and security reports
  screenshots/       App screenshots used in the READMEs
```
