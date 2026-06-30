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

The current API version is `0.3.12` after adding cover photos to boat list responses.

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
- Public homepage fleet cards use each boat's uploaded cover photo when available.

Recently proven/fixed:

- Real boat photos upload from the admin page and create D1 media rows.
- Existing media URLs were migrated from GitHub Pages URLs to raw GitHub URLs.
- Hose Monkey uploaded photos return `200 image/jpeg` from their stored URLs.

### Captains Slice

Completed so far:

- `GET /api/v1/captains` returns captain records from D1.
- `POST /api/v1/captains` creates a captain record.
- `GET /api/v1/captains/{id}` returns one captain record.
- `PUT /api/v1/captains/{id}` updates a captain record.
- `DELETE /api/v1/captains/{id}` deletes a captain and its boat approvals.
- `GET /api/v1/boats/{boat_id}/captains` returns approved captains for a boat.
- `PUT /api/v1/boats/{boat_id}/captains` replaces the approved captain list for a boat.
- Boat API responses now include `approvedCaptainIds` from D1.
- Admin Command Center has a Captains tab for CRUD.
- Admin boat detail has an Approved captains panel for assigning captains to boats.

## Current Roadmap

1. Finish Captains public selection surface.
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
