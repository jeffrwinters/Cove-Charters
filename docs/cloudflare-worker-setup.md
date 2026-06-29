# Cove Cloudflare Worker Setup

This repo includes a Cloudflare Worker for uploading Cove media files to GitHub so GitHub Pages can host them.

## Files added

- `workers/media-upload-worker.js` — upload API
- `wrangler.toml` — Cloudflare Worker config
- `.github/workflows/deploy-worker.yml` — GitHub Actions deployment workflow

## GitHub Actions secrets

Add these secrets in GitHub:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

The API token should have permission to deploy Workers.

## Worker secret

The Worker also needs a GitHub token so it can commit uploaded files to this repository.

Set it locally with Wrangler:

```bash
npx wrangler secret put GITHUB_TOKEN
```

Use a GitHub fine-grained token scoped to this repository with contents read/write permission.

## Worker variables

These are already in `wrangler.toml`:

```toml
GITHUB_OWNER = "jeffrwinters"
GITHUB_REPO = "Cove-Charters"
GITHUB_BRANCH = "main"
MAX_UPLOAD_BYTES = "15728640"
```

## Upload endpoint

After deployment, the endpoint will be:

```txt
https://<your-worker-name>.<your-cloudflare-subdomain>.workers.dev/upload-media
```

Paste that full URL into the Cove Admin dashboard under **Worker upload URL**.

## Storage paths

Uploaded files are committed to:

```txt
assets/boats/{boat-slug}/photos/
assets/boats/{boat-slug}/videos/
assets/captains/{captain-name}/photos/
```

GitHub Pages will host them from the repository site.
