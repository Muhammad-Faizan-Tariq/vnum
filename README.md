# VNum

A virtual phone number platform built as a **testing / assessment sandbox**: browse seeded demo inventory, run a complete checkout with *simulated* crypto payments, receive *simulated* SMS through a receive-only SMPP inbox (VNum has no send capability), and manage everything from an admin console.

> **Nothing here is real.** Numbers are seeded test data, payments are produced by a mock adapter (no funds, no blockchain, placeholder addresses), and incoming messages come from an in-app SMPP simulator. No real carrier, exchange or SMS network is contacted. SMTP/email is out of scope.

## Stack

Next.js 16 (App Router, `proxy.ts`) · React 19 · TypeScript (strict) · Tailwind CSS v4 · Lucide icons · Radix primitives (dropdown, dialog) · Sonner toasts · PostgreSQL (Neon in the cloud) via Prisma 7 + `@prisma/adapter-pg` · Zod · Playwright.

## Quick start

```bash
npm install
cp .env.example .env            # then adjust values if needed

npm run db:local                # terminal 1: real local Postgres on :54329 (embedded-postgres, no Docker)
npm run db:migrate              # terminal 2: apply migrations
npm run db:seed                 # idempotent demo data
npm run dev                     # http://localhost:3000
```

Demo accounts (seeded; shown on the sign-in page while `DEMO_MODE=true`):

| Role     | Email             | Password         |
| -------- | ----------------- | ---------------- |
| Customer | `demo@vnum.test`  | `Demo#Pass2025`  |
| Admin    | `admin@vnum.test` | `Admin#Demo2025` |

Override the seeded passwords with `SEED_DEMO_PASSWORD` / `SEED_ADMIN_PASSWORD` before the first seed. Other seeded customers (`priya.nair@…`, `tomas.berg@…`, `sam.whitfield@…`, and a suspended `lena.okafor@…`) use the customer password.

### Using Neon instead of the local database

Create a Neon project, copy the pooled connection string, and set it as `DATABASE_URL` (keep `?sslmode=require`). Then run `npm run db:migrate && npm run db:seed`. The app talks to Postgres through the standard `pg` driver, which works with Neon's pooled endpoint. If `DATABASE_URL` is missing or malformed, the app fails with an explicit configuration error instead of pretending to work.

## Environment variables

See [.env.example](.env.example). All are server-side; none are exposed to the browser.

| Variable                 | Required | Purpose                                                                                 |
| ------------------------ | -------- | --------------------------------------------------------------------------------------- |
| `DATABASE_URL`           | yes      | PostgreSQL connection string (Neon or local).                                           |
| `PAYMENT_WEBHOOK_SECRET` | yes      | HMAC-SHA256 secret (≥16 chars) that signs/verifies simulated payment callbacks.         |
| `SMPP_ENCRYPTION_KEY`    | for SMPP | 32-byte key (64 hex chars) encrypting stored SMPP vendor passwords. Same value for the web app and the worker. |
| `DEMO_MODE`              | no       | `true` (default) shows demo credentials on sign-in. Set `false` where real users sign in. |
| `SEED_ADMIN_PASSWORD`    | no       | Password for the seeded admin.                                                          |
| `SEED_DEMO_PASSWORD`     | no       | Password for the seeded customers.                                                      |

## Scripts

| Command                 | What it does                                                               |
| ----------------------- | -------------------------------------------------------------------------- |
| `npm run dev`           | Dev server.                                                                |
| `npm run build` / `start` | Production build / server.                                               |
| `npm run db:local`      | Start the local Postgres (dev DB `vnum_dev`, test DB `vnum_test`).         |
| `npm run db:migrate`    | `prisma migrate deploy`.                                                   |
| `npm run db:migrate:dev`| Create/apply a new migration during development.                           |
| `npm run db:seed`       | Idempotent seed (upserts on natural keys; never overwrites admin edits).   |
| `npm run db:reset`      | Drop, re-migrate and re-seed the database in `DATABASE_URL`.               |
| `npm run typecheck`     | `tsc --noEmit`.                                                            |
| `npm run lint`          | ESLint.                                                                    |
| `npm run test:e2e`      | Playwright suite (builds the app, recreates `vnum_test`, seeds, runs).     |
| `npm run test:report`   | Open the last Playwright HTML report.                                      |

## Testing

`npm run test:e2e` recreates an isolated `vnum_test` database, applies migrations, seeds it, builds and starts the app on port 3200 with test-only secrets, and runs the specs serially. If the local Postgres isn't already running, the test setup starts it (and stops it afterwards). Set `E2E_DEV=1` to use `next dev` instead of a production build. Tests never touch real services: weather is stubbed at the network layer where determinism matters, and payments/SMS/numbers are all simulated by design.

## Architecture

```
src/
  app/
    (marketing)/     public site: /, /pricing, /faq, /terms, /privacy, /contact
    (auth)/          /sign-in, /sign-up
    dashboard/       customer app (overview, numbers, checkout, orders, messages, payments, settings)
    admin/           admin console (overview, numbers, orders, users, payments, settings)
    api/             JSON route handlers: /api/admin/* (admin only), /api/payments/callback (signed webhook)
  components/        ui/ primitives, app shell, greeting card, customer/ + admin/ + marketing/ components
  server/            all business logic (no UI imports)
    auth/            sessions (opaque token, SHA-256 hashed in DB), bcrypt, requireUser/requireAdmin, API guard
    orders/          state machine (state.ts) + service (transactions, expiry, fulfilment)
    payments/        provider interface + mock adapter, callback verification, scenarios
    numbers/         provider interface + demo adapter, search queries
    messaging/       receive-only SMPP transport interface + simulator, inbound message service
    admin/           admin-only domain rules (number edit safety, user guards)
  proxy.ts           optimistic redirect for missing session cookie (not an authorization layer)
prisma/              schema, migrations (incl. partial unique indexes), idempotent seed
e2e/                 Playwright specs, global setup (isolated DB)
```

### Key decisions

- **Authorization is server-side and role comes from the database.** Sessions are random tokens in an HttpOnly, SameSite=Lax cookie; only the SHA-256 hash is stored. Every page calls `requireUser()`/`requireAdmin()` itself (layouts don't re-run on client navigation), every admin mutation is a route handler guarded by `authorizeApi(req, { admin: true })` with an origin check, and `proxy.ts` is only an early bounce.
- **Orders use an explicit state machine** (`server/orders/state.ts`): `PENDING_PAYMENT → PAID_SANDBOX → PROCESSING → COMPLETED`, with `CANCELLED`/`FAILED` exits. All changes go through `transitionOrder`, which validates the edge and uses a conditional update, so concurrent changes can't skip states.
- **No double-selling.** Three layers: an atomic `UPDATE … WHERE status = 'AVAILABLE'` reservation, a partial unique index allowing one live order per number, and a per-user idempotency key so repeated submits return the same order.
- **Payments are verified, not trusted.** The simulator emits provider-style events handled by the same code a real callback would use: HMAC signature check on the HTTP webhook, unique event ids (replays are no-ops), a row lock on the payment, amount verification (underpayment fails), expiry checks, and a one-pending-payment-per-order unique index.
- **Provider adapters.** `NumberProvider`, `PaymentProvider` and `SmppTransport` are interfaces; only demo/mock implementations ship. Provisioning, inventory and messaging are separate modules.
- **Themes** are a deliberate light and dark palette (CSS variables, oklch) applied by an inline head script before first paint, so there's no flash; the toggle persists the choice and otherwise follows the OS.
- **Greeting card** is client-rendered from the browser's real clock (no server/client mismatch). Weather comes from [Open-Meteo](https://open-meteo.com/) (no key). It asks for location only when you click "Use my location", rounds and stores the coordinates only in your browser, and otherwise uses a configurable default location (Admin → Settings). If weather can't be fetched the card says so.

## Receive-only SMPP (real protocol)

Besides the in-app simulator, VNum can bind to a real SMPP server as a **receiver** and store incoming SMS in the inbox of whoever owns the destination number. It cannot send.

1. **Vendors:** Admin → SMPP vendors → *Add vendor* (host, port, system ID, password). Passwords are AES-256-GCM encrypted with `SMPP_ENCRYPTION_KEY` and never shown again. The bind is always `bind_receiver`.
2. **Worker:** SMPP needs a long-lived TCP connection, which serverless hosting (Vercel) cannot keep open. Run the worker anywhere that stays on (a VPS, Railway, Fly.io, your machine) with the same `DATABASE_URL` and `SMPP_ENCRYPTION_KEY`:
   ```
   npm run smpp:worker
   ```
   It polls the database for vendor changes, reconnects with backoff, acknowledges every `deliver_sm`, and writes the link status you see in the admin page. If it isn't running, vendors show "Worker offline".
3. **Routing:** the PDU's destination address is matched to a number with a completed order; the message goes to that owner's inbox. Messages for numbers nobody owns are not stored (an activity-log entry records them).

**Trying it without a real vendor** (all local):
```
npm run smpp:sim       # fake SMSC on 127.0.0.1:2775 (system_id vnumtest / password testpass)
npm run smpp:worker    # in another terminal
# add a vendor in the admin UI: host 127.0.0.1, port 2775, vnumtest / testpass
npm run smpp:push -- +12065550153 "Your code is 123456" ACME-BANK
```
The simulator only accepts receiver binds. Use `127.0.0.1` rather than `localhost` (the simulator listens on IPv4 only).

## What would be needed for real integrations

- **Real payments:** implement `PaymentProvider` for a processor's *sandbox* (create-charge call, webhook signature scheme) and point its webhook at `/api/payments/callback` (or a new route using the same `handlePaymentEvent`). Needs sandbox API keys and a public webhook URL, none of which are available here. The mock adapter and all downstream verification logic stay as they are.
- **Real numbers:** implement `NumberProvider` against an aggregator/carrier API (reserve, activate, release) and import inventory with `provider = "<id>"`.
- **Real SMPP:** nothing to build. Add the vendor's host, port and credentials under Admin → SMPP vendors and run the worker. What's needed from the vendor is a receiver (RX) or transceiver account, their IP allow-listing of the worker's address, and numbers routed to your system ID.

## Known limitations

- No rate limiting or email verification/password reset (email is out of scope).
- Sessions are database-backed; expired rows aren't pruned automatically.
- Numbers outside the reserved fictional ranges used by the seed (US/CA 555-01xx, UK 07700 900xxx, DE 030 23125 xxx, FR 06 39 98 xx xx) are never generated, but admins can create any E.164 number; they remain simulated either way.
