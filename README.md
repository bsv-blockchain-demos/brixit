# BRIXit

BRIXit is a platform for collecting and comparing BRIX refractometer readings from produce. Contributors record measurements, brands and purchase venues; the application brings those readings together in a map, searchable data browser and leaderboards. BSV wallet identities authenticate contributors, and signed reading payloads are recorded on the BSV blockchain.

[Application](https://brixit.app) · [Repository](https://github.com/bsv-blockchain-demos/brixit)

## What the application does

- **Wallet sign-in:** connect a compatible BSV wallet directly or pair a mobile wallet through a QR code. Login accepts configured Mycelia Identity and BRIXit Identity certificates.
- **Reading collection:** submit multiple readings in one session, with crop, BRIX value, brand, dates, notes and optional photos. Select a nearby venue, register a community venue, or submit without one.
- **Data exploration:** browse and filter readings, switch to your own submissions, open individual reading details, and explore locations on a Mapbox map with clustered markers.
- **Comparison:** view crop, brand, venue and contributor leaderboards, including crop-normalised scores and geographic filters.
- **Reading management:** edit or delete your readings, correct rejected submissions and resubmit them, or retry a failed initial blockchain anchor.
- **Administration:** review submissions and venues, manage users and roles, edit reference data, and inspect treasury balances, funding options, activity and pending anchors.

The public site includes the landing page, map, information pages and wallet onboarding. The data browser, reading details, leaderboards, data entry, profile and settings require a session. The admin page additionally requires an admin role. API access rules are enforced separately from page access.

## Architecture

```mermaid
flowchart LR
    Wallet[BSV wallet] <--> UI[React application]
    Wallet <-->|Mobile pairing| Relay[Wallet relay]
    UI <-->|REST and JWT sessions| API[Express API]
    Relay <--> API
    UI --> Mapbox[Mapbox]
    UI <-->|Presigned image URLs| S3[AWS S3]
    API <--> DB[(PostgreSQL)]
    API --> S3
    API --> GeoNames[GeoNames]
    API --> Treasury[Server treasury wallet]
    Treasury <--> Storage[Remote wallet storage]
    Treasury --> BSV[BSV mainnet]
```

| Area | Implementation |
| --- | --- |
| Frontend | React 18, TypeScript, Vite 5, React Router 6, TanStack Query 5 |
| Interface | Tailwind CSS, shadcn/ui and Radix primitives, Recharts, Framer Motion |
| Maps and locations | Mapbox GL JS, GeoNames proxy, PostgreSQL venue records |
| Backend | Express 4, Prisma 7 with the PostgreSQL driver adapter, PostgreSQL 16 |
| Identity | BSV SDK, certificate authentication middleware, wallet relay, JWT access tokens and refresh cookies |
| Blockchain | Wallet Toolbox server wallet, signed PushDrop outputs, serialised wallet operations |
| Images | Direct browser uploads to S3 using presigned URLs; image metadata in PostgreSQL |
| Checks and packaging | Vitest, Playwright, ESLint, Docker, GitHub Actions |

PostgreSQL holds application records and supplies the SQL functions used by leaderboards. The backend is Express and Prisma; remaining Supabase-named types and documents are historical artefacts.

### Reading lifecycle

1. The frontend builds a canonical payload for each reading and asks the contributor's wallet to sign it. The payload includes the measurement, crop, brand, notes, dates and location fields.
2. The API validates the request and signatures, then saves the session's readings and contributor statistics in one database transaction.
3. Readings below the crop's poor threshold or above 120% of its excellent threshold are left unverified. Other readings are automatically verified. Administrators can subsequently verify or reject submissions.
4. After the database transaction commits, the backend queues a treasury-funded blockchain transaction with one PushDrop output per reading. Outputs include the payload, contributor identity and signature, and a server signature.
5. Successful anchors store an outpoint on the reading. An anchor failure leaves the database record available and records a failure state. Wallet work is queued in memory; pending anchors are visible to administrators, and owners can explicitly retry an initial anchor. There is no automatic retry worker.

Signed edits can replace a previous anchor and link to its transaction. Deleting an anchored reading spends its output; historical transactions remain on-chain. Rejection is a separate moderation state that retains the reading and a reason. Resubmission requires a change to the rejected reading before it returns to review.

## Local development

### Requirements

- Node.js 22.12+ on the Node 22 release line, or Node.js 24+, and npm. Prisma 7 requires a compatible Node version.
- Docker with Compose for the bundled PostgreSQL service, or an existing PostgreSQL database.
- A Mapbox public token for map rendering.
- A compatible BSV wallet for real authentication and signing.
- A server wallet private key and access to its remote storage provider. Blockchain operations also need a funded treasury.
- AWS S3 configuration for photos and a GeoNames username for location lookups.

The server wallet currently selects **BSV mainnet** and `https://store-us-1.bsvb.tech` in [`backend/src/serverWallet.ts`](backend/src/serverWallet.ts). These are code constants, not environment settings. Backend startup waits for remote wallet storage to become available.

### 1. Install dependencies

```bash
git clone https://github.com/bsv-blockchain-demos/brixit.git
cd brixit
npm ci
npm ci --prefix backend
cp .env.example .env
cp backend/.env.example backend/.env
```

### 2. Configure the application

Edit the copied environment files. For the bundled database and the default Vite port, set these values in `backend/.env`:

```dotenv
DATABASE_URL=postgresql://brixit:brixit_dev_password@localhost:5432/brixit
CORS_ORIGINS=http://localhost:8080
```

The example file contains placeholder database credentials and a CORS origin on port 5173; both need changing for this setup. Replace `JWT_SECRET`, `SERVER_PRIVATE_KEY` and `FLOAT_BALANCE_TOKEN` with your own values. The server private key is hex encoded. Put its corresponding public identity key in the frontend's `VITE_SERVER_PUBLIC_KEY`.

Generate random values for the JWT secret and monitoring token separately:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Frontend variables are embedded in the browser bundle. Keep private keys, JWT secrets and AWS credentials in the backend environment only.

### 3. Prepare PostgreSQL

Start only the database service while running the backend locally:

```bash
npm run db:up --prefix backend
cd backend
node --env-file=.env node_modules/prisma/build/index.js migrate deploy
npm run db:generate
npm run db:seed
npm run db:data
node --env-file=.env --import tsx scripts/create-superuser.ts
cd ..
```

`migrate deploy` applies the checked-in migrations. `db:seed` installs SQL functions and views, and `db:data` loads the bundled reference data. Both SQL scripts target the `brixit-postgres` Docker container; for an external database, run the SQL files against that database instead.

The backend server loads `backend/.env` itself, but the Prisma configuration and superuser script read the process environment. The commands above use Node's `--env-file` explicitly where needed.

The superuser script creates an internal system account and patches `AUTO_VERIFY_USER_ID` in `backend/.env`. It does **not** grant your wallet account admin access. For a fresh local database, sign in once to create your contributor account, then use Prisma Studio to add an `admin` role to that user's `UserRole` record:

```bash
cd backend
node --env-file=.env node_modules/prisma/build/index.js studio
```

### 4. Start the services

From the repository root, run these in separate terminals:

```bash
npm run backend
```

```bash
npm run dev
```

| Service | Local URL |
| --- | --- |
| Frontend | `http://localhost:8080` |
| Backend | `http://localhost:3001` |
| Liveness | `http://localhost:3001/health` |
| Database readiness | `http://localhost:3001/ready` |

For mobile pairing, set `ORIGIN` to the backend HTTP address reachable from the phone and `RELAY_URL` to its WebSocket address. For example, use `http://192.168.1.10:3001` and `ws://192.168.1.10:3001`. Include the frontend's LAN origin in `CORS_ORIGINS`, and set `VITE_API_URL` to a reachable backend address when opening the frontend on the phone.

### Frontend-only preview

For interface work without a wallet or backend, enable these in the root `.env`:

```dotenv
VITE_DEV_AUTH=1
VITE_DEV_AUTH_ROLE=admin
VITE_DEV_MOCK_DATA=1
```

Run `npm run dev` and open `/data`. The auth flag creates a local mock session; the mock-data flag supplies generated readings to the data browser. Other API-backed features can still show errors or empty states. These flags are guarded by `import.meta.env.DEV` and are disabled in production builds.

## Environment reference

### Frontend

See [`.env.example`](.env.example).

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | Backend base URL; defaults to `http://localhost:3001`. |
| `VITE_MAPBOX_TOKEN` | Public Mapbox token. `VITE_MAPBOX_ACCESS_TOKEN` is also accepted. |
| `VITE_SERVER_PUBLIC_KEY` | Public identity key corresponding to the backend's `SERVER_PRIVATE_KEY`. |
| `VITE_CERT_TYPE` | BRIXit certificate type; defaults to `Brixit Identity`. Match backend `CERT_TYPE`. |
| `VITE_MYCELIA_CERTIFIER` | Accepted Mycelia certifier public key. Match backend `MYCELIA_CERTIFIER`. |
| `VITE_MYCELIA_CERT_TYPE` | Mycelia certificate type; defaults to `Mycelia Identity`. Match the backend. |
| `VITE_DEV_AUTH` | Set to `1` for a development mock session. |
| `VITE_DEV_AUTH_ROLE` | Mock role: `admin`, `contributor` or `user`; defaults to `admin`. |
| `VITE_DEV_MOCK_DATA` | Set to `1` for generated data-browser readings in development. |

Set the Mycelia certifier explicitly on both sides. The example environment files contain a different key from the fallback compiled into the source.

### Backend

See [`backend/.env.example`](backend/.env.example) and [`backend/src/config.ts`](backend/src/config.ts).

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string. |
| `JWT_SECRET` | Signs access and refresh tokens. Startup rejects an absent secret or the example placeholder. |
| `JWT_ACCESS_EXPIRY`, `JWT_REFRESH_EXPIRY` | Token lifetimes; defaults are `1h` and `7d`. |
| `SERVER_PRIVATE_KEY` | Hex private key for the server wallet, certificates and treasury operations. |
| `CERT_TYPE` | BRIXit certificate type; defaults to `Brixit Identity`. |
| `MYCELIA_CERTIFIER`, `MYCELIA_CERT_TYPE` | Additional trusted certificate issuer and type. |
| `CORS_ORIGINS` | Comma-separated frontend origins. Set `http://localhost:8080` for local Vite. |
| `PORT`, `NODE_ENV` | Server port and environment; defaults are `3001` and `development`. |
| `ORIGIN` | Backend HTTP(S) URL embedded in wallet pairing links. |
| `RELAY_URL` | WebSocket URL reachable by the paired wallet. |
| `RELAY_SCHEMA` | Wallet deep-link scheme; defaults to `mycelia-app`. |
| `AUTO_VERIFY_USER_ID` | System account recorded as the automatic verifier. |
| `GEONAMES_USERNAME` | GeoNames account used by the location proxy. |
| `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET` | S3 image storage configuration. Required when using image endpoints. |
| `MAX_FILE_SIZE_MB` | Configuration hint, default `10`; the upload route currently enforces a fixed 10 MiB cap. |
| `FLOAT_BALANCE_TOKEN` | Required bearer token, at least 16 characters, for `GET /treasury/balance`. |

The OTP email utility currently logs codes to the backend console. The commented SMTP variables in the example file do not enable email delivery; a provider integration is still needed.

### Image storage

The browser requests a presigned upload URL, sends the file directly to S3, then finalises the image attachment through the API. Read URLs are also presigned. Configure bucket CORS to allow the frontend origin and the required upload headers and methods, and give the backend credentials access to read, write and delete submission image objects.

Supported upload extensions are JPEG, PNG, GIF, WebP, HEIC and HEIF. Photos are stored in S3 under `submission-images/`; the backend does not serve a local uploads directory.

## Routes and API

The route registrations in [`backend/src/index.ts`](backend/src/index.ts) and handlers in [`backend/src/routes/`](backend/src/routes/) are the API reference.

| Area | Representative endpoints |
| --- | --- |
| Sessions | `POST /api/auth/wallet-login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me` |
| Onboarding | `POST /api/auth/send-otp`, `POST /api/auth/verify-otp`, `POST /api/certifier/signCertificate` |
| Wallet pairing | `/api/session`, `/api/session/:id`, `/api/request/:id`, WebSocket `/ws` |
| Reference data | `GET /api/crops`, `GET /api/crops/categories`, `GET /api/crops/thresholds`, `GET /api/brands`, `GET /api/venues`, `GET /api/venues/nearby`, `POST /api/venues` |
| Readings | `GET /api/submissions`, `GET /api/submissions/:id`, `GET /api/submissions/mine`, `POST /api/submissions/create` |
| Reading changes | `PUT /api/submissions/:id`, `DELETE /api/submissions/:id`, `POST /api/submissions/:id/resubmit`, `POST /api/submissions/:id/retry-anchor` |
| Rankings | `GET /api/leaderboards/brand`, `/api/leaderboards/crop`, `/api/leaderboards/location`, `/api/leaderboards/user` |
| Maps and geocoding | `GET /api/map-preview`, `GET /api/geonames` |
| Profile | `GET /api/users/me`, `PUT /api/users/me` |
| Photos | `POST /api/upload/presigned-url`, `POST /api/upload/finalize`, `DELETE /api/upload/delete`, `POST /api/images` |
| Moderation | `/api/admin/users`, `/api/admin/submissions`, `/api/admin/roles/grant`, `/api/admin/roles/revoke`, `/api/admin/submissions/:id/verify`, `/api/admin/submissions/:id/reject` |
| Reference administration | `/api/admin/crud/crops`, `/api/admin/crud/brands`, `/api/admin/crud/venues`, `/api/admin/crud/categories` |
| Treasury administration | `/api/admin/wallet/balance`, `/api/admin/wallet/info`, `/api/admin/wallet/activity`, `/api/admin/wallet/pending`, `/api/admin/wallet/topup/internalize`, `/api/admin/wallet/topup/sweep` |
| Operational probes | `GET /health`, `GET /ready`, bearer-protected `GET /treasury/balance` |

Public data endpoints coexist with authenticated contributor and admin operations. Reading mutations enforce ownership or the applicable role. The frontend API client handles token refresh and tunnels PUT/DELETE requests through POST with `X-Brixit-Method` for proxy compatibility.

Frontend routes are defined in [`src/App.tsx`](src/App.tsx). `/login` redirects to `/`, preserving query parameters; `/my-data` redirects to `/data?scope=mine`.

## Development commands and checks

Run from the repository root unless stated otherwise:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Vite on port 8080. |
| `npm run backend` | Start the API with file watching. |
| `npm run build` | Build the frontend into `dist/`. |
| `npm run build --prefix backend` | Compile the backend into `backend/dist/`. |
| `npm run preview` | Serve the built frontend locally. |
| `npm start --prefix backend` | Run the compiled backend. |
| `npm run lint` | Run ESLint. |
| `npm test` | Run frontend Vitest tests. |
| `npm test --prefix backend` | Run backend Vitest tests. |
| `npm run test:watch` | Watch frontend unit tests; add `--prefix backend` for backend tests. |
| `npm run test:e2e` | Run Playwright browser tests. |
| `npm run test:e2e:ui` | Open the Playwright test interface. |
| `npm run db:down --prefix backend` | Stop the Compose services, retaining the database volume. |

Install Chromium before the first browser test run:

```bash
npx playwright install chromium
npm run test:e2e
```

Playwright starts or reuses the frontend on port 8080 and currently runs Chromium only. Its fixtures mock authentication and API responses; this suite does not validate live wallet, S3 or blockchain integrations. Unit tests cover areas including payload signing, certificate selection, filters, scoring, transaction construction and wallet queue behaviour.

When changing the database schema, use Prisma's `migrate dev` command from `backend/` with `DATABASE_URL` loaded, commit the resulting migration, and regenerate the client. Changes to leaderboard SQL also require reapplying `prisma/seed.sql`.

## Containers and deployment

To run PostgreSQL and the backend together after configuring `backend/.env`:

```bash
docker compose -f backend/docker-compose.yml up -d --build
```

The root `npm run db:up` starts this same full Compose stack. Use `npm run db:up --prefix backend` when you want only PostgreSQL.

The backend container entrypoint waits for PostgreSQL, applies migrations, loads SQL functions and reference data, ensures the system account, and starts the API on port 3001. Compose overrides its database URL to use the `postgres` service hostname.

Build the frontend separately, substituting your public deployment values:

```bash
docker build \
  --build-arg VITE_API_URL=https://api.example.com \
  --build-arg VITE_MAPBOX_TOKEN=your_public_mapbox_token \
  --build-arg VITE_SERVER_PUBLIC_KEY=your_server_public_key \
  --build-arg 'VITE_CERT_TYPE=Brixit Identity' \
  -t brixit-frontend .
docker run --rm -p 3000:3000 brixit-frontend
```

The frontend image serves the SPA on port 3000 with route fallback. Its configuration is fixed at build time. The current Dockerfile exposes only the four build arguments above; custom Mycelia certificate settings require adding the corresponding build arguments and environment assignments, or building with Vite outside that Dockerfile.

Deployments need matching certificate settings, frontend CORS origins, HTTPS/WSS relay addresses and S3 bucket configuration. A reverse proxy must forward WebSocket upgrades for `/ws`.

GitHub Actions builds frontend and backend images for `linux/amd64` and `linux/arm64`. Pushes to `master`, `v*` tags and manual runs publish to `ghcr.io/bsv-blockchain-demos/brixit-frontend` and `ghcr.io/bsv-blockchain-demos/brixit-backend`; pull requests build without publishing. A separate workflow runs Playwright and uploads its report.

## Repository layout

```text
src/
  components/       Feature components, shared controls and UI primitives
  contexts/         Authentication, wallets, filters and crop thresholds
  hooks/            Data queries, image URLs and anchor retry helpers
  lib/              API clients, signing, formatting and development mocks
  pages/            Route-level screens
backend/
  prisma/           Schema, migrations, SQL functions and reference data
  scripts/          Database and maintenance utilities
  src/routes/       REST handlers and operational probes
  src/lib/          Blockchain transactions, signatures, wallet queue and S3
  src/middleware/   Authentication, CORS, logging and error handling
  src/utils/        Validation, geocoding, rate limits and OTP utilities
  src/serverWallet.ts
  docker-compose.yml
  entrypoint.sh
tests/              Playwright tests and mock fixtures
public/             Static assets and standalone pages
docs/               Design notes and historical documentation
.github/workflows/  Container builds, browser tests and repository sync
```

The [design perspective](docs/Design_Perspective.md), [architecture notes](docs/Architecture.md), [roadmap](docs/Roadmap.md) and [venue registration plan](docs/venue-registration-plan.md) provide additional context. These documents and [`backend/README.md`](backend/README.md) may describe earlier implementations; use the current source, migrations and this setup guide when they differ.
