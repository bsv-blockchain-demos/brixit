# Design Perspective 

This document captures user journeys, profiles, and testing scenarios from the perspective of how users interact with the application. It is intended to guide design decisions, QA, and development priorities.

---

## 👤 User Profiles

### Profile: S (Consumer / US)
- Motivations
    - Motivated by personal and family health to buy quality food.
    - Values Brix as a proxy for quality; wants to contribute to the movement.
- Technology Background
    - iPhone user; familiar with social media (Instagram).
    - Uses technology moderately, prefers simplicity.
- Software Usage
    - Primarily mobile; occasionally desktop.
    - Context-aware, testing beta version.

### Profile: John (Contributor / Zambia)
- Motivations 
    - Working with BFA to study food nutrition and secure funding.
- Technology Background
    - Android user, some tablets/iPads; frequent phone use.
    - Not highly tech-savvy.
- Software Usage
    - Mobile only; no desktop.
    - Context-aware, testing beta version.

---

## Test Cases / Platforms
| Device  | Browser | Environment |
| ------- | ------- | ----------- |
| Android | Chrome  | Phone       |
| iPhone  | Safari  | Phone       |
| iPhone  | Chrome  | Phone       |
| Windows | Chrome  | PC          |
| iOS     | Safari  | PC          |
| iOS     | Chrome  | PC          |


---

## User Journeys
Consumer Journey (S / Health-Seeker)
1. Access & Login
    - Open app on mobile device.
    - Create new account if not already registered.
    - Login using credentials.
    - Forgot password flow should work.
2. Exploring Data
    - View quality produce near me.
    - Navigate to leaderboard: focus on recent data (last 7 days).
    - Filter by brand more than store (brands are available at multiple locations).
    - Optional: view map for additional context.
3. Insights & Preferences
    - Set crop type and location preferences in profile.
    - Track Brix scores for top brands/locations.
    - Optional: contribute to dataset in future.

Contributor / Testing Journey (John / Data Collector)
1. Access & Login
    - Open app on mobile device.
    - Create new account if not registered.
    - Login using credentials.
    - Forgot password flow should work.
2. Submitting Data
    - Navigate to Add New Measurement form.
    - Enter:
        - Crop type
        - Brand name
        - Point of purchase (POP)
        - Brix score
        - Sample location (geocoded to stores)
        - Purchase date / Assessment date
        - Variety / Notes
    - If the store or brand is not in the ontology list:
        - Add new store/brand while minimizing duplicates and misspellings.
    - Submit measurement.
3. Verification / Feedback
    - Successful submission moves to Your Data tab.
    - “Add New Measurement” button remains prominent for quick successive entries.
    - Check location works for international entries (Europe, Africa).

--- 

## 🗺 Key Interaction Notes
- Leaderboard & Map
    - Scores normalized for location: city → state → country.
    - Consumers focus on brands; contributors focus on submitting and reviewing stores.

- Submission Flow
    - Contributors see their verified and unverified submissions.
    - Admins can verify submissions (via Admin Page).

- Profile & Points
    - Users can update display name, location, and crop type.
    - Points earned from submissions and contributions are visible.

--- 

## ⚠ Design / Developer Considerations
- Ensure mobile-first design: both S and John primarily use mobile.

- Provide clear pathways for adding new stores/brands to minimize duplication.

- Make submission success feedback immediate; users should not need to hunt for confirmation.

- Consider fallbacks for international locations when entries don’t match US-centric ontology.

- Ensure filtering and leaderboard features show recent and relevant data clearly.