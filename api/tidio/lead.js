const SUPABASE_URL = process.env.SUPABASE_URL || "https://hwwhyrpwfewxevocjjzk.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TIDIO_WEBHOOK_SECRET = process.env.TIDIO_WEBHOOK_SECRET;

module.exports = async (req, res) => {
  if (req.method === "GET") {
    return sendJson(res, 200, {
      ok: true,
      service: "tidio-lead-ingest",
      message: "POST chat lead payloads here from Tidio flows."
    });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    return sendJson(res, 500, {
      ok: false,
      error: "Missing SUPABASE_SERVICE_ROLE_KEY environment variable"
    });
  }

  if (!TIDIO_WEBHOOK_SECRET) {
    return sendJson(res, 500, {
      ok: false,
      error: "Missing TIDIO_WEBHOOK_SECRET environment variable"
    });
  }

  const authHeader = req.headers.authorization || "";
  const providedToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!providedToken || providedToken !== TIDIO_WEBHOOK_SECRET) {
    return sendJson(res, 401, { ok: false, error: "Unauthorized" });
  }

  const payload = typeof req.body === "string" ? safeParse(req.body) : (req.body || {});
  if (!payload || typeof payload !== "object") {
    return sendJson(res, 400, { ok: false, error: "Invalid JSON body" });
  }

  const normalized = normalizeLeadPayload(payload);
  if (!normalized.email && !normalized.phone) {
    return sendJson(res, 400, {
      ok: false,
      error: "Tidio lead must include at least an email or phone number"
    });
  }

  try {
    const leadRecord = buildSupabaseLead(normalized);
    const response = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify(leadRecord)
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return sendJson(res, 502, {
        ok: false,
        error: "Supabase insert failed",
        details: data
      });
    }

    return sendJson(res, 201, {
      ok: true,
      leadId: data?.[0]?.id || null,
      source: "Tidio"
    });
  } catch (error) {
    return sendJson(res, 500, {
      ok: false,
      error: "Unexpected server error",
      details: error.message
    });
  }
};

function safeParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeLeadPayload(payload) {
  const email = stringify(payload.email || payload.contactEmail || payload.contact_email);
  const phone = stringify(payload.phone || payload.contactPhone || payload.contact_phone);
  const clientName = stringify(
    payload.clientName ||
    payload.name ||
    payload.contactName ||
    payload.contact_name ||
    fallbackName(email, phone)
  );

  return {
    clientName,
    email,
    phone,
    eventType: stringify(payload.eventType || payload.event_type || "General Inquiry"),
    eventDate: normalizeDate(payload.eventDate || payload.event_date),
    venue: stringify(payload.venue),
    city: stringify(payload.city),
    serviceRequested: stringify(payload.serviceRequested || payload.service_requested || "Luxury DSLR Digital Booth"),
    guestCount: normalizeNumber(payload.guestCount || payload.guest_count, 0),
    budget: normalizeNumber(payload.budget, 0),
    notes: buildNotes(payload),
    sourceReference: stringify(payload.sourceReference || payload.contactId || payload.contact_id || payload.conversationId || payload.conversation_id)
  };
}

function buildSupabaseLead(payload) {
  const referenceLine = payload.sourceReference ? `Tidio reference: ${payload.sourceReference}` : "";
  const finalNotes = [payload.notes, referenceLine].filter(Boolean).join("\n\n");

  return {
    client_name: payload.clientName || "Tidio Lead",
    phone: payload.phone || "Not provided",
    email: payload.email || "Not provided",
    event_type: payload.eventType || "General Inquiry",
    event_date: payload.eventDate || null,
    venue: payload.venue || null,
    city: payload.city || null,
    service_requested: payload.serviceRequested || "Luxury DSLR Digital Booth",
    guest_count: payload.guestCount,
    budget: payload.budget,
    notes: finalNotes || "Lead captured from Tidio chat.",
    status: "New Lead",
    payment_status: "Not Requested",
    calendar_checked: false,
    source: "Tidio"
  };
}

function buildNotes(payload) {
  const lines = [];
  if (payload.notes) lines.push(`Lead notes: ${stringify(payload.notes)}`);
  if (payload.message) lines.push(`Chat message: ${stringify(payload.message)}`);
  if (payload.transcript) lines.push(`Transcript: ${stringify(payload.transcript)}`);
  if (payload.pageUrl || payload.page_url) lines.push(`Page URL: ${stringify(payload.pageUrl || payload.page_url)}`);
  return lines.join("\n");
}

function fallbackName(email, phone) {
  if (email) return email.split("@")[0];
  if (phone) return `Lead ${phone.slice(-4)}`;
  return "Tidio Lead";
}

function normalizeDate(value) {
  const stringValue = stringify(value);
  if (!stringValue) return "";
  return stringValue.slice(0, 10);
}

function normalizeNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stringify(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}
