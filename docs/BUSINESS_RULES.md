# Cove Charters Business Rules

## Pricing and Settings

Settings should be editable and should be snapshotted onto bookings when a booking is created.

Current known settings:

- Mileage rate: `$14/mile`
- Sales tax rate
- Cleaning fee
- Fuel deposit
- Captain hourly rate
- Owner split
- Cove split

Do not hard-code these values in UI or business logic when they can come from settings.

## Boat Pricing

Pricing belongs to the boat, not just a global table.

A boat may have:

- 4 hour price
- 6 hour price
- 8 hour price
- Sunset cruise price
- Holiday pricing
- Custom pricing

## Captains

Each boat has an approved list of captains. Customers must choose their own captain from that list.

The system must eventually support:

- Captain availability
- Captain acceptance
- Approved boat/captain relationships
- Captain profile photos
- Captain credentials

## Charter Agreements

Customers must sign charter agreements. After booking, the captain/back office needs a copy.

The system should track:

- Agreement template
- Sent status
- Signed status
- Signed timestamp
- Document URL

## Trip Closeout

The office needs to record actual trip details after the charter.

Track:

- Beginning miles
- Ending miles
- Billable miles
- Mileage rate used
- Mileage charge
- Fuel paid by customer/captain/owner/office
- Fuel amount
- Cleaning fee charged
- Damage reported
- Damage notes
- Captain notes
- Office notes

## Settlement

Settlement is separate from booking.

Track:

- Customer paid status
- Owner paid status
- Captain paid status
- Captain pay
- Owner payout
- Cove commission
- Tax collected
- Fuel deposit
- Fuel deposit refund
- Mileage charge
- Additional charges

## Back Office Overrides

Back office must be able to change operational details, including:

- Boat on a booking
- Captain on a booking
- Paid status
- Settlement status
- Notes
- Payout details
