# Conflux

A self-hosted time-tracking and invoicing app (Harvest-style), built as a proof of concept.

## Getting started

```bash
npm install
cp .env.example .env
npx prisma migrate dev
npm run db:seed
npm run dev
```

Then open <http://localhost:3000>.

## Demo login

The seed creates one admin account (demo-only credentials, safe to publish):

- **Email:** `admin@conflux.test`
- **Password:** `conflux-demo`

## Scripts

- `npm run dev` — start the dev server
- `npm run build` / `npm run start` — production build and serve
- `npm run lint` — ESLint
- `npm run format` / `npm run format:md` — Prettier (write); `npm run lint:md` checks Markdown formatting
- `npm run db:seed` — (re)apply the demo seed; idempotent, safe to re-run

## Project docs

- [`docs/status.md`](docs/status.md) — where we are and what's next (read first)
- [`docs/requirements.md`](docs/requirements.md) — what we're building
- [`docs/architecture.md`](docs/architecture.md) — guardrails + decision log
- [`docs/plan.md`](docs/plan.md) — build plan (schema, milestones M0–M5)
- [`AGENTS.md`](AGENTS.md) — working conventions
