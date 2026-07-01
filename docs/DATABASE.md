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

### booking_documents

Stores documents attached to a booking, including signed bareboat agreements.

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

### documents

Stores charter agreements and related documents.

### payments

Tracks payment movement and external references.

### audit_log

Future audit trail for sensitive admin/back-office changes.

## Migration Rule

Add schema changes through migrations. Avoid destructive schema edits unless there is an explicit migration plan.
