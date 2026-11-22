# guided-i18n Radar (web)

The review UI for [guided-i18n-radar-api](https://github.com/lb0ss/guided-i18n-radar-api): React,
TypeScript, Vite, Tailwind and TanStack Query, with API types generated from the API's OpenAPI schema.

| Screen | What it's for |
|---|---|
| **Digest** | Stats with trends, new comments on your posts, threads worth a reply, Check now / Research now |
| **Review** | Threads worth a reply, comments on your posts, intel, **Draft a Reply** (paste a thread, pick which of your posts it's under), past drafts |
| **Run history** | Every run with its steps, timings, failures and cost |
| **Brief & schedule** | How often checks and research run, Run now, and the research brief |

Drafting always shows the estimated cost first and only runs after you confirm. Nothing is ever posted:
you copy the draft, post it yourself, then **Mark as posted** with the link, which keeps your final
text for calibrating the evaluator.

## Run it

The API serves the built app, so normally you just open **http://127.0.0.1:8000** (the API starts at
login; see the API repo). After changing the UI:

```sh
pnpm install
pnpm build              # the API serves dist/ from ../guided-i18n-radar-web (or RADAR_WEB_DIST)
```

While developing, `pnpm dev` serves the app on http://localhost:5173 against the API on :8000.

```sh
pnpm api:types   # regenerate src/api/schema.d.ts from the running API
pnpm test        # vitest
pnpm lint && pnpm typecheck
```

Needs Node 20.19+.
