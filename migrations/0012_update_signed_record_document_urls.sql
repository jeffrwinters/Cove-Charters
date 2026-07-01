UPDATE booking_documents
SET url = 'https://jeffrwinters.github.io/Cove-Charters/signed.html?token=' || (
    SELECT signing_token
    FROM bookings
    WHERE bookings.id = booking_documents.booking_id
  ),
  title = 'Signed electronic charter packet',
  filename = 'signed-charter-packet-' || booking_id || '.html',
  content_type = 'text/html',
  status = 'signed',
  audience = 'office,captain',
  updated_at = CURRENT_TIMESTAMP
WHERE document_type = 'electronic_signature_record'
  AND EXISTS (
    SELECT 1
    FROM bookings
    WHERE bookings.id = booking_documents.booking_id
      AND signing_token IS NOT NULL
  );
