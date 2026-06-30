# Cove Charters Status

Last updated: 2026-06-30

## Current State

Cove Charters is a static GitHub Pages frontend backed by a Cloudflare Worker and Cloudflare D1 database.

The live production API is:

```txt
https://cove-api.jeff-r-winters.workers.dev
```

The active Worker file is:

```txt
workers/cove-api-v3-worker.js
```

The current API version is `0.3.10` after the media URL fix.

## Working End To End

### Boat Records

- Public homepage loads boat records from `GET /api/v1/boats`.
- Public boat detail can resolve boat records by id or slug.
- Admin Command Center can create, edit, and delete boat records through D1.
- Boat pricing is read from `boat_pricing` and returned as `startingPrice` and `priceUnit`.
- Admin writes require `Authorization: Bearer <ADMIN_TOKEN>`.

### Admin Auth

- `ADMIN_TOKEN` is configured in Cloudflare Worker secrets.
- `/api/v1/health` returns `adminAuth: true` when the secret exists.
- The admin page stores the entered token in browser local storage and sends it as a bearer token for protected writes.

### Media Slice

Completed so far:

- `POST /api/v1/media` uploads files to GitHub repo assets and inserts a D1 `media` row.
- Uploaded media rows store `raw.githubusercontent.com` URLs so admin/public previews work immediately without waiting for GitHub Pages publishing.
- `GET /api/v1/media?entityType=boat&entityId={boat_id}` returns ordered media rows.
- `GET /api/v1/media/{id}` returns one media row.
- `PUT /api/v1/media/{id}` updates title, alt text, sort order, and cover status.
- `DELETE /api/v1/media/{id}` deletes a media row.
- Admin boat detail view loads media, shows cover/gallery/videos, supports Set Cover, and supports drag/drop ordering.
- Admin media cards support editable captions stored in D1 `title`/`alt` fields.
- Public `boat.html` loads media for the selected boat.
- Public boat detail renders a cover-driven hero, gallery carousel, thumbnail strip, and videos when media exists.
- Public boat detail gracefully shows an empty media state when no media has been uploaded.

Recently proven/fixed:

- Real boat photos upload from the admin page and create D1 media rows.
- Existing media URLs were migrated from GitHub Pages URLs to raw GitHub URLs.
- Hose Monkey uploaded photos return `200 image/jpeg` from their stored URLs.

## Current Roadmap

1. Captains vertical slice.
2. Availability vertical slice.
3. Booking engine.
4. Charter agreements.
5. Trip closeout.
6. Back office settlement workflow.
7. Payments.
8. SEO and public polish.

## Development Rules

- Work in vertical slices: Database -> API -> Admin UI -> Public UI.
- Keep D1 as the source of truth for migrated domains.
- Keep JSON files as fallback/seed data only.
- Prefer small incremental commits.
- Keep Worker version numbers updated when API behavior changes.
- Keep this `docs/` folder updated whenever project state or architecture changes.
