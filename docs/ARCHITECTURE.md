# Cove Charters Architecture

## Current Direction

Cove is moving from a static JSON prototype to a production backend using Cloudflare Workers and Cloudflare D1.

## Deployment

The Cove API Worker is deployed through GitHub Actions using Wrangler.

Important deployment pieces:

- `wrangler.toml`
- GitHub Actions workflow for Worker deployment
- Cloudflare API token in GitHub secrets
- Cloudflare account ID in GitHub secrets
- D1 database binding named `DB`

## Backend

The Worker is the API gateway for the platform.

Current core endpoints:

- `GET /api/v1/health`
- `GET /api/v1/settings`
- `PUT /api/v1/settings`
- `GET /api/v1/boats`
- `POST /api/v1/boats`
- `GET /api/v1/boats/{id}`
- `PUT /api/v1/boats/{id}`
- `DELETE /api/v1/boats/{id}`
- `POST /api/v1/media`

## Database

Cloudflare D1 is the source of truth.

JSON files are now fallback/prototype data only and should not be treated as authoritative for migrated domains.

## Frontend

The current frontend is static HTML/CSS/JavaScript hosted from the repository.

Pages currently include:

- `index.html` public homepage
- `boat.html` public boat detail
- `admin.html` operations/admin interface

## Design Principle

Prefer vertical slices:

1. Database
2. API
3. Admin UI
4. Public UI

Do not build large disconnected layers before proving the slice end-to-end.

## Security Note

Admin endpoints are currently lightly protected or unprotected during bootstrap. Before production, admin writes should be authenticated and authorization-aware.

Public GET endpoints can remain public where appropriate.
