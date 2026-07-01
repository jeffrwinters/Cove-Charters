# Required First Step - Admin Refactor

## Status
Required before any major Command Center UX implementation.

## Purpose

The current `admin.html` has grown into a large monolithic file. That makes it risky to safely edit, review, and extend.

Before merging the Customer List prototype, shared sticky breadcrumbs, compact Save actions, or side-panel workflows into the main Command Center, the admin should be refactored into a maintainable structure.

## Required Step 0

Refactor the admin into separate files:

```text
admin.html
assets/admin.css
assets/admin.js
assets/admin-detail-header.css
assets/admin-side-panel.css
assets/admin-side-panel.js
```

`admin.html` should become the composition layer. It should load the shared CSS and JavaScript assets instead of containing the entire admin application inline.

## Validation Requirement

The refactor must not change functionality.

Verify all existing behavior still works before implementing new UX:

- Dashboard loads.
- API base URL and admin token settings still work.
- Boats list loads.
- Boat detail opens.
- Boat save works.
- Boat delete works.
- Boat media upload works.
- Boat media reorder works.
- Set cover photo still works.
- Captains list loads.
- Captain save works.
- Captain delete works.
- Approved boat/captain relationships still work.
- Bookings tab loads.
- Booking filters still work.
- Booking calendar still works.
- Availability blocks still work.
- Mobile navigation still works.

## Required Rollback Commit

After the refactor is complete and verified, create this commit:

```text
SAFE ROLLBACK POINT - Admin Refactor Complete
```

This commit becomes the safe baseline for all future Command Center UX work.

## Phase 2 After Refactor

After the rollback point, continue with the UX merge described in:

- `docs/10 Codex Implementation Prompt - Admin UX Merge.md`

Phase 2 should implement:

1. Merge Customer List into the main admin.
2. Add Customer List to desktop and mobile nav.
3. Preserve the Customer List drill-in/detail UX from `admin-customers.html`.
4. Apply shared sticky breadcrumb + compact Save header to Boats, Captains, and Customers.
5. Wire the Universal Admin Side Panel assets where safe.
6. Keep Bookings mostly unchanged until its workflow is redesigned.
7. Preserve all existing API behavior.

## Required Second Rollback Commit

After Phase 2 is complete and verified, create this commit:

```text
SAFE ROLLBACK POINT - Customer List + Shared Detail UX Merge
```

## Supporting References

Use these documents and assets as implementation references:

- `admin-customers.html`
- `assets/admin-detail-header.css`
- `assets/admin-side-panel.css`
- `assets/admin-side-panel.js`
- `docs/08 Command Center UX Refactor Plan.md`
- `docs/09 Universal Side Panel Component.md`
- `docs/10 Codex Implementation Prompt - Admin UX Merge.md`

## Codex Handoff Instruction

Start here first:

```text
Start with docs/11 Required First Step - Admin Refactor.md. Treat it as the required Phase 0 implementation plan. After completing and committing the admin refactor rollback point, continue with docs/10 Codex Implementation Prompt - Admin UX Merge.md.
```
