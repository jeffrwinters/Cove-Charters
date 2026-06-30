# Cove Charters - Codex Handoff

## Project Vision

Cove Charters is a premium charter marketplace for Lake of the Ozarks focused on upscale experiences. The architecture is moving from a JSON prototype to a production Cloudflare Worker plus D1 backend.

## Current Status

### Infrastructure

- Cloudflare Worker deployed through GitHub Actions
- Cloudflare D1 connected
- Database schema initialized
- Seed boats imported into D1
- Business settings stored in D1, including editable mileage rate

### Boat Vertical Slice

Completed:

- Homepage loads boats from `GET /api/v1/boats`
- `boat.html` loads boats from `GET /api/v1/boats`
- Admin reads and writes boats through:
  - `GET /api/v1/boats`
  - `POST /api/v1/boats`
  - `PUT /api/v1/boats/{id}`
  - `DELETE /api/v1/boats/{id}`

Boat uploads currently store files successfully.

Current limitation:

- Uploads do not yet create rows in the D1 `media` table.

## Immediate Goal

Finish the Media vertical slice.

### Worker

Extend the existing Cove API Worker.

`POST /api/v1/media` should:

1. Upload the file.
2. Insert a row in the `media` table.

Fields:

- `id`
- `entity_type`
- `entity_id`
- `media_type`
- `url`
- `title`
- `alt`
- `sort_order`
- `is_cover`
- `created_at`

Add:

`GET /api/v1/media`

Supported query parameters:

- `entityType`
- `entityId`

Example:

`GET /api/v1/media?entityType=boat&entityId=boat_123`

Returns ordered media.

### Admin

After upload:

- Refresh gallery automatically
- Display cover photo
- Display gallery
- Display videos
- Allow cover selection
- Allow drag/drop sort

### Public Site

Boat detail page should load media using `GET /api/v1/media` and display:

- Cover image
- Gallery carousel
- Videos

## Architectural Rules

- Do not rewrite existing boat CRUD.
- Do not change the D1 schema unless absolutely necessary.
- Extend existing endpoints instead of replacing them.
- Prefer small incremental commits.
- Keep Worker version numbers updated.

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

1. Finish Media
2. Captains
3. Availability
4. Booking Engine
5. Charter Agreements
6. Trip Closeout
7. Back Office
8. Payments
9. SEO and Public Polish

## Development Philosophy

Work in vertical slices:

Database -> API -> Admin UI -> Public UI

Complete each slice before starting the next.
