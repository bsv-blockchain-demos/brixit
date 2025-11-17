# Roadmap & Future Work

This document outlines planned improvements, incomplete features, and next steps to move the prototype toward production.

---

## 📝 Current State

The prototype achieves the following:
- Basic functionality implemented
- Working demo
- Initial architecture in place

However, several areas require enhancement.

---

## 🛣 Future Work

- View data in leaderboard by selecting times for 24 hours, last week, last month, and all time 
- Does everything work on mobile? Can you get to and from every screen and enter everything appropriately?
- Leaderboard scroll takes forever and is long, add a small button / navigation on the side to skip / go to the other leaderboards on mobile especially 
- Login caching w/ token

---

## 🪲 Known Bugs

- Leaderboard scoring and normalization logic 
- Can't see map in mobile view (because of the bottom pane)
    - Best practices investigation: How does Apple maps + Google maps ideally implement this? -> Snap points 25 / 50, 75 and open the bottom drawer at default on 50 snap or less
- Reconcile all wording of other / unknown / unbranded / allowing users to create new brands
- Reconcile adding brand to database appropriately with fetchBrands
- User can edit data details without it breaking 
- User can delete their own account 
- User can change their display name
- Data page should not have scroll bars on mobile 
- Forgot password
- Displaying address on data side pane isn't consistent (especially for countries in Africa)
- Parameterized link for data when filtering/searching
- Data detail city/state truncates

---

## 🧱 Technical Debt

- The filters used to be shared and more in sync between the map and the data pages and therefore there's some shared sameness between them that doesn't always fully align. 

- There's pages that are no longer used but still exist, like Register.tsx (since we're no longer allowing users to self-register), ResetPassword.tsx versus ResetPasswordOTP.tsx, VerifyEmailNotice.tsx, etc. 

- There's helper functions [`src/lib`](src/lib) that are no longer used or their functionality had to be changed based on new feature needs. For example, there's color helper functions that were used to align the colors of BRIX scores throughout the application and different functions for fetching things from the database, take a look, most are named well like fetchBrands for fetching brands or fetchSubmissions for fetching submissions. 