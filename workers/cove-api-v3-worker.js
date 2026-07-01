export default {
  async fetch(request, env, ctx) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    const path = '/' + new URL(request.url).pathname.split('/').filter(Boolean).join('/').toLowerCase();

    try {
      if (request.method === 'GET' && (path === '/health' || path === '/api/v1/health')) return await health(env, cors);
      if (request.method === 'POST' && path === '/api/v1/admin/import-seed') {
        const auth = requireAdmin(request, env);
        if (auth) return json(auth.body, auth.status, cors);
        return await importSeed(env, cors);
      }
      if (path === '/api/v1/boats') return await boats(request, env, cors);
      if (path === '/api/v1/boats/order') return await boatOrder(request, env, cors);
      if (path.match(/^\/api\/v1\/boats\/[^/]+\/captains$/)) return await boatCaptains(request, env, cors, path.split('/')[4]);
      if (path.startsWith('/api/v1/boats/')) return await boatById(request, env, cors, path.split('/').pop());
      if (path.match(/^\/api\/v1\/owners\/[^/]+\/boats$/)) return await ownerBoats(request, env, cors, path.split('/')[4]);
      if (path === '/api/v1/owners') return await owners(request, env, cors);
      if (path.startsWith('/api/v1/owners/')) return await ownerById(request, env, cors, path.split('/').pop());
      if (path === '/api/v1/captains') return await captains(request, env, cors);
      if (path.startsWith('/api/v1/captains/')) return await captainById(request, env, cors, path.split('/').pop());
      if (path === '/api/v1/availability') return await availability(request, env, cors);
      if (path.startsWith('/api/v1/availability/')) return await availabilityById(request, env, cors, path.split('/').pop());
      if (path === '/api/v1/bookings') return await bookings(request, env, cors, ctx);
      if (path.match(/^\/api\/v1\/bookings\/[^/]+\/documents$/)) return await bookingDocuments(request, env, cors, path.split('/')[4]);
      if (path.match(/^\/api\/v1\/bookings\/[^/]+\/settlement$/)) return await bookingSettlement(request, env, cors, path.split('/')[4]);
      if (path.match(/^\/api\/v1\/bookings\/[^/]+\/send-agreement-packet$/)) return await sendAgreementPacket(request, env, cors, path.split('/')[4]);
      if (path.match(/^\/api\/v1\/bookings\/[^/]+\/send-confirmation$/)) return await sendBookingConfirmation(request, env, cors, path.split('/')[4]);
      if (path.match(/^\/api\/v1\/bookings\/[^/]+\/send-captain-packet$/)) return await sendCaptainPacket(request, env, cors, path.split('/')[4]);
      if (path.match(/^\/api\/v1\/bookings\/[^/]+\/send-final-invoice$/)) return await sendFinalInvoice(request, env, cors, path.split('/')[4]);
      if (path.startsWith('/api/v1/bookings/')) return await bookingById(request, env, cors, path.split('/').pop());
      if (path.match(/^\/api\/v1\/signing\/[^/]+$/)) return await signingPacket(request, env, cors, path.split('/').pop());
      if (path === '/api/v1/settings') return await settings(request, env, cors);
      if (path === '/api/v1/media') return await media(request, env, cors);
      if (path.startsWith('/api/v1/media/')) return await mediaById(request, env, cors, path.split('/').pop());
      if (path === '/api/v1/media/upload' || path === '/media/upload' || path === '/upload-media') return await uploadMedia(request, env, cors);
      return json({ error: 'Not found', path }, 404, cors);
    } catch (error) {
      return json({ error: error.message || String(error) }, 500, cors);
    }
  }
};

async function health(env, cors) {
  requireDb(env);
  const result = await env.DB.prepare('SELECT 1 AS ok').first();
      const resendConfigured = Boolean(env.RESEND_API_KEY && env.BOOKING_NOTIFY_FROM);
  return json({ ok: true, service: 'cove-api', version: '0.3.32', d1: result?.ok === 1, adminAuth: Boolean(env.ADMIN_TOKEN), bookingEmail: Boolean(resendConfigured && env.BOOKING_NOTIFY_TO), customerEmail: resendConfigured, captainEmail: resendConfigured, emailProvider: resendConfigured ? 'resend' : null }, 200, cors);
}

async function settings(request, env, cors) {
  requireDb(env);
  if (request.method === 'GET') {
    const rows = await env.DB.prepare('SELECT * FROM settings ORDER BY key').all();
    return json(rows.results || [], 200, cors);
  }
  if (request.method === 'PUT') {
    const auth = requireAdmin(request, env);
    if (auth) return json(auth.body, auth.status, cors);
    const body = await request.json();
    await env.DB.prepare('UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?').bind(String(body.value), body.key).run();
    return json({ ok: true }, 200, cors);
  }
  return json({ error: 'GET or PUT required' }, 405, cors);
}

async function boats(request, env, cors) {
  requireDb(env);
  if (request.method === 'GET') {
    const rows = await env.DB.prepare(`
      SELECT b.*,
        (SELECT base_fee FROM boat_pricing WHERE boat_id = b.id AND active = 1 ORDER BY duration_hours LIMIT 1) AS starting_price,
        (SELECT plan_name FROM boat_pricing WHERE boat_id = b.id AND active = 1 ORDER BY duration_hours LIMIT 1) AS price_unit,
        o.name AS owner_name,
        o.email AS owner_email,
        o.phone AS owner_phone,
        (SELECT url FROM media WHERE entity_type = 'boat' AND entity_id = b.id AND media_type = 'photos' ORDER BY is_cover DESC, sort_order ASC, created_at ASC LIMIT 1) AS cover_photo_url,
        (SELECT title FROM media WHERE entity_type = 'boat' AND entity_id = b.id AND media_type = 'photos' ORDER BY is_cover DESC, sort_order ASC, created_at ASC LIMIT 1) AS cover_photo_title,
        (SELECT alt FROM media WHERE entity_type = 'boat' AND entity_id = b.id AND media_type = 'photos' ORDER BY is_cover DESC, sort_order ASC, created_at ASC LIMIT 1) AS cover_photo_alt,
        (SELECT focal_x FROM media WHERE entity_type = 'boat' AND entity_id = b.id AND media_type = 'photos' ORDER BY is_cover DESC, sort_order ASC, created_at ASC LIMIT 1) AS cover_photo_focal_x,
        (SELECT focal_y FROM media WHERE entity_type = 'boat' AND entity_id = b.id AND media_type = 'photos' ORDER BY is_cover DESC, sort_order ASC, created_at ASC LIMIT 1) AS cover_photo_focal_y,
        (SELECT zoom FROM media WHERE entity_type = 'boat' AND entity_id = b.id AND media_type = 'photos' ORDER BY is_cover DESC, sort_order ASC, created_at ASC LIMIT 1) AS cover_photo_zoom
      FROM boats b
      LEFT JOIN owners o ON o.id = b.owner_id
      ORDER BY sort_order ASC, featured DESC, name ASC
    `).all();
    const boatsWithCaptains = await withApprovedCaptainIds(env, rows.results || []);
    return json(boatsWithCaptains.map(outBoat), 200, cors);
  }
  if (request.method === 'POST') {
    const auth = requireAdmin(request, env);
    if (auth) return json(auth.body, auth.status, cors);
    const boat = await request.json();
    const id = boat.id || `boat_${crypto.randomUUID()}`;
    await upsertBoat(env, { ...boat, id });
    return json({ ok: true, id }, 201, cors);
  }
  return json({ error: 'GET or POST required' }, 405, cors);
}

async function boatOrder(request, env, cors) {
  requireDb(env);
  if (request.method !== 'PUT') return json({ error: 'PUT required' }, 405, cors);
  const auth = requireAdmin(request, env);
  if (auth) return json(auth.body, auth.status, cors);
  const body = await request.json();
  const boatIds = Array.isArray(body.boatIds) ? body.boatIds : [];
  if (!boatIds.length) return json({ error: 'boatIds array required' }, 400, cors);
  await env.DB.batch(boatIds.map((id, index) => env.DB.prepare('UPDATE boats SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(index, id)));
  return json({ ok: true, boatIds }, 200, cors);
}

async function boatById(request, env, cors, id) {
  requireDb(env);
  if (request.method === 'GET') {
    const row = await env.DB.prepare(`
      SELECT b.*,
        (SELECT base_fee FROM boat_pricing WHERE boat_id = b.id AND active = 1 ORDER BY duration_hours LIMIT 1) AS starting_price,
        (SELECT plan_name FROM boat_pricing WHERE boat_id = b.id AND active = 1 ORDER BY duration_hours LIMIT 1) AS price_unit,
        o.name AS owner_name,
        o.email AS owner_email,
        o.phone AS owner_phone,
        (SELECT url FROM media WHERE entity_type = 'boat' AND entity_id = b.id AND media_type = 'photos' ORDER BY is_cover DESC, sort_order ASC, created_at ASC LIMIT 1) AS cover_photo_url,
        (SELECT title FROM media WHERE entity_type = 'boat' AND entity_id = b.id AND media_type = 'photos' ORDER BY is_cover DESC, sort_order ASC, created_at ASC LIMIT 1) AS cover_photo_title,
        (SELECT alt FROM media WHERE entity_type = 'boat' AND entity_id = b.id AND media_type = 'photos' ORDER BY is_cover DESC, sort_order ASC, created_at ASC LIMIT 1) AS cover_photo_alt,
        (SELECT focal_x FROM media WHERE entity_type = 'boat' AND entity_id = b.id AND media_type = 'photos' ORDER BY is_cover DESC, sort_order ASC, created_at ASC LIMIT 1) AS cover_photo_focal_x,
        (SELECT focal_y FROM media WHERE entity_type = 'boat' AND entity_id = b.id AND media_type = 'photos' ORDER BY is_cover DESC, sort_order ASC, created_at ASC LIMIT 1) AS cover_photo_focal_y,
        (SELECT zoom FROM media WHERE entity_type = 'boat' AND entity_id = b.id AND media_type = 'photos' ORDER BY is_cover DESC, sort_order ASC, created_at ASC LIMIT 1) AS cover_photo_zoom
      FROM boats b
      LEFT JOIN owners o ON o.id = b.owner_id
      WHERE b.id = ? OR b.slug = ?
    `).bind(id, id).first();
    if (!row) return json({ error: 'Boat not found' }, 404, cors);
    const [boatWithCaptains] = await withApprovedCaptainIds(env, [row]);
    return json(outBoat(boatWithCaptains), 200, cors);
  }
  if (request.method === 'PUT') {
    const auth = requireAdmin(request, env);
    if (auth) return json(auth.body, auth.status, cors);
    const boat = await request.json();
    await upsertBoat(env, { ...boat, id });
    return json({ ok: true, id }, 200, cors);
  }
  if (request.method === 'DELETE') {
    const auth = requireAdmin(request, env);
    if (auth) return json(auth.body, auth.status, cors);
    await env.DB.prepare('DELETE FROM boats WHERE id = ?').bind(id).run();
    return json({ ok: true, id }, 200, cors);
  }
  return json({ error: 'GET, PUT, or DELETE required' }, 405, cors);
}

async function importSeed(env, cors) {
  requireDb(env);
  const seed = await readSeedJson(env);
  let imported = 0;

  for (const boat of seed) {
    await upsertBoat(env, boat);
    await env.DB.prepare('INSERT OR REPLACE INTO boat_pricing (id, boat_id, plan_name, duration_hours, base_fee) VALUES (?, ?, ?, ?, ?)')
      .bind(`price_${boat.id}_4h`, boat.id, boat.priceUnit || '4 hour', 4, Number(boat.startingPrice || 0))
      .run();
    imported += 1;
  }

  return json({ ok: true, imported }, 200, cors);
}

async function upsertBoat(env, boat) {
  await env.DB.prepare(`
    INSERT OR REPLACE INTO boats (
      id, owner_id, slug, name, status, lifecycle_status, booking_enabled, featured,
      home_port, length_ft, capacity, bedrooms, bathrooms, make, model, boat_type,
      short_description, source_listing_url, sort_order, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).bind(
    boat.id,
    boat.ownerId || null,
    boat.slug,
    boat.name,
    boat.status || 'draft',
    boat.lifecycleStatus || 'draft',
    boat.bookingEnabled ? 1 : 0,
    boat.featured ? 1 : 0,
    boat.homePort || null,
    boat.lengthFt || null,
    boat.capacity || null,
    boat.bedrooms || 0,
    boat.bathrooms || 0,
    boat.make || null,
    boat.model || null,
    boat.type || null,
    boat.shortDescription || null,
    boat.sourceListingUrl || null,
    Number(boat.sortOrder ?? boat.sort_order ?? 0)
  ).run();

  if (boat.startingPrice !== undefined || boat.priceUnit) {
    await env.DB.prepare('INSERT OR REPLACE INTO boat_pricing (id, boat_id, plan_name, duration_hours, base_fee) VALUES (?, ?, ?, ?, ?)')
      .bind(`price_${boat.id}_4h`, boat.id, boat.priceUnit || '4 hour', 4, Number(boat.startingPrice || 0))
      .run();
  }
}

function outBoat(row) {
  const boat = {
    id: row.id,
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    ownerEmail: row.owner_email,
    ownerPhone: row.owner_phone,
    slug: row.slug,
    name: row.name,
    status: row.status,
    lifecycleStatus: row.lifecycle_status,
    bookingEnabled: Boolean(row.booking_enabled),
    featured: Boolean(row.featured),
    sortOrder: Number(row.sort_order || 0),
    homePort: row.home_port,
    lengthFt: row.length_ft,
    capacity: row.capacity,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    make: row.make,
    model: row.model,
    type: row.boat_type,
    shortDescription: row.short_description,
    sourceListingUrl: row.source_listing_url,
    startingPrice: row.starting_price || 0,
    priceUnit: row.price_unit || 'charter',
    detailUrl: `boat.html?boat=${encodeURIComponent(row.slug || row.id)}`,
    media: {
      photos: row.cover_photo_url ? [{
        url: row.cover_photo_url,
        title: row.cover_photo_title,
        alt: row.cover_photo_alt,
        focalX: num(row.cover_photo_focal_x, 50),
        focalY: num(row.cover_photo_focal_y, 50),
        zoom: num(row.cover_photo_zoom, 1),
        isCover: true,
        sortOrder: 0
      }] : [],
      videos: []
    },
    coverPhoto: row.cover_photo_url ? {
      url: row.cover_photo_url,
      title: row.cover_photo_title,
      alt: row.cover_photo_alt,
      focalX: num(row.cover_photo_focal_x, 50),
      focalY: num(row.cover_photo_focal_y, 50),
      zoom: num(row.cover_photo_zoom, 1)
    } : null,
    approvedCaptainIds: row.approved_captain_ids ? String(row.approved_captain_ids).split(',').filter(Boolean) : []
  };
  return { ...boat, ...marketingFields(boat) };
}

async function withApprovedCaptainIds(env, boatRows) {
  if (!boatRows.length) return boatRows;
  const boatIds = boatRows.map(row => row.id).filter(Boolean);
  if (!boatIds.length) return boatRows;
  const placeholders = boatIds.map(() => '?').join(',');
  const rows = await env.DB.prepare(`
    SELECT boat_id, captain_id
    FROM boat_captains
    WHERE status = 'approved' AND boat_id IN (${placeholders})
    ORDER BY boat_id ASC, sort_order ASC, created_at ASC, captain_id ASC
  `).bind(...boatIds).all();
  const byBoat = new Map(boatIds.map(id => [id, []]));
  for (const row of rows.results || []) {
    if (byBoat.has(row.boat_id)) byBoat.get(row.boat_id).push(row.captain_id);
  }
  return boatRows.map(row => ({ ...row, approved_captain_ids: (byBoat.get(row.id) || []).join(',') }));
}

async function owners(request, env, cors) {
  requireDb(env);
  if (request.method === 'GET') {
    const rows = await env.DB.prepare(`
      SELECT o.*,
        (SELECT COUNT(*) FROM boats b WHERE b.owner_id = o.id) AS boat_count
      FROM owners o
      ORDER BY status = 'active' DESC, name ASC
    `).all();
    return json((rows.results || []).map(outOwner), 200, cors);
  }
  if (request.method === 'POST') {
    const auth = requireAdmin(request, env);
    if (auth) return json(auth.body, auth.status, cors);
    const owner = await request.json();
    const id = owner.id || `owner_${crypto.randomUUID()}`;
    await upsertOwner(env, { ...owner, id });
    return json({ ok: true, id }, 201, cors);
  }
  return json({ error: 'GET or POST required' }, 405, cors);
}

async function ownerById(request, env, cors, id) {
  requireDb(env);
  if (request.method === 'GET') {
    const row = await env.DB.prepare(`
      SELECT o.*,
        (SELECT COUNT(*) FROM boats b WHERE b.owner_id = o.id) AS boat_count
      FROM owners o
      WHERE o.id = ?
    `).bind(id).first();
    return row ? json(outOwner(row), 200, cors) : json({ error: 'Owner not found' }, 404, cors);
  }
  if (request.method === 'PUT') {
    const auth = requireAdmin(request, env);
    if (auth) return json(auth.body, auth.status, cors);
    const owner = await request.json();
    await upsertOwner(env, { ...owner, id });
    return json({ ok: true, id }, 200, cors);
  }
  if (request.method === 'DELETE') {
    const auth = requireAdmin(request, env);
    if (auth) return json(auth.body, auth.status, cors);
    await env.DB.prepare('UPDATE boats SET owner_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE owner_id = ?').bind(id).run();
    await env.DB.prepare('DELETE FROM owners WHERE id = ?').bind(id).run();
    return json({ ok: true, id }, 200, cors);
  }
  return json({ error: 'GET, PUT, or DELETE required' }, 405, cors);
}

async function ownerBoats(request, env, cors, ownerId) {
  requireDb(env);
  if (request.method === 'GET') {
    const rows = await env.DB.prepare('SELECT * FROM boats WHERE owner_id = ? ORDER BY name ASC').bind(ownerId).all();
    return json((rows.results || []).map(outBoat), 200, cors);
  }
  if (request.method === 'PUT') {
    const auth = requireAdmin(request, env);
    if (auth) return json(auth.body, auth.status, cors);
    const body = await request.json();
    const boatIds = unique(Array.isArray(body.boatIds) ? body.boatIds.map(String) : []);
    await env.DB.prepare('UPDATE boats SET owner_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE owner_id = ?').bind(ownerId).run();
    if (boatIds.length) {
      await env.DB.batch(boatIds.map(boatId => env.DB.prepare('UPDATE boats SET owner_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(ownerId, boatId)));
    }
    return json({ ok: true, ownerId, boatIds }, 200, cors);
  }
  return json({ error: 'GET or PUT required' }, 405, cors);
}

async function upsertOwner(env, owner) {
  await env.DB.prepare(`
    INSERT OR REPLACE INTO owners (
      id, name, email, phone, payout_notes, status, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).bind(
    owner.id,
    owner.name || 'New Owner',
    owner.email || null,
    owner.phone || null,
    owner.payoutNotes ?? owner.payout_notes ?? null,
    owner.status || 'active'
  ).run();
}

function outOwner(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    payoutNotes: row.payout_notes,
    status: row.status,
    boatCount: Number(row.boat_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function captains(request, env, cors) {
  requireDb(env);
  if (request.method === 'GET') {
    const rows = await env.DB.prepare(`
      SELECT c.*,
        (SELECT COUNT(*) FROM boat_captains bc WHERE bc.captain_id = c.id AND bc.status = 'approved') AS approved_boat_count
      FROM captains c
      ORDER BY status = 'active' DESC, name ASC
    `).all();
    return json((rows.results || []).map(outCaptain), 200, cors);
  }
  if (request.method === 'POST') {
    const auth = requireAdmin(request, env);
    if (auth) return json(auth.body, auth.status, cors);
    const captain = await request.json();
    const id = captain.id || `captain_${crypto.randomUUID()}`;
    await upsertCaptain(env, { ...captain, id });
    return json({ ok: true, id }, 201, cors);
  }
  return json({ error: 'GET or POST required' }, 405, cors);
}

async function captainById(request, env, cors, id) {
  requireDb(env);
  if (request.method === 'GET') {
    const row = await env.DB.prepare(`
      SELECT c.*,
        (SELECT COUNT(*) FROM boat_captains bc WHERE bc.captain_id = c.id AND bc.status = 'approved') AS approved_boat_count
      FROM captains c
      WHERE c.id = ?
    `).bind(id).first();
    return row ? json(outCaptain(row), 200, cors) : json({ error: 'Captain not found' }, 404, cors);
  }
  if (request.method === 'PUT') {
    const auth = requireAdmin(request, env);
    if (auth) return json(auth.body, auth.status, cors);
    const captain = await request.json();
    await upsertCaptain(env, { ...captain, id });
    return json({ ok: true, id }, 200, cors);
  }
  if (request.method === 'DELETE') {
    const auth = requireAdmin(request, env);
    if (auth) return json(auth.body, auth.status, cors);
    await env.DB.prepare('DELETE FROM boat_captains WHERE captain_id = ?').bind(id).run();
    await env.DB.prepare('DELETE FROM captains WHERE id = ?').bind(id).run();
    return json({ ok: true, id }, 200, cors);
  }
  return json({ error: 'GET, PUT, or DELETE required' }, 405, cors);
}

async function boatCaptains(request, env, cors, boatId) {
  requireDb(env);
  if (request.method === 'GET') {
    const rows = await env.DB.prepare(`
      SELECT c.*, bc.status AS approval_status, bc.notes AS approval_notes, bc.sort_order AS approval_sort_order
      FROM captains c
      INNER JOIN boat_captains bc ON bc.captain_id = c.id
      WHERE bc.boat_id = ? AND bc.status = 'approved'
      ORDER BY bc.sort_order ASC, c.name ASC
    `).bind(boatId).all();
    return json((rows.results || []).map(outCaptain), 200, cors);
  }
  if (request.method === 'PUT') {
    const auth = requireAdmin(request, env);
    if (auth) return json(auth.body, auth.status, cors);
    const body = await request.json();
    const captainIds = unique(Array.isArray(body.captainIds) ? body.captainIds.map(String) : []);
    await env.DB.prepare('DELETE FROM boat_captains WHERE boat_id = ?').bind(boatId).run();
    for (const [index, captainId] of captainIds.entries()) {
      await env.DB.prepare('INSERT OR REPLACE INTO boat_captains (boat_id, captain_id, status, notes, sort_order) VALUES (?, ?, ?, ?, ?)')
        .bind(boatId, captainId, 'approved', null, index)
        .run();
    }
    return json({ ok: true, boatId, captainIds }, 200, cors);
  }
  return json({ error: 'GET or PUT required' }, 405, cors);
}

async function upsertCaptain(env, captain) {
  await env.DB.prepare(`
    INSERT OR REPLACE INTO captains (
      id, name, status, credential, email, phone, bio, home_port, photo_url, photo_focal_x, photo_focal_y, photo_zoom, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).bind(
    captain.id,
    captain.name || 'New Captain',
    captain.status || 'draft',
    captain.credential || null,
    captain.email || null,
    captain.phone || null,
    captain.bio || null,
    captain.homePort || captain.home_port || null,
    captain.photoUrl ?? captain.photo_url ?? null,
    num(captain.photoFocalX ?? captain.photo_focal_x, 50),
    num(captain.photoFocalY ?? captain.photo_focal_y, 30),
    num(captain.photoZoom ?? captain.photo_zoom, 1)
  ).run();
}

function outCaptain(row) {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    credential: row.credential,
    email: row.email,
    phone: row.phone,
    bio: row.bio,
    homePort: row.home_port,
    photoUrl: row.photo_url,
    photoFocalX: num(row.photo_focal_x, 50),
    photoFocalY: num(row.photo_focal_y, 30),
    photoZoom: num(row.photo_zoom, 1),
    approvedBoatCount: Number(row.approved_boat_count || 0),
    approvalStatus: row.approval_status,
    approvalNotes: row.approval_notes,
    approvalSortOrder: num(row.approval_sort_order, 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function availability(request, env, cors) {
  requireDb(env);
  if (request.method === 'GET') {
    const url = new URL(request.url);
    const clauses = [];
    const values = [];
    for (const [param, column] of [['entityType', 'entity_type'], ['entityId', 'entity_id'], ['status', 'status']]) {
      const value = url.searchParams.get(param) || url.searchParams.get(column);
      if (value) {
        clauses.push(`${column} = ?`);
        values.push(value);
      }
    }
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    if (from) {
      clauses.push('end_at >= ?');
      values.push(from);
    }
    if (to) {
      clauses.push('start_at <= ?');
      values.push(to);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = await env.DB.prepare(`SELECT * FROM availability ${where} ORDER BY start_at ASC, entity_type ASC`).bind(...values).all();
    return json((rows.results || []).map(outAvailability), 200, cors);
  }
  if (request.method === 'POST') {
    const auth = requireAdmin(request, env);
    if (auth) return json(auth.body, auth.status, cors);
    const body = await request.json();
    if (!body.entityType && !body.entity_type) return json({ error: 'entityType is required' }, 400, cors);
    if (!body.entityId && !body.entity_id) return json({ error: 'entityId is required' }, 400, cors);
    if (!body.startAt && !body.start_at) return json({ error: 'startAt is required' }, 400, cors);
    if (!body.endAt && !body.end_at) return json({ error: 'endAt is required' }, 400, cors);
    const id = body.id || `availability_${crypto.randomUUID()}`;
    await upsertAvailability(env, { ...body, id });
    const row = await env.DB.prepare('SELECT * FROM availability WHERE id = ?').bind(id).first();
    return json({ ok: true, id, availability: outAvailability(row) }, 201, cors);
  }
  return json({ error: 'GET or POST required' }, 405, cors);
}

async function availabilityById(request, env, cors, id) {
  requireDb(env);
  if (request.method === 'GET') {
    const row = await env.DB.prepare('SELECT * FROM availability WHERE id = ?').bind(id).first();
    return row ? json(outAvailability(row), 200, cors) : json({ error: 'Availability block not found' }, 404, cors);
  }
  const auth = requireAdmin(request, env);
  if (auth) return json(auth.body, auth.status, cors);
  if (request.method === 'PUT') {
    const current = await env.DB.prepare('SELECT * FROM availability WHERE id = ?').bind(id).first();
    if (!current) return json({ error: 'Availability block not found' }, 404, cors);
    const body = await request.json();
    await upsertAvailability(env, { ...current, ...body, id });
    const row = await env.DB.prepare('SELECT * FROM availability WHERE id = ?').bind(id).first();
    return json({ ok: true, availability: outAvailability(row) }, 200, cors);
  }
  if (request.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM availability WHERE id = ?').bind(id).run();
    return json({ ok: true, id }, 200, cors);
  }
  return json({ error: 'GET, PUT, or DELETE required' }, 405, cors);
}

async function upsertAvailability(env, block) {
  await env.DB.prepare(`
    INSERT OR REPLACE INTO availability (
      id, entity_type, entity_id, start_at, end_at, status, notes, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).bind(
    block.id,
    block.entityType || block.entity_type,
    block.entityId || block.entity_id,
    block.startAt || block.start_at,
    block.endAt || block.end_at,
    block.status || 'hold',
    block.notes || null
  ).run();
}

function outAvailability(row) {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    startAt: row.start_at,
    endAt: row.end_at,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function bookings(request, env, cors, ctx) {
  requireDb(env);
  if (request.method === 'GET') {
    const rows = await env.DB.prepare(bookingSelectSql('ORDER BY bk.created_at DESC')).all();
    return json(await attachBookingDocuments(env, (rows.results || []).map(outBooking)), 200, cors);
  }
  if (request.method === 'POST') {
    const body = await request.json();
    if (!body.boatId && !body.boat_id) return json({ error: 'boatId is required' }, 400, cors);
    if (!body.customerName && !(body.firstName || body.lastName)) return json({ error: 'Customer name is required' }, 400, cors);
    if (!body.email && !body.phone) return json({ error: 'Email or phone is required' }, 400, cors);
    const requestedStartTime = body.startTime || body.start_time || null;
    if (requestedStartTime && !isPublicBookingStartTime(requestedStartTime)) return json({ error: 'Start time must be between 9:00 AM and 6:00 PM in 30-minute increments.' }, 400, cors);
    const bookingId = body.id || `booking_${crypto.randomUUID()}`;
    const customerId = body.customerId || `customer_${crypto.randomUUID()}`;
    const names = splitName(body.customerName, body.firstName, body.lastName);
    const price = await env.DB.prepare(`
      SELECT id, base_fee, cleaning_fee, fuel_deposit, tax_rate
      FROM boat_pricing
      WHERE boat_id = ? AND active = 1
      ORDER BY duration_hours
      LIMIT 1
    `).bind(body.boatId || body.boat_id).first();

    await env.DB.prepare(`
      INSERT OR REPLACE INTO customers (id, first_name, last_name, email, phone, notes, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(customerId, names.firstName, names.lastName, body.email || null, body.phone || null, body.customerNotes || body.notes || null).run();

    await env.DB.prepare(`
      INSERT INTO bookings (
        id, customer_id, boat_id, captain_id, pricing_id, status, paid_status,
        charter_date, start_time, duration_hours, base_fee, cleaning_fee,
        fuel_deposit, tax_rate, mileage_rate, office_notes, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      bookingId,
      customerId,
      body.boatId || body.boat_id,
      body.captainId || body.captain_id || null,
      price?.id || null,
      'requested',
      'unpaid',
      body.charterDate || body.charter_date || null,
      requestedStartTime,
      Number(body.durationHours || body.duration_hours || 4),
      Number(price?.base_fee || body.baseFee || 0),
      Number(price?.cleaning_fee || 0),
      Number(price?.fuel_deposit || 0),
      Number(price?.tax_rate || 0.08225),
      Number(await setting(env, 'mileage_rate', 14)),
      body.officeNotes ?? body.office_notes ?? null
    ).run();

    const row = await env.DB.prepare(bookingSelectSql('WHERE bk.id = ?')).bind(bookingId).first();
    const booking = outBooking(row);
    const emailTask = sendBookingNotification(env, booking).catch(error => console.error('Booking notification failed', error));
    if (ctx?.waitUntil) ctx.waitUntil(emailTask); else await emailTask;
    return json({ ok: true, id: bookingId, booking: (await attachBookingDocuments(env, [booking]))[0] }, 201, cors);
  }
  return json({ error: 'GET or POST required' }, 405, cors);
}

async function bookingById(request, env, cors, id) {
  requireDb(env);
  if (request.method === 'GET') {
    const row = await env.DB.prepare(bookingSelectSql('WHERE bk.id = ?')).bind(id).first();
    return row ? json((await attachBookingDocuments(env, [outBooking(row)]))[0], 200, cors) : json({ error: 'Booking not found' }, 404, cors);
  }

  const auth = requireAdmin(request, env);
  if (auth) return json(auth.body, auth.status, cors);

  if (request.method === 'PUT') {
    const current = await env.DB.prepare('SELECT * FROM bookings WHERE id = ?').bind(id).first();
    if (!current) return json({ error: 'Booking not found' }, 404, cors);
    const body = await request.json();
    await env.DB.prepare(`
      UPDATE bookings
      SET status = ?, paid_status = ?, captain_id = ?, charter_date = ?, start_time = ?,
        duration_hours = ?, office_notes = ?, agreement_status = ?, signing_url = ?,
        agreement_signed_at = CASE WHEN ? = 'signed' AND agreement_signed_at IS NULL THEN CURRENT_TIMESTAMP ELSE agreement_signed_at END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      body.status || current.status,
      body.paidStatus || body.paid_status || current.paid_status,
      body.captainId ?? body.captain_id ?? current.captain_id,
      body.charterDate ?? body.charter_date ?? current.charter_date,
      body.startTime ?? body.start_time ?? current.start_time,
      Number(body.durationHours ?? body.duration_hours ?? current.duration_hours ?? 4),
      body.officeNotes ?? body.office_notes ?? current.office_notes,
      body.agreementStatus ?? body.agreement_status ?? current.agreement_status ?? 'not started',
      body.signingUrl ?? body.signing_url ?? current.signing_url,
      body.agreementStatus ?? body.agreement_status ?? current.agreement_status ?? 'not started',
      id
    ).run();
    const row = await env.DB.prepare(bookingSelectSql('WHERE bk.id = ?')).bind(id).first();
    return json({ ok: true, booking: (await attachBookingDocuments(env, [outBooking(row)]))[0] }, 200, cors);
  }

  if (request.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM bookings WHERE id = ?').bind(id).run();
    return json({ ok: true, id }, 200, cors);
  }

  return json({ error: 'GET, PUT, or DELETE required' }, 405, cors);
}

async function bookingDocuments(request, env, cors, bookingId) {
  requireDb(env);
  const auth = requireAdmin(request, env);
  if (auth) return json(auth.body, auth.status, cors);

  if (request.method === 'GET') {
    const rows = await env.DB.prepare('SELECT * FROM booking_documents WHERE booking_id = ? ORDER BY created_at DESC').bind(bookingId).all();
    return json((rows.results || []).map(outBookingDocument), 200, cors);
  }

  if (request.method === 'POST') {
    const body = await request.json();
    if (!body.url) return json({ error: 'Document URL is required' }, 400, cors);
    const id = body.id || `doc_${crypto.randomUUID()}`;
    await env.DB.prepare(`
      INSERT INTO booking_documents (id, booking_id, document_type, title, url, filename, content_type, status, audience, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      id,
      bookingId,
      body.documentType || body.document_type || 'agreement',
      body.title || 'Signed charter document',
      body.url,
      body.filename || null,
      body.contentType || body.content_type || null,
      body.status || 'uploaded',
      body.audience || 'office'
    ).run();

    if (String(body.status || '').toLowerCase() === 'signed') {
      await env.DB.prepare('UPDATE bookings SET agreement_status = ?, agreement_signed_at = COALESCE(agreement_signed_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind('signed', bookingId).run();
    }

    const row = await env.DB.prepare('SELECT * FROM booking_documents WHERE id = ?').bind(id).first();
    return json({ ok: true, document: outBookingDocument(row) }, 201, cors);
  }

  return json({ error: 'GET or POST required' }, 405, cors);
}

async function bookingSettlement(request, env, cors, bookingId) {
  requireDb(env);
  const auth = requireAdmin(request, env);
  if (auth) return json(auth.body, auth.status, cors);

  const bookingRow = await env.DB.prepare(bookingSelectSql('WHERE bk.id = ?')).bind(bookingId).first();
  if (!bookingRow) return json({ error: 'Booking not found' }, 404, cors);
  const booking = outBooking(bookingRow);

  if (request.method === 'GET') {
    const trip = await env.DB.prepare('SELECT * FROM trips WHERE booking_id = ?').bind(bookingId).first();
    const settlement = await env.DB.prepare('SELECT * FROM settlements WHERE booking_id = ? ORDER BY updated_at DESC LIMIT 1').bind(bookingId).first();
    const calculation = await calculateSettlement(env, bookingRow, trip || {}, settlement || {});
    return json({ booking, trip: trip ? outTrip(trip) : null, settlement: settlement ? outSettlement(settlement) : null, calculation }, 200, cors);
  }

  if (request.method === 'PUT') {
    const body = await request.json();
    const currentTrip = await env.DB.prepare('SELECT * FROM trips WHERE booking_id = ?').bind(bookingId).first();
    const currentSettlement = await env.DB.prepare('SELECT * FROM settlements WHERE booking_id = ? ORDER BY updated_at DESC LIMIT 1').bind(bookingId).first();
    const calculation = await calculateSettlement(env, bookingRow, currentTrip || {}, { ...currentSettlement, ...body });
    const tripId = currentTrip?.id || body.tripId || `trip_${crypto.randomUUID()}`;
    const settlementId = currentSettlement?.id || body.settlementId || `settlement_${crypto.randomUUID()}`;
    const closeTrip = Boolean(body.closeTrip);

    await env.DB.prepare(`
      INSERT OR REPLACE INTO trips (
        id, booking_id, status, actual_hours, start_miles, end_miles, billable_miles, mileage_rate,
        mileage_charge, fuel_paid_by, fuel_amount, cleaning_fee_charged, damage_reported,
        damage_notes, captain_notes, office_notes, closed_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? THEN COALESCE((SELECT closed_at FROM trips WHERE id = ?), CURRENT_TIMESTAMP) ELSE NULL END, CURRENT_TIMESTAMP)
    `).bind(
      tripId,
      bookingId,
      closeTrip ? 'closed' : (body.tripStatus || body.trip_status || currentTrip?.status || 'open'),
      calculation.actualHours,
      calculation.startMiles,
      calculation.endMiles,
      calculation.billableMiles,
      calculation.mileageRate,
      calculation.mileageCharge,
      body.fuelPaidBy || body.fuel_paid_by || currentTrip?.fuel_paid_by || null,
      calculation.fuelAmount,
      calculation.cleaningFee > 0 ? 1 : 0,
      body.damageReported || body.damage_reported || currentTrip?.damage_reported || 0,
      body.damageNotes || body.damage_notes || currentTrip?.damage_notes || null,
      body.captainNotes || body.captain_notes || currentTrip?.captain_notes || null,
      body.officeNotes || body.office_notes || currentTrip?.office_notes || null,
      closeTrip ? 1 : 0,
      tripId
    ).run();

    await env.DB.prepare(`
      INSERT OR REPLACE INTO settlements (
        id, booking_id, trip_id, captain_pay, owner_payout, cove_commission, cleaning_fee,
        tax_collected, fuel_deposit, fuel_deposit_refund, mileage_charge, additional_charges, additional_charges_json,
        gross_revenue, gross_profit, captain_hourly_rate, owner_split, cove_split,
        owner_paid_status, captain_paid_status, customer_paid_status, office_status, notes, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      settlementId,
      bookingId,
      tripId,
      calculation.captainPay,
      calculation.ownerPayout,
      calculation.coveCommission,
      calculation.cleaningFee,
      calculation.taxCollected,
      calculation.fuelDeposit,
      calculation.fuelDepositRefund,
      calculation.mileageCharge,
      calculation.additionalCharges,
      JSON.stringify(calculation.additionalChargeItems),
      calculation.grossRevenue,
      calculation.grossProfit,
      calculation.captainHourlyRate,
      calculation.ownerSplit,
      calculation.coveSplit,
      body.ownerPaidStatus || body.owner_paid_status || currentSettlement?.owner_paid_status || 'unpaid',
      body.captainPaidStatus || body.captain_paid_status || currentSettlement?.captain_paid_status || 'unpaid',
      body.customerPaidStatus || body.customer_paid_status || currentSettlement?.customer_paid_status || 'unpaid',
      body.officeStatus || body.office_status || currentSettlement?.office_status || 'draft',
      body.notes || currentSettlement?.notes || null
    ).run();

    if (closeTrip) {
      await env.DB.prepare('UPDATE bookings SET status = ?, paid_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .bind('completed', body.customerPaidStatus || body.customer_paid_status || bookingRow.paid_status || 'unsettled', bookingId)
        .run();
    }

    const trip = await env.DB.prepare('SELECT * FROM trips WHERE id = ?').bind(tripId).first();
    const settlement = await env.DB.prepare('SELECT * FROM settlements WHERE id = ?').bind(settlementId).first();
    return json({ ok: true, trip: outTrip(trip), settlement: outSettlement(settlement), calculation }, 200, cors);
  }

  return json({ error: 'GET or PUT required' }, 405, cors);
}

async function calculateSettlement(env, booking, trip = {}, input = {}) {
  const mileageRate = num(input.mileageRate ?? input.mileage_rate ?? trip.mileage_rate ?? booking.mileage_rate ?? await setting(env, 'mileage_rate', 14), 14);
  const captainHourlyRate = num(input.captainHourlyRate ?? input.captain_hourly_rate ?? await setting(env, 'captain_hourly_rate', 125), 125);
  const ownerSplit = num(input.ownerSplit ?? input.owner_split ?? await setting(env, 'owner_split', 0.85), 0.85);
  const coveSplit = num(input.coveSplit ?? input.cove_split ?? await setting(env, 'cove_split', 0.15), 0.15);
  const actualHours = num(input.actualHours ?? input.actual_hours ?? trip.actual_hours ?? booking.duration_hours, 0);
  const milesTraveled = num(input.milesTraveled ?? input.miles_traveled ?? input.billableMiles ?? input.billable_miles ?? trip.billable_miles, 0);
  const startMiles = null;
  const endMiles = null;
  const billableMiles = milesTraveled;
  const mileageCharge = roundMoney(billableMiles * mileageRate);
  const baseFee = num(input.charterAmount ?? input.baseFee ?? input.base_fee ?? booking.base_fee, 0);
  const fuelDeposit = num(input.fuelDeposit ?? input.fuel_deposit ?? booking.fuel_deposit, 0);
  const fuelAmount = 0;
  const additionalChargeItems = additionalItemsFromInput(input);
  const additionalCharges = roundMoney(additionalChargeItems.length ? additionalChargeItems.reduce((sum, item) => sum + item.amount, 0) : num(input.additionalCharges ?? input.additional_charges, 0));
  const cleaningFee = truthy(input.cleaningFeeCharged ?? input.cleaning_fee_charged ?? trip.cleaning_fee_charged ?? true) ? num(input.cleaningFee ?? input.cleaning_fee ?? booking.cleaning_fee, 0) : 0;
  const taxOverride = nullableNum(input.taxCollected ?? input.tax_collected);
  const taxCollected = taxOverride !== null ? taxOverride : roundMoney((baseFee + cleaningFee) * num(booking.tax_rate, 0));
  const captainPay = roundMoney(num(input.captainPay ?? input.captain_pay, actualHours * captainHourlyRate));
  const netAfterCaptain = Math.max(0, baseFee - captainPay);
  const ownerPayout = roundMoney(num(input.ownerPayout ?? input.owner_payout, netAfterCaptain * ownerSplit));
  const coveCommission = roundMoney(num(input.coveCommission ?? input.cove_commission, netAfterCaptain * coveSplit));
  const fuelDepositRefund = roundMoney(Math.max(0, num(input.fuelDepositRefund ?? input.fuel_deposit_refund, fuelDeposit - fuelAmount - mileageCharge - additionalCharges)));
  const grossRevenue = roundMoney(num(input.grossRevenue ?? input.gross_revenue, baseFee + cleaningFee + taxCollected + fuelDeposit + mileageCharge + additionalCharges));
  const grossProfit = roundMoney(num(input.grossProfit ?? input.gross_profit, coveCommission));
  return { actualHours, startMiles, endMiles, milesTraveled, billableMiles, mileageRate, mileageCharge, baseFee, cleaningFee, taxCollected, fuelDeposit, fuelAmount, fuelDepositRefund, additionalCharges, additionalChargeItems, captainHourlyRate, captainPay, ownerSplit, coveSplit, ownerPayout, coveCommission, grossRevenue, grossProfit };
}

function additionalItemsFromInput(input = {}) {
  const raw = input.additionalChargeItems ?? input.additional_charge_items ?? input.additionalChargesJson ?? input.additional_charges_json;
  if (Array.isArray(raw)) return normalizeAdditionalItems(raw);
  if (typeof raw === 'string' && raw.trim()) {
    try { return normalizeAdditionalItems(JSON.parse(raw)); } catch { return []; }
  }
  return [];
}

function normalizeAdditionalItems(items) {
  return (Array.isArray(items) ? items : [])
    .map(item => ({ description: String(item.description || item.label || '').trim(), amount: roundMoney(num(item.amount, 0)) }))
    .filter(item => item.description || item.amount);
}

function outTrip(row) {
  return {
    id: row.id,
    bookingId: row.booking_id,
    status: row.status,
    actualHours: row.actual_hours,
    startMiles: row.start_miles,
    endMiles: row.end_miles,
    billableMiles: row.billable_miles,
    mileageRate: row.mileage_rate,
    mileageCharge: row.mileage_charge,
    fuelPaidBy: row.fuel_paid_by,
    fuelAmount: row.fuel_amount,
    cleaningFeeCharged: Boolean(row.cleaning_fee_charged),
    damageReported: Boolean(row.damage_reported),
    damageNotes: row.damage_notes,
    captainNotes: row.captain_notes,
    officeNotes: row.office_notes,
    closedAt: row.closed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function outSettlement(row) {
  return {
    id: row.id,
    bookingId: row.booking_id,
    tripId: row.trip_id,
    captainPay: row.captain_pay,
    ownerPayout: row.owner_payout,
    coveCommission: row.cove_commission,
    cleaningFee: row.cleaning_fee,
    taxCollected: row.tax_collected,
    fuelDeposit: row.fuel_deposit,
    fuelDepositRefund: row.fuel_deposit_refund,
    mileageCharge: row.mileage_charge,
    additionalCharges: row.additional_charges,
    additionalChargeItems: additionalItemsFromInput({ additional_charges_json: row.additional_charges_json }),
    additionalChargesJson: row.additional_charges_json,
    grossRevenue: row.gross_revenue,
    grossProfit: row.gross_profit,
    captainHourlyRate: row.captain_hourly_rate,
    ownerSplit: row.owner_split,
    coveSplit: row.cove_split,
    ownerPaidStatus: row.owner_paid_status,
    captainPaidStatus: row.captain_paid_status,
    customerPaidStatus: row.customer_paid_status,
    officeStatus: row.office_status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function signingPacket(request, env, cors, token) {
  requireDb(env);
  const row = await env.DB.prepare(bookingSelectSql('WHERE bk.signing_token = ?')).bind(token).first();
  if (!row) return json({ error: 'Signing packet not found' }, 404, cors);
  const booking = (await attachBookingDocuments(env, [outBooking(row)]))[0];

  if (request.method === 'GET') {
    return json({
      booking: publicSigningBooking(booking),
      sections: agreementSections(booking),
      completed: booking.agreementStatus === 'signed' || Boolean(booking.signingCompletedAt)
    }, 200, cors);
  }

  if (request.method === 'POST') {
    const body = await request.json();
    if (!body.signerName) return json({ error: 'Signer name is required' }, 400, cors);
    if (!body.signatureText) return json({ error: 'Signature is required' }, 400, cors);
    const accepted = Array.isArray(body.accepted) ? body.accepted : [];
    const requiredIds = agreementSections().map(section => section.id);
    const missing = requiredIds.filter(id => !accepted.some(item => item.id === id && item.accepted));
    if (missing.length) return json({ error: `Missing acceptance for: ${missing.join(', ')}` }, 400, cors);

    const signatureId = `sig_${crypto.randomUUID()}`;
    await env.DB.prepare(`
      INSERT INTO booking_signatures (id, booking_id, signer_name, signer_email, signer_ip, user_agent, accepted_json, signature_text)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      signatureId,
      booking.id,
      body.signerName,
      body.signerEmail || booking.email || null,
      body.signerIp || null,
      body.userAgent || null,
      JSON.stringify(accepted),
      body.signatureText
    ).run();

    await env.DB.prepare(`
      UPDATE bookings
      SET agreement_status = 'signed', agreement_signed_at = COALESCE(agreement_signed_at, CURRENT_TIMESTAMP),
        signing_completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(booking.id).run();

    const summaryUrl = `${env.ADMIN_URL || 'https://jeffrwinters.github.io/Cove-Charters/admin.html'}#booking-${booking.id}`;
    await env.DB.prepare(`
      INSERT INTO booking_documents (id, booking_id, document_type, title, url, filename, content_type, status, audience, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      `doc_${crypto.randomUUID()}`,
      booking.id,
      'electronic_signature_record',
      'Electronic signing record',
      summaryUrl,
      `electronic-signature-${booking.id}.json`,
      'application/json',
      'signed',
      'office,captain'
    ).run();

    await sendSignedAgreementNotice(env, { ...booking, signatureId, signerName: body.signerName, signerEmail: body.signerEmail || booking.email || null, signedRecordUrl: summaryUrl }).catch(error => {
      console.warn('Signed agreement notice failed', error?.message || error);
    });

    return json({ ok: true, signatureId }, 201, cors);
  }

  return json({ error: 'GET or POST required' }, 405, cors);
}

async function sendBookingConfirmation(request, env, cors, id) {
  requireDb(env);
  const auth = requireAdmin(request, env);
  if (auth) return json(auth.body, auth.status, cors);
  if (request.method !== 'POST') return json({ error: 'POST required' }, 405, cors);

  const row = await env.DB.prepare(bookingSelectSql('WHERE bk.id = ?')).bind(id).first();
  if (!row) return json({ error: 'Booking not found' }, 404, cors);
  const booking = (await attachBookingDocuments(env, [outBooking(row)]))[0];
  if (!booking.email) return json({ error: 'Booking has no customer email address' }, 400, cors);
  const missing = [];
  if (!booking.boatId) missing.push('boat');
  if (!booking.captainId) missing.push('captain');
  if (!booking.charterDate) missing.push('date');
  if (!booking.startTime) missing.push('start time');
  if (!booking.durationHours) missing.push('hours');
  if (missing.length) return json({ error: `Add ${missing.join(', ')} before sending the agreement packet` }, 400, cors);
  if (!env.RESEND_API_KEY || !env.BOOKING_NOTIFY_FROM) {
    return json({ ok: false, sent: false, configured: false, provider: 'resend', error: 'Customer email is not configured' }, 501, cors);
  }

  const result = await sendCustomerConfirmation(env, booking);
  const note = `[${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })}] Confirmation email sent to ${booking.email}`;
  await env.DB.prepare(`
    UPDATE bookings
    SET office_notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind([booking.officeNotes, note].filter(Boolean).join('\n'), id).run();

  return json({ ok: true, sent: true, result }, 200, cors);
}

async function sendAgreementPacket(request, env, cors, id) {
  requireDb(env);
  const auth = requireAdmin(request, env);
  if (auth) return json(auth.body, auth.status, cors);
  if (request.method !== 'POST') return json({ error: 'POST required' }, 405, cors);

  const row = await env.DB.prepare(bookingSelectSql('WHERE bk.id = ?')).bind(id).first();
  if (!row) return json({ error: 'Booking not found' }, 404, cors);
  const booking = (await attachBookingDocuments(env, [outBooking(row)]))[0];
  if (!booking.email) return json({ error: 'Booking has no customer email address' }, 400, cors);
  if (!env.RESEND_API_KEY || !env.BOOKING_NOTIFY_FROM) {
    return json({ ok: false, sent: false, configured: false, provider: 'resend', error: 'Customer email is not configured' }, 501, cors);
  }

  const body = await request.json().catch(() => ({}));
  const signingToken = booking.signingToken || body.signingToken || crypto.randomUUID();
  const signingUrl = body.signingUrl || body.signing_url || booking.signingUrl || `${publicSiteUrl(env)}/sign.html?token=${encodeURIComponent(signingToken)}`;
  const result = await sendCustomerAgreementPacket(env, { ...booking, signingUrl });
  const note = `[${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })}] Agreement packet sent to ${booking.email}${signingUrl ? ` (${signingUrl})` : ''}`;
  await env.DB.prepare(`
    UPDATE bookings
    SET agreement_status = ?, signing_token = COALESCE(signing_token, ?), signing_url = COALESCE(?, signing_url), agreement_sent_at = CURRENT_TIMESTAMP,
      office_notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind('sent', signingToken, signingUrl || null, [booking.officeNotes, note].filter(Boolean).join('\n'), id).run();

  return json({ ok: true, sent: true, result }, 200, cors);
}

async function sendCaptainPacket(request, env, cors, id) {
  requireDb(env);
  const auth = requireAdmin(request, env);
  if (auth) return json(auth.body, auth.status, cors);
  if (request.method !== 'POST') return json({ error: 'POST required' }, 405, cors);

  const row = await env.DB.prepare(bookingSelectSql('WHERE bk.id = ?')).bind(id).first();
  if (!row) return json({ error: 'Booking not found' }, 404, cors);
  const booking = (await attachBookingDocuments(env, [outBooking(row)]))[0];
  if (!booking.captainId) return json({ error: 'Booking does not have an assigned captain' }, 400, cors);
  if (!booking.captainEmail) return json({ error: 'Assigned captain does not have an email address' }, 400, cors);
  if (!env.RESEND_API_KEY || !env.BOOKING_NOTIFY_FROM) {
    return json({ ok: false, sent: false, configured: false, provider: 'resend', error: 'Captain email is not configured' }, 501, cors);
  }

  const result = await sendCaptainTripPacket(env, booking);
  const note = `[${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })}] Captain packet sent to ${booking.captainName || booking.captainEmail}`;
  await env.DB.prepare(`
    UPDATE bookings
    SET office_notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind([booking.officeNotes, note].filter(Boolean).join('\n'), id).run();

  return json({ ok: true, sent: true, result }, 200, cors);
}

async function sendFinalInvoice(request, env, cors, id) {
  requireDb(env);
  const auth = requireAdmin(request, env);
  if (auth) return json(auth.body, auth.status, cors);
  if (request.method !== 'POST') return json({ error: 'POST required' }, 405, cors);

  const row = await env.DB.prepare(bookingSelectSql('WHERE bk.id = ?')).bind(id).first();
  if (!row) return json({ error: 'Booking not found' }, 404, cors);
  const booking = (await attachBookingDocuments(env, [outBooking(row)]))[0];
  if (!booking.email) return json({ error: 'Booking has no customer email address' }, 400, cors);
  if (!env.RESEND_API_KEY || !env.BOOKING_NOTIFY_FROM) {
    return json({ ok: false, sent: false, configured: false, provider: 'resend', error: 'Customer email is not configured' }, 501, cors);
  }

  const trip = await env.DB.prepare('SELECT * FROM trips WHERE booking_id = ?').bind(id).first();
  const settlement = await env.DB.prepare('SELECT * FROM settlements WHERE booking_id = ? ORDER BY updated_at DESC LIMIT 1').bind(id).first();
  const calculation = await calculateSettlement(env, row, trip || {}, settlement || {});
  const result = await sendCustomerFinalInvoice(env, booking, calculation);
  const note = `[${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })}] Final invoice sent to ${booking.email}`;
  await env.DB.prepare(`
    UPDATE bookings
    SET office_notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind([booking.officeNotes, note].filter(Boolean).join('\n'), id).run();

  return json({ ok: true, sent: true, result, calculation }, 200, cors);
}

function bookingSelectSql(suffix = '') {
  return `
    SELECT bk.*, b.name AS boat_name, b.slug AS boat_slug, c.name AS captain_name,
      c.email AS captain_email, c.phone AS captain_phone,
      cu.first_name, cu.last_name, cu.email, cu.phone, cu.notes AS customer_notes
    FROM bookings bk
    LEFT JOIN boats b ON b.id = bk.boat_id
    LEFT JOIN captains c ON c.id = bk.captain_id
    LEFT JOIN customers cu ON cu.id = bk.customer_id
    ${suffix}
  `;
}

function outBooking(row) {
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: [row.first_name, row.last_name].filter(Boolean).join(' ').trim(),
    email: row.email,
    phone: row.phone,
    customerNotes: row.customer_notes,
    boatId: row.boat_id,
    boatName: row.boat_name,
    boatSlug: row.boat_slug,
    captainId: row.captain_id,
    captainName: row.captain_name,
    captainEmail: row.captain_email,
    captainPhone: row.captain_phone,
    pricingId: row.pricing_id,
    status: row.status,
    paidStatus: row.paid_status,
    charterDate: row.charter_date,
    startTime: row.start_time,
    durationHours: row.duration_hours,
    baseFee: row.base_fee,
    cleaningFee: row.cleaning_fee,
    fuelDeposit: row.fuel_deposit,
    taxRate: row.tax_rate,
    mileageRate: row.mileage_rate,
    taxAmount: row.tax_amount,
    totalCollected: row.total_collected,
    officeNotes: row.office_notes,
    agreementStatus: row.agreement_status || 'not started',
    agreementSentAt: row.agreement_sent_at,
    agreementSignedAt: row.agreement_signed_at,
    signingUrl: row.signing_url,
    signingToken: row.signing_token,
    signingCompletedAt: row.signing_completed_at,
    documents: [],
    signatures: [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function attachBookingDocuments(env, bookings) {
  if (!bookings.length) return bookings;
  const ids = bookings.map(b => b.id);
  const placeholders = ids.map(() => '?').join(',');
  const rows = await env.DB.prepare(`SELECT * FROM booking_documents WHERE booking_id IN (${placeholders}) ORDER BY created_at DESC`).bind(...ids).all();
  const sigRows = await env.DB.prepare(`SELECT * FROM booking_signatures WHERE booking_id IN (${placeholders}) ORDER BY signed_at DESC`).bind(...ids).all();
  const tripRows = await env.DB.prepare(`SELECT * FROM trips WHERE booking_id IN (${placeholders})`).bind(...ids).all();
  const settlementRows = await env.DB.prepare(`SELECT * FROM settlements WHERE booking_id IN (${placeholders}) ORDER BY updated_at DESC`).bind(...ids).all();
  const byBooking = new Map(ids.map(id => [id, []]));
  const signaturesByBooking = new Map(ids.map(id => [id, []]));
  const tripsByBooking = new Map();
  const settlementsByBooking = new Map();
  for (const row of rows.results || []) {
    byBooking.get(row.booking_id)?.push(outBookingDocument(row));
  }
  for (const row of sigRows.results || []) {
    signaturesByBooking.get(row.booking_id)?.push(outBookingSignature(row));
  }
  for (const row of tripRows.results || []) {
    tripsByBooking.set(row.booking_id, outTrip(row));
  }
  for (const row of settlementRows.results || []) {
    if (!settlementsByBooking.has(row.booking_id)) settlementsByBooking.set(row.booking_id, outSettlement(row));
  }
  return bookings.map(booking => ({ ...booking, documents: byBooking.get(booking.id) || [], signatures: signaturesByBooking.get(booking.id) || [], trip: tripsByBooking.get(booking.id) || null, settlement: settlementsByBooking.get(booking.id) || null }));
}

function outBookingDocument(row) {
  return {
    id: row.id,
    bookingId: row.booking_id,
    documentType: row.document_type,
    title: row.title,
    url: row.url,
    filename: row.filename,
    contentType: row.content_type,
    status: row.status,
    audience: row.audience,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function outBookingSignature(row) {
  return {
    id: row.id,
    bookingId: row.booking_id,
    signerName: row.signer_name,
    signerEmail: row.signer_email,
    accepted: safeJson(row.accepted_json, []),
    signatureText: row.signature_text,
    signedAt: row.signed_at
  };
}

function publicSigningBooking(booking) {
  return {
    id: booking.id,
    customerName: booking.customerName,
    email: booking.email,
    boatName: booking.boatName,
    captainName: booking.captainName,
    charterDate: booking.charterDate,
    startTime: booking.startTime,
    durationHours: booking.durationHours,
    agreementStatus: booking.agreementStatus
  };
}

function agreementSections(booking = {}) {
  const captainName = booking.captainName || 'the confirmed captain';
  const charterDate = booking.charterDate || 'the confirmed charter date';
  const startTime = booking.startTime || 'the confirmed start time';
  const durationHours = booking.durationHours ? `${booking.durationHours} hours` : 'the confirmed charter duration';
  const endTime = booking.endTime || estimatedEndTime(booking.startTime, booking.durationHours) || 'the confirmed end time';
  return [
    {
      id: 'captain_service_agreement',
      title: 'Captain Service Agreement',
      summary: 'Confirms the customer selected the captain and understands captain services are separate from the vessel charter.',
      body: `Selected Captain: ${captainName}

THIS CAPTAIN SERVICES AGREEMENT (this “Agreement”) is made as of ${new Date().toLocaleDateString("en-US")} by and between the Charterer signing this packet, individually, and ${captainName}, a USCG licensed captain (the “Captain”), and the confirmed crew member, individually (the “Crew”). If necessary additional crew members are attached to the Captain Services Agreement.

1. This agreement shall cover a period of ${durationHours} on ${charterDate}. Any additional hours agreed upon by the parties hereto in writing and attached hereto, for contract as crew on the vessel.

2. The Captain and Crew shall have sole authority and responsibility for the safe navigation and safety of the vessel.

3. The Captain and Crew shall perform assigned duties on the vessel in a timely, neat, first class, good and workmanlike manner, in strict compliance with the laws of the United States of America and in accordance with all rules and regulations that may be applicable to this agreement and the performance of said duties.  The Captain will have the final decision on the safe operation of the vessel.

4. The Captain and Crew have the power and authority to report any illegal drugs or drug use on board to the proper authorities and make arrangements for the vessel to be met at dock.  The Captain also has the right to terminate the Charter at any time for improper, abusive or dangerous behavior on board.

5. Captains and Crews relationship to the Charterer shall be that of an independent contractor and not of an employee or agent of the Charterer.  The Captain and Crew have discretion as to how to perform the services contemplated by this agreement.

NOTE:  The following paragraph (#6) is for additional hours of service only.  The Boat/Yacht, Captain, Crew and all other add-ons have been paid in full (or will be paid in full) through Cove Charters Payment options.

6. In the event Charter extends past scheduled time, additional charges may apply, and will be charged to Charterer.

IN WITNESS WHEREOF, the parties have executed this agreement as of the date first referenced above.

CHARTERER:`
    },
    {
      id: 'bareboat_charter_agreement',
      title: 'Bareboat Charter Agreement',
      summary: 'Defines the bareboat charter terms for the vessel, charter period, customer responsibilities, and required captain selection.',
      body: `1. Owner has agreed, pursuant to those terms of use to let end demise bareboat and the Charterer hereby agrees to hire on a bareboat basis upon the terms and conditions and for the consideration hereinafter set forth, as well as the terms of use which are incorporated herein by reference, the said vessel for a period commencing at ${startTime} and ending at ${endTime} on ${charterDate}

2. Charterer acknowledges that the owner has warranted that the vessel is in good seaworthy condition and complies with all applicable laws and regulations pertaining to the condition of the vessel.

3. Charterer takes complete possession of the vessel, operating it as if it were their own with full
incidents of ownership; Charterer has complete control over the captain and crew, except as to the safe navigation and safety of the vessel.

4. Charterer acknowledges that the skipper hired or appointed by Charterer will be a qualified and competent person who shall be responsible for the safe navigation of the vessel.

5. Charterer has the option to secure and keep in force during the entire term of this charter, in addition to the insurance already in place, a standard marine insurance policy including hull coverage, to full value and protection and indemnity coverage in such form, with such carrier or carriers so as to protect owner and/or charterer against any and all liability incident to the operation of the vessel.

6. Charterer agrees that the vessel shall be employed exclusively as a pleasure vessel for the sole and proper use of itself and guests during the term of this charter. Charterer further agrees not to transport MERCHANDISE FOR HIRE or CARRY PASSENGERS FOR HIRE, or engage in any trade, or in any way violate any laws of the United States or of any other government within the jurisdiction of which the vessel may be at any time during the charter.

7. Charterer acknowledges and agrees that they have been given a selection of Captain and crew. A list or roster of qualified operators (Captains) was presented at the time of booking for the charterer to choose from. The Charterer was also given the option to select Captain and crew of their choosing. The Captain Services Agreement displays the captain selected by the Charterer only.`
    },
    {
      id: 'waiver_release_indemnification',
      title: 'Waiver, Release, and Indemnification',
      summary: 'Captures customer acknowledgement of boating risks, releases, and indemnification obligations.',
      body: `Terms & Conditions

In the consideration of the mutual promises and covenants set forth in this release, and for other good and valuable consideration, the receipt and adequacy of which are hereby acknowledged, Cove Charters LLC  and Charterer agree as follows:

1. In consideration of Cove Charters LLC permitting Charterer to utilize the services, Charterer, and to the full extent allowed by law, on behalf of him or herself, his or her spouse, children/wards and guests (the “Charterer Parties”), does hereby release, waive and discharge Cove Charters LLC of and from any and all manner of action or actions, cause or causes of action, in law or in equity, suits, debts, liens, contracts, agreements, promises, covenants, obligations, liabilities, claims, demands, losses, damages, cost or expenses, including but not limited to court costs and attorneys’ fees (including reasonable attorneys’ and paralegals’ fees and costs incurred before and at trial, at all tribunal levels, whether or not suit is instituted, and at arbitration and in establishing this right to indemnification), of any natural whatsoever, whether or not now known, claimed or suspected, fixed or contingent (hereinafter collectively referred to as “CLAIMS”) which the Charterer Parties may have, or which may hereafter accrue to the Charterer Parties, as a result of Charterer’s, and to the full extent allowed by law, the Charterer Parties’ use of the Services. This release is intended to discharge in advance Cove Charters LLC, its members, officers, employees and agents (“Cove Charters LLC PARTIES”) from any and all liability arising out of or connected in any way with the Charterer Parties’ use of the Services and/or participation in the Yacht Membership Club even though that liability may arise out of negligence or carelessness on the part of the Cove Charters LLC Parties.

2. Charterer’s receipt of the services involves known and unknown RISKS associated with water activities. Such RISKS include, but are not limited to: drowning, traversing wet and slippery surfaces, physical trauma, strains, bruises, sprains, muscle tears, broken bones, sunburn, swimming in deep water, wading in shallow water, damage to or loss of real or personal property and other serious bodily injury, including cardiac injuries and heart attacks, permanent disability, paralysis and death, which may be caused by the Charterer Parties’ own actions or inactions or the actions or inactions of the Captain or the other passengers on the yacht, the condition of the yacht, or the negligence of Cove Charters LLC, whether passive or active; and that there may be other risks either not known to the Charterer Parties’ or not readily foreseeable at the time. Charterer, and to the full extent allowed by law on behalf of the Charterer Parties’, hereby agree to fully accept and assume all such RISKS and all responsibility for losses, cost, and damages the Charterer Parties incur as a result of the Charterer and the Charterer Parties’

3. TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE COVE CHARTERS PARTIES SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOOD-WILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM CHARTERER’S, AND TO THE FULL EXTENT ALLOWED BY LAW THE CHARTERER PARTIES USE OF THE SERVICES. THE LIMITATIONS OF THIS SECTION SHALL APPLY TO ANY THERY OF LIABILITY, WHETHER BASED ON WARRANTY, CONTRACT, STATUTE, TORT (INCLUDING NEGLIGENCE) OR OTHERWISE, AND WHETHER OR NOT Cove Charters LLC HAS BEEN INFORMED OF THE POSSIBILITY OF ANY SUCH DAMAGE, AND EVEN IF A REMEDY SET FORTH HEREIN IS FOUND TO HAVE FAILED OF ITS ESSENTIAL PURPOSE.

4. The Charterer and to the full extent allowed by law, the Charterer Parties, and each of them,
hereby indemnifies, defends, and holds harmless the Cove Charterers Parties from, against and in respect of any and all direct and/or indirect claims asserted against or suffered or incurred by the Cove Charters LLC Parties to the extent directly or indirectly under, caused, resulting from or in connection with the Charterer’s, and to the full extent allowed by law the Charterer Parties use of the Services, even if such claims arise out of or in connection with the negligence of the Cove Charters LLC Parties.

5. The indemnification provision in Section 4 shall not apply in the event of gross negligence or
intentional torts by any Cove Charters LLC Party.

6. The Terms of Use are incorporated herein by reference.`
    },
    {
      id: 'rules_guidelines_fines',
      title: 'Rules, Guidelines, and Fines',
      summary: 'Lists operational rules, prohibited conduct, vessel care expectations, and fines or charges.',
      body: `It is Cove Charters LLC mission to provide a safe and fun option for anyone looking to enjoy the water. We want you and your group to abide by the rules and guidelines set forth in order to keep you, your guests, the crew, and the vessel safe. Any violation of these rules will result in fines and fees charged to the credit card of the charterer. By signing this agreement, you are agreeing to any of these fines and charges. The Captain and crew have the right to TERMINATE your charter at anytime if your actions/behavior puts you, your guests, the crew, or the vessel at risk and NO REFUND WILL BE GIVEN REGARDLESS OF THE TIME NOT USED ON THE VESSEL. In addition to the full charter price being charged, the charterer will also be responsible for any and all fuel expenses, taxes, gratuity, and other expenses incurred including but not limited to dockage, provisions, etc.

The rules and guidelines include but are not limited to:

1. THE LEGAL PASSENGER CAPACITY OF THE VESSEL MAY NOT BE EXCEEDED for any reason, at the commencement or during the charter, unless for a medical/safety emergency.
Passenger capacities do no include the CHARTERER, CAPTAIN, OR CREW MEMBERS. THIS IS A FEDERAL LAW AND ANY CITATIONS BY THE UNITED STATES COAST GUARD (Or any other law enforcement agency) ARE THE FULL RESPONSIBILITY OF THE CHARTERER. The maximum fine administered by Cove Charters LLC is $1,000.00 plus the cost of any fines
administered by any law enforcement agency. The Captain WILL report any overboarding
and has the full right to terminate the charter with no refund of the deposit of full charter
amount.

2. NO SMOKING OR OPEN FLAMES ON BOARD. Marijuana use or possession is not allowed. Any charterer found in violation of this policy may be removed without a refund.Smoking of any kind is forbidden. Vaping and E-sigs are allowed. Any burns to seats, flooring, bedding, teak, or otherwise must be fully repaired to “Like New” condition at the expense of the Charterer. The maximum fine administered by Cove Charters LLC for smoking or open flames of any kind is $500.00 plus the full cost of the repair/restoration of the damaged article/area.

3. NO RED WINES OR RED DRINKS OF ANY KIND…..PERIOD! Red wine and red drinks stain seats, carpets, teak, etc. Any stains due to spills of any red drink or wine must be repaired to like new condition at the expense of the Charterer. The maximum fine administered by Cove Charters LLC for bringing any red drink or red wine on board is $250.00 plus the full cost of any repair/restoration of the damaged area/article.

4. No loud or vulgar music or sound pollution allowed when in a private marina. Private marinas strictly prohibit loud or vulgar music, and the Captain/crew needs to be able to hear while docking and undocking the vessel. Once you exit the marina area, you are allowed to turn up the music and have a good time! The maximum fine for loud and vulgar music in a private marina or in any instance the Captain/Crew have instructed the music be turned down for any reason administered by Cove Charters LLC is $250.00 plus the full cost of repair/restoration of each damaged speaker if applicable.

5. NO ILLEGAL DRUGS OF ANY KIND are allowed on the vessel. Captains have the right to terminate the Charter immediately and no refund will be given to the Charterer(s). Captains also have the obligation to contact law enforcement and have any illegal drug activity reported to local law enforcement agents. The maximum fine administered for illegal drugs is $1,000.00.

6. NO JUMPING OFF THE VESSEL while it is underway (moving) or when the motors are on. Whether you are wanting to jump in the water, onto a beach, dock, or any other surface, you must wait for the Captain/Crew to give the ok. YOU MUST ALWAYS INFORM THE CREW IF YOU ARE JUMPING IN THE WATER. The maximum fine for jumping off the vessel at an inappropriate time is $500.00 per occurrence.

7. LISTEN TO AND FOLLOW THE CAPTAIN AND CREW’S INSTRUCTIONS AT ALL TIMES. The Captain and Crew have the duty to keep you, your guests, the vessel, and themselves safe at all times. This is a HUGE responsibility and as so, they have the final say in safety. PLEASE LISTEN TO THEIR INSTRUCTIONS AT ALL TIMES. The maximum fine for failing to follow the Captains/Crews instructions is $500.00 per occurrence plus any additional damage, repair, restoration, or otherwise.`
    },
    {
      id: 'cancellation_policy',
      title: 'Cancellation Policy',
      summary: 'Explains cancellation, weather, timing, refund, and rescheduling terms.',
      body: `These terms and conditions govern Cove Charters LLC Cancellation Policy (the “Cancellation Policy”) available to Charterers and Owners through the Services. Cove Charters LLC has a
standardized cancellation policy for all boats on the platform that we will enforce to protect both Renter (“Charterer”) and Boat Owner. Each party has the ability to cancel at any time. The fee schedule will be determined when the cancellation occurs in relation to the reservation dates (“set sail date” or “departure date”).

The cancellation is as follows: If the vessel was booked (deposit made) with more than 72 hours of the departure date:

● Free cancellations for 24 hours after the deposit is made.

● After 24 hours, the deposit is non-refundable.

● The remaining balance will be deducted at least 7 days prior to the departure date.

● After the remaining balance has been charged, cancellations are non-refundable unless weather or mechanical failure occurs. Only the USCG Licensed Captain and Cove Charter may cancel due to weather conditions. That decision will be determined on the day of departure only. Forecasts are not an acceptable reason for cancellation.

● Note: if your charter departure date is less than 7 days away, there are no refunds or cancellations. You may reschedule only. Reschedule fees apply. See below. If the vessel was booked (deposit made) within (less than) 72 hours of the departure date:

● Cancellations are non-refundable. No exceptions.

● Note: if you place a deposit for a charter that takes place within 72 hours of the departure date (ex: next day or same day bookings), there are no refunds or cancellations. All sales are final and subject to forfeit the entire remaining balance.

● Note: Weather and/or Mechanical failure will still result in a reschedule only.`
    },
  ];
}

function estimatedEndTime(startTime, durationHours) {
  if (!startTime || !durationHours) return null;
  const match = String(startTime).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const startMinutes = Number(match[1]) * 60 + Number(match[2]);
  const endMinutes = startMinutes + Number(durationHours) * 60;
  const hours = Math.floor((endMinutes / 60) % 24);
  const minutes = Math.round(endMinutes % 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function isPublicBookingStartTime(startTime) {
  const match = String(startTime || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return false;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return minutes >= 9 * 60 && minutes <= 18 * 60 && minutes % 30 === 0;
}

function safeJson(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}

function splitName(fullName, firstName, lastName) {
  if (firstName || lastName) return { firstName: firstName || '', lastName: lastName || '' };
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] || '', lastName: '' };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts.at(-1) };
}

async function sendBookingNotification(env, booking) {
  if (!env.RESEND_API_KEY || !env.BOOKING_NOTIFY_TO || !env.BOOKING_NOTIFY_FROM) return null;
  const adminUrl = env.ADMIN_URL || 'https://jeffrwinters.github.io/Cove-Charters/admin.html';
  const subject = `New Cove booking request: ${booking.boatName || booking.boatId}`;
  const lines = [
    `New booking request ${booking.id}`,
    ``,
    `Customer: ${booking.customerName || 'Guest'}`,
    `Email: ${booking.email || 'Not provided'}`,
    `Phone: ${booking.phone || 'Not provided'}`,
    ``,
    `Boat: ${booking.boatName || booking.boatId}`,
    `Captain: ${booking.captainName || 'Not selected'}`,
    `Date: ${booking.charterDate || 'TBD'}`,
    `Start time: ${booking.startTime || 'TBD'}`,
    `Duration: ${booking.durationHours || 'TBD'} hours`,
    ``,
    `Notes: ${booking.customerNotes || booking.officeNotes || 'None'}`,
    ``,
    `Admin: ${adminUrl}`
  ];
  const html = `
    <h2>New Cove booking request</h2>
    <p><strong>Reference:</strong> ${escapeHtml(booking.id)}</p>
    <h3>Customer</h3>
    <p>${escapeHtml(booking.customerName || 'Guest')}<br>${escapeHtml(booking.email || 'No email')}<br>${escapeHtml(booking.phone || 'No phone')}</p>
    <h3>Charter</h3>
    <p><strong>Boat:</strong> ${escapeHtml(booking.boatName || booking.boatId)}<br><strong>Captain:</strong> ${escapeHtml(booking.captainName || 'Not selected')}<br><strong>Date:</strong> ${escapeHtml(booking.charterDate || 'TBD')}<br><strong>Start:</strong> ${escapeHtml(booking.startTime || 'TBD')}<br><strong>Duration:</strong> ${escapeHtml(booking.durationHours || 'TBD')} hours</p>
    <h3>Notes</h3>
    <p>${escapeHtml(booking.customerNotes || booking.officeNotes || 'None')}</p>
    <p><a href="${escapeHtml(adminUrl)}">Open Cove Admin</a></p>
  `;
  return await sendResendEmail(env, {
    to: env.BOOKING_NOTIFY_TO.split(',').map(item => item.trim()).filter(Boolean),
    reply_to: booking.email || undefined,
    subject,
    text: lines.join('\n'),
    html
  });
}

async function sendCustomerConfirmation(env, booking) {
  const subject = `Cove Charters booking confirmation: ${booking.boatName || booking.boatId}`;
  const lines = customerConfirmationLines(booking);
  const html = `
    <h2>Your Cove Charters booking is confirmed</h2>
    <p>Hi ${escapeHtml(booking.customerName || 'there')},</p>
    <p>We can confirm your charter request.</p>
    <p><strong>Boat:</strong> ${escapeHtml(booking.boatName || booking.boatId)}<br><strong>Date:</strong> ${escapeHtml(booking.charterDate || 'TBD')}<br><strong>Start:</strong> ${escapeHtml(booking.startTime || 'TBD')}<br><strong>Duration:</strong> ${escapeHtml(booking.durationHours || 'TBD')} hours<br><strong>Captain:</strong> ${escapeHtml(booking.captainName || 'Captain TBD')}</p>
    <p>Next, Cove will guide you through the required charter documents. Your booking is not ready for departure until those documents are complete.</p>
    <p>Please reply with any questions or changes.</p>
  `;
  return await sendResendEmail(env, {
    to: booking.email,
    reply_to: env.BOOKING_REPLY_TO || env.BOOKING_NOTIFY_FROM,
    subject,
    text: lines.join('\n'),
    html
  });
}

async function sendCustomerAgreementPacket(env, booking) {
  const subject = `Cove Charters documents to complete: ${booking.boatName || booking.boatId}`;
  const lines = agreementPacketLines(booking);
  const signingLine = booking.signingUrl ? `<p><strong>Start here:</strong> <a href="${escapeHtml(booking.signingUrl)}">Open your document packet</a></p>` : '<p>Cove will send the signing link as soon as the document packet is ready.</p>';
  const html = `
    <h2>Your Cove Charters document packet</h2>
    <p>Hi ${escapeHtml(booking.customerName || 'there')},</p>
    <p>Your charter has been accepted by the Cove back office. Please complete the required documents before your trip.</p>
    ${signingLine}
    <p><strong>Boat:</strong> ${escapeHtml(booking.boatName || booking.boatId)}<br><strong>Date:</strong> ${escapeHtml(booking.charterDate || 'TBD')}<br><strong>Start:</strong> ${escapeHtml(booking.startTime || 'TBD')}<br><strong>Captain:</strong> ${escapeHtml(booking.captainName || 'Captain TBD')}</p>
    <p>After the documents are signed, Cove will attach the completed copies to your charter record and provide the captain with the required bareboat agreement copy.</p>
  `;
  return await sendResendEmail(env, {
    to: booking.email,
    reply_to: env.BOOKING_REPLY_TO || env.BOOKING_NOTIFY_FROM,
    subject,
    text: lines.join('\n'),
    html,
    attachments: templateAgreementAttachments(env)
  });
}

async function sendCaptainTripPacket(env, booking) {
  const subject = `Cove captain packet: ${booking.boatName || booking.boatId} on ${booking.charterDate || 'date TBD'}`;
  const lines = captainPacketLines(booking);
  const html = `
    <h2>Cove captain trip packet</h2>
    <p>Hi ${escapeHtml(booking.captainName || 'Captain')},</p>
    <p>This confirmed charter is assigned to you.</p>
    <p><strong>Boat:</strong> ${escapeHtml(booking.boatName || booking.boatId)}<br><strong>Date:</strong> ${escapeHtml(booking.charterDate || 'TBD')}<br><strong>Start:</strong> ${escapeHtml(booking.startTime || 'TBD')}<br><strong>Duration:</strong> ${escapeHtml(booking.durationHours || 'TBD')} hours</p>
    <h3>Customer</h3>
    <p>${escapeHtml(booking.customerName || 'Guest')}<br>${escapeHtml(booking.phone || 'No phone')}<br>${escapeHtml(booking.email || 'No email')}</p>
    <h3>Notes</h3>
    <p>${escapeHtml(booking.customerNotes || 'None')}</p>
    <p>Back office will send updates if agreement, payment, weather, or schedule details change.</p>
  `;
  return await sendResendEmail(env, {
    to: booking.captainEmail,
    reply_to: env.BOOKING_REPLY_TO || env.BOOKING_NOTIFY_FROM,
    subject,
    text: lines.join('\n'),
    html,
    attachments: captainPacketAttachments(env, booking)
  });
}

async function sendCustomerFinalInvoice(env, booking, calculation) {
  const subject = `Cove Charters final invoice: ${booking.boatName || booking.boatId}`;
  const invoice = customerInvoiceLines(booking, calculation);
  const rows = invoice.items.map(item => `<tr><td style="padding:8px 0;border-bottom:1px solid #e6eef2">${escapeHtml(item.label)}</td><td style="padding:8px 0;border-bottom:1px solid #e6eef2;text-align:right">${escapeHtml(moneyText(item.amount))}</td></tr>`).join('');
  const html = `
    <h2>Your Cove Charters final invoice</h2>
    <p>Hi ${escapeHtml(booking.customerName || 'there')},</p>
    <p>Thank you for choosing Cove Charters. Here is the final invoice summary for your charter.</p>
    <p><strong>Boat:</strong> ${escapeHtml(booking.boatName || booking.boatId)}<br><strong>Date:</strong> ${escapeHtml(booking.charterDate || 'TBD')}<br><strong>Start:</strong> ${escapeHtml(booking.startTime || 'TBD')}<br><strong>Duration:</strong> ${escapeHtml(booking.durationHours || 'TBD')} hours<br><strong>Captain:</strong> ${escapeHtml(booking.captainName || 'Captain TBD')}</p>
    <table style="width:100%;border-collapse:collapse">${rows}</table>
    <p><strong>Net final charges:</strong> ${escapeHtml(moneyText(invoice.netFinalCharges))}</p>
    <p><strong>Fuel deposit refund / credit:</strong> ${escapeHtml(moneyText(calculation.fuelDepositRefund))}</p>
    <p><strong>Payment status:</strong> ${escapeHtml(booking.paidStatus || calculation.customerPaidStatus || 'unsettled')}</p>
    <p>Please reply to this email with any questions. If a balance or refund remains, Cove will coordinate the next step.</p>
  `;
  return await sendResendEmail(env, {
    to: booking.email,
    reply_to: env.BOOKING_REPLY_TO || env.BOOKING_NOTIFY_FROM,
    subject,
    text: invoice.lines.join('\n'),
    html
  });
}

async function sendSignedAgreementNotice(env, booking) {
  if (!env.RESEND_API_KEY || !env.BOOKING_NOTIFY_FROM) return null;
  const recipients = [
    ...(env.BOOKING_NOTIFY_TO || '').split(',').map(item => item.trim()).filter(Boolean),
    booking.captainEmail
  ].filter(Boolean);
  if (!recipients.length) return null;
  const subject = `Cove signed documents: ${booking.boatName || booking.boatId} on ${booking.charterDate || 'date TBD'}`;
  const lines = [
    `Cove signed document notice`,
    ``,
    `Booking: ${booking.id}`,
    `Customer: ${booking.customerName || 'Guest'}`,
    `Signer: ${booking.signerName || 'Not provided'}`,
    `Boat: ${booking.boatName || booking.boatId}`,
    `Captain: ${booking.captainName || 'Captain TBD'}`,
    `Date/time: ${booking.charterDate || 'TBD'} ${booking.startTime || ''}`,
    `Duration: ${booking.durationHours || 'TBD'} hours`,
    ``,
    `Signed record: ${booking.signedRecordUrl}`,
    booking.signingUrl ? `Customer signing packet: ${booking.signingUrl}` : ''
  ].filter(line => line !== '');
  const html = `
    <h2>Cove documents signed</h2>
    <p>${escapeHtml(booking.signerName || booking.customerName || 'The customer')} completed the charter document packet.</p>
    <p><strong>Booking:</strong> ${escapeHtml(booking.id)}<br><strong>Boat:</strong> ${escapeHtml(booking.boatName || booking.boatId)}<br><strong>Captain:</strong> ${escapeHtml(booking.captainName || 'Captain TBD')}<br><strong>Date:</strong> ${escapeHtml(booking.charterDate || 'TBD')} ${escapeHtml(booking.startTime || '')}</p>
    <p><a href="${escapeHtml(booking.signedRecordUrl)}">Open the signed record in Cove Admin</a></p>
  `;
  return await sendResendEmail(env, {
    to: unique(recipients),
    reply_to: env.BOOKING_REPLY_TO || env.BOOKING_NOTIFY_FROM,
    subject,
    text: lines.join('\n'),
    html
  });
}

async function sendResendEmail(env, message) {
  const fromName = env.BOOKING_NOTIFY_FROM_NAME || 'Cove Charters';
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'User-Agent': 'cove-charters-worker/1.0'
    },
    body: JSON.stringify({
      from: `${fromName} <${env.BOOKING_NOTIFY_FROM}>`,
      ...message
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || 'Resend email failed');
  return data;
}

function customerConfirmationLines(booking) {
  return [
    `Hi ${booking.customerName || 'there'},`,
    ``,
    `We can confirm your Cove Charters booking.`,
    ``,
    `Boat: ${booking.boatName || booking.boatId}`,
    `Date: ${booking.charterDate || 'TBD'}`,
    `Start time: ${booking.startTime || 'TBD'}`,
    `Duration: ${booking.durationHours || 'TBD'} hours`,
    `Captain: ${booking.captainName || 'Captain TBD'}`,
    ``,
    `Next, Cove will guide you through the required charter documents.`,
    `Your booking is not ready for departure until those documents are complete.`,
    ``,
    `Please reply with any questions or changes.`
  ];
}

function agreementPacketLines(booking) {
  return [
    `Hi ${booking.customerName || 'there'},`,
    ``,
    `Your charter has been accepted by the Cove back office. Please complete the required documents before your trip.`,
    booking.signingUrl ? `Start here: ${booking.signingUrl}` : `Cove will send the signing link as soon as the document packet is ready.`,
    ``,
    `Boat: ${booking.boatName || booking.boatId}`,
    `Date: ${booking.charterDate || 'TBD'}`,
    `Start time: ${booking.startTime || 'TBD'}`,
    `Duration: ${booking.durationHours || 'TBD'} hours`,
    `Captain: ${booking.captainName || 'Captain TBD'}`,
    ``,
    `After the documents are signed, Cove will attach the completed copies to your charter record and provide the captain with the required bareboat agreement copy.`
  ];
}

function captainPacketLines(booking) {
  return [
    `Hi ${booking.captainName || 'Captain'},`,
    ``,
    `This confirmed Cove charter is assigned to you.`,
    ``,
    `Booking: ${booking.id}`,
    `Boat: ${booking.boatName || booking.boatId}`,
    `Date: ${booking.charterDate || 'TBD'}`,
    `Start time: ${booking.startTime || 'TBD'}`,
    `Duration: ${booking.durationHours || 'TBD'} hours`,
    ``,
    `Customer: ${booking.customerName || 'Guest'}`,
    `Customer phone: ${booking.phone || 'Not provided'}`,
    `Customer email: ${booking.email || 'Not provided'}`,
    ``,
    `Customer notes: ${booking.customerNotes || 'None'}`,
    `Office notes: ${booking.officeNotes || 'None'}`,
    ``,
    `Back office will send updates if agreement, payment, weather, or schedule details change.`
  ];
}

function customerInvoiceLines(booking, calculation) {
  const items = finalInvoiceItems(calculation);
  const netFinalCharges = roundMoney(
    calculation.baseFee +
    calculation.cleaningFee +
    calculation.taxCollected +
    calculation.mileageCharge +
    calculation.additionalCharges
  );
  return {
    items,
    netFinalCharges,
    lines: [
      `Hi ${booking.customerName || 'there'},`,
      ``,
      `Thank you for choosing Cove Charters. Here is the final invoice summary for your charter.`,
      ``,
      `Booking: ${booking.id}`,
      `Boat: ${booking.boatName || booking.boatId}`,
      `Date: ${booking.charterDate || 'TBD'}`,
      `Start time: ${booking.startTime || 'TBD'}`,
      `Duration: ${booking.durationHours || 'TBD'} hours`,
      `Captain: ${booking.captainName || 'Captain TBD'}`,
      ``,
      ...items.map(item => `${item.label}: ${moneyText(item.amount)}`),
      ``,
      `Fuel deposit collected: ${moneyText(calculation.fuelDeposit)}`,
      `Net final charges: ${moneyText(netFinalCharges)}`,
      `Fuel deposit refund / credit: ${moneyText(calculation.fuelDepositRefund)}`,
      `Payment status: ${booking.paidStatus || 'unsettled'}`,
      ``,
      `Please reply to this email with any questions. If a balance or refund remains, Cove will coordinate the next step.`
    ]
  };
}

function finalInvoiceItems(calculation) {
  const additionalItems = Array.isArray(calculation.additionalChargeItems) ? calculation.additionalChargeItems : [];
  return [
    { label: 'Charter fee', amount: calculation.baseFee },
    { label: 'Cleaning fee', amount: calculation.cleaningFee },
    { label: 'Sales tax', amount: calculation.taxCollected },
    { label: `Fuel charge (${calculation.milesTraveled || 0} miles)`, amount: calculation.mileageCharge },
    ...additionalItems.map(item => ({ label: item.description || 'Additional charge', amount: item.amount }))
  ].filter(item => Number(item.amount || 0) !== 0 || item.label === 'Charter fee');
}

function moneyText(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num(value, 0));
}

function templateAgreementAttachments(env) {
  return [
    env.BAREBOAT_AGREEMENT_URL ? { path: env.BAREBOAT_AGREEMENT_URL, filename: env.BAREBOAT_AGREEMENT_FILENAME || 'bareboat-charter-agreement.pdf' } : null,
    env.CHARTER_RULES_URL ? { path: env.CHARTER_RULES_URL, filename: env.CHARTER_RULES_FILENAME || 'charter-rules.pdf' } : null
  ].filter(Boolean);
}

function captainPacketAttachments(env, booking) {
  const signedDocs = (booking.documents || [])
    .filter(doc => ['signed', 'final'].includes(String(doc.status || '').toLowerCase()) || String(doc.documentType || '').includes('agreement'))
    .filter(doc => doc.url)
    .map(doc => ({ path: doc.url, filename: doc.filename || safeAttachmentName(doc.title, doc.documentType) }));
  return [...templateAgreementAttachments(env), ...signedDocs];
}

function safeAttachmentName(title, fallback = 'document') {
  const base = String(title || fallback || 'document').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'document';
  return base.endsWith('.pdf') ? base : `${base}.pdf`;
}

function publicSiteUrl(env) {
  return (env.PUBLIC_SITE_URL || 'https://jeffrwinters.github.io/Cove-Charters').replace(/\/+$/, '');
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function marketingFields(boat) {
  const type = String(boat.type || '').toLowerCase();
  const capacity = Number(boat.capacity || 0);
  const bedrooms = Number(boat.bedrooms || 0);
  const bathrooms = Number(boat.bathrooms || 0);
  const vibe = [];
  const priorityTags = [];
  const amenities = ['Captain required'];

  if (capacity >= 7) {
    vibe.push('large-group');
    priorityTags.push('space');
    amenities.push('Large-group layout');
  } else {
    vibe.push('small');
    priorityTags.push('sport');
  }
  if (type.includes('sundancer') || type.includes('yacht') || type.includes('premium')) {
    vibe.push('premium');
    priorityTags.push('comfort');
    amenities.push('Premium seating');
  }
  if (type.includes('sport') || type.includes('runabout') || type.includes('bowrider')) {
    vibe.push('sport');
    amenities.push('Swim platform');
  }
  if (capacity >= 10 || boat.featured) vibe.push('party');
  if (bedrooms > 0) {
    vibe.push('family');
    amenities.push('Cabin');
  }
  if (bathrooms > 0) amenities.push('Restroom');
  if (Number(boat.startingPrice || 0) <= 1100) priorityTags.push('value');
  if (boat.featured) priorityTags.push('premium');

  return { vibe: unique(vibe), priorityTags: unique(priorityTags), amenities: unique(amenities) };
}

async function media(request, env, cors) {
  requireDb(env);
  if (request.method === 'GET') return await listMedia(request, env, cors);
  if (request.method === 'POST') return await uploadMedia(request, env, cors);
  return json({ error: 'GET or POST required' }, 405, cors);
}

async function listMedia(request, env, cors) {
  const url = new URL(request.url);
  const entityType = normalizeEntityType(url.searchParams.get('entityType') || url.searchParams.get('entity_type') || '');
  const entityId = url.searchParams.get('entityId') || url.searchParams.get('entity_id') || '';
  const mediaTypeParam = url.searchParams.get('mediaType') || url.searchParams.get('media_type') || '';
  const mediaType = mediaTypeParam ? normalizeMediaType(mediaTypeParam) : '';
  const clauses = [];
  const values = [];

  if (entityType) {
    clauses.push('entity_type = ?');
    values.push(entityType);
  }
  if (entityId) {
    clauses.push('entity_id = ?');
    values.push(entityId);
  }
  if (mediaType) {
    clauses.push('media_type = ?');
    values.push(mediaType);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  let rows = await env.DB.prepare(`SELECT * FROM media ${where} ORDER BY is_cover DESC, sort_order ASC, created_at ASC`).bind(...values).all();
  if ((!rows.results || rows.results.length === 0) && entityType === 'boat' && entityId) {
    await backfillBoatMediaFromAssets(env, entityId, mediaType);
    rows = await env.DB.prepare(`SELECT * FROM media ${where} ORDER BY is_cover DESC, sort_order ASC, created_at ASC`).bind(...values).all();
  }
  return json((rows.results || []).map(outMedia), 200, cors);
}

async function uploadMedia(request, env, cors) {
  if (request.method !== 'POST') return json({ error: 'POST required' }, 405, cors);
  requireDb(env);
  const auth = requireAdmin(request, env);
  if (auth) return json(auth.body, auth.status, cors);
  const form = await request.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') return json({ error: 'Missing file field' }, 400, cors);

  const entityType = normalizeEntityType(form.get('entityType') || form.get('entity_type') || 'misc');
  const entityId = String(form.get('entityId') || form.get('entity_id') || form.get('entitySlug') || form.get('entity_slug') || 'unsorted');
  const entitySlug = cleanSegment(form.get('entitySlug') || form.get('entity_slug') || entityId);
  const mediaType = normalizeMediaType(form.get('mediaType') || form.get('media_type') || 'photos');
  if (file.size > Number(env.MAX_UPLOAD_BYTES || 15728640)) return json({ error: 'File too large' }, 413, cors);

  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const path = `assets/${cleanSegment(entityType)}s/${entitySlug}/${mediaType}/${stamp}-${cleanFilename(file.name || 'upload.bin')}`;
  const response = await fetch(`https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}`, { method: 'PUT', headers: githubHeaders(env), body: JSON.stringify({ message: `Upload media: ${path}`, content: toBase64(await file.arrayBuffer()), branch: env.GITHUB_BRANCH || 'main' }) });
  const uploaded = await response.json();
  if (!response.ok) throw new Error(uploaded.message || JSON.stringify(uploaded));

  const mediaId = `media_${crypto.randomUUID()}`;
  const publicUrl = uploaded.content?.download_url || `https://raw.githubusercontent.com/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/${env.GITHUB_BRANCH || 'main'}/${path}`;
  const title = String(form.get('title') || file.name || 'Uploaded media');
  const alt = String(form.get('alt') || title);
  const nextSort = await nextMediaSort(env, entityType, entityId, mediaType);
  const shouldCover = mediaType === 'photos' && (truthy(form.get('isCover') || form.get('is_cover')) || await hasNoCover(env, entityType, entityId));

  if (shouldCover) await clearCover(env, entityType, entityId);
  await env.DB.prepare(`
    INSERT INTO media (id, entity_type, entity_id, media_type, url, title, alt, sort_order, is_cover, focal_x, focal_y, zoom)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(mediaId, entityType, entityId, mediaType, publicUrl, title, alt, nextSort, shouldCover ? 1 : 0, 50, 50, 1).run();

  const row = await env.DB.prepare('SELECT * FROM media WHERE id = ?').bind(mediaId).first();
  return json({ ok: true, path, url: publicUrl, media: outMedia(row) }, 200, cors);
}

async function mediaById(request, env, cors, id) {
  requireDb(env);
  if (request.method === 'GET') {
    const row = await env.DB.prepare('SELECT * FROM media WHERE id = ?').bind(id).first();
    return row ? json(outMedia(row), 200, cors) : json({ error: 'Media not found' }, 404, cors);
  }

  const auth = requireAdmin(request, env);
  if (auth) return json(auth.body, auth.status, cors);

  if (request.method === 'PUT') {
    const current = await env.DB.prepare('SELECT * FROM media WHERE id = ?').bind(id).first();
    if (!current) return json({ error: 'Media not found' }, 404, cors);

    const body = await request.json();
    const next = {
      title: body.title ?? current.title,
      alt: body.alt ?? current.alt,
      sortOrder: body.sortOrder ?? body.sort_order ?? current.sort_order,
      isCover: body.isCover ?? body.is_cover ?? Boolean(current.is_cover),
      focalX: body.focalX ?? body.focal_x ?? current.focal_x,
      focalY: body.focalY ?? body.focal_y ?? current.focal_y,
      zoom: body.zoom ?? current.zoom
    };

    if (truthy(next.isCover)) await clearCover(env, current.entity_type, current.entity_id);
    await env.DB.prepare('UPDATE media SET title = ?, alt = ?, sort_order = ?, is_cover = ?, focal_x = ?, focal_y = ?, zoom = ? WHERE id = ?')
      .bind(String(next.title || ''), String(next.alt || ''), Number(next.sortOrder || 0), truthy(next.isCover) ? 1 : 0, num(next.focalX, 50), num(next.focalY, 50), num(next.zoom, 1), id)
      .run();
    const updated = await env.DB.prepare('SELECT * FROM media WHERE id = ?').bind(id).first();
    return json({ ok: true, media: outMedia(updated) }, 200, cors);
  }

  if (request.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM media WHERE id = ?').bind(id).run();
    return json({ ok: true, id }, 200, cors);
  }

  return json({ error: 'GET, PUT, or DELETE required' }, 405, cors);
}

async function nextMediaSort(env, entityType, entityId, mediaType) {
  const row = await env.DB.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort FROM media WHERE entity_type = ? AND entity_id = ? AND media_type = ?').bind(entityType, entityId, mediaType).first();
  return Number(row?.next_sort || 0);
}

async function hasNoCover(env, entityType, entityId) {
  const row = await env.DB.prepare('SELECT COUNT(*) AS count FROM media WHERE entity_type = ? AND entity_id = ? AND media_type = ? AND is_cover = 1').bind(entityType, entityId, 'photos').first();
  return Number(row?.count || 0) === 0;
}

async function clearCover(env, entityType, entityId) {
  await env.DB.prepare('UPDATE media SET is_cover = 0 WHERE entity_type = ? AND entity_id = ?').bind(entityType, entityId).run();
}

async function backfillBoatMediaFromAssets(env, boatId, requestedMediaType) {
  const boat = await env.DB.prepare('SELECT id, slug FROM boats WHERE id = ? OR slug = ?').bind(boatId, boatId).first();
  if (!boat?.slug) return;

  const mediaTypes = requestedMediaType ? [requestedMediaType] : ['photos', 'videos'];
  for (const mediaType of mediaTypes) {
    const files = await githubDirectory(env, `assets/boats/${boat.slug}/${mediaType}`);
    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      const title = titleFromFilename(file.name);
      const isCover = mediaType === 'photos' && index === 0 && await hasNoCover(env, 'boat', boat.id);
      if (isCover) await clearCover(env, 'boat', boat.id);
      await env.DB.prepare(`
        INSERT INTO media (id, entity_type, entity_id, media_type, url, title, alt, sort_order, is_cover, focal_x, focal_y, zoom)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(`media_${crypto.randomUUID()}`, 'boat', boat.id, mediaType, file.download_url, title, title, index, isCover ? 1 : 0, 50, 50, 1).run();
    }
  }
}

async function githubDirectory(env, path) {
  const response = await fetch(`https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}?ref=${env.GITHUB_BRANCH || 'main'}`, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'cove-api' } });
  if (response.status === 404) return [];
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || `GitHub read failed for ${path}`);
  return Array.isArray(data) ? data.filter(item => item.type === 'file') : [];
}

function outMedia(row) {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    mediaType: row.media_type,
    url: row.url,
    title: row.title,
    alt: row.alt,
    sortOrder: row.sort_order,
    isCover: Boolean(row.is_cover),
    focalX: num(row.focal_x, 50),
    focalY: num(row.focal_y, 50),
    zoom: num(row.zoom, 1),
    createdAt: row.created_at
  };
}

async function readSeedJson(env) {
  const urls = [
    `https://${env.GITHUB_OWNER}.github.io/${env.GITHUB_REPO}/data/boats.json`,
    `https://raw.githubusercontent.com/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/${env.GITHUB_BRANCH || 'main'}/data/boats.json`
  ];
  let lastError = '';
  for (const url of urls) {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (response.ok) return await response.json();
    lastError = `${response.status} ${response.statusText} from ${url}`;
  }
  throw new Error(`Could not read seed boats.json: ${lastError}`);
}

function requireAdmin(request, env) {
  if (!env.ADMIN_TOKEN) return { status: 503, body: { error: 'ADMIN_TOKEN is not configured for protected write operations' } };
  const expected = `Bearer ${env.ADMIN_TOKEN}`;
  if (request.headers.get('Authorization') !== expected) return { status: 401, body: { error: 'Admin authorization required' } };
  return null;
}

async function setting(env, key, fallback) {
  const row = await env.DB.prepare('SELECT value, value_type FROM settings WHERE key = ?').bind(key).first();
  if (!row) return fallback;
  return row.value_type === 'number' ? Number(row.value) : row.value;
}

function requireDb(env) { if (!env.DB) throw new Error('D1 binding DB is not configured'); }
function githubHeaders(env) { return { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'cove-api' }; }
function corsHeaders(request, env) { const allowed = (env.ALLOWED_ORIGINS || 'https://jeffrwinters.github.io,https://covecharters.com,https://www.covecharters.com').split(',').map(item => item.trim()); const origin = request.headers.get('Origin') || ''; return { 'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0], 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS','Access-Control-Allow-Headers': 'Content-Type,Authorization' }; }
function json(value, status = 200, headers = {}) { return new Response(JSON.stringify(value, null, 2), { status, headers: { ...headers, 'Content-Type': 'application/json' } }); }
function num(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
function nullableNum(value) { const n = Number(value); return value === null || value === undefined || value === '' || !Number.isFinite(n) ? null : n; }
function roundMoney(value) { return Math.round(num(value, 0) * 100) / 100; }
function cleanSegment(value) { return String(value).toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '') || 'item'; }
function cleanFilename(value) { const parts = String(value).split('.'); const ext = parts.length > 1 ? parts.pop().toLowerCase().replace(/[^a-z0-9]/g, '') : 'bin'; return `${cleanSegment(parts.join('.') || 'upload')}.${ext}`; }
function normalizeEntityType(value) { const clean = cleanSegment(value); return clean.endsWith('s') ? clean.slice(0, -1) : clean; }
function normalizeMediaType(value) { const clean = cleanSegment(value); if (clean === 'photo' || clean === 'image' || clean === 'images') return 'photos'; if (clean === 'video') return 'videos'; return clean || 'photos'; }
function truthy(value) { return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase()); }
function titleFromFilename(value) { return String(value || 'Media').replace(/^\d+-/, '').replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }
function toBase64(buffer) { let binary = ''; const bytes = new Uint8Array(buffer); for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(binary); }
function unique(items) { return [...new Set(items.filter(Boolean))]; }
