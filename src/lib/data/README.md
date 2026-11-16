# Data access layer

All Supabase access goes through **service classes**. Pages, actions, route handlers and
components never call `.rpc()` or create a Supabase client (ESLint enforces it).

```ts
import { serverApi } from "@/lib/data/server-api";

const api = serverApi(); // this request's API
await api.businessTypes.adminSave({ id, slug, name, icon, isActive });
redirect(await api.auth.homePath());
```

| Class                                            | Methods                                                                                                                      |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `BusinessTypesService` (`api.businessTypes`)     | `listActive()` (cached, public), `isActive(slug)`, `adminList()`, `adminSave(input)`, `adminDelete(id)`, `adminReorder(ids)` |
| `OwnersService` (`api.owners`)                   | `myStatus()`, `signUp(input)`, `resendSignupEmail(email)`, `completeProfile(input)`                                          |
| `AdminsService` (`api.admins`)                   | `isPlatformAdmin()`                                                                                                          |
| `AuthService` (`api.auth`)                       | `currentUser()`, `signInWithPassword()`, `signOut()`, `completeRedirect()`, `homePath()`                                     |
| `BrowserApi` (`browserApi()`, Client Components) | `startOAuthSignIn(provider)`                                                                                                 |

Rules:

- **One `ServerApi` per request.** `serverApi()` is memoized per request with React `cache`;
  never keep an instance in a module-level variable (it carries the user's session).
- The Supabase client is created **lazily**, on the first query. Pages that only use cached
  public data (`businessTypes.listActive()`) never read cookies and stay prerenderable.
- Methods take plain typed arguments (camelCase) and map them to the SQL `p_*` args. Types come
  from `src/lib/supabase/database.types.ts`; regenerate after each migration (`npm run db:types`).
- Failures throw `DataError` (`errors.ts`) with a domain `code`; callers map codes to messages.
- New area → new `services/<area>.ts` class taking `LazyDb`, added as a property on `ServerApi`.
