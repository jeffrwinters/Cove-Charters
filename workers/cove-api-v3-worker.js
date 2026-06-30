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
      if (path.match(/^\/api\/v1\/boats\/[^/]+\/captains$/)) return await boatCaptains(request, env, cors, path.split('/')[4]);
      if (path.startsWith('/api/v1/boats/')) return await boatById(request, env, cors, path.split('/').pop());
      if (path === '/api/v1/captains') return await captains(request, env, cors);
      if (path.startsWith('/api/v1/captains/')) return await captainById(request, env, cors, path.split('/').pop());
      if (path === '/api/v1/availability') return await availability(request, env, cors);
      if (path.startsWith('/api/v1/availability/')) return await availabilityById(request, env, cors, path.split('/').pop());
      if (path === '/api/v1/bookings') return await bookings(request, env, cors, ctx);
      if (path.match(/^\/api\/v1\/bookings\/[^/]+\/send-confirmation$/)) return await sendBookingConfirmation(request, env, cors, path.split('/')[4]);
      if (path.startsWith('/api/v1/bookings/')) return await bookingById(request, env, cors, path.split('/').pop());
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
  return json({ ok: true, service: 'cove-api', version: '0.3.17', d1: result?.ok === 1, adminAuth: Boolean(env.ADMIN_TOKEN), bookingEmail: Boolean(resendConfigured && env.BOOKING_NOTIFY_TO), customerEmail: resendConfigured, emailProvider: resendConfigured ? 'resend' : null }, 200, cors);
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
        (SELECT GROUP_CONCAT(captain_id) FROM boat_captains WHERE boat_id = b.id AND status = 'approved') AS approved_captain_ids,
        (SELECT url FROM media WHERE entity_type = 'boat' AND entity_id = b.id AND media_type = 'photos' ORDER BY is_cover DESC, sort_order ASC, created_at ASC LIMIT 1) AS cover_photo_url,
        (SELECT title FROM media WHERE entity_type = 'boat' AND entity_id = b.id AND media_type = 'photos' ORDER BY is_cover DESC, sort_order ASC, created_at ASC LIMIT 1) AS cover_photo_title,
        (SELECT alt FROM media WHERE entity_type = 'boat' AND entity_id = b.id AND media_type = 'photos' ORDER BY is_cover DESC, sort_order ASC, created_at ASC LIMIT 1) AS cover_photo_alt
      FROM boats b
      ORDER BY featured DESC, name ASC
    `).all();
    return json((rows.results || []).map(outBoat), 200, cors);
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

async function boatById(request, env, cors, id) {
  requireDb(env);
  if (request.method === 'GET') {
    const row = await env.DB.prepare(`
      SELECT b.*,
        (SELECT base_fee FROM boat_pricing WHERE boat_id = b.id AND active = 1 ORDER BY duration_hours LIMIT 1) AS starting_price,
        (SELECT plan_name FROM boat_pricing WHERE boat_id = b.id AND active = 1 ORDER BY duration_hours LIMIT 1) AS price_unit,
        (SELECT GROUP_CONCAT(captain_id) FROM boat_captains WHERE boat_id = b.id AND status = 'approved') AS approved_captain_ids,
        (SELECT url FROM media WHERE entity_type = 'boat' AND entity_id = b.id AND media_type = 'photos' ORDER BY is_cover DESC, sort_order ASC, created_at ASC LIMIT 1) AS cover_photo_url,
        (SELECT title FROM media WHERE entity_type = 'boat' AND entity_id = b.id AND media_type = 'photos' ORDER BY is_cover DESC, sort_order ASC, created_at ASC LIMIT 1) AS cover_photo_title,
        (SELECT alt FROM media WHERE entity_type = 'boat' AND entity_id = b.id AND media_type = 'photos' ORDER BY is_cover DESC, sort_order ASC, created_at ASC LIMIT 1) AS cover_photo_alt
      FROM boats b
      WHERE b.id = ? OR b.slug = ?
    `).bind(id, id).first();
    return row ? json(outBoat(row), 200, cors) : json({ error: 'Boat not found' }, 404, cors);
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
      short_description, source_listing_url, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
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
    boat.sourceListingUrl || null
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
    slug: row.slug,
    name: row.name,
    status: row.status,
    lifecycleStatus: row.lifecycle_status,
    bookingEnabled: Boolean(row.booking_enabled),
    featured: Boolean(row.featured),
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
        isCover: true,
        sortOrder: 0
      }] : [],
      videos: []
    },
    coverPhoto: row.cover_photo_url ? {
      url: row.cover_photo_url,
      title: row.cover_photo_title,
      alt: row.cover_photo_alt
    } : null,
    approvedCaptainIds: row.approved_captain_ids ? String(row.approved_captain_ids).split(',').filter(Boolean) : []
  };
  return { ...boat, ...marketingFields(boat) };
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
      SELECT c.*, bc.status AS approval_status, bc.notes AS approval_notes
      FROM captains c
      INNER JOIN boat_captains bc ON bc.captain_id = c.id
      WHERE bc.boat_id = ? AND bc.status = 'approved'
      ORDER BY c.name ASC
    `).bind(boatId).all();
    return json((rows.results || []).map(outCaptain), 200, cors);
  }
  if (request.method === 'PUT') {
    const auth = requireAdmin(request, env);
    if (auth) return json(auth.body, auth.status, cors);
    const body = await request.json();
    const captainIds = unique(Array.isArray(body.captainIds) ? body.captainIds.map(String) : []);
    await env.DB.prepare('DELETE FROM boat_captains WHERE boat_id = ?').bind(boatId).run();
    for (const captainId of captainIds) {
      await env.DB.prepare('INSERT OR REPLACE INTO boat_captains (boat_id, captain_id, status, notes) VALUES (?, ?, ?, ?)')
        .bind(boatId, captainId, 'approved', null)
        .run();
    }
    return json({ ok: true, boatId, captainIds }, 200, cors);
  }
  return json({ error: 'GET or PUT required' }, 405, cors);
}

async function upsertCaptain(env, captain) {
  await env.DB.prepare(`
    INSERT OR REPLACE INTO captains (
      id, name, status, credential, email, phone, bio, home_port, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).bind(
    captain.id,
    captain.name || 'New Captain',
    captain.status || 'draft',
    captain.credential || null,
    captain.email || null,
    captain.phone || null,
    captain.bio || null,
    captain.homePort || captain.home_port || null
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
    approvedBoatCount: Number(row.approved_boat_count || 0),
    approvalStatus: row.approval_status,
    approvalNotes: row.approval_notes,
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
    return json((rows.results || []).map(outBooking), 200, cors);
  }
  if (request.method === 'POST') {
    const body = await request.json();
    if (!body.boatId && !body.boat_id) return json({ error: 'boatId is required' }, 400, cors);
    if (!body.customerName && !(body.firstName || body.lastName)) return json({ error: 'Customer name is required' }, 400, cors);
    if (!body.email && !body.phone) return json({ error: 'Email or phone is required' }, 400, cors);
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
      body.startTime || body.start_time || null,
      Number(body.durationHours || body.duration_hours || 4),
      Number(price?.base_fee || body.baseFee || 0),
      Number(price?.cleaning_fee || 0),
      Number(price?.fuel_deposit || 0),
      Number(price?.tax_rate || 0.08225),
      Number(await setting(env, 'mileage_rate', 14)),
      body.officeNotes || body.notes || null
    ).run();

    const row = await env.DB.prepare(bookingSelectSql('WHERE bk.id = ?')).bind(bookingId).first();
    const booking = outBooking(row);
    const emailTask = sendBookingNotification(env, booking).catch(error => console.error('Booking notification failed', error));
    if (ctx?.waitUntil) ctx.waitUntil(emailTask); else await emailTask;
    return json({ ok: true, id: bookingId, booking }, 201, cors);
  }
  return json({ error: 'GET or POST required' }, 405, cors);
}

async function bookingById(request, env, cors, id) {
  requireDb(env);
  if (request.method === 'GET') {
    const row = await env.DB.prepare(bookingSelectSql('WHERE bk.id = ?')).bind(id).first();
    return row ? json(outBooking(row), 200, cors) : json({ error: 'Booking not found' }, 404, cors);
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
        duration_hours = ?, office_notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      body.status || current.status,
      body.paidStatus || body.paid_status || current.paid_status,
      body.captainId ?? body.captain_id ?? current.captain_id,
      body.charterDate ?? body.charter_date ?? current.charter_date,
      body.startTime ?? body.start_time ?? current.start_time,
      Number(body.durationHours ?? body.duration_hours ?? current.duration_hours ?? 4),
      body.officeNotes ?? body.office_notes ?? current.office_notes,
      id
    ).run();
    const row = await env.DB.prepare(bookingSelectSql('WHERE bk.id = ?')).bind(id).first();
    return json({ ok: true, booking: outBooking(row) }, 200, cors);
  }

  if (request.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM bookings WHERE id = ?').bind(id).run();
    return json({ ok: true, id }, 200, cors);
  }

  return json({ error: 'GET, PUT, or DELETE required' }, 405, cors);
}

async function sendBookingConfirmation(request, env, cors, id) {
  requireDb(env);
  const auth = requireAdmin(request, env);
  if (auth) return json(auth.body, auth.status, cors);
  if (request.method !== 'POST') return json({ error: 'POST required' }, 405, cors);

  const row = await env.DB.prepare(bookingSelectSql('WHERE bk.id = ?')).bind(id).first();
  if (!row) return json({ error: 'Booking not found' }, 404, cors);
  const booking = outBooking(row);
  if (!booking.email) return json({ error: 'Booking has no customer email address' }, 400, cors);
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

function bookingSelectSql(suffix = '') {
  return `
    SELECT bk.*, b.name AS boat_name, b.slug AS boat_slug, c.name AS captain_name,
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
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
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
    <p>Our back office will follow up with the remaining agreement and payment details.</p>
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
    `Our back office will follow up with the remaining agreement and payment details.`,
    ``,
    `Please reply with any questions or changes.`
  ];
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
    INSERT INTO media (id, entity_type, entity_id, media_type, url, title, alt, sort_order, is_cover)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(mediaId, entityType, entityId, mediaType, publicUrl, title, alt, nextSort, shouldCover ? 1 : 0).run();

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
      isCover: body.isCover ?? body.is_cover ?? Boolean(current.is_cover)
    };

    if (truthy(next.isCover)) await clearCover(env, current.entity_type, current.entity_id);
    await env.DB.prepare('UPDATE media SET title = ?, alt = ?, sort_order = ?, is_cover = ? WHERE id = ?')
      .bind(String(next.title || ''), String(next.alt || ''), Number(next.sortOrder || 0), truthy(next.isCover) ? 1 : 0, id)
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
        INSERT INTO media (id, entity_type, entity_id, media_type, url, title, alt, sort_order, is_cover)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(`media_${crypto.randomUUID()}`, 'boat', boat.id, mediaType, file.download_url, title, title, index, isCover ? 1 : 0).run();
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
function cleanSegment(value) { return String(value).toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '') || 'item'; }
function cleanFilename(value) { const parts = String(value).split('.'); const ext = parts.length > 1 ? parts.pop().toLowerCase().replace(/[^a-z0-9]/g, '') : 'bin'; return `${cleanSegment(parts.join('.') || 'upload')}.${ext}`; }
function normalizeEntityType(value) { const clean = cleanSegment(value); return clean.endsWith('s') ? clean.slice(0, -1) : clean; }
function normalizeMediaType(value) { const clean = cleanSegment(value); if (clean === 'photo' || clean === 'image' || clean === 'images') return 'photos'; if (clean === 'video') return 'videos'; return clean || 'photos'; }
function truthy(value) { return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase()); }
function titleFromFilename(value) { return String(value || 'Media').replace(/^\d+-/, '').replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }
function toBase64(buffer) { let binary = ''; const bytes = new Uint8Array(buffer); for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(binary); }
function unique(items) { return [...new Set(items.filter(Boolean))]; }
