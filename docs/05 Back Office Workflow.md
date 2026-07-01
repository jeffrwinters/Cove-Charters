# Back Office Workflow

## Overview

Back office is responsible for keeping bookings operationally correct after a customer request enters the system.

## Responsibilities

Back office should be able to:

- Review incoming booking requests
- Change boats on bookings
- Help facilitate captain selection
- Change captains when operationally required
- Track signed charter agreements
- Store attachments
- Communicate with customers, captains, and owners
- Review post-charter closeout
- Finalize payouts

## Booking Changes

Back office may need to change a boat or captain after booking due to availability, maintenance, weather, or operational issues.

Any change should be audit-friendly and should preserve historical context.

## Charter Agreements

The customer must sign required charter agreements. After booking is made, the captain needs to receive a copy.

Future workflow:

1. Customer signs agreement.
2. Agreement is attached to booking.
3. Back office can verify status.
4. Captain receives copy before trip.
5. Agreement remains available from booking record.

## Post-Charter Review

Back office reviews captain closeout values before final payout.

Review should cover:

- Miles travelled
- Fuel charges
- Fuel payer
- Cleaning payer
- Gallons used
- Damage or incident notes
- Any customer refund or additional charge

## Payout Finalization

Back office finalizes payouts for:

- Boat owner
- Captain
- Cove profit
- Customer refund or additional charge where applicable

The system should produce receipts or statements for appropriate parties.
