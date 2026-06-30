# Cove Charters Domain Model

## Core Entities

```text
Owner
  -> Boat
      -> Pricing
      -> Media
      -> Approved Captains
      -> Availability
      -> Bookings

Captain
  -> Profile
  -> Availability
  -> Approved Boats
  -> Trips
  -> Payouts

Customer
  -> Bookings
  -> Charter Agreements
  -> Payments

Booking
  -> Boat
  -> Captain
  -> Customer
  -> Trip
  -> Settlement
  -> Documents
```

## Boat

A boat is the primary marketplace inventory item.

Important relationships:

- Belongs to an owner
- Has pricing plans
- Has media
- Has approved captains
- Has bookings
- Has availability

## Captain

A captain is an independent service provider available for approved boats.

Important relationships:

- Can be approved for many boats
- Has availability
- Accepts or rejects trip assignments
- Receives payouts

## Customer

A customer books a charter and must choose a captain from a boat's approved list.

Important relationships:

- Creates bookings
- Signs charter agreements
- Makes payments

## Booking

A booking represents the customer-facing reservation.

It should snapshot pricing and settings at the time of booking so future settings changes do not change historical records.

## Trip

A trip represents what actually happened on the water.

Trip closeout captures:

- Start miles
- End miles
- Billable miles
- Fuel
- Cleaning
- Damage
- Notes

## Settlement

A settlement determines money movement after the trip.

It should track:

- Owner payout
- Captain payout
- Cove commission
- Fuel deposit refund or charges
- Mileage charges
- Payment status

## Media

Media belongs to a business entity, usually a boat or captain.

Media should support:

- Cover image
- Gallery images
- Videos
- Sort order
- Alt text
