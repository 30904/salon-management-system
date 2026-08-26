# Deployment (DigitalOcean Droplet)

CI/CD is two GitHub Actions workflows. Each builds on GitHub's own runner,
then ships the *built output* to the droplet via `rsync` over SSH and
reloads the relevant process there — no git, and no GitHub credentials, ever
touch the server itself.

- `.github/workflows/deploy-backend.yml` — triggers on push to `main` under
  `backend/**`. Runs `npm ci --prefix backend` as a build gate, then
  `scripts/deploy-backend.sh` (rsyncs `backend/` source, excluding
  `node_modules`/`.env`, then on the server: `npm ci --omit=dev` + `pm2
  reload s21-backend`).
- `.github/workflows/deploy-frontend.yml` — triggers on push to `main`
  under `frontend/**`. Lints and builds the Vite app *on the runner*, then
  `scripts/deploy-frontend.sh` rsyncs just `frontend/dist/` to the server
  and reloads nginx.

Both are also manually triggerable from the Actions tab (`workflow_dispatch`).
They share a `do-deploy` concurrency group so a push touching both folders
deploys sequentially instead of racing.

`scripts/deploy-backend.sh` / `deploy-frontend.sh` are written to run from
*wherever you have the repo + SSH access* — the GitHub runner, or your own
machine for a manual deploy — never on the server itself.

## Target: `/home/s21` (new, separate from the existing `/home/salonerp`)

The droplet currently runs the live app out of `/home/salonerp/backend` and
`/home/salonerp/frontend` as plain folders (not git, deployed by hand
historically). Rather than touch that directly, the first automated deploys
land in a fresh `/home/s21` — once verified working, PM2 and nginx get
pointed at it and the old folders can be retired. `/home/salonerp` is left
completely alone until that cutover.

## One-time server setup

1. **Create the target directory** (root owns `/home`, so this needs sudo
   once):
   ```bash
   sudo mkdir /home/s21
   sudo chown salonerp:salonerp /home/s21
   ```

2. **Create `backend/.env` in the new location** — rsync deliberately never
   touches `.env` (excluded so a deploy can't wipe secrets), so it has to
   exist there before the first deploy:
   ```bash
   mkdir -p /home/s21/backend
   nano /home/s21/backend/.env
   # Same shape as backend/.env.example, with real prod values: MONGO_URI,
   # JWT_SECRET / JWT_REFRESH_SECRET, CLIENT_URL, NODE_ENV=production
   ```

3. **Confirm passwordless sudo for nginx reload** — already done and
   verified working (`/etc/sudoers.d/deploy-nginx-reload`, 2026-08-26).

4. **Point nginx at the new location — only once verified working.** Until
   then, the new deploy sits in `/home/s21/frontend/dist` unused by nginx.
   When ready to cut over, update the site config's `root` to
   `/home/s21/frontend/dist` and `sudo nginx -t && sudo systemctl reload
   nginx`.

5. **Cut PM2 over — only once verified working.** The backend process
   `s21-backend` currently runs from `/home/salonerp/backend`. To point it
   at the new location: `pm2 delete s21-backend`, then start it fresh from
   `/home/s21/backend` (`pm2 start server.js --name s21-backend --cwd
   /home/s21/backend`), then `pm2 save`. After this, `scripts/deploy-backend.sh`'s
   `pm2 reload s21-backend` will reload the right process automatically.

## GitHub repo secrets

Settings → Secrets and variables → Actions → New repository secret:

| Secret | Value |
|---|---|
| `DO_HOST` | `64.227.164.24` |
| `DO_SSH_USER` | `salonerp` |
| `DO_SSH_PORT` | `22` |
| `DO_SSH_KEY` | Full contents of `~/.ssh/salonerp_droplet` (the existing recovered key — reused deliberately, no separate deploy key needed since nothing on the server ever talks to GitHub) |
| `DO_DEPLOY_PATH` | `/home/s21` |

## Day to day

Merge to `main` → the relevant workflow(s) run automatically. Watch progress
under the repo's Actions tab. `deploy-backend.sh` polls `/api/health` after
reloading (10 retries over ~20s) and fails the workflow if the backend
doesn't come back healthy — check `pm2 logs s21-backend` on the droplet.

**Manual deploy** (bypass CI, e.g. to debug) — from your own machine, with
the repo checked out and SSH access to the droplet:
```bash
export DO_HOST=64.227.164.24 DO_SSH_USER=salonerp DO_DEPLOY_PATH=/home/s21
export DO_SSH_KEY_PATH="$HOME/.ssh/salonerp_droplet"
bash scripts/deploy-backend.sh
# and/or, after building:
npm run build --prefix frontend
bash scripts/deploy-frontend.sh
```

**Rollback**: there's no git history on the server to reset to (rsync just
overwrites). Two options:
- Re-run the workflow for an older commit (Actions tab → find the last-good
  run → "Re-run all jobs"), or check out that commit locally and run the
  manual deploy commands above.
- (Not yet implemented) a releases-folder + `current`-symlink pattern would
  make rollback instant (repoint the symlink) instead of requiring a
  re-deploy — worth adding once the basic flow is proven out.

## Optional hardening

- Add a GitHub **Environment** named `production` with required reviewers on
  the `deploy` job in both workflows, so deploys need manual approval.
- Consider switching `DO_SSH_KEY` to a dedicated deploy-only keypair later,
  so a leaked GitHub secret wouldn't also expose personal droplet access.
