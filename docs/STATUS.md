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

The current API version is `0.3.15` after adding availability blocks.

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

### Booking Requests Slice

Completed so far:

- `GET /api/v1/bookings` returns booking requests joined with customer, boat, and captain names.
- `POST /api/v1/bookings` creates a customer row and booking request from the public site.
- `GET /api/v1/bookings/{id}` returns one booking request.
- `PUT /api/v1/bookings/{id}` updates booking status, paid status, captain, date/time, duration, and office notes.
- `DELETE /api/v1/bookings/{id}` deletes a booking request.
- Public `boat.html` has a Request this charter form.
- Public `boat.html` checks selected boat/date/time against availability blocks and shows a non-blocking availability message.
- Public booking requests append the availability guidance shown to the customer into customer notes for back-office context.
- Admin Command Center has a Bookings inbox with status updates.
- Admin booking cards now work as a small operations workbench: status, assigned captain, date, start time, duration, and office notes are editable in place.
- Admin booking cards include copy-ready internal summaries plus confirmation and decline customer reply drafts.
- Admin booking cards include quick actions for Confirm, Needs Follow-up, and Decline. These update status, stamp office notes, and copy customer-ready text where applicable.
- Agreement handling is intentionally back-office only after confirmation: customer booking requests stay lightweight, while confirmed/completed admin booking cards can track agreement status and copy an agreement packet checklist.
- Admin Bookings has filters for status, boat, captain, date range, and text search.
- Admin Bookings includes a master month calendar for dated booking requests; calendar entries respect the same status, boat, captain, date, and search filters.
- Booking statuses for admin operations are `requested`, `reviewing`, `confirmed`, `completed`, `declined`, and `cancelled`.
- Booking requests attempt an email notification when the Cloudflare Email Sending binding and notification variables are configured.

### Availability Slice

Completed so far:

- Remote D1 now has the `availability` table and `idx_availability_entity` index from `migrations/0002_create_availability.sql`.
- `GET /api/v1/availability` lists availability blocks and supports filters for `entityType`, `entityId`, `status`, `from`, and `to`.
- `POST /api/v1/availability` creates protected admin availability blocks.
- `GET /api/v1/availability/{id}` returns one availability block.
- `PUT /api/v1/availability/{id}` updates a protected admin availability block.
- `DELETE /api/v1/availability/{id}` deletes a protected admin availability block.
- Admin Bookings can create boat/captain holds, unavailable windows, maintenance blocks, and captain unavailable blocks.
- Admin calendar renders availability blocks alongside bookings.
- Booking cards show availability conflict warnings when their boat or captain overlaps an availability block.

## Current Roadmap

1. Captain availability guidance and customer confirmation email workflow.
2. Configure Cloudflare Email Sending binding/variables for live booking alerts.
3. Turn the agreement packet workflow into real document/e-sign storage.
4. Trip closeout.
5. Back office settlement workflow.
6. Payments.
7. SEO and public polish.

## Development Rules

- Work in vertical slices: Database -> API -> Admin UI -> Public UI.
- Keep D1 as the source of truth for migrated domains.
- Keep JSON files as fallback/seed data only.
- Prefer small incremental commits.
- Keep Worker version numbers updated when API behavior changes.
- Keep this `docs/` folder updated whenever project state or architecture changes.
