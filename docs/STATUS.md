# Cove Charters Status

Last updated: 2026-06-29

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

The current API version is `0.3.6` after the media endpoint work.

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

- `POST /api/v1/media` uploads files to GitHub Pages assets and inserts a D1 `media` row.
- `GET /api/v1/media?entityType=boat&entityId={boat_id}` returns ordered media rows.
- `GET /api/v1/media/{id}` returns one media row.
- `PUT /api/v1/media/{id}` updates title, alt text, sort order, and cover status.
- `DELETE /api/v1/media/{id}` deletes a media row.
- Admin boat detail view loads media, shows cover/gallery/videos, supports Set Cover, and supports drag/drop ordering.

Still to finish:

- Public `boat.html` should load `GET /api/v1/media` for the selected boat.
- Public boat detail should render cover image, gallery carousel, and videos.
- Media upload and public rendering should be tested manually with a real boat photo/video.

## Current Roadmap

1. Finish Media public UI on `boat.html`.
2. Captains vertical slice.
3. Availability vertical slice.
4. Booking engine.
5. Charter agreements.
6. Trip closeout.
7. Back office settlement workflow.
8. Payments.
9. SEO and public polish.

## Development Rules

- Work in vertical slices: Database -> API -> Admin UI -> Public UI.
- Keep D1 as the source of truth for migrated domains.
- Keep JSON files as fallback/seed data only.
- Prefer small incremental commits.
- Keep Worker version numbers updated when API behavior changes.
- Keep this `docs/` folder updated whenever project state or architecture changes.
