# Cove API Worker Setup

This repo now includes a unified Cloudflare Worker for Cove backend functionality.

## Files

- `workers/cove-api-worker.js` — unified Cove API
- `workers/media-upload-worker.js` — older media-only worker kept for reference
- `wrangler.toml` — deploys the unified Cove API Worker
- `.github/workflows/deploy-worker.yml` — GitHub Actions deployment workflow

## Current endpoints

```txt
GET  /health
POST /media/upload
POST /upload-media          # backward-compatible alias
GET  /boats
PUT  /boats
GET  /captains
PUT  /captains
```

Reserved roadmap endpoints:

```txt
POST /bookings
POST /agreements
POST /payments/webhook
GET  /availability
```

## GitHub Actions secrets

Add these repository secrets in GitHub Actions:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## Worker secret

The Worker needs a GitHub token so it can read/write JSON and commit uploaded media.

Set it in Cloudflare with Wrangler:

```bash
npx wrangler secret put GITHUB_TOKEN
```

Use a GitHub fine-grained token scoped to this repository with contents read/write permission.

## Worker variables

These are in `wrangler.toml`:

```toml
GITHUB_OWNER = "jeffrwinters"
GITHUB_REPO = "Cove-Charters"
GITHUB_BRANCH = "main"
MAX_UPLOAD_BYTES = "15728640"
ALLOWED_ORIGINS = "https://jeffrwinters.github.io,https://covecharters.com,https://www.covecharters.com"
```

## API URL

After deployment, the Worker URL will look like:

```txt
https://cove-api.<your-cloudflare-subdomain>.workers.dev
```

Use this upload endpoint in the Cove Admin dashboard:

```txt
https://cove-api.<your-cloudflare-subdomain>.workers.dev/media/upload
```

## Storage paths

Uploaded files are committed to:

```txt
assets/boats/{boat-slug}/photos/
assets/boats/{boat-slug}/videos/
assets/captains/{captain-name}/photos/
```

GitHub Pages will host them from the repository site.
