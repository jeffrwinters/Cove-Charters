# Payments and Payouts

## Overview

Payments and payouts are central to the Cove back-office workflow. The system must support payout transparency for captains and owners while preserving Cove's ability to reconcile post-charter operating costs.

## Inputs

Payment and payout calculations may depend on:

- Charter amount received
- Captain rate or payout amount
- Owner payout amount
- Price per mile
- Miles travelled
- Fuel charges
- Gallons of fuel used
- Fuel payer
- Cleaning payer
- Refunds or additional customer charges
- Taxes or estimated taxes
- Cove fees or margin

## Captain Closeout Inputs

The captain post-charter form should include:

- Price per mile
- Miles travelled
- Fuel charges
- Who paid for fuel?
- Who paid for cleaning?
- Gallons of fuel used

These are used by back office to calculate adjustments before payout.

## Captain Payout Statement

The captain-facing payout statement should show a clear receipt/ledger.

Example rows:

| Payee Name | Payee Type | Payee Email | Amount |
| --- | --- | --- | --- |
| Captain | Captain | captain email | Captain payout |
| Customer | Customer fuel refund or charge | customer email | Fuel adjustment |

Summary rows:

- Payouts total
- Amount received
- Gross profit
- Estimated tax
- Profit / Cove Charters

## Product Requirements

- Receipt should be printable.
- Receipt should be downloadable as PDF in the future.
- Receipt should be available after closeout and back-office approval.
- Back office should be able to review and adjust before finalization.
- Values should be auditable.
- Captain should be able to view payout receipts from the captain-facing experience.

## Open Questions

- Which party usually pays cleaning?
- Are fuel charges normally reimbursed to captain, charged to customer, or netted against owner payout?
- Should estimated tax be visible to captains or only back office?
- Should owner payout receipt be separate from captain payout receipt?
