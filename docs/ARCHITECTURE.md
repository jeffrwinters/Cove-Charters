# Cove Charters Architecture

## Current Direction

Cove is moving from a static JSON prototype to a production backend using Cloudflare Workers and Cloudflare D1.

For the latest implementation status, start with `docs/STATUS.md`.

## Deployment

The Cove API Worker is deployed through GitHub Actions using Wrangler.

Important deployment pieces:

- `wrangler.toml`
- GitHub Actions workflow for Worker deployment
- Cloudflare API token in GitHub secrets
- Cloudflare account ID in GitHub secrets
- Worker secrets: `GITHUB_TOKEN` and `ADMIN_TOKEN`
- D1 database binding named `DB`

## Backend

The Worker is the API gateway for the platform.

Current core endpoints:

- `GET /api/v1/health`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `GET /api/v1/users`
- `POST /api/v1/users`
- `PUT /api/v1/users/{id}`
- `DELETE /api/v1/users/{id}`
- `GET /api/v1/settings`
- `PUT /api/v1/settings`
- `GET /api/v1/boats`
- `POST /api/v1/boats`
- `PUT /api/v1/boats/order`
- `GET /api/v1/boats/{id-or-slug}`
- `PUT /api/v1/boats/{id}`
- `DELETE /api/v1/boats/{id}`
- `GET /api/v1/media`
- `POST /api/v1/media`
- `GET /api/v1/media/{id}`
- `PUT /api/v1/media/{id}`
- `DELETE /api/v1/media/{id}`
- `GET /api/v1/bookings`
- `POST /api/v1/bookings`
- `GET /api/v1/bookings/{id}`
- `PUT /api/v1/bookings/{id}`
- `DELETE /api/v1/bookings/{id}`
- `POST /api/v1/bookings/{id}/send-confirmation`
- `POST /api/v1/bookings/{id}/send-agreement-packet`
- `POST /api/v1/bookings/{id}/send-captain-packet`
- `POST /api/v1/bookings/{id}/captain-trip-link`
- `GET /api/v1/captain-trips/{token}`
- `POST /api/v1/captain-trips/{token}/closeout`
- `GET /api/v1/captain-trips/{token}/availability`
- `POST /api/v1/captain-trips/{token}/availability`
- `DELETE /api/v1/captain-trips/{token}/availability/{id}`
- `GET /api/v1/bookings/{id}/documents`
- `POST /api/v1/bookings/{id}/documents`
- `GET /api/v1/bookings/{id}/payments`
- `GET /api/v1/signing/{token}`
- `POST /api/v1/signing/{token}`

Public reads can remain public where appropriate. Admin writes accept `Authorization: Bearer <session_token>` for signed-in back-office users. The legacy `ADMIN_TOKEN` bearer value remains a bootstrap/fallback path for creating the first user and emergency access.

Back-office admin pages are gated behind the standalone login/session flow. Do not require captain authentication for tokenized captain trip packets, signed agreement access, or customer signing links; those flows are intentionally low-friction, token-scoped access paths for MVP operations.

## Database

Cloudflare D1 is the source of truth.

JSON files are now fallback/prototype data only and should not be treated as authoritative for migrated domains.

Current migrated domains:

- Boats
- Boat pricing
- Media metadata

Media binary files are stored as repository assets and served by GitHub Pages. Media metadata is stored in D1.

## Frontend

The current frontend is static HTML/CSS/JavaScript hosted from the repository.

Pages currently include:

- `index.html` public homepage
- `boat.html` public boat detail
- `admin.html` operations/admin interface
- `login.html` Cove Command Center login
- `sign.html` tokenized customer agreement signing
- `signed.html` tokenized signed agreement record
- `captain-trip.html` tokenized captain trip packet

The admin interface supports signed-in user sessions and still supports the bootstrap admin token fallback for protected writes. `admin.html` redirects visitors without a saved session to `login.html` and validates the session before loading admin data. The Command Center admits `admin` and `staff` users; user management requires an `admin` role or the bootstrap token.

## Design Principle

Prefer vertical slices:

1. Database
2. API
3. Admin UI
4. Public UI

Do not build large disconnected layers before proving the slice end-to-end.

## Security Note

Admin write endpoints are protected by `ADMIN_TOKEN`. This is acceptable for the bootstrap/admin prototype but should eventually move toward user-aware authentication and authorization before broad production use.
