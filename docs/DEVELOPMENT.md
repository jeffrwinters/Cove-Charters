# Cove Charters Development Rules

## General Rules

- Prefer small commits.
- Do not rewrite working slices without a clear reason.
- Extend existing endpoints instead of replacing them.
- Keep the Worker version number updated when API behavior changes.
- Keep public GET endpoints stable where possible.
- Keep admin writes explicit and easy to reason about.
- Keep `docs/STATUS.md` updated whenever project state changes.
- Update the relevant docs file when architecture, business rules, API behavior, or workflow changes.

## Source of Truth

D1 is the source of truth for migrated domains.

Current migrated domains:

- Boats
- Boat pricing
- Media metadata

JSON files may remain as fallbacks, fixtures, or seed data, but they should not be treated as authoritative once a domain has moved to D1.

## Vertical Slice Pattern

Use this order:

1. Database
2. API
3. Admin UI
4. Public UI

Do not build large unrelated features before the current slice works end-to-end.

## Frontend Guidance

- Keep the customer-facing site polished and premium.
- Keep admin workflows drill-in and operations-focused.
- Avoid large inline rewrites when a smaller change will work.
- Preserve existing visual style unless explicitly redesigning.

## API Guidance

- Keep existing boat CRUD behavior intact.
- Return useful JSON errors.
- Avoid generic Worker 1101 errors by awaiting async handlers inside try/catch blocks.
- Validate input enough to avoid corrupt records.
- Use bearer-token auth for protected admin writes.

## Database Guidance

- Prefer migrations for schema changes.
- Snapshot financial settings onto booking records.
- Avoid destructive schema changes.
- Use indexes for lookup-heavy endpoints.
- Store media metadata in D1, not only as uploaded files.

## Before Production

Replace the bootstrap `ADMIN_TOKEN` pattern with user-aware authentication and authorization.

Public reads can remain public where appropriate.
