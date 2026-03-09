# Deploy CPO Dashboard to AWS EC2 (Ubuntu)

## 1. Project analysis

| Item | Value |
|------|--------|
| **Package manager** | **npm** (`package-lock.json` present) |
| **Build command** | `npm run build` → runs `tsc -b && vite build` |
| **Build output** | `dist/` (Vite default) |
| **Start command (prod)** | None — static frontend. Serve `dist/` with **nginx** (recommended) or `npx serve -s dist -l PORT` with PM2. |
| **App type** | **Frontend only** (Vite + React SPA). API is external (Node-RED/backend elsewhere). |
| **Environment variables** | **`VITE_API_URL`** — base URL of your API (e.g. `https://dash.evse.cloud`). Empty = same origin. Set at **build time** (Vite embeds it). |

---

## 2. Recommended deployment method

- **Prefer: `git clone` on server** — simpler, no upload from your machine, easy redeploys with `git pull && npm ci && npm run build`.
- **Alternative: `rsync` from your machine** — use if the repo is not in a git remote (e.g. only on your laptop). We exclude `node_modules`, `.git`, `scripts`, `database` as requested.

---

## 3. One-time server setup (Node.js + nginx)

Run these **once** on the EC2 instance (after SSH).

```bash
# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install Node.js 20.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v
npm -v

# Install nginx
sudo apt-get install -y nginx

# Install PM2 (optional — only if you choose "serve" instead of nginx)
sudo npm install -g pm2
```

---

## 4. Deployment commands (copy-paste in order)

Use your `.pem` key path and app directory name as needed. Replace `YOUR_KEY.pem` and `cpo-dashboard` if different.

### Option A — Using git clone on server (recommended)

```bash
# 1) SSH into EC2 (from your local machine)
ssh -i /path/to/YOUR_KEY.pem ubuntu@ec2-54-217-14-204.eu-west-1.compute.amazonaws.com

# 2) Create app directory and clone (on server)
sudo mkdir -p /var/www
sudo chown ubuntu:ubuntu /var/www
cd /var/www
git clone https://github.com/YOUR_ORG/cpo-dashboard.git
cd cpo-dashboard

# 3) Set API URL and install (on server)
echo 'VITE_API_URL=https://dash.evse.cloud' > .env.production
npm ci
npm run build

# 4) Nginx: copy config and enable (on server)
sudo cp /var/www/cpo-dashboard/deploy/nginx-cpo-dashboard.conf /etc/nginx/sites-available/cpo-dashboard
sudo ln -sf /etc/nginx/sites-available/cpo-dashboard /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

If you don’t have a git remote yet, use **Option B** to upload from your machine.

---

### Option B — Using rsync from your local machine (no git on server)

Run from your **local** machine (PowerShell or Git Bash), from the project root (parent of `src/`, `package.json`).

```bash
# 1) SSH and create app directory (one-time)
ssh -i /path/to/YOUR_KEY.pem ubuntu@ec2-54-217-14-204.eu-west-1.compute.amazonaws.com "sudo mkdir -p /var/www && sudo chown ubuntu:ubuntu /var/www"

# 2) Rsync project (exclude node_modules, .git, scripts, database)
rsync -avz --delete \
  -e "ssh -i /path/to/YOUR_KEY.pem" \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'scripts' \
  --exclude 'database' \
  --exclude 'dist' \
  ./ ubuntu@ec2-54-217-14-204.eu-west-1.compute.amazonaws.com:/var/www/cpo-dashboard/

# 3) SSH in and build on server
ssh -i /path/to/YOUR_KEY.pem ubuntu@ec2-54-217-14-204.eu-west-1.compute.amazonaws.com << 'ENDSSH'
cd /var/www/cpo-dashboard
echo 'VITE_API_URL=https://dash.evse.cloud' > .env.production
npm ci
npm run build
ENDSSH

# 4) On server: enable nginx site and reload (run once)
ssh -i /path/to/YOUR_KEY.pem ubuntu@ec2-54-217-14-204.eu-west-1.compute.amazonaws.com "sudo cp /var/www/cpo-dashboard/deploy/nginx-cpo-dashboard.conf /etc/nginx/sites-available/cpo-dashboard && sudo ln -sf /etc/nginx/sites-available/cpo-dashboard /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx"
```

Replace `/path/to/YOUR_KEY.pem` with the real path to your `.pem` file.

---

## 5. Vite/React: build and serve

- **Build:** Use `npm run build`. This runs TypeScript and Vite and produces static files in `dist/`.
- **Serve:** For production, **do not** run `npm run dev` or `vite preview` long-term. Two options:
  1. **nginx (recommended):** Serves `dist/` directly (fast, no Node process for static files). Config below.
  2. **PM2 + serve:** Run `npx serve -s dist -l 3000` and put nginx (or a reverse proxy) in front if you want.

This guide uses **nginx** to serve `dist/` and optionally proxy `/api` to your backend.

---

## 6. Nginx config

Config file is in the repo at `deploy/nginx-cpo-dashboard.conf`. Summary:

- Serves static files from `/var/www/cpo-dashboard/dist`.
- Optional reverse proxy: `/api` → your backend (e.g. `https://dash.evse.cloud`).
- Listens on port 80; optional SSL placeholder for later.

Use a **domain** or the **EC2 public DNS** as `server_name` (e.g. `ec2-54-217-14-204.eu-west-1.compute.amazonaws.com`).

---

## 7. Environment variable at build time

`VITE_API_URL` is read when you run `npm run build`. Options:

- **Same origin (e.g. nginx proxies /api):**  
  `echo 'VITE_API_URL=' > .env.production`  
  Then the app will call `/api` on the same host.

- **External API:**  
  `echo 'VITE_API_URL=https://dash.evse.cloud' > .env.production`  
  Then rebuild: `npm run build`.

After changing `.env.production`, always run `npm run build` again.

---

## 8. Redeploy (after code changes)

**If using git clone:**

```bash
ssh -i /path/to/YOUR_KEY.pem ubuntu@ec2-54-217-14-204.eu-west-1.compute.amazonaws.com
cd /var/www/cpo-dashboard
git pull
npm ci
npm run build
sudo systemctl reload nginx
```

**If using rsync:** run the same `rsync` and “SSH in and build” block as in Option B, then reload nginx.

---

## 9. Excluded from upload (rsync)

- `node_modules` — reinstalled with `npm ci` on server  
- `.git` — not needed if you don’t use git on server  
- `scripts` — not required for build or run  
- `database` — not required for frontend  
- `dist` — rebuilt on server with `npm run build`

---

## 10. Optional: PM2 instead of nginx for serving `dist/`

If you prefer a Node server instead of nginx for static files:

```bash
cd /var/www/cpo-dashboard
npm run build
npx serve -s dist -l 3000
# Or with PM2:
pm2 start "npx serve -s dist -l 3000" --name cpo-dashboard
pm2 save
pm2 startup
```

Then point nginx (or a load balancer) at `http://127.0.0.1:3000`, or open port 3000 in the security group and use `http://EC2_HOST:3000`.

---

## Quick reference

| Step | Command / action |
|------|-------------------|
| Connect | `ssh -i /path/to/YOUR_KEY.pem ubuntu@ec2-54-217-14-204.eu-west-1.compute.amazonaws.com` |
| App dir | `/var/www/cpo-dashboard` |
| Env | `echo 'VITE_API_URL=https://dash.evse.cloud' > .env.production` |
| Install | `npm ci` |
| Build | `npm run build` |
| Serve | nginx serving `dist/` (see `deploy/nginx-cpo-dashboard.conf`) |

---

## 11. Final deployment commands (in order)

Use **Option A** if the project is in a git repo you can clone from the server. Use **Option B** if you deploy from your PC (e.g. Windows with Git Bash or WSL).

**Windows note:** Use the full path to your `.pem` (e.g. `C:\Users\User\Desktop\my-key.pem`) and run `ssh`/`rsync` from **Git Bash** or **WSL** so the commands match. Replace `C:\path\to\YOUR_KEY.pem` in the examples below.

### One-time: server setup (run once on EC2 after first SSH)

```bash
ssh -i C:\path\to\YOUR_KEY.pem ubuntu@ec2-54-217-14-204.eu-west-1.compute.amazonaws.com
```

Then on the server:

```bash
sudo apt-get update && sudo apt-get upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs nginx
node -v
sudo mkdir -p /var/www && sudo chown ubuntu:ubuntu /var/www
exit
```

### Option A — Git clone (recommended)

On your **local** machine:

```bash
ssh -i C:\path\to\YOUR_KEY.pem ubuntu@ec2-54-217-14-204.eu-west-1.compute.amazonaws.com
```

On the **server**:

```bash
cd /var/www
git clone https://github.com/YOUR_ORG/REPO_NAME.git cpo-dashboard
cd cpo-dashboard
echo 'VITE_API_URL=https://dash.evse.cloud' > .env.production
npm ci
npm run build
sudo cp /var/www/cpo-dashboard/deploy/nginx-cpo-dashboard.conf /etc/nginx/sites-available/cpo-dashboard
sudo ln -sf /etc/nginx/sites-available/cpo-dashboard /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
exit
```

Replace `YOUR_ORG/REPO_NAME` with your real git URL (or use the clone URL you use locally).

### Option B — Rsync from local (no git on server)

From your **local** project root (folder that contains `package.json`, `src/`), in Git Bash or WSL:

```bash
# Upload (excludes node_modules, .git, scripts, database)
rsync -avz --delete -e "ssh -i C:\path\to\YOUR_KEY.pem" \
  --exclude 'node_modules' --exclude '.git' --exclude 'scripts' --exclude 'database' --exclude 'dist' \
  ./ ubuntu@ec2-54-217-14-204.eu-west-1.compute.amazonaws.com:/var/www/cpo-dashboard/

# Build on server
ssh -i C:\path\to\YOUR_KEY.pem ubuntu@ec2-54-217-14-204.eu-west-1.compute.amazonaws.com "cd /var/www/cpo-dashboard && echo 'VITE_API_URL=https://dash.evse.cloud' > .env.production && npm ci && npm run build"

# Enable nginx (run once)
ssh -i C:\path\to\YOUR_KEY.pem ubuntu@ec2-54-217-14-204.eu-west-1.compute.amazonaws.com "sudo cp /var/www/cpo-dashboard/deploy/nginx-cpo-dashboard.conf /etc/nginx/sites-available/cpo-dashboard && sudo ln -sf /etc/nginx/sites-available/cpo-dashboard /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx"
```

### Open the app

- **HTTP:** `http://ec2-54-217-14-204.eu-west-1.compute.amazonaws.com`
- Ensure EC2 **Security Group** allows **inbound TCP 80** (and 443 if you add HTTPS later).
