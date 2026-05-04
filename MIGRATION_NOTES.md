# JWT / RBAC frontend migration (CPO Dashboard)

## Contract change

- **`POST /api/v4/auth/login`** and **`GET /api/v4/auth/me`** now return `permissions` as an object: `Record<string, "R" | "RW">` (permission code → access level), not an array of strings.
- The client stores the opaque JWT in `localStorage` as **`cpo_token`** (unchanged) and persists the permission map under **`cpo_permissions`** for hard refreshes and sidebar/route checks while session is restored.
- **`403`** responses that include **`requiredPermission`** no longer trigger a redirect to login; the app shows a short in-app notice (see `Layout.tsx` + `cpo-api-forbidden` event from `request()` in `src/services/api.ts`).
- **`401`** still clears token, permissions cache key, and GET cache, then redirects to `/login`.
- All `fetch` calls through **`request()`** use a **15s** client timeout; on timeout the caller receives `statusCode: 504` and `message: "Request timed out"` (login maps this to a dedicated translated string).

## Files touched

| Area | File |
|------|------|
| API types + `request()` | `src/services/api.ts` |
| Session + permissions | `src/context/AuthContext.tsx` |
| Login | `src/pages/Login.tsx` |
| Route / nav RBAC | `src/lib/permissions.ts` |
| Hook | `src/hooks/usePermission.ts` |
| Guards | `src/App.tsx` |
| Sidebar + logo | `src/components/Sidebar.tsx` |
| 403 toast host | `src/components/Layout.tsx` |
| Write UX (examples) | `src/pages/PartnerUsers.tsx`, `src/pages/Settings.tsx`, `src/components/OrganizationLogoDialog.tsx` |
| Copy | `src/lib/translations.ts` |
| Notes | `MIGRATION_NOTES.md` |

## Permission codes referenced by the UI

Confirm each exists in `ocpp_CSGO.Permissions` and matches enforcement on the corresponding API routes:

| Code | Where used |
|------|----------------|
| `organizations.view` | Route `/org`; RW for sidebar logo + `OrganizationLogoDialog` saves |
| `stations.view` | Routes `/details`, `/list` |
| `sessions.view` | Route `/sessions` |
| `reports.view` | Route `/reports` |
| `support.view` | Route `/support` |
| `settings.view` | Route `/settings` (R); RW for settings logo save actions |
| `map.view` | Route `/map` |
| `users.manage` | Route `/partner-users` (R); RW for add/edit/delete partner users |
| `audit.view` | Route `/audit-log` |

`// TODO(rbac):` comments in `src/lib/permissions.ts` mark places where route minimum access was set to **`R`** for `/settings` and `/partner-users` so read-only users can open the page while writes stay gated with `usePermission(..., "RW")`. Align with backend if those routes should require **RW** at the HTTP layer.

## How to verify locally

1. **`npm run build`** — TypeScript + Vite build completes (no `lint` script in this repo).
2. **Login** — Valid user: `cpo_token` + `cpo_permissions` populated; redirect to `/`.
3. **Sidebar** — Only links the user’s permission map allows (plus `/`); routes without a mapped code still use the legacy role path lists.
4. **Hard refresh** on e.g. `/reports` while logged in — Session restored via `me()` + stored permissions; no bounce to `/login` when the token and map are valid.
5. **Logout** — Clears `cpo_token`, `cpo_permissions`, and GET cache (`clearGetCache()`).
6. **Read-only** — User with `R` on `users.manage` or `settings.view`: pages open where routed with `R`; write controls disabled with “Read-only access” tooltip/title.
7. **403 + `requiredPermission`** — Toast-style banner; user stays logged in.
8. **Timeout** — Slow login: translated “service is taking too long” message; form fields unchanged.
