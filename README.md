# BRIXit

A geospatial data-collection platform where citizen scientists worldwide submit [BRIX](https://en.wikipedia.org/wiki/Brix) bionutrient measurements for food quality tracking. Users record refractometer readings at points of purchase, and the data feeds leaderboards, an interactive map, and brand/location rankings — all authenticated through BSV wallet identity.

> **Status:** Live at **[brixit.app](https://brixit.app)**. Functional end-to-end with wallet auth, data submission, leaderboards, map explorer, and admin moderation.

---

## How It Works

1. **Authenticate** with a BSV wallet (desktop extension or mobile QR scan)
2. **Submit** BRIX readings — pick a crop, brand, store, and score
3. **Explore** data on an interactive Mapbox map with store-level clustering
4. **Compare** brands and locations on normalized leaderboards
5. **Admin** users verify submissions and manage contributors

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + TypeScript, Vite, Tailwind CSS, shadcn/ui (Radix), React Query |
| Backend | Express, Prisma ORM, PostgreSQL (Docker) |
| Auth | BSV wallet-only — `@bsv/sdk` + `@bsv/auth-express-middleware` certificate verification |
| Maps | Mapbox GL JS + GeoNames reverse geocoding |
| Infra | Docker (frontend + backend), GitHub Actions CI |

### Notable Libraries

- `@bsv/wallet-relay` — wallet relay for mobile ↔ desktop login via QR
- `@bsv/wallet-helper` — server-side wallet operations
- `jose` — JWT signing/verification
- `multer` — file uploads for submission images
- `recharts` — charts and data visualization

---

## Architecture

```
┌─────────────┐       ┌──────────────────┐       ┌────────────┐
│   React UI  │──────▶│  Express Backend  │──────▶│ PostgreSQL │
│  (Vite)     │◀──────│  (Prisma ORM)     │◀──────│  (Docker)  │
└─────────────┘       └──────────────────┘       └────────────┘
       │                      │
       ▼                      ▼
   Mapbox GL            GeoNames API
                        BSV Network
```

- **Frontend** communicates with the Express API via REST + React Query for caching/pagination
- **Backend** handles auth (wallet certificate verification + JWT sessions), CRUD, leaderboard aggregation, and file uploads
- **Database** stores users, submissions, crops, brands, stores/locations — with SQL functions for leaderboard RPCs

---

## Getting Started

### Prerequisites

- Node.js v20+
- Docker Desktop (for PostgreSQL)
- A Mapbox access token
- A BSV wallet (browser extension or mobile app)

### 1. Clone and install

```bash
git clone https://github.com/bsv-blockchain-demos/brixit.git
cd brixit
npm install
cd backend && npm install && cd ..
```

### 2. Configure environment

```bash
cp .env.example .env
cp backend/.env.example backend/.env
```

#### Frontend (`/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | No | Backend URL (default: `http://localhost:3001`) |
| `VITE_MAPBOX_TOKEN` | Yes | Mapbox public access token |
| `VITE_SERVER_PUBLIC_KEY` | Yes | Backend wallet public key — must match `SERVER_PRIVATE_KEY` in backend |
| `VITE_CERT_TYPE` | No | Certificate type string (default: `Brixit Identity`) |

#### Backend (`/backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (Prisma) |
| `JWT_SECRET` | Yes | Secret for signing access tokens |
| `REFRESH_TOKEN_SECRET` | Yes | Secret for signing refresh tokens |
| `SERVER_PRIVATE_KEY` | Yes | Private key for the server wallet (certifier + nonce verification) |
| `GEONAMES_USERNAME` | Yes | GeoNames account for reverse geocoding |
| `AUTO_VERIFY_USER_ID` | No | System user ID for auto-verification (set by `create-superuser`) |
| `CORS_ORIGINS` | No | Allowed origins (default: `http://localhost:5173`) |
| `UPLOAD_DIR` | No | Upload directory (default: `./uploads`) |
| `MAX_FILE_SIZE_MB` | No | Max upload size in MB (default: `10`) |
| `PORT` | No | Server port (default: `3001`) |

### 3. Set up the database

```bash
npm run db:up                    # start Docker PostgreSQL
cd backend
npm run db:migrate               # apply Prisma migrations
npm run db:seed                  # load SQL functions and views
npm run db:data                  # load reference data (crops, brands, locations)
npm run create-superuser         # create system user, patches .env
cd ..
```

### 4. Run

```bash
# Terminal 1 — backend
npm run backend

# Terminal 2 — frontend
npm run dev
```

Frontend: `http://localhost:8080` | Backend: `http://localhost:3001` | Health check: `http://localhost:3001/health`

---

## Project Structure

```
brixit/
├── backend/                  # Express API server
│   ├── prisma/               # Schema, migrations, seed data
│   ├── src/
│   │   ├── routes/           # API route handlers
│   │   ├── middleware/       # Auth, CORS, rate limiting, logging
│   │   ├── utils/            # Geocoding, sanitization, email, OTP
│   │   ├── db/               # Prisma client
│   │   └── serverWallet.ts   # BSV server wallet setup
│   ├── docker-compose.yml    # PostgreSQL container
│   └── Dockerfile
├── src/                      # React frontend
│   ├── components/           # UI components by feature area
│   ├── contexts/             # Auth, location, filter state
│   ├── hooks/                # Custom React hooks
│   ├── pages/                # Route-level screens
│   ├── lib/                  # Helpers and utilities
│   ├── types/                # TypeScript definitions
│   └── data/                 # Static config and reference data
├── docs/                     # Extended documentation
├── Dockerfile                # Frontend production container
└── public/                   # Static assets
```

---

## Key Features

### Wallet Authentication
No passwords. Users authenticate with their BSV wallet, which issues a Mycelia identity certificate. The backend verifies the certificate, creates a JWT session, and supports mobile login via QR code relay.

### Data Submission
Contributors submit BRIX readings with crop type, brand, point of purchase, score, and optional photos. New brands and stores can be added inline. Submissions go through verification before appearing on public leaderboards.

### Interactive Map
Mapbox-powered explorer with store-level clustering, crop-type markers, and a detail panel. Supports "near me" centering and mobile-optimized bottom sheet navigation.

### Leaderboards
Normalized BRIX rankings by brand, crop, location, and contributor. Scores cascade from city → state → country when local data is sparse. Filters by country, crop, and store.

### Admin Tools
Admin users review submissions in a dedicated queue: verify, reject (a reversible soft-decline, kept for audit), or delete. They can also click any submission to inspect it in a detail modal, manage user roles (contributor/admin), and perform CRUD operations across all data tables with paginated search.

---

## API Overview

Full route documentation is in [`backend/README.md`](backend/README.md). Key groups:

| Group | Examples |
|-------|----------|
| Auth | `POST /api/auth/wallet-login`, `POST /api/auth/refresh`, `GET /api/auth/me` |
| Submissions | `GET /api/submissions`, `POST /api/submissions/create`, `GET /api/submissions/mine` |
| Leaderboards | `GET /api/leaderboards/brand`, `/crop`, `/location`, `/user` |
| Reference data | `GET /api/crops`, `GET /api/brands`, `GET /api/venues` |
| Admin | `POST /api/admin/roles/grant`, `POST /api/admin/submissions/:id/verify`, `POST /api/admin/submissions/:id/reject` |

---

## Docker

Both frontend and backend have Dockerfiles for containerized deployment.

```bash
# Frontend
docker build --build-arg VITE_API_URL=... --build-arg VITE_MAPBOX_TOKEN=... -t brixit-frontend .

# Backend
docker build -t brixit-backend ./backend
```

---

## Documentation

Extended docs in [`docs/`](docs/):

- [Design Perspective](docs/Design_Perspective.md) — user profiles, journeys, and design philosophy
- [Architecture](docs/Architecture.md) — system structure and component breakdown
- [Roadmap](docs/Roadmap.md) — known bugs, future work, and technical debt
- [AI Assistance](docs/AI_Assistance.md) — notes on the AI-assisted development workflow
- [Supabase](docs/Supabase.md) — legacy Supabase reference (database has since migrated to Prisma)

---

## Development History

This project was built iteratively with AI-assisted development tools (Lovable, Claude, ChatGPT, Gemini, Cursor) and has gone through several major phases:

1. **Lovable prototype** — initial React UI with Supabase for everything (auth, DB, edge functions)
2. **Backend migration** — replaced Supabase with Express + Prisma + Docker PostgreSQL
3. **Wallet authentication** — removed email/password entirely, switched to BSV wallet identity with certificate verification
4. **Mobile login** — added QR code relay for mobile wallet → desktop session handoff
5. **UI hardening** — leaderboard normalization, map clustering, mobile-first submission flow

Some early-phase code and documentation still references Supabase — the canonical backend is now Express/Prisma.
