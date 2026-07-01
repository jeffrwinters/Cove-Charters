# Captain Workflow

## Overview

The captain workflow supports availability, booking acceptance, trip execution, post-charter closeout, and payout transparency.

## Approved Captain Lists

Each boat has an approved list of captains. The customer must choose their own captain from that approved list.

Product implications:

- Captains must be associated with boats they are approved to operate.
- Boat detail pages should show approved captains.
- Captains page should link back to boats they are approved for.
- Back office may help facilitate but should not appear to assign the captain on the customer's behalf.

## Availability

Captain availability must be maintained separately from boat availability.

Booking should consider:

- Boat availability
- Captain availability
- Existing bookings
- Maintenance blocks
- Owner holds
- Captain unavailable blocks

## Booking Acceptance

After customer selection, the captain should accept or decline the booking.

Future statuses may include:

- Pending captain acceptance
- Captain accepted
- Captain declined
- Needs alternate captain

## Post-Charter Closeout

After the charter, the captain submits closeout details.

Required fields:

- Price per mile
- Miles travelled
- Fuel charges
- Gallons of fuel used
- Who paid for fuel?
- Who paid for cleaning?
- Notes

Closeout submission should trigger back-office review and payout calculation.

## Payout Receipt

After back-office reconciliation, the captain should receive a payout statement showing:

- Captain payout
- Fuel adjustments
- Cleaning adjustments
- Customer refund or charge adjustments
- Total payout
- Gross amount received
- Gross profit
- Estimated tax
- Cove net profit

The statement should be printable, downloadable, and available later from the captain-facing experience.
