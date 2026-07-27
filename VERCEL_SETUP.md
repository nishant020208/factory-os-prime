# Vercel Deployment Guide — FactoryOS AI

## Prerequisites

1. A **Vercel** account connected to your GitHub repository
2. A **Supabase** project with all migrations applied

---

## Step 1 — Set Environment Variables in Vercel Dashboard

Go to your Vercel project → **Settings** → **Environment Variables** and add these:

### Required — All Roles

| Name | Value | Scope |
|:-----|:------|:------|
| `SUPABASE_URL` | `https://ytawmeiylkrzjzmauvhf.supabase.co` | All |
| `SUPABASE_PUBLISHABLE_KEY` | Your Supabase **anon/public** key | All |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase **service_role** key 🔒 | Preview + Production |
| `VITE_SUPABASE_URL` | Same as `SUPABASE_URL` | All |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Same as `SUPABASE_PUBLISHABLE_KEY` | All |
| `VITE_SUPABASE_PROJECT_ID` | `ytawmeiylkrzjzmauvhf` | All |

> **⚠️ Security note**: `SUPABASE_SERVICE_ROLE_KEY` bypasses Row-Level Security.
> Never expose it to the client — it's only used during Server-Side Rendering (SSR)
> for admin operations like auth middleware, notifications, and order lifecycle.

### How to find your keys

| Key | Location in Supabase Dashboard |
|:----|:-------------------------------|
| URL | Project Settings → API → Project URL |
| anon/public key | Project Settings → API → Project API keys → `anon` / `public` |
| service_role key | Project Settings → API → Project API keys → `service_role` |

---

## Step 2 — Deploy

1. Push to GitHub: `git push origin main`
2. In Vercel Dashboard: **Add New Project** → Import your GitHub repo
3. Vercel auto-detects the build command (`vite build`) and output directory (`.output/public`)
4. Click **Deploy**

> **Note**: The `@lovable.dev/vite-tanstack-config` package auto-detects the Vercel
> environment at build time via Nitro's platform detection. No manual preset override needed.

---

## Step 3 — Verify

After deployment:
1. Visit your Vercel URL (e.g. `https://your-app.vercel.app`)
2. Click **Get started** → **Sign in** → pick a role → **One-click sign in**
3. Verify the dashboard loads with real data from Supabase

---

## Local Development

```bash
# 1. Copy the template and fill in your keys
cp .env.example .env
# Edit .env with your real Supabase keys

# 2. Install dependencies
npm install

# 3. Start dev server
npm run dev -- --port 5181
```

---

## Troubleshooting

### "Missing Supabase environment variable(s)"

**Cause**: Vite reads `.env` at startup. If you add env vars while the dev server is running, it won't see them.

**Fix**: Kill the dev server and restart: `npm run dev -- --port 5181`

### "Module not found" errors on Vercel

**Cause**: A dependency failed to install during build.

**Fix**: Enable **Auto Install** in Vercel project settings or add a lockfile (`package-lock.json`) to your repo.

### SSR errors returning the error page

**Cause**: A server-side rendering crash (often missing env var or DB connection issue).

**Fix**: Check Vercel Function Logs in the Vercel Dashboard → Deployments → latest → Functions.
