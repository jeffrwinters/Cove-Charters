# Cove Charters Demo

This repository contains the static Cove Charters MVP plus the Cloudflare Worker and D1 schema that power the live fleet data.

## Current Demo Scope

- SEO-friendly landing page hosted with GitHub Pages
- Upscale Lake of the Ozarks charter positioning
- Public boat inventory loaded from the live Cove API with JSON fallback
- Boat cards with pricing, capacity, bedroom/bath specs, and detail links
- Customer workflow: select boat, choose captain, sign agreements, enjoy the lake
- D1-backed Command Center for boat records and media upload workflows
- Protected Worker write endpoints using an admin bearer token
- Responsive layout for desktop and mobile

## Current Architecture

- `index.html` - public landing page and boat matcher
- `boat.html` - public boat detail view
- `admin.html` - Cove Command Center for D1 boat records
- `data/boats.json` - fallback/seed fleet data
- `workers/cove-api-v3-worker.js` - active Cloudflare Worker API
- `migrations/0001_initial_cove_schema.sql` - initial D1 schema
- `wrangler.toml` - Worker and D1 deployment config

The production API URL currently used by the static pages is:

```txt
https://cove-api.jeff-r-winters.workers.dev
```

## Product Direction Notes

Cove is being shaped as a luxury charter marketplace and operating platform, not a generic rental app.

Initial persona/platform thinking:

- Customers: website-first experience
- Captains: eventual mobile app for availability, trip acceptance, notifications, and trip details
- Back office: web-based Command Center
- Boat owners: web portal first, with mobile later only if usage justifies it

## Next Build Ideas

- Replace gradient boat cards with real boat photos
- Add richer individual boat detail pages
- Add availability request form
- Add captain-selection flow
- Add charter agreement step
- Expand Command Center beyond boat records into bookings, trips, and settlements
- Add stronger production auth around the hosted admin surface
