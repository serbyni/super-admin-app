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

**Form fields** are Material 3 _outlined_ fields with a floating label (`src/components/auth/fields.tsx`): at rest the label sits inside the box; on focus or when filled it moves onto the top border (pure CSS via `peer` + `:placeholder-shown` / `:invalid`, no JavaScript). Example placeholders only appear while a field is focused. The label notch uses the `bg-field-notch` token (= card surface), so put fields on `surface-container-lowest` cards. Use `TextField` / `PasswordField` / `SelectField` / `PhoneField`; for custom inputs combine `outlinedBox()` + `FloatingLabel` (the input must come before the label).

Auth UI building blocks are in `src/components/auth/`: `AuthShell`, `TextField`, `SelectField`, `PasswordField`, `SocialButtons`, `OrDivider`, and `StaticForm` (blocks submit until auth is implemented).

## Auth & database

Auth is **Supabase Auth** (email + password, Google, Facebook). Owner applications live in the private `platform` schema (`platform.owner_accounts`). A trigger on `auth.users` creates them; clients only use the RPCs `get_my_owner_status()` and `complete_owner_profile(...)`. Migrations are in `supabase/migrations/` and are applied to the Supabase project with the same version numbers.

Owner status flow: `email_unverified` → (email link) → `pending_approval` → `approved` / `rejected`. Google/Facebook sign-ups start at `profile_incomplete` and must complete `/register/complete`.

### Data access layer

All Supabase calls live in **`src/lib/data/`**, one module per area (`business-types`, `owners`, `admins`, `auth`, `browser`). Pages, server actions and components call typed functions such as `adminSaveBusinessType({ id, slug, name, icon, isActive })`; they never use `.rpc()` or create a Supabase client. ESLint blocks client imports and `.rpc()` outside `src/lib/data` and `src/lib/supabase`.

- Each function creates the right client itself: the **public** client inside cached functions, the **per-request** client (user cookies) otherwise. Clients are never stored in module state.
- Arguments and results are typed from the database (`src/lib/supabase/database.types.ts`). After every migration run `SUPABASE_PROJECT_REF=<ref> npm run db:types` (needs `npx supabase login` once); a renamed SQL argument then fails `npm run typecheck`.
- Failures throw `DataError` with a domain `code` (`forbidden`, `conflict`, `in_use`, `stale_list`, `not_authenticated`, `profile_already_completed`, `invalid_location`, `unknown`); actions map the code to a message. Unknown errors are logged once in `unwrap()`.
- Where a signed-in user belongs (admin → `/admin`, owner → by status) is decided only in `homePathForCurrentUser()`.

More in `src/lib/data/README.md`.

### Environment variables

| Name                                   | Where                           | Value                                                             |
| -------------------------------------- | ------------------------------- | ----------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | `.env.local`, Vercel (all envs) | Supabase project URL                                              |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env.local`, Vercel (all envs) | Supabase **publishable** key (`sb_publishable_…`)                 |
| `NEXT_PUBLIC_SITE_URL`                 | `.env.local`, Vercel            | `http://localhost:3000` locally, `https://dev.serbi.me` on Vercel |

Copy `.env.example` to `.env.local` for local development.

### Business location (register)

The register and complete-profile forms collect the business location. **No maps key is ever sent to the browser.** The browser only calls our server routes, which use **server-only** keys:

| Browser calls                     | Server calls the provider                                                  |
| --------------------------------- | -------------------------------------------------------------------------- |
| `POST /api/places/autocomplete`   | place / address search                                                     |
| `GET /api/places/details`         | place details (Google only; Geoapify returns full results in autocomplete) |
| `GET /api/geocode/reverse`        | address for a pin or typed coordinates                                     |
| `GET /api/maps/static`            | map image (cached 1 day)                                                   |
| `GET /api/maps/tiles/{z}/{x}/{y}` | map tiles for the interactive map (cached 1 week)                          |
| `GET /api/places/nearby`          | cafés, restaurants, bars, bakeries in the visible area (zoom ≥ 16)         |

**Providers** (`src/lib/maps/providers/`):

- **Geoapify** (default): OpenStreetMap data, free plan without a credit card. Env `GEOAPIFY_API_KEY`.
- **Google** (optional, needs billing): Places API (New), Geocoding, Maps Static. Env `GOOGLE_MAPS_SERVER_KEY`.

Set `MAPS_PROVIDER=geoapify|google` to force one; otherwise Geoapify is used when its key is set. Geoapify renders 512px tiles, so its zoom is shifted by −1 to keep the click math identical.

Every route checks the request comes from the same site, validates input (zod), and is rate-limited per IP (in memory; use a shared store when running several instances).

**Map (Geoapify):** an interactive [Leaflet](https://leafletjs.com) map (`src/components/location/interactive-map.tsx`): drag, pinch/scroll and + / − zoom. From street zoom (16) it shows nearby cafés, restaurants, bars and bakeries; tapping one and choosing **This is my business** fills in the name and address. Owners can also tap the map or drag the pin, and the address is looked up again. **Google** (no tile/places support here) falls back to a static map image you click to move the pin (Web-Mercator math in `src/lib/location/mercator.ts`). Owners can always type latitude/longitude. Moving the pin clears and re-fills the address; street, postal code and city stay editable. The required attribution is shown on the map.

Stored on `platform.owner_accounts`: `latitude`, `longitude`, `place_id`, `formatted_address`, `street`, `postal_code`, `city`, `region`, `country`, `country_code`, `location_source` (`place_search` | `map_pin` | `coordinates`). Without any maps key the form shows manual coordinates and address fields.

### Phone number

`src/components/auth/phone-field.tsx`: a country picker (SVG flag, name, dial code; search by name, ISO code or `+code`; keyboard ↑ ↓ Enter Esc) with the main markets first (`src/config/phone.ts`). The number is formatted as you type for the chosen country ([libphonenumber-js](https://gitlab.com/catamphetamine/libphonenumber-js)), a pasted `+33…` or `0033…` number switches the country automatically, and while the field is empty the country follows the business location. The form submits E.164 (`+21620123456`); the server re-validates with the **full** per-country rules (`libphonenumber-js/max`).

Flags come from `country-flag-icons` and are copied to `public/flags/` by `npm install` (postinstall, gitignored), so only the flags shown are downloaded.

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
