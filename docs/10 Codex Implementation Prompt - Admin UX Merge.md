# Codex Implementation Prompt - Admin UX Merge

## Goal
Use Codex to safely merge the validated admin UX prototype into the real Cove Command Center.

This task should implement:

1. Customer List inside the main `admin.html` experience.
2. Shared sticky breadcrumb + compact Save header for detail screens.
3. Universal Side Panel assets wired where appropriate.
4. Safer, more maintainable structure if feasible.

## Recommended Codex Prompt

```text
You are working in the Cove-Charters GitHub repo.

Implement the planned Command Center UX merge using the existing prototype and docs.

Reference these files:
- admin-customers.html
- assets/admin-detail-header.css
- assets/admin-side-panel.css
- assets/admin-side-panel.js
- docs/08 Command Center UX Refactor Plan.md
- docs/09 Universal Side Panel Component.md

Scope:
1. Integrate Customer List into the main admin experience.
   - Add Customer List to desktop nav and mobile nav.
   - Use the same list → drill-in detail UX from admin-customers.html.
   - Include customer statuses: new, repeat, vip, banned.
   - Preserve the red banned banner/warning behavior.

2. Implement the shared sticky detail header pattern.
   - Use assets/admin-detail-header.css.
   - Apply to Boat detail view.
   - Apply to Captain detail view.
   - Apply to Customer detail view.
   - Header should show breadcrumb left and compact Save action right.
   - Header should be sticky.
   - The overview/hero card should NOT be sticky.

3. Wire the Universal Side Panel assets.
   - Include assets/admin-side-panel.css and assets/admin-side-panel.js.
   - Create a shared AdminSidePanel instance.
   - Do not replace full editors yet.
   - Use the side panel only where it is safe and additive, or leave it available for future use if wiring it to current screens is risky.

4. Keep Bookings mostly unchanged.
   - Do not redesign booking workflow in this pass.
   - Avoid changing booking API behavior.

5. Preserve all existing API behavior.
   - Do not break boat save/delete.
   - Do not break captain save/delete.
   - Do not break media upload/reorder/set-cover.
   - Do not break bookings calendar/filtering/availability.

6. Refactor only if it improves safety.
   - Prefer extracting CSS and JS from admin.html into assets/admin.css and assets/admin.js if practical.
   - If refactoring is too large, keep the implementation minimal and document the next refactor step.

Commit message:
SAFE ROLLBACK POINT - Merge Customer List and Admin Detail UX

After changes, verify:
- Admin dashboard loads.
- Boats list loads.
- Boat detail opens and saves.
- Boat media still loads.
- Captains load and save.
- Customer List appears in nav.
- Customer detail drill-in works.
- Banned customer warning appears.
- Bookings tab still loads.
- Mobile nav still works.
```

## Implementation Notes

### Customer List Source
Use `admin-customers.html` as the functional and visual prototype.

Important behavior to preserve:
- Main list first.
- Click customer to drill into detail.
- Breadcrumb returns to Customer List.
- Save button is compact, right-aligned, and sticky.
- Banned status displays red warning banner.
- Customer List naming should be used, not Guest Book.

### Sticky Detail Header Source
Use `assets/admin-detail-header.css`.

Expected pattern:

```html
<section class="admin-sticky-detail-bar">
  <nav class="admin-breadcrumb">
    <button type="button">Boats</button>
    <span class="sep">›</span>
    <strong>Brima</strong>
  </nav>
  <div class="admin-sticky-actions">
    <button class="btn sand admin-save-compact" type="button">Save</button>
  </div>
</section>
```

### Universal Side Panel Source
Use:

```html
<link rel="stylesheet" href="assets/admin-side-panel.css">
<script src="assets/admin-side-panel.js"></script>
```

Create shared instance:

```js
const sidePanel = new AdminSidePanel();
```

Do not force side-panel behavior into flows where full detail screens are still safer.

## Risk Management

This should be one obvious rollback commit.

Do not combine unrelated feature work with this task.

If Codex determines `admin.html` is too large or risky to edit safely, first refactor it into:

- `admin.html`
- `assets/admin.css`
- `assets/admin.js`
- existing shared component CSS/JS assets

Then apply the UX merge in a second commit.

## Follow-up Task

After this merge, create a separate issue or doc note for:

- Global admin search
- Unsaved changes indicator
- Previous/Next record navigation
- Activity timeline
- Booking workflow redesign
