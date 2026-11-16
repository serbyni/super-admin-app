# Data access layer

All Supabase access goes through these modules. Pages, actions, route handlers and
components never call `.rpc()`, `.from()` or `.auth.*` themselves (ESLint enforces it).

| Module              | What                                                                            |
| ------------------- | ------------------------------------------------------------------------------- |
| `business-types.ts` | public cached list + super-admin CRUD (refreshes the cache tag)                 |
| `owners.ts`         | owner sign-up, resend email, complete profile, my status                        |
| `admins.ts`         | `isPlatformAdmin()`                                                             |
| `auth.ts`           | current user, sign in/out, finish email/OAuth links, `homePathForCurrentUser()` |
| `browser.ts`        | Client Component calls (OAuth start)                                            |
| `errors.ts`         | `unwrap()` + `DataError` with domain codes (`forbidden`, `in_use`, `conflict`…) |

Rules:

- Each function picks its own client: `createPublicClient()` for cached public data,
  `createClient()` (per request, user cookies) for everything else. Never store a client
  in module state.
- Functions take plain typed arguments (camelCase) and map them to the SQL `p_*` args.
  Types come from `src/lib/supabase/database.types.ts` — regenerate after each migration
  (`npm run db:types`), so a renamed SQL argument fails the typecheck.
- Failures throw `DataError`; callers turn `error.code` into UI messages.
