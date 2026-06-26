# Deploying Departures

This project has two parts that deploy **separately**:

1. **The frontend** (React app) → GitHub Pages. Public, static, anyone can see the source.
2. **The proxy** (Cloudflare Worker) → Cloudflare. Holds your real Anthropic API key. This is the only piece that ever talks to Claude directly.

Deploy the proxy first — the frontend needs its URL.

---

## Part 1 — Deploy the proxy (Cloudflare Worker)

This is what keeps your API key out of the public repo and out of the browser.

1. Get an Anthropic API key from [console.anthropic.com](https://console.anthropic.com) if you don't have one.

2. Install Wrangler (Cloudflare's CLI) and log in:
   ```bash
   cd worker
   npm install -g wrangler
   wrangler login
   ```
   This opens a browser to authenticate with your Cloudflare account (free, no card required for this usage level).

3. Deploy the worker:
   ```bash
   wrangler deploy
   ```
   This prints a URL like `https://departures-proxy.yourname.workers.dev`. Copy it.

4. Set your API key as a secret — **never put it in a file**:
   ```bash
   wrangler secret put ANTHROPIC_API_KEY
   ```
   Paste your key when prompted. It's stored encrypted on Cloudflare's side, not in your code or repo.

5. Open `worker/index.js` and update `ALLOWED_ORIGINS` with your future GitHub Pages URL (you'll get the exact URL in Part 2, step 4 — come back and update this, then run `wrangler deploy` again). This restricts who can call your proxy.

---

## Part 2 — Deploy the frontend (GitHub Pages)

1. Open `src/config.js` and paste in the Worker URL from Part 1:
   ```js
   export const PROXY_URL = "https://departures-proxy.yourname.workers.dev";
   ```

2. Open `vite.config.js` and set `base` to match your repo name exactly:
   ```js
   base: "/your-repo-name/",
   ```

3. Push to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```

4. On GitHub: go to **Settings → Pages**, and under "Build and deployment", set **Source** to "GitHub Actions". The included workflow (`.github/workflows/deploy.yml`) will build and deploy automatically on every push to `main`.

5. After the first deploy finishes (check the **Actions** tab), your site is live at:
   ```
   https://YOUR_USERNAME.github.io/YOUR_REPO/
   ```

6. Go back to `worker/index.js`, put that exact URL into `ALLOWED_ORIGINS`, and redeploy the worker:
   ```bash
   cd worker
   wrangler deploy
   ```

---

## Verifying it works

- Visit your GitHub Pages URL.
- Open the "Ask Tower to replan" chat and send a message.
- If you get a response, you're done.
- If you get a CORS error in the browser console, double check step 6 above — the origins must match exactly (including `https://` and no trailing slash mismatch).
- If you get a 401/auth error, the secret wasn't set correctly — redo Part 1, step 4.

## Local development

```bash
npm install
npm run dev
```
This runs the frontend at `http://localhost:5173`, which is already whitelisted in `ALLOWED_ORIGINS` by default, so chat works locally too as long as the worker is deployed.

## Cost note

The Worker free tier covers 100,000 requests/day — far more than a demo needs. The only real cost is Anthropic API usage per message, which is small for short chat exchanges. The proxy also caps message length and conversation length as a basic guard against abuse if your link gets shared widely.
