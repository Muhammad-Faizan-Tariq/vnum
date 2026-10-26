# Deploying VNum on a Hostinger VPS (Docker)

Everything runs on one server as a Docker Compose project called **`vnum-faizan`**:

| Container | What it does |
| --- | --- |
| `web` | The VNum website (Next.js). |
| `worker` | Receive-only SMPP worker: keeps a `bind_receiver` session open to every enabled vendor and stores incoming SMS in the owner's inbox. |
| `sim` | Built-in fake SMPP server for demos (never reachable from the internet). |
| `caddy` | Public entry point on ports 80/443; serves HTTPS automatically when you give it a domain. |
| `migrate` | Applies database migrations on every start, then exits. |

The database is **Neon** (external). Nothing on the server stores data except Caddy's certificates.

## 1. Prepare the server

You need a Hostinger **VPS** (shared web hosting cannot run this) and SSH access.

```bash
ssh root@179.197.249.22          # or the user you were given

# Docker (skip if Hostinger's "Ubuntu with Docker" template was used)
curl -fsSL https://get.docker.com | sh
docker --version && docker compose version

# Firewall: SSH + web only. Do NOT open 2775/2776.
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw enable
```

If the server already runs something on port 80/443, set `HTTP_PORT` / `HTTPS_PORT` in `.env` to free ports.

## 2. Get the code and configure it

```bash
git clone <your repository url> vnum-faizan
cd vnum-faizan
cp .env.docker.example .env
nano .env
```

Fill in `.env`:

- `DATABASE_URL`: your Neon connection string.
- `PAYMENT_WEBHOOK_SECRET` and `SMPP_ENCRYPTION_KEY`: generate each with
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` (or `openssl rand -hex 32`).
  **`SMPP_ENCRYPTION_KEY` must stay the same forever**, or saved SMPP passwords can no longer be decrypted. If you also run the site elsewhere (for example Vercel), use the same value there.
- `SITE_ADDRESS=:80` and `COOKIE_SECURE=false` for plain HTTP on the IP. With a domain pointing at the server, use `SITE_ADDRESS=your.domain.com` and `COOKIE_SECURE=true`.

## 3. Start it

```bash
docker compose up -d --build
docker compose ps                       # web should become "healthy"
docker compose run --rm seed   # first time only: demo accounts + numbers (safe to repeat)
```

Open `http://179.197.249.22` (or your domain). Demo logins are on the sign-in page while `DEMO_MODE=true`.

## 4. Connect an SMPP vendor

Sign in as the admin → **SMPP vendors** → **Add vendor**.

**Demo vendor (the built-in simulator):** host `sim`, port `2775`, system ID `vnumtest`, password `testpass`. Within a few seconds the status turns **Bound (receiver)**. Open the vendor and use **Send a test SMS**: it travels the real SMPP path (simulator → worker → inbox). Pick a number that a customer has bought (the form pre-fills one).

**The client's real vendor:** use the host, port, system ID and password the vendor gave you. Ask the vendor to:
1. allow the server's IP (`179.197.249.22`) if they restrict by IP;
2. give you a **receiver (RX) or transceiver** account (VNum only ever binds as a receiver);
3. route the client's numbers to that system ID.

The numbers must also exist in VNum (Admin → Numbers) and be bought by a customer, because messages are delivered to the owner of the destination number. Anything else is kept under the vendor's **Recent traffic** as "not routed".

**Testing with a real phone:** send an SMS from any phone to the number. If the vendor routes it, it shows up under the vendor's **Recent traffic** and in the owner's **Inbox (SMPP)** within seconds.

## 5. Everyday operations

```bash
docker compose logs -f worker           # see binds, deliveries, errors
docker compose logs -f web
docker compose restart worker
git pull && docker compose up -d --build    # deploy an update (migrations run automatically)
docker compose down                          # stop everything (data stays in Neon)
```

## 6. Automatic deploys (GitHub Actions)

`.github/workflows/ci-cd.yml` does three things:

- **Every push and pull request:** type-check, lint and build.
- **Pull requests:** also runs the Playwright end-to-end suite against a throwaway Postgres.
- **Every push to `main`** (after the checks pass): SSH into the server, `git reset --hard origin/main`, `docker compose up -d --build`, then wait for the website to report healthy. If it never does, the deploy fails and the log shows the container output.

One-time setup:

**On the server**, as root:

```bash
# A dedicated, non-root user that can run Docker
adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy

# SSH key pair for the pipeline (run on YOUR computer, not the server):
#   ssh-keygen -t ed25519 -f vnum_deploy -C "github-actions-vnum" -N ""
# Then put the PUBLIC half on the server:
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
echo "<contents of vnum_deploy.pub>" >> /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys && chmod 600 /home/deploy/.ssh/authorized_keys
```

Then, as the `deploy` user, do step 2 of this guide in `/home/deploy/vnum-faizan` (clone and create `.env`). The server must be able to `git pull`: for a private repository add a read-only **deploy key** (GitHub → repository → Settings → Deploy keys) generated on the server with `ssh-keygen -t ed25519`, and clone over SSH (`git@github.com:Muhammad-Faizan-Tariq/vnum.git`).

**In GitHub** → repository → Settings → Secrets and variables → Actions:

| Name | Type | Value |
| --- | --- | --- |
| `SERVER_HOST` | secret | `179.197.249.22` |
| `SERVER_USER` | secret | `deploy` |
| `SSH_PRIVATE_KEY` | secret | contents of the private file `vnum_deploy` |
| `SSH_KNOWN_HOSTS` | secret | output of `ssh-keyscan -p 22 179.197.249.22` (run from your computer) |
| `SERVER_PORT` | secret (optional) | only if SSH is not on port 22 |
| `APP_DIR` | variable (optional) | folder under the deploy user's home; defaults to `vnum-faizan` |

Pinning the host key in `SSH_KNOWN_HOSTS` means the pipeline refuses to deploy to any machine that isn't your server. The workflow's `production` environment can additionally require a manual approval (Settings → Environments) if you want a human to click before each deploy.

Never put the private key, `.env` values or passwords in the repository or in chat.

## 7. Before real users arrive

- Set `DEMO_MODE=false` and change the seeded demo passwords (or don't run the seed).
- Use a domain with HTTPS (`SITE_ADDRESS` + `COOKIE_SECURE=true`).
- Keep `.env` private; it holds the database URL and encryption key.
- The simulator is only for demos. Remove the `sim` service from `compose.yaml` once the real vendor is connected, if you don't want it running.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Can't sign in on `http://IP` | `COOKIE_SECURE` must be `false` without HTTPS. |
| Vendor shows **Worker offline** | The `worker` container isn't running: `docker compose ps`, `docker compose logs worker`. |
| Vendor **Failed: ESME_RINVPASWD / ESME_RINVSYSID** | Wrong password / system ID. |
| Vendor **Failed: ECONNREFUSED / ETIMEDOUT** | Wrong host/port, or the vendor hasn't allow-listed the server IP. |
| Cannot decrypt stored password | `SMPP_ENCRYPTION_KEY` changed; re-save the vendor's password. |
| Build fails fetching fonts | The server needs outbound internet during `docker compose build`. |
