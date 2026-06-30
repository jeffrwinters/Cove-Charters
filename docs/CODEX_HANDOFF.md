# Cove Charters - Codex Handoff

## Project Vision

Cove Charters is a premium charter marketplace for Lake of the Ozarks focused on upscale experiences. The architecture is moving from a JSON prototype to a production Cloudflare Worker plus D1 backend.

For the latest concise project state, start with `docs/STATUS.md`.

## Current Status

### Infrastructure

- Cloudflare Worker deployed through GitHub Actions
- Cloudflare D1 connected
- Database schema initialized
- Seed boats imported into D1
- Business settings stored in D1, including editable mileage rate
- `ADMIN_TOKEN` configured in Cloudflare Worker secrets
- Admin write endpoints protected with bearer-token auth

### Boat Vertical Slice

Completed:

- Homepage loads boats from `GET /api/v1/boats`
- `boat.html` loads boats from `GET /api/v1/boats`
- Admin reads and writes boats through:
  - `GET /api/v1/boats`
  - `POST /api/v1/boats`
  - `PUT /api/v1/boats/{id}`
  - `DELETE /api/v1/boats/{id}`
- Boat pricing returns from D1 as `startingPrice` and `priceUnit`

### Media Vertical Slice

Completed so far:

- `POST /api/v1/media` uploads a file and inserts a row in the D1 `media` table
- Uploaded media rows store `raw.githubusercontent.com` URLs to avoid GitHub Pages publish lag in admin/public previews
- `GET /api/v1/media` supports `entityType`, `entityId`, and `mediaType` filters
- `GET /api/v1/media/{id}` returns one media row
- `PUT /api/v1/media/{id}` updates title, alt, sort order, and cover status
- `DELETE /api/v1/media/{id}` deletes a media row
- Admin boat detail view shows cover photo, gallery photos, and videos
- Admin supports Set Cover and drag/drop sort persistence
- Public `boat.html` renders boat media with a cover-driven hero, gallery carousel, thumbnail strip, and videos

Recently proven/fixed:

- Real boat photos upload from admin and create D1 media rows
- Existing media URLs were migrated from GitHub Pages URLs to raw GitHub URLs
- Hose Monkey uploaded photos return `200 image/jpeg` from their stored URLs

## Immediate Goal

Build the Availability vertical slice so booking requests can be checked against boat and captain availability before confirmation.

The Booking Requests slice is now useful for MVP back-office triage:

- Public boat pages can submit booking requests.
- Admin booking cards show customer, boat, captain, date/time, duration, customer notes, and office notes.
- Back office can edit booking status, assigned captain, schedule, duration, and internal notes.
- Admin includes copy-ready internal summaries plus confirmation and decline customer reply drafts.
- Admin Bookings can be filtered by status, boat, captain, date range, and text search.
- Admin Bookings includes a master month calendar for dated booking requests. Calendar entries use the same filters and click through to the matching booking card.

## Architectural Rules

- Do not rewrite existing boat CRUD.
- Do not change the D1 schema unless absolutely necessary.
- Extend existing endpoints instead of replacing them.
- Prefer small incremental commits.
- Keep Worker version numbers updated.
- Keep `docs/STATUS.md` updated when project state changes.

## Business Rules

Trips track:

- Start miles
- End miles
- Billable miles
- Mileage charge
- Cleaning fee
- Fuel payer
- Fuel amount
- Damage notes
- Captain notes
- Office notes

Mileage rate is currently `$14/mile` and must remain editable in Settings.

Back office tracks:

- Booking paid status
- Captain payout
- Owner payout
- Fuel reimbursement
- Cleaning fees
- Settlement workflow

## Roadmap

1. Availability rules/data model for boat and captain blackout dates, holds, and conflicts
2. Booking Engine
3. Charter Agreements
4. Trip Closeout
5. Back Office
6. Payments
7. SEO and Public Polish

## Development Philosophy

Work in vertical slices:

Database -> API -> Admin UI -> Public UI

Complete each slice before starting the next.
