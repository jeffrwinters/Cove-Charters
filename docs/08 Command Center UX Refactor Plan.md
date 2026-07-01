# Command Center UX Refactor Plan

## Status
Planned

## Goal
Refactor the admin experience to use a consistent drill-in/drill-out navigation pattern with reusable components.

## Current Prototype
The standalone `admin-customers.html` page is the UX prototype.

It establishes:
- Customer List → Customer Detail drill-in
- Sticky breadcrumb navigation
- Compact sticky Save button
- Banned customer status
- Responsive layout

## Planned Refactor
- Refactor the monolithic `admin.html` into smaller CSS, JS, and shared UI assets.
- Create a reusable Admin Detail Header component (sticky breadcrumbs + compact Save button).
- Apply the shared component to Boats, Captains, Customers, Owners, and eventually Bookings.

## Safety Strategy
- Do not edit the existing monolithic `admin.html` until the complete file is available.
- Prototype new UX in standalone pages first.
- Merge proven UX into the main admin after validation.
- Create obvious rollback commits before major merges.

## Standard UX Pattern
List → Drill into Detail → Sticky Breadcrumb + Save → Back to List

This should become the standard interaction model across the Cove Command Center.