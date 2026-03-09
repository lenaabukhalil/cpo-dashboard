# Charging Point Operator (CPO) Dashboard

Least-privilege dashboard for operators: view organization details, manage locations, chargers, connectors, and tariffs (view / add / delete). Uses the same API and style as the admin dashboard.

## Features

- **Login** – Same auth as admin (`/api/v4/auth/login`, `/api/v4/auth/me`)
- **Organization** – Read-only view of the current user’s org (`GET /api/v4/org?id=`)
- **Locations** – List (by org), add, delete (`GET/POST/DELETE /api/v4/location`)
- **Chargers** – List by location, add, delete (`GET/POST/DELETE /api/v4/charger`)
- **Connectors** – List by charger, add, delete (`GET/POST/DELETE /api/v4/connector`)
- **Tariffs** – List all, add, delete (`GET/POST/DELETE /api/v4/tariff`)

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the API (Node-RED flow) on port 1880 so the proxy can reach it.

3. Run the app:
   ```bash
   npm run dev
   ```
   App runs at http://localhost:5174. API calls to `/api` are proxied to http://localhost:1880.

4. To use another API base URL, set:
   ```bash
   VITE_API_URL=http://your-api-host:1880
   ```
   and run `npm run build` (or ensure the dev server uses this env).

## Build

```bash
npm run build
```

Output is in `dist/`.

## Tech

- React 18, TypeScript, Vite
- React Router 6
- Tailwind CSS (dashboard-style layout: sidebar, header, cards, tables)
