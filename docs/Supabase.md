# Supabase Documentation

This document contains everything needed to understand or rebuild the Supabase backend.

---

# 📦 Contents

- Database structure & migrations
- Stored SQL functions
- Database triggers (with SQL to view them)
- Edge functions (names + purpose)
- Auth configuration
- SMTP & email templates
- Environment variables used by Supabase
- Test users
- Useful SQL reference (queries to inspect database internals)

---

# 🗄️ Project Structure (`supabase/`)

supabase/
├── .branches/ # auto-generated; never touched
├── .temp/ # temp build files; safe to ignore
├── .functions/ # empty (edge functions are remote)
├── migrations/ # ALL migrations (canonical schema source)
backup_seed_data.sql # Used to insert original seed data, probably out of date
cline_seed_data.sql # Original AI-generated seed data
gemini_initial_seed.sql # Original AI-generated seed data
schema_review.md # Review of the initial database schema from AI with tests
test_rls_policies.sql # Tests for the initial schema (definitely out of date)

The **source of truth** for schema is:  
`supabase/migrations/`

However, local development is tricky because supabase does magic things behind your back. Supabase links to a local set-up, so you can develop on the remote database even during local development. 

---

# 🧩 SQL Functions

These exist, none were created from us they're all just Supabase for auth purposes. You probably? won't need these. 


---

# 🔔 Database Triggers

These are the **actual triggers extracted**:

`on_auth_user_created`
`submissions_after_insert`
`submissions_after_insert_points`
`tr_check_filters`
`enforce_bucket_name_length_trigger`
`objects_delete_delete_prefix`
`objects_insert_create_prefix`
`objects_update_create_prefix`
`update_objects_updated_at`
`prefixes_create_hierarchy`
`prefixes_delete_hierarchy`

I, uh, do not remember creating any of these and don't think they're used (they're all mostly on the storage, I think we briefly used the auth trigger to reconcile the public.users and auth.users tables). 

---

## 🔍 Useful SQL Queries for Inspecting Supabase

List all triggers (provided above):

```sql
SELECT
  event_object_schema AS trigger_schema,
  event_object_table AS table_name,
  trigger_name,
  action_statement AS definition,
  substring(action_statement from 'FUNCTION ([^)]*)') AS function_name,
  enabled
FROM information_schema.triggers
ORDER BY event_object_schema, event_object_table;
```

List all SQL functions (you probably won't need these):

```sql
SELECT 
    routine_schema,
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines
ORDER BY routine_schema, routine_name;
```

List RLS policies:

```sql
SELECT * FROM pg_policies ORDER BY schemaname, tablename;
```

Show table schemas:

```sql
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
ORDER BY table_schema, table_name;
```

---
## ⛓️ Supabase Edge Functions (Remote)
These are NOT stored in the repo and are dynamically retrieved in the code, however, as you develop these will need to be updated, changed or added to. 

### Edge Functions in Use
1. **mapbox-token**
Returns Mapbox API token from environment variables.

2. **get-supabase-url**
Returns Supabase project URL.

3. **auto-verify-submission**
Automatically approves submissions based on heuristics.
Currently broken and hardcoded to approve everything.

4. **get-geonames-username**
Returns Geonames API username.

5. **create-user-profile**
Previously auto-created profile rows.
May no longer be needed / isn't currently used 

6. **admin-create-user**
Creates a new Supabase auth user from the admin page in the UI.

---

## 🔐 Environment Variables Stored in Supabase ("Secrets")

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`
- `AUTO_VERIFY_USER_ID`
- `VITE_GEONAMES_USERNAME`

--- 

## 📧 SMTP / Auth Email Templates

- Reset password template was customized.
- Other templates (confirmation, magic link) use defaults (probably).

---

## 🧪 Test Users
These accounts are used for testing the prototype:
(Greg has the password for these)

Admin:
`rosemariafontana+testinguser5555555@gmail.com`
Holds imported data

Contributor:
`rosemariafontana@gmail.com`

---

## Allowed Client Origins

Supabase + OAuth + redirect URLs include:
- `https://id-preview--b7722ef7-cfd5-4ef2-801f-e4445c3cc277.lovable.app`
- `https://preview--sweet-earth-mapper.lovable.app`
- `https://sweet-earth-mapper.lovable.app`
- `https://www.brixit.app`

---

## Important references

How to do migrations (it's like Django, but worse! imagine that): 
https://supabase.com/docs/guides/deployment/database-migrations

Quick start Supabase local dev guide: 
https://supabase.com/docs/reference/cli/supabase-bootstrap