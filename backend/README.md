# BRIXit Backend

Express API for BRIXit, the produce-reading platform. The backend stores readings, venues, users and reference data in PostgreSQL; verifies wallet identity and signed submissions; manages photos in S3; and anchors reading payloads through a server treasury wallet.

See the [project README](../README.md) for the application workflow, full environment reference and frontend setup.

## Requirements

- Node.js 22.12 or later on the Node 22 release line, or Node.js 24 and npm.
- PostgreSQL 16, available through the bundled Docker Compose service.
- A server wallet private key and access to its remote storage provider.
- S3 configuration for photos and a GeoNames account for location lookups when using those features.

[serverWallet.ts](src/serverWallet.ts) selects BSV mainnet and `https://store-us-1.bsvb.tech` in code. Startup waits for that wallet storage connection; blockchain writes require treasury funds.

## Local setup

Run from the repository root:

```sh
npm ci --prefix backend
cp backend/.env.example backend/.env
cd backend
```

Edit `.env`. For the bundled PostgreSQL service and frontend, use:

```dotenv
DATABASE_URL=postgresql://brixit:brixit_dev_password@localhost:5432/brixit
CORS_ORIGINS=http://localhost:8080
```

Set your own `JWT_SECRET`, `SERVER_PRIVATE_KEY` and `FLOAT_BALANCE_TOKEN`. The monitoring token must be at least 16 characters. Set certificate issuer/type values consistently with the frontend, and configure optional services as described in the root guide. Access and refresh tokens both use `JWT_SECRET`; there is no separate `REFRESH_TOKEN_SECRET` setting.

Prepare a fresh local database from `backend/`:

```sh
npm run db:up
node --env-file=.env node_modules/prisma/build/index.js migrate deploy
npm run db:generate
npm run db:seed
npm run db:data
node --env-file=.env --import tsx scripts/create-superuser.ts
```

The SQL seed command installs functions and views; the data command loads reference records. Both target the `brixit-postgres` container. For an external PostgreSQL instance, apply [prisma/seed.sql](prisma/seed.sql) and [prisma/data.sql](prisma/data.sql) to that database instead.

The server loads `.env` itself, but Prisma's datasource configuration and the system-user script read the process environment. The explicit `--env-file` commands above cover those cases.

The system-user script sets `AUTO_VERIFY_USER_ID`. That internal account records automatic verification; it does not grant your wallet account admin access. After signing in, an administrator can assign your account the appropriate role. For an isolated local database, the root guide explains using Prisma Studio.

```sh
npm run dev
```

The API listens on `http://localhost:3001` by default. `GET /health` reports liveness and `GET /ready` checks database readiness. Start the frontend separately from the repository root with `npm run dev`.

## Services and storage

| Area | Source |
| --- | --- |
| Route registration, relay and probes | [src/index.ts](src/index.ts) |
| Runtime settings | [src/config.ts](src/config.ts) |
| Session, reading, venue, moderation and treasury handlers | [src/routes/](src/routes/) |
| Schema and migrations | [prisma/](prisma/) |
| Signed payloads, transaction construction and wallet queue | [src/lib/](src/lib/) |

Images are uploaded directly to S3 through presigned URLs. There is no backend `/uploads` directory serving photos. Venue routes use `/api/venues`; the root guide contains a current API overview.

## Builds and tests

Run from `backend/`:

```sh
npm run build
npm start
```

`build` compiles TypeScript into `dist/`; generate the Prisma client first on a fresh checkout.

The Vitest suite includes `certifierSignFields.test.ts` and `formatSubmission.test.ts`, which import the real server wallet. For the other unit tests without initialising remote wallet storage:

```sh
npm test -- --exclude '**/certifierSignFields.test.ts' --exclude '**/formatSubmission.test.ts'
```

Review environment and wallet dependencies before running the complete `npm test` suite. Unit tests do not establish live database, photo-upload or blockchain compatibility.

## Containers

From the repository root:

```sh
docker compose -f backend/docker-compose.yml up -d --build
```

The entrypoint waits for PostgreSQL, applies migrations and seed SQL, prepares the system account and starts the API. `npm run db:up` from `backend/` starts only PostgreSQL; the root command with that name starts the full backend Compose stack.

Preserve the PostgreSQL volume and treasury key when updating an existing instance. `db:reset` resets the configured database and is only appropriate for disposable development data.

## Licence

**Open BSV Licence v6.** See [LICENSE.txt](../LICENSE.txt) for the full terms. The licence applies to this project's original code and documentation and restricts use to the BSV blockchain defined in the licence. Third-party code, assets and referenced standards retain their respective terms. The [country data](../src/data/countries.ts) retains its recorded upstream MIT attribution.
