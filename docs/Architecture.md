# Architecture Overview

This document provides a high-level view of the system architecture, core modules, data flow, and major components. It enables developers to understand how the prototype is structured before diving into the code. It also includes user flows, key pages, and relationships between frontend, backend, and database.

---

## 🏗 High-Level Architecture

The application is composed of the following major layers:

- **Frontend/UI**  
  Built mostly in React (with TSX components), this layer handles user interactions, renders screens, and communicates with Supabase and backend APIs. Includes components, pages, contexts, hooks, and shared utilities.

- **Backend / API Layer**  
  Supabase-hosted APIs, edge functions, and server-side logic. This layer handles authentication, data validation, business rules, and orchestrates database interactions.

- **Database / Persistence**  
  PostgreSQL (hosted by Supabase) storing:
    - Users and profiles
    - Submissions (verified/unverified)
    - Stores, brands, crop types
    - Points and statistics (up and coming feature, probably!)

- **External Services**
    - Supabase Authentication/Storage
    - Mapbox (map rendering)
    - Geonames API (geo lookup)

---

## 🔌 Data Flow

[Frontend] ⇄ [Supabase Edge Functions / APIs] ⇄ [Database]
        |
   [External Services]

- Frontend communicates via Supabase client and API calls.
- Edge functions handle business logic that requires server execution (e.g., auto-verify-submission, create-user-profile).
- Database triggers enforce rules on insert/update/delete operations (e.g., submission verification, points calculation).

---

## 🧩 Core Components

1. **User Management**
- Login / Forgot Password 
    - Users must be created by an admin via the admin page. Login is tied to Supabase auth w/ Edge function logic
- Profile 
    - Users can view and edit: 
        - Display name 
        - Location 
        - Crop type
        - Email (currently unchangeable, just viewable)
        - Points (broken / WIP up-coming feature)
        - Delete account (broken / untested)

2. **Leaderboard**
- Displays BRIX scores: 
    - Top locations
    - Top brands
    - Most submissions 
- Scores are normalized and tailored to user location, fall backs from city -> state -> country if no data
[`Normalization Logic Data Link`] 
(https://docs.google.com/spreadsheets/d/1Udh93_EqdVvdB4lIAQ9mLRcEzObg4BpFgQjt8iFeyMY/edit?gid=1847670096#gid=1847670096) 

- Filters available for country/state/city
- Data is pulled from verified submissions only 

3. **Explorer / Map**
- Interactive map showing all stores with submissions 
- Clicking a store shows grouped submissions by crop, with tabs for "All" and "Brand"
- Clicking a submission displays individual details (crop/brand/location/score/notes)
- "Near me" recenters map to user's profile location

4. ** Data Pages**
- **All Submissions**
    - Table with:
        - Crop / Variety / Brand 
        - Location and BRIX score
        - Notes
        - Verified / unverified (Doesn't work was part of a previous feature that wasn't implemented, only shows verified submissions)
        - Filters: Brix range, crop type, date range, brand, point of purchase, image/no image
- **Your Data**
    - Table with: 
        - The same as above but it's separate code because it used to work differently in the beginning
    - Displays all of the user's own submissions verified and unverified
    - Users can view their profile statistics (partially implemented)
    - Contributors can submit new measurements 

5. **Submission Flow**
- Contributors can add submissions via form: 
    - Crop type, brand, point of purchase, Brix score, sample location (geocoded to store), purchase date, assessment date, variety, notes
    - New stores and brands can be added dynamically 
- Submission validation handled via edge function (and possibly database triggers)

6. **Admin Page**
- Shows submissions pending verification
- User management: 
    - Create new users
    - Promote/demote users to contributor/admin

---

## 🗂 File and Module Structure

/src
  /components     # UI components, including pages (Admin, Explorer, Leaderboard, Data)
  /contexts       # Context providers for state (e.g., user location, filters)
  /data           # Static seed data or configuration lists
  /hooks          # Custom React hooks
  /integrations   # This has the types for supabase
  /lib            # Shared helper functions
  /pages          # Page components (routes/screens)
  /types          # Shared TypeScript types
App.tsx
main.tsx
App.css
index.css

Notes: Components like Admin, Common are shared or page-specific. Pages reference components and hooks to manage state and render data from Supabase. (mostly, probably or at least we've tried to)
