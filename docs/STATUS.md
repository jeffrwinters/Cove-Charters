# Cove Charters Status

Last updated: 2026-07-01

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

The current API version is `0.3.27` after adding admin-controlled crop settings for captain photos and boat cover media.

## Working End To End

### Boat Records

- Public homepage loads boat records from `GET /api/v1/boats`.
- Public boat detail can resolve boat records by id or slug.
- Admin Command Center can create, edit, and delete boat records through D1.
- Admin Boats can drag/drop boat cards to control public fleet display order via `boats.sort_order`.
- Public homepage fleet cards render in `sortOrder` order.
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
- Public homepage and boat detail pages include baseline SEO metadata, canonical URLs, Open Graph tags, and lightweight structured data.
- Public boat detail page has customer-facing language for overview, media, amenities, and available captains; internal/admin MVP wording is hidden from guests.

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
- Admin captain profiles have an Approved boats panel for managing the same boat/captain approval relationship from the captain side.

### Booking Requests Slice

Completed so far:

- `GET /api/v1/bookings` returns booking requests joined with customer, boat, and captain names.
- `POST /api/v1/bookings` creates a customer row and booking request from the public site.
- `GET /api/v1/bookings/{id}` returns one booking request.
- `PUT /api/v1/bookings/{id}` updates booking status, paid status, captain, date/time, duration, and office notes.
- `DELETE /api/v1/bookings/{id}` deletes a booking request.
- Public `boat.html` has a Request this charter form.
- Public `boat.html` checks selected boat/date/time against availability blocks and shows a non-blocking availability message.
- Public and admin time inputs are constrained and snapped to 30-minute increments.
- Public booking requests append the availability guidance shown to the customer into customer notes for back-office context.
- Public booking request form now sets clearer expectations: no payment due today, Cove confirms boat/captain/agreement/payment details, and customers should watch email after submission.
- Admin Command Center has a booking lifecycle Kanban board for requested, reviewing, confirmed, completed, and closed bookings.
- API base URL, admin token controls, auth status, and raw API/state JSON live under API Debug instead of Command Center.
- Admin Command Center has a Bookings inbox with status updates.
- Admin booking cards now work as a small operations workbench: status, assigned captain, date, start time, duration, and office notes are editable in place.
- Admin booking cards include copy-ready internal summaries plus confirmation and decline customer reply drafts.
- Admin booking cards include quick actions for Confirm, Needs Follow-up, and Decline. These update status, stamp office notes, and copy customer-ready text where applicable.
- Admin confirmed/completed booking cards include Send Confirmation. It calls `POST /api/v1/bookings/{id}/send-confirmation`; if Resend email sending is not configured, the admin falls back to copying the confirmation text.
- After back-office confirmation, Admin can send a guided agreement packet with `POST /api/v1/bookings/{id}/send-agreement-packet`.
- Sending an agreement packet now requires a boat, captain, date, start time, and duration. Admin saves the current booking edits before sending so date/time/captain changes are baked into the packet.
- Booking records now track `agreement_status`, sent/signed timestamps, and an optional `signing_url`.
- Cove now has an internal public signing page at `sign.html?token=...`; agreement packet emails generate this link when a custom signing URL is not provided.
- The signing page treats boat, captain, date, start time, duration, and customer as display-only confirmed details. If those change, back office should update the booking and send a fresh signing packet.
- Internal signing sections now use the legal copy lifted from the existing Cove Gravity Forms agreement page, with old booking-selection placeholders normalized to confirmed booking details.
- Signing initials now carry forward after first entry, and section navigation validates the current step before moving.
- Public signing submissions are stored in `booking_signatures` and mark the booking agreement as signed.
- When a customer signs, Cove sends a signed-document notice to the back office and assigned captain when email is configured and the captain has an email address.
- Signed charter documents can be attached to booking records through `POST /api/v1/bookings/{id}/documents`.
- Booking emails use Resend REST API when `RESEND_API_KEY` and `BOOKING_NOTIFY_FROM` are configured.
- Admin confirmed/completed bookings with an assigned captain include Copy Captain Packet and Send Captain Packet. The send action calls `POST /api/v1/bookings/{id}/send-captain-packet`, requires the assigned captain to have an email address, and attaches signed booking documents / configured bareboat template URLs when available.
- Current MVP email sender uses the temporary `lakefrontatloto.com` domain. Revisit this configuration after Cove controls `covecharters.com`; likely target is `BOOKING_NOTIFY_FROM=bookings@covecharters.com` with replies routed to the back-office inbox.
- Agreement handling is intentionally post-confirmation: customer booking requests stay lightweight, then back office sends a guided document packet and attaches signed documents to the booking for office/captain access.
- Source legal copy came from the existing Cove multi-step agreement page, even though all steps share one URL; final business/legal review is still needed before production reliance.
- Confirmed/completed admin booking cards include MVP trip closeout controls for actual hours, miles traveled, payment status, additional charge line items, and closeout notes. Complete Trip stamps office notes, marks the booking completed, and copies a settlement summary.
- Admin booking cards now include an MVP settlement calculator for post-charter fuel charge and payout review.
- Settlement calculator saves trip closeout and draft settlement records to D1 through `PUT /api/v1/bookings/{id}/settlement`.
- Settlement math now follows the reviewed `Charges and Payout.xlsx` workbook; a formula-preserving CSV copy is stored at `docs/Charges and Payout.csv`.
- Current settlement rules: captain pay is actual hours times the captain hourly rate; owner/Cove split the charter fee after captain pay; sales tax is calculated on charter fee plus cleaning fee; total collected includes charter fee, cleaning, tax, fuel deposit, fuel charge, and additional charge line items; fuel deposit refund is reduced by fuel charge and additional charges.
- Admin now includes a basic Owners manager. Boats can be assigned to an owner from the Boat editor dropdown or from the Owner manager's owned-boats checklist.
- Admin confirmed/completed bookings can send a final invoice to the customer. The action saves the current settlement first, then emails an itemized final invoice through Resend.
- Admin Bookings has filters for status, boat, captain, date range, and text search.
- Admin Bookings has a summary-list to detail drill-in workflow, with the full booking editor behind the selected record.
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

### Admin UX Refactor Slice

Completed so far:

- Admin Command Center was split from a monolithic `admin.html` into separate HTML, CSS, and JS assets.
- Shared admin detail header assets now provide sticky breadcrumb plus compact Save affordances.
- Universal admin side-panel assets are loaded and available for future low-risk detail views; full editors were not replaced during the MVP merge.
- Boats and Captains now use the shared sticky breadcrumb/save header.
- Admin has a Customer List tab in desktop and mobile navigation.
- Customer List is derived from booking records for MVP and preserves list-to-detail drill-in UX.
- Customer statuses supported in the UI are `new`, `repeat`, `vip`, and `banned`.
- Banned customers show a soft red warning banner in the customer detail view.
- Customer status/notes/profile overrides are stored in browser localStorage under `cove_customer_overrides` until a durable customer table/API is added.

### Captain Images Slice

Completed so far:

- Captain records now support canonical `photoUrl` backed by D1 column `captains.photo_url`.
- Admin captain profiles can upload, preview, paste, replace, remove, and crop a captain headshot/profile image.
- Public captain cards read `photoUrl`, honor `photoFocalX`, `photoFocalY`, and `photoZoom`, and fall back to initials/placeholders when missing.
- Boat cover media rows now support `focalX`, `focalY`, and `zoom`; admin can crop the selected cover image for public fleet cards and boat detail heroes.
- Migration file `migrations/0006_add_captain_photo_url.sql` adds the `photo_url` column.
- Migration file `migrations/0008_add_image_crop_fields.sql` adds captain and media crop fields. The remote D1 schema and migration journal were reconciled after older migrations had already been applied outside the journal.

## Current Roadmap

1. Add a durable customers data model/API so Customer List edits are shared across admin browsers.
2. Add a cleaner captain-facing trip view / future captain app foundation.
3. Turn the agreement packet workflow into real document/e-sign storage.
4. Turn closeout/settlement notes into structured accounting records.
5. Back office settlement workflow.
6. Payments.
7. SEO and public polish.

Parked idea: mobile sticky `Book This Boat` CTA on public boat detail pages. A version that appeared after the hero CTA and hid over the request form was shelved because it did not match the desired flow; revisit if the boat detail page layout changes.

## Development Rules

- Work in vertical slices: Database -> API -> Admin UI -> Public UI.
- Keep D1 as the source of truth for migrated domains.
- Keep JSON files as fallback/seed data only.
- Prefer small incremental commits.
- Keep Worker version numbers updated when API behavior changes.
- Keep this `docs/` folder updated whenever project state or architecture changes.
