# Safawala CRM

Safawala CRM Version 1 is a production-oriented authentication foundation and responsive dashboard shell. It uses Supabase Auth for email/password sign-in and keeps application routes protected with server-validated sessions.

## Included in Version 1

- `/` redirects according to the current authenticated session.
- `/login` provides accessible email/password sign-in, password visibility, validation, loading, configuration, and safe error states.
- `/dashboard` validates the user server-side and renders a responsive CRM shell.
- Desktop sidebar, mobile navigation drawer, user menu, and Supabase logout.
- Shared design tokens and reusable UI/layout/auth components.
- Separate browser and server Supabase clients, plus cookie/session refresh middleware.
- A minimal `profiles` migration with Row Level Security for the current user only.
- Clearly labelled dashboard demo data, ready to be replaced with organization-scoped queries.

## Intentionally not included

This version does not implement leads, deals, contacts, payments, invoicing, messaging, automations, AI, advanced reporting, billing, full permissions, or external integrations. Sidebar items beyond Dashboard are visual placeholders only. No CRM business records are stored locally or in static files.

## Requirements

- Node.js 22.13 or newer
- npm
- A Supabase project

## Installation

```bash
npm install
```

Copy `.env.example` to `.env.local`, then add the two public Supabase values described below. An empty `.env.local` is included for local setup and is ignored by Git.

## Environment variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL=https://YOUR_PRODUCTION_DOMAIN
```

The two Supabase variables are public browser configuration. Find them in **Supabase Dashboard → Project Settings → API**. Older Supabase projects can use `NEXT_PUBLIC_SUPABASE_ANON_KEY` instead of the publishable key. `NEXT_PUBLIC_SITE_URL` is optional locally and should be the trusted deployed origin in production so social preview metadata can use an absolute URL. Never add `SUPABASE_SERVICE_ROLE_KEY` to these variables or to browser code.

## Supabase setup

1. Create or select a Supabase project.
2. In **Authentication → Providers**, keep Email enabled.
3. Decide whether email confirmation is required for newly invited users.
4. Create a test user in **Authentication → Users**, or use your approved user invitation workflow.
5. Add the project URL and publishable/anon client key to `.env.local`.
6. Apply `supabase/migrations/20260901000000_profiles_foundation.sql` using the Supabase CLI or SQL Editor.
7. For production, add the final application domain to the allowed Site URL and Redirect URLs in **Authentication → URL Configuration**.

The service-role key is not needed for Version 1. Supabase Auth stores credentials; the `profiles` table contains application-level profile information only.

## Local development

```bash
npm run dev
```

Open the local URL printed by the command. With no active session, `/` and `/dashboard` lead to `/login`.

## Quality checks

```bash
npm run lint
npm run build
```

## Production deployment

Build with `npm run build`, configure the same two public environment variables in the hosting environment, and deploy the generated application using the selected platform. Add the deployed domain to Supabase Authentication URL Configuration before testing sign-in.

## Authentication checks

1. Visit `/` while signed out; the login page should appear.
2. Submit invalid credentials; a generic error should appear and dashboard access should remain blocked.
3. Sign in with a valid Supabase email/password user; the app should open `/dashboard`.
4. Refresh `/dashboard`; cookie-backed session middleware should keep the user signed in.
5. Log out from the user menu; the session should end and `/login` should appear.
6. Visit `/dashboard` after logout; the server must redirect to `/login`.
7. Visit `/login` while signed in; the server must redirect to `/dashboard`.

## Database migrations and future architecture

Migration files live in `supabase/migrations`; production data lives in the connected Supabase PostgreSQL database, not in this folder.

Future multi-tenant work should introduce `organizations` and `organization_members` first. Organization-owned tables such as contacts, leads, deals, activities, files, and custom fields should include `organization_id`. Every table must have RLS policies that derive permitted organizations from `auth.uid()` membership on the server/database side—never from a client-provided organization ID alone.

The intended relationship is:

```text
auth.users → profiles → organization_members → organizations → CRM data
```

Future uploaded documents should use Supabase Storage with organization-aware bucket policies. Email, WhatsApp, calendar, telephony, payments, webhooks, and other third-party services should be added behind dedicated server-side integration modules when those features are explicitly commissioned.

## Project structure

```text
app/                         Routes and global design system
  login/                     Supabase sign-in route
  dashboard/                 Protected dashboard shell
components/
  auth/                      Authentication UI
  layout/                    Sidebar, header, user menu, responsive shell
  ui/                        Reusable shadcn primitives
lib/supabase/                Browser, server, configuration, and session clients
supabase/migrations/         Versioned database foundation
proxy.ts                     Session refresh and route protection
.env.example                 Public configuration placeholders
```
