# Contributing

Thanks for helping build the SUTech Transportation System. These are the few rules that keep
`main` clean and always working.

## Branches

- `main` is the **only long-lived branch** and is always green.
- Each task gets **one short branch** and **one pull request** into `main`.
- Delete the branch after it is merged. Please do not keep personal or old branches around.

## Before you open a pull request

Front end (`frontend/`):

```bash
npm run check   # types, lint, formatting, unused code, unit tests
npm run e2e     # end-to-end tests on a phone and a laptop viewport
```

Both must pass. GitHub Actions runs the same checks on every pull request, and a pull request
is merged only when CI is green.

AI assistant (`assistant/`): run `python test_bot.py` and say in the pull request whether the
answers got better or worse.

## Pull requests

- Keep each pull request about one thing, with a clear title.
- Say **what changed and why**, and add a screenshot for anything you can see on the screen.
- Arabic and English must change together: every new text goes into both
  `frontend/src/messages/ar.json` and `en.json`.
- A change to an endpoint goes into `frontend/openapi.json` (`npm run openapi`) and the
  [back end agreement](docs/backend-agreement/), in both languages.

## Data and secrets

- Never commit real student names, IDs or phone numbers. The demo data is made up, and a test
  fails if a real-looking phone number is added.
- Never commit API keys or `.env` files. Use `.env.example` to show which settings exist.

## Questions

Ask in the team group or open an issue, and tag the team leader.
