# Stripe Readiness Notes

Date: 2026-07-02

This is the implementation/setup note for Stripe test-mode payments after the Cove MVP booking, signing, captain packet, closeout, and reporting foundation.

## Recommended First Stripe Slice

Use Stripe Payment Links or Checkout Sessions for MVP customer payments, not raw PaymentIntents in the browser. The Worker should create server-side Checkout Sessions and return a hosted Stripe URL.

Suggested customer flows:

- Booking deposit or initial collection after back office confirms the booking.
- Final invoice collection after trip closeout and settlement review.
- Optional refund/credit tracking stays in Cove accounting records first; Stripe refund automation can come later.

## Proposed Worker Secrets

Do not commit these values.

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_SUCCESS_URL`
- `STRIPE_CANCEL_URL`

Optional later:

- `STRIPE_PRICE_CHARTER_DEPOSIT`
- `STRIPE_ACCOUNT_COUNTRY`

## Implemented API Endpoints

Admin-authenticated:

- `POST /api/v1/bookings/{id}/payments/checkout`
  - Creates a Stripe Checkout Session for a booking charge.
  - Payload includes `purpose`: `deposit`, `final_invoice`, or `custom`.
  - Payload includes an admin-approved amount in cents or dollars.
  - Stores the Checkout URL and Stripe session ID in `payments`.

Public webhook:

- `POST /api/v1/stripe/webhook`
  - Verifies the Stripe signature with `STRIPE_WEBHOOK_SECRET`.
  - Records successful or expired Checkout status back to `payments`.
  - Updates booking/settlement customer payment status after successful payment.
  - Appends an office note with the Stripe session/payment reference.

## Sandbox Setup Checklist

1. In Stripe, make sure the Dashboard is in test mode.
2. Copy the test secret key that starts with `sk_test_`.
3. Set the Worker secret:
   - `npx wrangler secret put STRIPE_SECRET_KEY --name cove-api`
4. In Stripe, create a webhook endpoint:
   - Endpoint URL: `https://cove-api.jeff-r-winters.workers.dev/api/v1/stripe/webhook`
   - Events: `checkout.session.completed`, `checkout.session.expired`
5. Copy the endpoint signing secret that starts with `whsec_`.
6. Set the Worker secret:
   - `npx wrangler secret put STRIPE_WEBHOOK_SECRET --name cove-api`
7. Confirm `/api/v1/health` shows `"stripe": true`.
8. In Booking Details, use `Create Payment Link` on a confirmed booking, open the generated Stripe Checkout URL, and pay with a Stripe test card.

## Suggested Data Model

`migrations/0016_upgrade_payments_for_stripe.sql` upgrades the existing `payments` table for Stripe audit records:

- `id`
- `booking_id`
- `settlement_id`
- `provider`
- `provider_session_id`
- `provider_payment_intent_id`
- `purpose`
- `amount`
- `currency`
- `status`
- `checkout_url`
- `metadata_json`
- `created_at`
- `updated_at`

Relationship to existing records:

- `bookings.paid_status` remains the high-level operational status.
- `settlements.customer_paid_status` remains the closeout/payment review status.
- `accounting_records` remains the reporting ledger.
- `payments` becomes the external processor audit trail.

## Safety Notes

- Keep Stripe creation behind admin auth.
- Keep webhook verification strict before touching D1.
- Prefer Stripe-hosted Checkout for PCI scope.
- Do not put card fields into Cove pages for MVP.
- Use test mode first and record the Stripe object IDs in office notes for troubleshooting.
- Apply `0016_upgrade_payments_for_stripe.sql` to D1 before deploying Worker code that writes Stripe payment records.
