# Push this project to GitHub (lenaabukhalil)

## 1. Project check

- **Package manager:** npm  
- **Build:** `npm run build`  
- **Type:** Frontend (Vite + React). No secrets in repo; `.env*` and keys are in `.gitignore`.

## 2. What’s in `.gitignore`

Ignored so they are **not** pushed:

- `node_modules/`
- `dist/`
- `.env`, `.env.local`, `.env.production`, and other `.env.*` (except `.env.production.example`)
- `scripts/`
- `database/`
- `*.tsbuildinfo`, `*.pem`, `*.key`, IDE/OS junk, logs

## 3. Where to run commands

All commands below must be run from the **project root** (the folder that contains `package.json`, `src/`, and `.gitignore`):

```bash
cd "C:\Users\User\Desktop\charging point operator"
```

(Adjust the path if your project is elsewhere.)

---

## 4. Commands in order (copy‑paste)

**Step 1 — Go to project folder**

```bash
cd "C:\Users\User\Desktop\charging point operator"
```

**Step 2 — Use this folder as the Git repo (if it isn’t already)**

If this folder has no `.git` yet (or you want it to be the repo root and not your user folder), run:

```bash
git init
```

If you already ran `git init` here and see your project files when you run `git status`, skip this.

**Step 3 — Add remote (create the repo on GitHub first)**

On GitHub: **New repository** → name it (e.g. `cpo-dashboard`) → **do not** add README/license/.gitignore (empty repo). Then run (replace `REPO_NAME` with the repo name you chose, e.g. `cpo-dashboard`):

```bash
git remote add origin https://github.com/lenaabukhalil/REPO_NAME.git
```

If `origin` already exists and points to the wrong repo:

```bash
git remote set-url origin https://github.com/lenaabukhalil/REPO_NAME.git
```

**Step 4 — Stage and commit**

```bash
git add .
git status
git commit -m "Initial commit: CPO dashboard (Vite + React)"
```

**Step 5 — Push**

```bash
git branch -M main
git push -u origin main
```

When prompted for credentials, use your GitHub username and a **Personal Access Token** (not your GitHub password). You can create a token under GitHub → Settings → Developer settings → Personal access tokens. No token or password should be pasted into chat.

---

## 5. Suggested repository name

- **`cpo-dashboard`** — matches `package.json` and is short.  
- **`charging-point-operator`** — more descriptive.

Create the repo on GitHub with one of these names (or any name you prefer), then use that name as `REPO_NAME` in the `git remote add` / `git remote set-url` command above.

---

## 6. If your Git repo is currently your user folder

If when you run `git status` you see files from your **user folder** (e.g. `../../.bash_history`, `../../Documents/`), the Git repo is **not** this project folder. In that case:

1. Open a new terminal.
2. `cd` into **only** the project folder:  
   `cd "C:\Users\User\Desktop\charging point operator"`
3. Run:  
   `git init`  
   so that this folder becomes the repo root.
4. Then run **Step 3–5** above (remote, add, commit, push).

After that, `git status` should list only files under the project (e.g. `src/`, `package.json`, `docs/`, etc.), and only those will be pushed to GitHub.

---

## 7. Summary

| Step | Command |
|------|--------|
| 1 | `cd "C:\Users\User\Desktop\charging point operator"` |
| 2 | `git init` (only if this folder is not yet a repo) |
| 3 | Create empty repo on GitHub, then: `git remote add origin https://github.com/lenaabukhalil/REPO_NAME.git` |
| 4 | `git add .` → `git status` → `git commit -m "Initial commit: CPO dashboard (Vite + React)"` |
| 5 | `git branch -M main` → `git push -u origin main` |

Replace `REPO_NAME` with your actual repo name (e.g. `cpo-dashboard`).
