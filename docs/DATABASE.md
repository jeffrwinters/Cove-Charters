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

### boat_captains

Join table for approved boat/captain relationships.

### customers

Stores customer records.

### bookings

Customer-facing booking records.

Booking should snapshot price/settings values used at booking time.

### trips

Operational trip closeout record for what actually happened on the water.

### settlements

Financial settlement record for owner, captain, Cove, and customer adjustments.

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
