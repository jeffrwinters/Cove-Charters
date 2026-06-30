# Cove API Worker Setup

This repo includes a Cloudflare Worker backend for Cove boat records, media uploads, and D1-backed admin workflows.

## Active Files

- `workers/cove-api-v3-worker.js` - active Cove API Worker referenced by `wrangler.toml`
- `wrangler.toml` - Worker deployment config and D1 binding
- `migrations/0001_initial_cove_schema.sql` - initial D1 schema
- `.github/workflows/deploy-worker.yml` - GitHub Actions deployment workflow
- `workers/cove-api-worker.js`, `workers/cove-api-d1-worker.js`, and `workers/media-upload-worker.js` - older/reference Worker versions

## Current Endpoints

Public reads:

```txt
GET /health
GET /api/v1/health
GET /api/v1/boats
GET /api/v1/boats/{id-or-slug}
GET /api/v1/settings
GET /api/v1/media
GET /api/v1/media/{id}
```

`GET /api/v1/media` supports these optional filters:

```txt
entityType
entityId
mediaType
```

Example:

```txt
GET /api/v1/media?entityType=boat&entityId=boat_123
```

Protected writes require `Authorization: Bearer <ADMIN_TOKEN>`:

```txt
POST   /api/v1/admin/import-seed
POST   /api/v1/boats
PUT    /api/v1/boats/{id}
DELETE /api/v1/boats/{id}
PUT    /api/v1/settings
POST   /api/v1/media
PUT    /api/v1/media/{id}
DELETE /api/v1/media/{id}
POST   /api/v1/media/upload
POST   /media/upload
POST   /upload-media
```

## GitHub Actions Secrets

Add these repository secrets in GitHub Actions:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## Worker Secrets

Set these in Cloudflare with Wrangler:

```bash
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put ADMIN_TOKEN
```

`GITHUB_TOKEN` should be a GitHub fine-grained token scoped to this repository with contents read/write permission. It is used only for GitHub-backed media uploads.

`ADMIN_TOKEN` protects all write, upload, and seed-import endpoints. Store the same value in the Cove Admin page token field when making edits from `admin.html`.

## Worker Variables

These are in `wrangler.toml`:

```toml
GITHUB_OWNER = "jeffrwinters"
GITHUB_REPO = "Cove-Charters"
GITHUB_BRANCH = "main"
MAX_UPLOAD_BYTES = "15728640"
ALLOWED_ORIGINS = "https://jeffrwinters.github.io,https://covecharters.com,https://www.covecharters.com"
```

The D1 binding is also configured in `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "cove-production"
```

## Booking Email Notifications

Booking requests save successfully even when email is not configured. To enable email alerts, Cloudflare Email Sending must be enabled for the sending domain and the Worker must have an email binding.

Expected Worker binding:

```toml
send_email = [
  { name = "EMAIL" }
]
```

Expected Worker variables:

```toml
BOOKING_NOTIFY_TO = "ops@example.com"
BOOKING_NOTIFY_FROM = "bookings@yourdomain.com"
BOOKING_NOTIFY_FROM_NAME = "Cove Charters"
ADMIN_URL = "https://jeffrwinters.github.io/Cove-Charters/admin.html"
```

`BOOKING_NOTIFY_FROM` must use a domain onboarded in Cloudflare Email Sending. `/api/v1/health` reports `bookingEmail: true` when the binding and required variables are present.

## API URL

The current public Worker URL used by the static pages is:

```txt
https://cove-api.jeff-r-winters.workers.dev
```

## Media Storage Paths

Uploaded files are committed to:

```txt
assets/boats/{boat-slug}/photos/
assets/boats/{boat-slug}/videos/
assets/captains/{captain-name}/photos/
```

GitHub Pages hosts those files from the repository site after the commit lands.

Media metadata is written to the D1 `media` table with `entity_type`, `entity_id`, `media_type`, `url`, `title`, `alt`, `sort_order`, and `is_cover`.
