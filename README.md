# super-admin-app — Serbi platform

Platform app of **Serbi** (`serbi.me`): public pages, café-owner sign-up and login, and the super-admin console.
The café-facing app (menus, ordering, café dashboards on `<cafe>.serbi.me`) lives in [`serbyni/cafe-app`](https://github.com/serbyni/cafe-app).

Stack: **Next.js 16** (App Router, `cacheComponents`), React 19, TypeScript, Tailwind CSS 4, ESLint 9, Prettier.

## Routes

| Route              | Page                                                                                         | Status      |
| ------------------ | -------------------------------------------------------------------------------------------- | ----------- |
| `/`                | Platform home (temporary route map)                                                          | placeholder |
| `/login`           | Login (café owners, platform)                                                                | placeholder |
| `/register`        | Café-owner registration → email verification → approval                                      | placeholder |
| `/forgot-password` | Password reset request                                                                       | placeholder |
| `/about`           | About us                                                                                     | placeholder |
| `/contact`         | Contact                                                                                      | placeholder |
| `/admin`           | Super-admin console (applications, café directory, plans, aggregated stats)                  | placeholder |
| `/[tenant]/admin`  | Platform-side management of one café (status, plan, owner); **no café business data** (GDPR) | placeholder |

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

## Development

```bash
nvm use            # Node 24 (.nvmrc)
npm ci
npm run dev        # http://localhost:3000
```

| Script                            | Does                                                            |
| --------------------------------- | --------------------------------------------------------------- |
| `npm run lint`                    | ESLint (Next core-web-vitals + TypeScript, Prettier-compatible) |
| `npm run format` / `format:check` | Prettier write / check (with Tailwind class sorting)            |
| `npm run typecheck`               | `next typegen` + `tsc --noEmit`                                 |
| `npm run build`                   | Production build                                                |

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
