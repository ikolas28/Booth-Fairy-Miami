const crypto = require("crypto");
const {
  findDuplicateLead,
  insertLeadWithFallback,
  recordLeadDuplicate,
  recordLeadScore,
  withLeadIntelligence
} = require("../_lead-utils");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://hwwhyrpwfewxevocjjzk.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const INSTAGRAM_WEBHOOK_VERIFY_TOKEN = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN;
const INSTAGRAM_APP_SECRET = process.env.INSTAGRAM_APP_SECRET;
const INSTAGRAM_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const INSTAGRAM_USER_ID = process.env.INSTAGRAM_USER_ID;

module.exports = async (req, res) => {
  const route = getRoute(req);
  if (!route || route === "status") return handleStatus(req, res);
  if (route === "lead") return handleLead(req, res);
  if (route === "webhook") return handleWebhook(req, res);
  return sendJson(res, 404, { ok: false, error: "Instagram route not found." });
};

module.exports.config = {
  api: {
    bodyParser: false
  }
};

function handleStatus(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  return sendJson(res, 200, {
    ok: true,
    configured: Boolean(INSTAGRAM_WEBHOOK_VERIFY_TOKEN),
    publishingConfigured: Boolean(INSTAGRAM_ACCESS_TOKEN && INSTAGRAM_USER_ID),
    signatureVerification: Boolean(INSTAGRAM_APP_SECRET),
    webhookUrl: "https://www.boothfairymiami.com/api/instagram/webhook",
    leadIntakeUrl: "https://www.boothfairymiami.com/api/instagram/lead",
    privacyPolicyUrl: "https://www.boothfairymiami.com/privacy-policy.html",
    dataDeletionUrl: "https://www.boothfairymiami.com/data-deletion.html",
    requestedPermissions: [
      "instagram_business_basic",
      "instagram_business_manage_messages",
      "instagram_business_manage_comments",
      "instagram_business_content_publish"
    ],
    note: "Meta webhook setup requires an Instagram professional account connected to Meta, webhook verification token, and app permissions/review for live DM events. Publishing also needs INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_USER_ID, and content publishing permission for your app user."
  });
}

async function handleWebhook(req, res) {
  if (req.method === "GET") {
    return handleVerification(req, res);
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const rawBody = await readRawBody(req);
    verifySignature(req, rawBody);
    const payload = JSON.parse(rawBody || "{}");
    const events = extractInstagramEvents(payload);
    const results = [];

    for (const event of events) {
      try {
        const result = await importInstagramLead(event);
        results.push({ ok: true, result });
      } catch (error) {
        results.push({ ok: false, error: error.message || "Instagram event import failed." });
      }
    }

    return sendJson(res, 200, {
      ok: true,
      received: true,
      eventsProcessed: events.length,
      results
    });
  } catch (error) {
    return sendJson(res, error.statusCode || 400, {
      ok: false,
      error: error.message || "Instagram webhook failed."
    });
  }
}

async function handleLead(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization || "";
  const providedToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!providedToken || providedToken !== INSTAGRAM_WEBHOOK_VERIFY_TOKEN) {
    return sendJson(res, 401, { ok: false, error: "Unauthorized" });
  }

  try {
    const rawBody = await readRawBody(req);
    const payload = safeParse(rawBody) || {};
    const result = await importInstagramLead(payload);
    return sendJson(res, result.duplicate ? 200 : 201, {
      ok: true,
      ...result,
      source: "Instagram"
    });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, {
      ok: false,
      error: error.message || "Instagram lead intake failed.",
      details: error.details || null
    });
  }
}

async function importInstagramLead(payload) {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    const error = new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable");
    error.statusCode = 500;
    throw error;
  }
  if (!INSTAGRAM_WEBHOOK_VERIFY_TOKEN) {
    const error = new Error("Missing INSTAGRAM_WEBHOOK_VERIFY_TOKEN environment variable");
    error.statusCode = 500;
    throw error;
  }

  const normalized = normalizeInstagramLead(payload);
  if (!normalized.email && !normalized.phone && !normalized.instagramHandle) {
    const error = new Error("Instagram lead must include an Instagram handle, email, or phone number.");
    error.statusCode = 400;
    throw error;
  }

  const imported = await recordInstagramImport(normalized);
  if (imported.alreadyImported) {
    return {
      duplicate: true,
      leadId: imported.leadId
    };
  }

  const duplicate = await findDuplicateLead(supabaseAdmin, {
    email: normalized.email,
    phone: normalized.phone,
    event_date: normalized.eventDate,
    event_type: normalized.eventType,
    city: normalized.city,
    venue: normalized.venue,
    service_requested: normalized.serviceRequested,
    notes: normalized.messageText,
    source: "Instagram"
  });
  if (duplicate) {
    await recordLeadDuplicate(supabaseAdmin, normalized, duplicate, "instagram");
    await updateInstagramImport(normalized, duplicate.id);
    return {
      duplicate: true,
      leadId: duplicate.id,
      leadCode: duplicate.lead_code || null
    };
  }

  const lead = await createLead(normalized);
  await recordMessageHistory(lead.id, normalized);
  await createFollowup(lead.id, normalized);
  await updateInstagramImport(normalized, lead.id);
  await recordLeadScore(supabaseAdmin, lead.id, lead, "Instagram lead captured");
  return {
    duplicate: false,
    leadId: lead.id,
    leadCode: lead.lead_code || null
  };
}

function handleVerification(req, res) {
  const url = new URL(req.url, "https://www.boothfairymiami.com");
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && token === INSTAGRAM_WEBHOOK_VERIFY_TOKEN) {
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/plain");
    return res.end(challenge || "");
  }

  return sendJson(res, 403, {
    ok: false,
    error: "Instagram webhook verification failed."
  });
}

function extractInstagramEvents(payload) {
  const events = [];
  const entries = Array.isArray(payload.entry) ? payload.entry : [];

  for (const entry of entries) {
    for (const messaging of entry.messaging || []) {
      const message = messaging.message || {};
      const text = message.text || message.quick_reply?.payload || "";
      const messageId = message.mid || messaging.postback?.mid || `${messaging.sender?.id || "sender"}-${messaging.timestamp || Date.now()}`;
      events.push({
        sourceReference: messageId,
        senderId: messaging.sender?.id || "",
        instagramUserId: messaging.sender?.id || "",
        text: text || messaging.postback?.payload || "Instagram DM event received.",
        eventType: "General Inquiry"
      });
    }

    for (const change of entry.changes || []) {
      const value = change.value || {};
      const text = value.text || value.message || value.comment || value.caption || "";
      const reference = value.id || value.comment_id || `${change.field || "change"}-${entry.time || Date.now()}`;
      if (text || change.field) {
        events.push({
          sourceReference: reference,
          instagramUserId: value.from?.id || value.user_id || "",
          instagramHandle: value.from?.username || value.username || "",
          text: text || `Instagram ${change.field || "event"} received.`,
          eventType: "General Inquiry"
        });
      }
    }
  }

  return events;
}

function normalizeInstagramLead(payload) {
  const text = stringify(payload.text || payload.message || payload.comment || payload.caption || payload.body);
  const instagramHandle = normalizeHandle(payload.instagramHandle || payload.instagram_handle || payload.username || payload.handle || payload.senderUsername);
  const instagramUserId = stringify(payload.instagramUserId || payload.instagram_user_id || payload.senderId || payload.sender_id || payload.psid);
  const eventDate = normalizeDate(payload.eventDate || payload.event_date);
  const city = stringify(payload.city);
  const venue = stringify(payload.venue);
  const phone = stringify(payload.phone || extractPhone(text));
  const email = stringify(payload.email || extractEmail(text));
  const sourceReference = stringify(payload.sourceReference || payload.source_reference || payload.messageId || payload.message_id || payload.commentId || payload.comment_id || payload.id || instagramUserId || instagramHandle || crypto.randomUUID());
  const missing = [];
  if (!eventDate) missing.push("event date");
  if (!venue && !city) missing.push("venue/city");
  if (!phone) missing.push("phone number");

  return {
    clientName: stringify(payload.clientName || payload.client_name || payload.name || instagramHandle || fallbackName(email, phone, instagramUserId)),
    email: email || "Not provided",
    phone: phone || "Not provided",
    instagramHandle,
    instagramUserId,
    eventType: stringify(payload.eventType || payload.event_type || inferEventType(text)),
    eventDate,
    venue,
    city,
    serviceRequested: stringify(payload.serviceRequested || payload.service_requested || inferService(text)),
    guestCount: normalizeNumber(payload.guestCount || payload.guest_count, 0),
    budget: normalizeNumber(payload.budget, 0),
    messageText: text,
    sourceReference,
    status: missing.length ? "Missing Info" : "New Lead",
    missing
  };
}

async function createLead(lead) {
  const notes = [
    lead.messageText ? `Instagram message: ${lead.messageText}` : "",
    lead.instagramHandle ? `Instagram handle: ${lead.instagramHandle}` : "",
    lead.instagramUserId ? `Instagram user ID: ${lead.instagramUserId}` : "",
    lead.sourceReference ? `Instagram reference: ${lead.sourceReference}` : "",
    lead.missing.length ? `Missing info to request: ${lead.missing.join(", ")}` : "",
    "Instagram lead. Do not confirm availability until calendar is checked. Do not offer print packages."
  ].filter(Boolean).join("\n");

  const rows = await insertLeadWithFallback(supabaseAdmin, withLeadIntelligence({
    client_name: lead.clientName || "Instagram Lead",
    phone: lead.phone,
    email: lead.email,
    event_type: lead.eventType,
    event_date: lead.eventDate || null,
    venue: lead.venue || null,
    city: lead.city || null,
    service_requested: lead.serviceRequested,
    guest_count: lead.guestCount,
    budget: lead.budget,
    notes,
    status: lead.status,
    payment_status: "Not Requested",
    calendar_checked: false,
    source: "Instagram"
  }));
  return rows?.[0] || {};
}

async function recordMessageHistory(leadId, lead) {
  try {
    await supabaseAdmin("/message_history", {
      method: "POST",
      body: {
        lead_id: leadId,
        channel: "Instagram",
        direction: "Inbound",
        from_value: lead.instagramHandle || lead.instagramUserId || null,
        subject: "Instagram lead captured",
        summary: lead.messageText || "Instagram lead captured.",
        notes: `Instagram reference: ${lead.sourceReference}`
      }
    });
  } catch {
    // Lead capture is the critical path.
  }
}

async function createFollowup(leadId, lead) {
  try {
    await supabaseAdmin("/followups", {
      method: "POST",
      body: {
        lead_id: leadId,
        due_date: addDaysIso(1),
        channel: "Instagram",
        status: "Open",
        notes: lead.missing.length
          ? `Reply on Instagram and ask for: ${lead.missing.join(", ")}.`
          : "Reply on Instagram, confirm details, and move to calendar check if ready."
      }
    });
  } catch {
    // Lead capture is the critical path.
  }
}

async function recordInstagramImport(lead) {
  try {
    const existing = await supabaseAdmin(`/instagram_imports?instagram_reference=eq.${encodeURIComponent(lead.sourceReference)}&select=id,lead_id&limit=1`, { method: "GET" });
    if (existing?.[0]) {
      return { alreadyImported: true, leadId: existing[0].lead_id };
    }
    await supabaseAdmin("/instagram_imports", {
      method: "POST",
      body: {
        instagram_reference: lead.sourceReference,
        instagram_user_id: lead.instagramUserId || null,
        instagram_handle: lead.instagramHandle || null,
        lead_id: null,
        message_summary: lead.messageText || null
      }
    });
  } catch {
    // The optional migration may not be installed yet. Continue without idempotency table.
  }
  return { alreadyImported: false, leadId: null };
}

async function updateInstagramImport(lead, leadId) {
  try {
    await supabaseAdmin(`/instagram_imports?instagram_reference=eq.${encodeURIComponent(lead.sourceReference)}`, {
      method: "PATCH",
      body: { lead_id: leadId }
    });
  } catch {
    // Optional table may not exist yet.
  }
}

async function supabaseAdmin(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method: options.method || "GET",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation"
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = await parseResponse(response);
  if (!response.ok) {
    const error = new Error(payload?.message || payload?.hint || "Supabase admin request failed.");
    error.details = payload;
    error.statusCode = response.status;
    throw error;
  }
  return payload;
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function verifySignature(req, rawBody) {
  if (!INSTAGRAM_APP_SECRET) return;
  const header = req.headers["x-hub-signature-256"];
  if (!header || !header.startsWith("sha256=")) {
    const error = new Error("Missing Instagram webhook signature.");
    error.statusCode = 401;
    throw error;
  }
  const received = header.slice("sha256=".length);
  const expected = crypto.createHmac("sha256", INSTAGRAM_APP_SECRET).update(rawBody).digest("hex");
  const receivedBuffer = Buffer.from(received, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (receivedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)) {
    const error = new Error("Invalid Instagram webhook signature.");
    error.statusCode = 401;
    throw error;
  }
}

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function getRoute(req) {
  const pathname = new URL(req.url, "https://www.boothfairymiami.com").pathname;
  return pathname.split("/").filter(Boolean).slice(2).join("/");
}

function inferService(text) {
  const lower = String(text || "").toLowerCase();
  if (lower.includes("dj") && (lower.includes("photo") || lower.includes("booth"))) return "Photo Booth + DJ Bundle";
  if (lower.includes("dj")) return "Premium DJ Services";
  return "DSLR Photo Booth - Digital Sharing";
}

function inferEventType(text) {
  const lower = String(text || "").toLowerCase();
  if (lower.includes("wedding")) return "Wedding";
  if (lower.includes("quince")) return "Quinceanera";
  if (lower.includes("birthday")) return "Birthday Party";
  if (lower.includes("baby shower")) return "Baby Shower";
  if (lower.includes("corporate") || lower.includes("brand")) return "Corporate Event";
  if (lower.includes("school")) return "School Event";
  return "General Inquiry";
}

function normalizeHandle(value) {
  const clean = stringify(value).replace(/^@+/, "");
  return clean ? `@${clean}` : "";
}

function extractEmail(text) {
  return String(text || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
}

function extractPhone(text) {
  return String(text || "").match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/)?.[0] || "";
}

function fallbackName(email, phone, instagramUserId) {
  if (email) return email.split("@")[0];
  if (phone) return `Instagram Lead ${phone.slice(-4)}`;
  if (instagramUserId) return `Instagram Lead ${instagramUserId.slice(-4)}`;
  return "Instagram Lead";
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

function addDaysIso(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function stringify(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function safeParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}
