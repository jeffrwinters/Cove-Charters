# Universal Admin Side Panel Component

## Status
Component assets stubbed, implementation planned.

## Purpose
The Universal Admin Side Panel allows staff to inspect or lightly edit related records without losing their place in a list.

This supports the Command Center UX principle:

List → Click record → Side panel opens → Close panel → Same list position retained

## Assets

- `assets/admin-side-panel.css`
- `assets/admin-side-panel.js`

These are standalone reusable assets and are safe for Codex to wire into `admin.html` after the admin refactor or when the complete file is available.

## Core Use Cases

### Boats
Clicking a boat from a list can open a side panel with:
- Boat summary
- Status
- Length/capacity/pricing
- Approved captains
- Cover photo
- Quick actions: Open full editor, View public page, Save

### Captains
Clicking a captain can open:
- Captain profile
- Credential
- Contact info
- Approved boats
- Availability snapshot
- Quick actions: Open full editor, Save

### Customers
Clicking a customer can open:
- Customer contact details
- Status including Banned
- Charter history snapshot
- Preferences
- Concierge notes
- Quick actions: Full profile, Save

### Bookings
Clicking a booking can open:
- Booking details
- Customer
- Boat
- Captain
- Agreement status
- Conflict warnings
- Quick actions: Accept, update status, open full booking workflow

## Design Requirements

- Overlay click closes panel.
- Escape key closes panel.
- Close button restores previous focus.
- Body scroll is locked while panel is open.
- Panel should not replace full detail editors yet.
- Panel should preserve list scroll position.
- Footer should support Save / Cancel / Open Full Editor actions.
- Mobile should use nearly full-screen width.

## Implementation Notes for Codex

1. Add the CSS asset to admin pages:
   `<link rel="stylesheet" href="assets/admin-side-panel.css">`

2. Add the JS asset:
   `<script src="assets/admin-side-panel.js"></script>`

3. Create one shared instance:
   `const sidePanel = new AdminSidePanel();`

4. Replace list-card click handlers where appropriate with `sidePanel.open(...)` instead of immediately drilling into a full detail page.

5. Preserve existing full editor routes/screens. The side panel should be an enhancement, not a replacement.

## Suggested First Integration

Start with Customer List because `admin-customers.html` is already the UX prototype and has low operational risk.

Second integration should be Boats or Captains after the monolithic `admin.html` is refactored into smaller assets.

## Safety Notes

Do not directly rewrite the monolithic `admin.html` unless the complete file is available locally. The current GitHub connector can truncate large files, which makes full-file replacement risky.
