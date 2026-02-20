# Brixit Backend

Express + Prisma + PostgreSQL backend for the Brixit brix data platform.

Authentication is wallet-only via BSV certificate verification — no email/password.

## Prerequisites

- [Node.js](https://nodejs.org/) v20+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for the local PostgreSQL container)

## Environment

Copy `.env.example` to `.env` and fill in the values before running any commands.

Key variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Prisma connection string (points to the Docker container) |
| `JWT_SECRET` | Secret used to sign access tokens |
| `REFRESH_TOKEN_SECRET` | Secret used to sign refresh tokens |
| `COMMONSOURCE_SERVER_KEY` | BSV public key for wallet certificate verification |
| `AUTO_VERIFY_USER_ID` | UUID of the system user (populated by `npm run create-superuser`) |

## First-time setup

Run these commands once after cloning:

```bash
# 1. Start the database (from the repo root or backend/)
npm run db:up

# 2. Apply Prisma migrations — creates all tables
npm run db:migrate

# 3. Load SQL functions and views (leaderboard RPCs, etc.)
npm run db:seed

# 4. Load reference data — crops, brands, store locations
npm run db:data

# 5. Create the system superuser and patch AUTO_VERIFY_USER_ID in .env
npm run create-superuser
```

## Running the app

Open three terminals:

```bash
# Terminal 1 — database
npm run db:up              # start Docker Postgres

# Terminal 2 — backend (from repo root)
npm run backend

# Terminal 3 — frontend (from repo root)
npm run dev
```

The backend will be available at `http://localhost:3001`.
Health check: `http://localhost:3001/api/health`

## NPM scripts

| Script | Description |
|---|---|
| `npm run dev` | Start backend in watch mode (tsx) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start` | Run compiled production build |
| `npm run db:up` | Start the Docker PostgreSQL container |
| `npm run db:down` | Stop the Docker PostgreSQL container |
| `npm run db:migrate` | Run pending Prisma migrations |
| `npm run db:seed` | Load SQL functions and views |
| `npm run db:data` | Load reference data (crops, brands, locations) |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:studio` | Open Prisma Studio (database GUI) |
| `npm run db:reset` | Reset the database and re-run all migrations |
| `npm run create-superuser` | Create the system user and patch `.env` |
| `npm run kill-port` | Kill whatever process is holding `$PORT` |

## API routes

| Method | Path | Auth |
|---|---|---|
| `POST` | `/api/auth/wallet-login` | — |
| `POST` | `/api/auth/refresh` | — |
| `POST` | `/api/auth/logout` | — |
| `GET` | `/api/auth/me` | required |
| `GET` | `/api/crops` | — |
| `GET` | `/api/crops/categories` | — |
| `GET` | `/api/crops/thresholds` | — |
| `GET` | `/api/crops/:name` | — |
| `GET` | `/api/brands` | — |
| `GET` | `/api/locations` | — |
| `GET` | `/api/submissions` | — |
| `GET` | `/api/submissions/count` | — |
| `GET` | `/api/submissions/bounds` | — |
| `GET` | `/api/submissions/mine` | required |
| `GET` | `/api/submissions/:id` | — |
| `POST` | `/api/submissions/create` | required + contributor |
| `DELETE` | `/api/submissions/:id` | required |
| `GET` | `/api/leaderboards/brand` | — |
| `GET` | `/api/leaderboards/crop` | — |
| `GET` | `/api/leaderboards/location` | — |
| `GET` | `/api/leaderboards/user` | — |
| `GET` | `/api/geonames` | — |
| `GET` | `/api/users/me` | required |
| `PUT` | `/api/users/me` | required |
| `GET` | `/api/admin/users` | admin |
| `GET` | `/api/admin/submissions/unverified` | admin |
| `POST` | `/api/admin/roles/grant` | admin |
| `POST` | `/api/admin/roles/revoke` | admin |
| `POST` | `/api/admin/submissions/:id/verify` | admin |
| `DELETE` | `/api/admin/submissions/:id` | admin |
| `POST` | `/api/upload` | required |

Uploaded files are served statically at `/uploads/<filename>`.
