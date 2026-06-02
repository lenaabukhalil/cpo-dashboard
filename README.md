# ION CPO Dashboard

EV Charging Point Operator dashboard built with React 18, TypeScript, and Vite.

## Stack
React 18 · TypeScript · Vite · React Router 6 · Tailwind CSS

## Setup

````bash
npm install
npm run dev
````

App runs at `http://localhost:5173`. API proxied to `http://localhost:1880`.

To override the API URL:

````bash
VITE_API_URL=http://your-api:1880 npm run build
````

## Features

* Auth, Organization, Locations, Chargers, Connectors, Tariffs, Reports, Monitor, Audit Log, Maintenance Tickets, Predictive AI, Map View, User Management