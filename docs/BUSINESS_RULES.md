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

- Miles traveled
- Mileage rate used
- Fuel charge
- Additional charge line items
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
- Fuel charge
- Additional charges total and line-item detail

## Back Office Overrides

Back office must be able to change operational details, including:

- Boat on a booking
- Captain on a booking
- Paid status
- Settlement status
- Notes
- Payout details

## Current MVP Settlement Formula

Source: `docs/Charges and Payout.csv`, exported from the `Charges and Payout.xlsx` workbook reviewed on July 1, 2026.

- Captain / first mate pay = actual hours x captain hourly rate. The 2026 workbook uses `$125/hour`.
- Net charter revenue = charter fee - captain / first mate pay.
- Owner payout = net charter revenue x owner split. The workbook uses `85%`.
- Cove commission = net charter revenue x Cove split. The workbook uses `15%`.
- Cleaning fee is a standard collected line item when charged. The current workbook uses `$75`.
- Sales tax = `(charter fee + cleaning fee) x sales tax rate`. The workbook uses `8.225%`.
- Total collected = charter fee + cleaning fee + sales tax + fuel deposit, plus post-charter fuel charge and additional charges collected through closeout.
- Miles traveled is entered directly by back office during trip closeout.
- Fuel charge = miles traveled x mileage rate.
- Additional charges are structured line items with descriptions and amounts.
- Fuel deposit refund = fuel deposit - fuel charge - additional charges, floored at zero.

Fuel charge and additional charge adjustments are operational closeout fields; they are not visible in the reviewed spreadsheet sections, but remain supported for back-office settlement. Settlement records should remain editable by back office before final payout.
