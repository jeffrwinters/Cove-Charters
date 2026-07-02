# Cove Charters Database Notes

Cloudflare D1 is the source of truth for migrated domains.

## Important Tables

### settings

Stores editable system/business settings.

Examples:

- mileage rate
- sales tax rate
- cleaning fee
- fuel deposit
- captain hourly rate
- owner split
- Cove split

### owners

Represents boat owners.

### boats

Primary fleet/inventory table.

Important fields:

- `id`
- `owner_id`
- `slug`
- `name`
- `status`
- `lifecycle_status`
- `booking_enabled`
- `featured`
- `sort_order`
- `home_port`
- `length_ft`
- `capacity`
- `bedrooms`
- `bathrooms`
- `make`
- `model`
- `boat_type`
- `short_description`
- `source_listing_url`

### boat_pricing

Stores per-boat pricing plans.

Examples:

- 4 hour
- 6 hour
- 8 hour
- custom

### captains

Stores captain profile records.

Image fields:

- `photo_url`
- `photo_focal_x`
- `photo_focal_y`
- `photo_zoom`

### boat_captains

Join table for approved boat/captain relationships.

- `sort_order` controls the per-boat priority order shown in the customer captain selector.

### customers

Stores customer records.

Important MVP fields:

- `status`: `new`, `repeat`, `vip`, or `banned`
- `favorite_boat`
- `favorite_captain`
- `notes`

### admin_users

Back-office user accounts for the admin application.

Important fields:

- `email`
- `name`
- `role`: currently `admin`, `staff`, `captain`, or `owner`
- `status`: currently `active`, `inactive`, or `invited`
- password hash metadata only; plaintext passwords are never stored

### admin_sessions

Hashed user session tokens for admin access.

Important fields:

- `user_id`
- `token_hash`
- `expires_at`
- `revoked_at`

### bookings

Customer-facing booking records.

Booking should snapshot price/settings values used at booking time.

Agreement workflow fields:

- `agreement_status`
- `agreement_sent_at`
- `agreement_signed_at`
- `signing_url`
- `signing_token`
- `signing_completed_at`
- `captain_trip_token`
- `captain_trip_url`
- `captain_trip_sent_at`

Captain trip links use `captain-trip.html?token=...` and expose a read-only captain-facing packet for assigned trips.

### booking_documents

Stores documents attached to a booking, including signed bareboat agreements.
Electronic signing records use `document_type = electronic_signature_record` and point to `signed.html?token=...` so the office/captain can open a printable signed packet from the booking.

Important fields:

- `booking_id`
- `document_type`
- `title`
- `url`
- `filename`
- `content_type`
- `status`
- `audience`

### booking_signatures

Stores electronic signature records submitted through Cove's internal signing page.

Important fields:

- `booking_id`
- `signer_name`
- `signer_email`
- `accepted_json`
- `signature_text`
- `signed_at`

### trips

Operational trip closeout record for what actually happened on the water.

### settlements

Financial settlement record for owner, captain, Cove, and customer adjustments.

Additional charge line items are stored in `additional_charges_json`; `additional_charges` remains the summed amount for reporting and compatibility.

### accounting_records

Structured ledger-style rows generated from the latest settlement calculation.

Important fields:

- `booking_id`
- `trip_id`
- `settlement_id`
- `party_type` / `party_id`
- `direction`
- `category`
- `label`
- `amount`
- `status`
- `metadata_json`

Settlement saves regenerate the `settlement_calculation` rows for the current settlement so closeout edits stay aligned with customer charges, customer credits, captain payout, owner payout, and Cove commission.

### payments

Tracks payment movement and external references.

`migrations/0016_upgrade_payments_for_stripe.sql` prepares this existing table for the upcoming Stripe integration by adding provider/session/payment-intent fields, checkout URL, purpose, currency, and metadata JSON.

`bookings.paid_status`, `settlements.customer_paid_status`, and `accounting_records` remain the operational/reporting source of truth; `payments` stores the external processor audit trail.

### media

Generic media table used by boats and captains.

Important fields:

- `id`
- `entity_type`
- `entity_id`
- `media_type`
- `url`
- `title`
- `alt`
- `sort_order`
- `is_cover`
- `focal_x`
- `focal_y`
- `zoom`
- `created_at`

### availability

Generic availability table for boats/captains.

Captain-facing availability management reuses this table with `entity_type='captain'`. Tokenized captain trip links may create/delete only rows for their assigned `captain_id`; back office keeps full admin control through the existing `/api/v1/availability` endpoints.

### documents

Stores charter agreements and related documents.

### audit_log

Future audit trail for sensitive admin/back-office changes.

## Migration Rule

Add schema changes through migrations. Avoid destructive schema edits unless there is an explicit migration plan.
