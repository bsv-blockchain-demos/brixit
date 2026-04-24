# Venue Registration — Design Plan

**Status:** Draft for review  
**Author:** Kjartan / Claude  
**Date:** 2026-04-23

---

## Problem

When a user submits a BRIX reading at a location that has no Google Maps business label (farmers markets, farm stalls, home pickups, roadside stands), the resulting submission has no human-readable name. This means:

- The map side panel shows a raw address or nothing useful
- Submissions at the same physical place can't be grouped together
- There is no way for users to discover "the farm down the road has great produce"

Named chains (Aldi, Lidl, etc.) already have a `poi_name` / `business_name` from the Mapbox geocoder, so they surface a name today — but they currently flow through a separate `Place` + `Location` table structure, creating two parallel systems for the same concept.

---

## Goals

1. One table — `Venue` — as the single source of truth for where a submission happened
2. Let contributors name unlabelled places at submission time
3. Reuse community-registered names for the same location automatically
4. Auto-fill `posType` from the venue when it is known and trusted
5. Allow admins to correct venue metadata (name, posType) once and have it propagate to all linked submissions automatically via the FK join — no per-row rewrite needed
6. Allow admins to merge duplicate venue records later with a single ID swap
7. Keep the map clean — coordinates-only submissions opt out of map display

---

## Consolidated `Venue` model

Rather than maintaining `Place` (coordinate deduplication) and `Location` (chain store name) as separate tables that `Submission` links to, we replace both with a single `Venue` table. Every submission either links to a `Venue` or is explicitly skipped.

This gives us one FK to join on for name, posType, and coordinates — no conditional logic depending on which combination of Place/Location a submission has.

---

## Schema changes

### New table: `Venue`

```
id              String    @id @default(uuid())
name            String
posType         String?   -- Supermarket | Farmers Market | Farm Direct | Online | Other
type            String?   -- farm_stand | market_stall | home_pickup | other (community venues only)
latitude        Float
longitude       Float
verified        Boolean   @default(false)
createdByUserId String?   -- null = system (Mapbox-sourced); set = contributor who registered it
createdAt       DateTime  @default(now())
```

**`verified` flag behaviour:**

| Value | Meaning |
|-------|---------|
| `true` | Trusted — either system-created from Mapbox data, or a community venue that an admin has approved. `posType` is locked and auto-fills on new submissions. |
| `false` | Community-registered, pending admin review. `posType` is shown as a suggestion but the user can still change it at submission time. |

There is no separate `source` field. `createdByUserId = null` means the system created it (Mapbox origin). `createdByUserId` set to a user ID means a contributor registered it. Admins flip `verified` to `true` when they approve a community venue — at that point the distinction between "system" and "community" no longer matters, and there is no leftover flag to clean up.

**`type` field:** Describes the kind of unlabelled venue (farm stand, market stall, etc.). Only relevant for community-registered venues; system-created Mapbox venues leave this null.

### Changes to `Submission`

| Change | Detail |
|--------|--------|
| Remove `placeId` | Replaced by `venueId` |
| Remove `locationId` | Absorbed into `Venue` |
| Remove `posType` | Moved to `Venue.posType` — single source of truth. Skipped submissions (no venueId) record their posType directly on the row as an exception (see below). |
| Add `venueId String?` | FK → `Venue.id`. Null only when `skipVenuePrompt = true`. |
| Add `skipVenuePrompt Boolean @default(false)` | When `true`: no venue linked, submission excluded from map, `posType` stored on the submission row as it has nowhere else to go. |

**All four submission states:**

| Scenario | `venueId` | `skipVenuePrompt` | `posType` source | Map display |
|----------|-----------|-------------------|-----------------|-------------|
| Mapbox returned a business/POI name (e.g. Aldi) | set (system Venue) | `false` | `Venue.posType` (locked if verified) | ✅ |
| No Mapbox label — user selected or registered a venue | set (community Venue) | `false` | `Venue.posType` (suggestion if unverified) | ✅ |
| No Mapbox label — user chose "Skip" | `null` | `true` | `Submission.posType` (user must select) | ❌ |
| Legacy pre-feature submission | migrated to Venue (see below) | `false` | `Venue.posType` after migration | ✅ |

### Tables being dropped

- `Place` — fully replaced by `Venue`
- `Location` — fully replaced by `Venue`. Multiple Aldi branches become separate `Venue` rows each with their own coordinates. Chain-level grouping (all Aldis in one city) is a future leaderboard filter concern, not a schema concern.

---

## Migration plan

The app is not yet in production, so this can be done as a clean cut-over migration.

1. Create the `Venue` table
2. For each existing `Place` record: create a corresponding `Venue` row with `verified: true`, `createdByUserId: null` (system), and `posType` inferred from the most common `posType` among submissions at that place
3. For each existing `Location` record that has no corresponding Place (i.e. chain-level without a specific coordinate): decide per record — either assign approximate coordinates and create a Venue, or discard if no submissions reference it
4. Update each `Submission`: set `venueId` to the newly created Venue that corresponds to its old `placeId`
5. Drop `Place` and `Location` tables and their FK columns from `Submission`

---

## Trigger condition

The venue prompt in `DataEntry` appears **only** when both of the following are empty after a location is selected via the search:

- `session.business_name`
- `session.poi_name`

When either is present (Mapbox returned a label), no prompt is shown. The system Venue is created silently at submission time.

---

## `posType` behaviour

| Venue state | posType in UI |
|-------------|---------------|
| Venue is `verified: true` and has a `posType` | Auto-filled and locked — user cannot change it |
| Venue is `verified: false` and has a `posType` | Pre-filled as a suggestion — user can override |
| Venue has no `posType` yet | User selects as normal; their selection is written to `Venue.posType` if the venue has none yet |
| Skipped submission (no venue) | User must select; stored on `Submission.posType` directly |

When an admin corrects `Venue.posType` via the CRUD panel, the change is reflected everywhere automatically because `posType` is read from the venue join — no per-submission update required.

---

## New backend routes

### `GET /api/venues/nearby`

```
Query params: lat, lng, radius (default 100m)
Auth: none (public read)
Returns: top 2 venues by submission count within radius
         [{ id, name, type, posType, verified, submissionCount, distanceMetres }]
```

- Proximity: bounding-box pre-filter then Haversine for accuracy
- `submissionCount` = count of `Submission` rows with `venueId = venue.id`
- Sorted descending by `submissionCount`

### `POST /api/venues`

```
Auth: contributor+
Body: { name, type, posType, latitude, longitude }
Returns: { id, name, type, posType, verified, isExisting }
```

- Before creating, checks for a case-insensitive name match within 100m
- Match found → return existing record with `isExisting: true`, no duplicate written
- No match → create with `verified: false`, return with `isExisting: false`

### Changes to `POST /api/submissions/create`

Replaces the existing `brandName` / location fields with venue-aware fields:

| Field | Type | Behaviour |
|-------|------|-----------|
| `venueId` | `string \| null` | Link to an existing venue (selected from nearby list) |
| `newVenue` | `{ name, type, posType, latitude, longitude } \| null` | Create venue inline then link. Deduplicates as above. |
| `skipVenuePrompt` | `boolean` | No venue. Submission hidden from map. `posType` taken from `body.posType` directly. |

For Mapbox-labelled locations (no prompt shown): the route creates or finds a system Venue using `poi_name` / `business_name` + coordinates, sets `verified: true`, and links it — all invisible to the user.

---

## Frontend changes — `DataEntry.tsx`

### New session fields

```typescript
venueId: string | null        // selected existing venue
skipVenuePrompt: boolean      // user chose "Skip"
pendingVenueName: string      // "Register new place" text input
pendingVenueType: string      // type chip selection
pendingVenuePosType: string   // posType chip (pre-filled from selection or user picks)
venueChoice: 'existing' | 'register' | 'skip' | null
```

### `posType` selector visibility

- Venue prompt **not** shown (Mapbox label present) and venue has a `posType`: field hidden, auto-filled
- Venue prompt shown and user selects an existing venue with `posType`: field hidden, auto-filled
- Venue prompt shown and user registers a new place: `posType` chips shown inside the "Register" panel
- Skipped: `posType` chips shown as normal (required)

### New component: `VenuePrompt`

Renders below the location search when trigger condition is met:

1. Calls `GET /api/venues/nearby` on mount with selected coordinates
2. Renders:
   - Up to 2 nearby venue options (name, distance, past entries count)
   - "Register a new place" — expands inline name input + type chips + posType chips
   - "Skip — coordinates only" — greyed, "Won't group on the map"
3. Reports selection back to `DataEntry` via `onSelect(choice)`

Mini-map preview: coordinate badge showing lat/lng is sufficient; static Mapbox image is a nice-to-have.

### Validation

- If venue prompt was shown: `venueChoice` must not be null
- If `venueChoice === 'register'`: `pendingVenueName` must not be empty
- If `venueChoice === 'skip'`: `posType` must be selected (stored on submission directly)

---

## Map behavior

- `skipVenuePrompt: true` submissions excluded from map query at the backend (`WHERE skip_venue_prompt = false`)
- All venue-linked submissions use `venue.name` as the display label in the side panel
- Clustering logic unchanged

---

## Data browser / leaderboard

No changes to visibility. Skipped submissions appear in all list and table views. `posType` on skipped submissions reads from `Submission.posType`; all others read from the joined `Venue.posType`.

---

## Admin CRUD additions

The existing admin panel gains a **Venues** section:

- List all venues (filterable by verified / unverified, by type)
- Edit `name`, `posType`, `type`, `verified` on any venue
- Changing `posType` on a verified venue propagates automatically to all linked submissions (join-based, no migration)

---

## Admin merge workflow (future, not in this PR)

1. Admin views venues at the same coordinate with slightly different names
2. Picks the canonical one, marks it `verified: true`
3. All `Submission.venueId` values pointing to duplicates are updated to the canonical `Venue.id` in a single `UPDATE`
4. Duplicate `Venue` rows deleted

No submission data is rewritten beyond the FK. The merge is cheap and reversible.

---

## Open questions for review

1. **`posType` on skipped submissions** — plan stores it directly on `Submission.posType` as the exception case. Alternatively we keep `posType` on every submission row (denormalised) and just treat the venue as the override when verified. This would be simpler at the query layer but means two places to keep in sync. Worth a call.

2. **Legacy migration: Location table** — some `Location` records may be chain-level entries without a precise coordinate. Proposal is to either assign a representative coordinate or discard if no submissions reference them. Should be audited before the migration runs.

3. **Visibility of skipped submissions for admins** — always hidden on the map, or should the admin map view have a toggle to show them for moderation?

4. **Community venue approval flow** — is flipping `verified` in the admin CRUD panel sufficient, or do we want an explicit "pending approval" queue surfaced on the admin overview?

---

## Implementation order (when approved)

1. Prisma migration — `Venue` table, update `Submission` (add `venueId`, `skipVenuePrompt`; remove `placeId`, `locationId`, `posType` except on skip)
2. Data migration script — `Place` → `Venue`, `Location` → `Venue`, update submission FKs
3. Drop `Place` and `Location` tables
4. Backend — `GET /api/venues/nearby`, `POST /api/venues`, update create route
5. Frontend — `VenuePrompt` component, `posType` visibility logic, wire into `DataEntry`
6. Map — exclude skipped from query, use venue name in side panel
7. Admin CRUD — Venues section with edit + verified toggle

---

## Rework minimisation strategy

To avoid cascading frontend changes during the migration, the backend should absorb the schema swap internally and keep all existing API response shapes intact.

Concretely: wherever a route currently returns `place_name`, `location_name`, `posType`, or similar fields sourced from `Place` / `Location`, the updated query instead joins `Venue` and maps the result to the **same field names the frontend already expects**. No frontend type changes, no rename ripple across components.

The only net-new frontend work is the `VenuePrompt` component and the `posType` visibility logic — everything else (map, data browser, leaderboard, submission detail) continues to read the same response shape and requires no changes.

This keeps the PR focused: schema + migration + route internals on the backend, one new component on the frontend.
