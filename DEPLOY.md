# نشر نظام كُتّاب مجانًا (Render + Postgres)

The whole app runs as **one free Render web service**: NestJS serves the REST API under
`/api/*` and the built React SPA on every other path, so there is no CORS setup and no
second service to pay for.

Free-tier facts worth knowing up front:

- A free Render service **sleeps after ~15 minutes without traffic**; the next request
  takes ~50 seconds to wake it. Everything after that is instant.
- Render's own free Postgres **expires after 30 days**, so use a provider whose free tier
  is permanent: **Neon** (recommended — auto-suspends and auto-resumes) or **Supabase**.
- The disk is ephemeral: nothing may be stored in SQLite in the cloud, which is why
  `DATABASE_URL` must point at Postgres. `backend/scripts/prepare-db.js` detects a
  `postgres://` URL at build time, flips the Prisma provider to `postgresql` and pushes
  the schema.

## 1. Create the database

1. Sign up at <https://neon.com> (free, no card) and create a project.
2. Copy the **pooled** connection string. It looks like:
   `postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require`

Supabase works too: use the connection pooler URI from
*Project settings → Database → Connection string*; the build script already rewrites its
`:6543`/`pgbouncer=true` pooler URL to the session port for the schema push.

## 2. Create the Render service

1. Push this repo to GitHub (`git push origin main`).
2. Go to <https://dashboard.render.com> → **New → Blueprint**, pick the repo.
   Render reads [`render.yaml`](render.yaml) and proposes a free web service named `kittab`.
3. Fill in the environment variables it asks for:
   - `DATABASE_URL` — the Postgres URL from step 1
   - `ADMIN_USERNAME` — login of the first account (e.g. `admin`)
   - `ADMIN_PASSWORD` — **set a real password**; without it the seed falls back to `123456`
4. Click **Apply**. The first build takes a few minutes (frontend build → backend build →
   `prisma db push`), then the app is live at `https://kittab.onrender.com`.

Without the blueprint, the equivalent manual settings are:

| Setting | Value |
| --- | --- |
| Runtime | Node |
| Build command | `cd frontend && npm ci --include=dev && npm run build && cd ../backend && npm ci --include=dev && npm run build` |
| Start command | `cd backend && npm run start:prod` |
| Health check path | `/api/health` |

## 3. First login

The backend seeds one account on an empty database: `ADMIN_USERNAME` / `ADMIN_PASSWORD`
(role «مشرف عام»). Add the rest of the مشايخ from inside the app, in صفحة المشايخ.

## Security before sharing the link

The API was written for a LAN/desktop deployment and is **not yet safe on the open
internet**: `/api/students`, `/api/settings` and most of `/api/sheikhs` have no auth at
all, and the session token is just `shk_<id>`, so anyone can send
`Authorization: Bearer shk_1` and act as the admin. Treat the Render URL as private until
real authentication (hashed-session or JWT + guards) is in place.

## Local development is unchanged

- `npm run dev` at the repo root (backend + Vite + Electron). Vite now proxies `/api` to
  `http://127.0.0.1:39281`, so the browser at <http://localhost:5175> talks to the API.
- The desktop build still uses SQLite: leave `backend/.env` as `DATABASE_URL="file:./dev.db"`.
