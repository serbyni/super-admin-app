# super-admin-app — Serbi platform

Platform app of **Serbi** (`serbi.me`): public pages, café-owner sign-up and login, and the super-admin console.
The café-facing app (menus, ordering, café dashboards on `<cafe>.serbi.me`) lives in [`serbyni/cafe-app`](https://github.com/serbyni/cafe-app).

Stack: **Next.js 16** (App Router, `cacheComponents`), React 19, TypeScript, Tailwind CSS 4, ESLint 9, Prettier.

## Routes

| Route                     | Page                                                                                         | Status                  |
| ------------------------- | -------------------------------------------------------------------------------------------- | ----------------------- |
| `/`                       | Platform home (temporary route map)                                                          | placeholder             |
| `/login`                  | Email/password + Google/Facebook sign-in; super admins → `/admin`, owners → by status        | **working**             |
| `/register`               | Café-owner registration → email verification → approval                                      | **UI done** (not wired) |
| `/forgot-password`        | Password reset request                                                                       | **UI done** (not wired) |
| `/reset-password/success` | Password updated confirmation                                                                | **UI done**             |
| `/privacy`, `/terms`      | Legal pages                                                                                  | placeholder             |
| `/about`                  | About us                                                                                     | placeholder             |
| `/contact`                | Contact                                                                                      | placeholder             |
| `/admin`                  | Super-admin overview (super admins only)                                                     | **working** (basic)     |
| `/admin/business`         | Business types CRUD: list, create, edit (EN/FR/AR names, icon, order, active), delete unused | **working**             |
| `/[tenant]/admin`         | Platform-side management of one café (status, plan, owner); **no café business data** (GDPR) | placeholder             |

Route files live in `src/app`:

```
src/app/
├─ page.tsx                     /
├─ (auth)/                      route group (no URL segment)
│  ├─ login/page.tsx            /login
│  ├─ register/page.tsx         /register
│  └─ forgot-password/page.tsx  /forgot-password
├─ (public)/                    route group
│  ├─ about/page.tsx            /about
│  └─ contact/page.tsx          /contact
├─ admin/page.tsx               /admin
└─ [tenant]/admin/page.tsx      /<tenant>/admin
```

Static routes always win over `[tenant]`, so `/login`, `/admin` etc. are never read as a café slug. Every top-level static route name must stay in the **reserved slug list** (`admin, login, register, forgot-password, about, contact, www, app, api, q, …`), so no café can register that name.

## Design system

Tokens follow the Stitch **"Artisanal Brew"** design system (project `17774407037339389188`). They live in `src/app/globals.css`, with palettes in `src/styles/palettes.css`.

| Layer                              | Where                                                                    | Use                                                                                                                                                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Semantic colors (Material 3 roles) | `--sb-*` CSS variables in `globals.css`, exposed through `@theme inline` | `bg-primary`, `text-on-surface-variant`, `bg-surface-container-low`, `ring-primary-container`… These are the same names Stitch exports, so its markup ports as-is. Variables can be overridden at runtime per café. |
| Fixed accents                      | `--sb-cta`, `--sb-success`, `--sb-info`                                  | `bg-cta` (order buttons), `text-success`, `bg-info-container`                                                                                                                                                       |
| Tonal palettes 50–950              | `src/styles/palettes.css` (generated)                                    | `coffee-*` (primary), `latte-*` (secondary), `slate-*` (tertiary), `sand-*` (neutral), `orange-*` (CTA), `sage-*` (success), `sky-*` (info), `red-*` (error). Regenerate with `npm run tokens:palettes`.            |
| Typography                         | `--text-*`                                                               | `text-display-lg`, `text-headline-md`, `text-body-lg`, `text-body-md`, `text-label-sm` (Plus Jakarta Sans via `next/font`)                                                                                          |
| Spacing                            | `--spacing-*`                                                            | `p-md`, `gap-lg`, `px-gutter`, `px-container-margin-desktop` (8px rhythm)                                                                                                                                           |
| Icons                              | Material Symbols Outlined                                                | `<Icon name="mail" />`, `filled`, `flipRtl` for arrows                                                                                                                                                              |

**No hard-coded values:** arbitrary Tailwind values (`text-[14px]`, `max-w-[36rem]`, `bg-[#fff]`, `shadow-[…]`) are **not allowed**. Add a token to `@theme` in `globals.css` and use the named utility. `npm run lint` (and CI) runs `lint:tokens`, which fails on any arbitrary value.

Extra tokens: icon sizes `text-icon-xs…3xl`, small text `text-caption` / `text-body-xs` / `text-body-sm`, card widths `max-w-card-sm` / `max-w-card-md`, shadows `shadow-header` / `shadow-card-warm` / `shadow-button-warm`, `bg-cover-glow`, `fill-facebook`. Use scale percentages like `hover:scale-101` and `active:scale-99`.

⚠ Tailwind 4 also uses the spacing names for sizing: `max-w-xl` = 48px here, not a container width. Use `max-w-card-*` or `max-w-2xl` and larger.

Auth UI building blocks are in `src/components/auth/`: `AuthShell`, `TextField`, `SelectField`, `PasswordField`, `SocialButtons`, `OrDivider`, and `StaticForm` (blocks submit until auth is implemented).

## Auth & database

Auth is **Supabase Auth** (email + password, Google, Facebook). Owner applications live in the private `platform` schema (`platform.owner_accounts`). A trigger on `auth.users` creates them; clients only use the RPCs `get_my_owner_status()` and `complete_owner_profile(...)`. Migrations are in `supabase/migrations/` and are applied to the Supabase project with the same version numbers.

Owner status flow: `email_unverified` → (email link) → `pending_approval` → `approved` / `rejected`. Google/Facebook sign-ups start at `profile_incomplete` and must complete `/register/complete`.

### Environment variables

| Name                                   | Where                           | Value                                                             |
| -------------------------------------- | ------------------------------- | ----------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | `.env.local`, Vercel (all envs) | Supabase project URL                                              |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env.local`, Vercel (all envs) | Supabase **publishable** key (`sb_publishable_…`)                 |
| `NEXT_PUBLIC_SITE_URL`                 | `.env.local`, Vercel            | `http://localhost:3000` locally, `https://dev.serbi.me` on Vercel |

Copy `.env.example` to `.env.local` for local development.

### Business location (register)

The register and complete-profile forms collect the business location with **Google Maps** (`@vis.gl/react-google-maps`):

- **Places search:** Places API (New) autocomplete with session tokens.
- **Map preview:** click the map or drag the pin. Reverse geocoding (Geocoding API) fills in the address.
- **Typed latitude and longitude:** for places not on Google Maps.

Street, postal code and city are editable. Stored on `platform.owner_accounts`: `latitude`, `longitude`, `place_id`, `formatted_address`, `street`, `postal_code`, `city`, `region`, `country`, `country_code`, `location_source` (`google_place` | `map_pin` | `coordinates`).

Env: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (browser key restricted to your domains; enable Maps JavaScript API, Places API (New) and Geocoding API) and optionally `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` (draggable Advanced Marker). Without a key the form shows manual coordinates and address fields.

### Super admins

Super admins are rows in `platform.platform_admins`. **No admin account or password is hard-coded.** Create one with the one-time script:

```bash
# needs NEXT_PUBLIC_SUPABASE_URL (in .env.local) and the Supabase SECRET key (never commit it)
SUPABASE_SECRET_KEY=sb_secret_... npm run admin:create
# prompts for email + password (or pass ADMIN_EMAIL / ADMIN_PASSWORD)
```

Then sign in at `/login`, and you are sent to `/admin`. Every admin page and RPC re-checks `is_platform_admin()` on the server. (Next step: require TOTP two-factor for admins.)

### Business types

Managed at `/admin/business` and stored in `platform.business_types` (slug, names in EN/FR/AR, icon, order, active). Icons are chosen with a searchable picker (click the icon preview) from the curated list in `src/config/business-icons.ts`. The server only accepts icons from that list; add new ones there. The **order** is set by dragging rows by their handle in the list (keyboard: focus the handle, Space, arrow keys, Space). It saves instantly through `admin_reorder_business_types`; new types are added at the end. The register form shows only **active** types, cached with the tag `business-types` and refreshed instantly on every admin save. Types used by café owners cannot be deleted, only deactivated.

## Development

```bash
nvm use            # Node 24 (.nvmrc)
npm ci
npm run dev        # http://localhost:3000
```

| Script                            | Does                                                                                                           |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `npm run lint`                    | ESLint (Next core-web-vitals + TypeScript, Prettier-compatible) + `lint:tokens` (no arbitrary Tailwind values) |
| `npm run format` / `format:check` | Prettier write / check (with Tailwind class sorting)                                                           |
| `npm run typecheck`               | `next typegen` + `tsc --noEmit`                                                                                |
| `npm run build`                   | Production build                                                                                               |

## Branches & environments

| Branch    | Purpose                                              | Deploys to                                        |
| --------- | ---------------------------------------------------- | ------------------------------------------------- |
| `develop` | integration branch; all work merges here through PRs | **Vercel = development environment**              |
| `main`    | production releases                                  | not wired yet (production on the VPS comes later) |

No staging environment for now. Feature branches → PR into `develop` → CI must pass → merge → automatic deploy to Vercel.

## CI/CD (`.github/workflows/`)

| Workflow            | Trigger                                                                         | Jobs                                                                      |
| ------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `ci.yml`            | PR to `develop`/`main`, push to `develop`                                       | **Lint · Prettier · Typecheck** and **Build** (parallel)                  |
| `deploy-vercel.yml` | called by `ci.yml` after all checks pass on a push to `develop` (or manual run) | `vercel pull` → `vercel build --prod` → `vercel deploy --prebuilt --prod` |

`vercel.json` disables Vercel's own Git auto-deploys, so deployments come **only** from this workflow, after CI passes.

### One-time setup (repository admin)

1. **Vercel project:** create a project for this repo in Vercel (framework: Next.js). Locally run `npx vercel link` to get the org and project IDs (`.vercel/project.json`, not committed).
2. **GitHub secrets** (Settings → Secrets and variables → Actions):
   - `VERCEL_TOKEN`: Vercel → Account Settings → Tokens
   - `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`: from `.vercel/project.json`
3. **GitHub variable** (Settings → Secrets and variables → Actions → Variables):
   - `DEV_DOMAIN`: public domain of the development environment, e.g. `dev.serbi.me`. The deploy workflow points it at each new deployment.
4. **GitHub environment:** create an environment named `development` (optional protection rules).
5. **Branch protection** on `develop` (and `main`): require PRs, require the status checks **Lint · Prettier · Typecheck** and **Build**, and no direct pushes.
6. Set `develop` as the default branch so PRs target it by default.
