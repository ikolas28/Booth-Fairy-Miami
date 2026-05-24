const SUPABASE_URL = process.env.SUPABASE_URL || "https://hwwhyrpwfewxevocjjzk.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;
const REQUIRE_TURNSTILE = process.env.VERCEL_ENV !== "preview";
const {
  findDuplicateLead,
  insertLeadWithFallback,
  recordLeadDuplicate,
  recordLeadScore,
  withLeadIntelligence
} = require("../_lead-utils");
const SITE_URL = process.env.SITE_URL || "https://www.boothfairymiami.com";
const ALLOWED_ORIGINS = new Set([
  SITE_URL,
  "https://www.boothfairymiami.com",
  "https://boothfairymiami.com"
]);
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 8;
const MAX_BODY_BYTES = 12_000;
const rateLimitBuckets = new Map();

module.exports = async (req, res) => {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  if (!isAllowedOrigin(req)) {
    return sendJson(res, 403, { ok: false, error: "Origin is not allowed." });
  }

  if (!checkRateLimit(req)) {
    return sendJson(res, 429, { ok: false, error: "Too many inquiries. Please try again later." });
  }

  if (Number(req.headers["content-length"] || 0) > MAX_BODY_BYTES) {
    return sendJson(res, 413, { ok: false, error: "Inquiry is too large." });
  }

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    return sendJson(res, 500, {
      ok: false,
      error: "Missing SUPABASE_SERVICE_ROLE_KEY environment variable"
    });
  }

  const payload = typeof req.body === "string" ? safeParse(req.body) : req.body || {};
  if (!payload || typeof payload !== "object") {
    return sendJson(res, 400, { ok: false, error: "Invalid JSON body" });
  }

  if (stringify(payload.website)) {
    return sendJson(res, 202, { ok: true, ignored: true });
  }

  if (REQUIRE_TURNSTILE) {
    const turnstileResult = await verifyTurnstile(stringify(payload["cf-turnstile-response"]), getClientIp(req));
    if (!turnstileResult.success) {
      return sendJson(res, 400, {
        ok: false,
        error: "Verification failed. Please refresh and try again.",
        code: "turnstile_failed"
      });
    }
  }

  const normalized = normalizeWebsiteLead(payload);
  const spamReason = getSpamReason(normalized, payload);
  if (spamReason) {
    return sendJson(res, 202, { ok: true, ignored: true, reason: spamReason });
  }

  if (!normalized.email && !normalized.phone) {
    return sendJson(res, 400, {
      ok: false,
      error: "Please include an email or phone number."
    });
  }

  if (normalized.email && !isValidEmail(normalized.email)) {
    return sendJson(res, 400, { ok: false, error: "Please enter a valid email address." });
  }

  try {
    const duplicate = await findDuplicateLead(supabaseAdmin, normalized);
    if (duplicate) {
      await recordLeadDuplicate(supabaseAdmin, normalized, duplicate, "website");
      await recordAuditLog("website_lead_duplicate", "leads", duplicate.id, "website", {
        email: normalized.email || null,
        phone: normalized.phone || null,
        eventDate: normalized.eventDate || null
      });
      return sendJson(res, 200, {
        ok: true,
        duplicate: true,
        leadId: duplicate.id,
        leadCode: duplicate.lead_code || null,
        status: duplicate.status || "Existing Lead"
      });
    }

    const leadRecord = buildLeadRecord(normalized);
    const data = await insertLeadWithFallback(supabaseAdmin, leadRecord);

    const leadId = data?.[0]?.id || null;
    if (leadId) {
      await recordLeadScore(supabaseAdmin, leadId, leadRecord, "Website lead captured");
    }

    return sendJson(res, 201, {
      ok: true,
      leadId,
      leadCode: data?.[0]?.lead_code || null,
      status: data?.[0]?.status || normalized.status
    });
  } catch (error) {
    return sendJson(res, 500, {
      ok: false,
      error: "Unexpected server error",
      details: error.message
    });
  }
};

async function verifyTurnstile(token, remoteIp) {
  if (!TURNSTILE_SECRET_KEY) {
    return { success: false, "error-codes": ["missing-secret"] };
  }
  if (!token) {
    return { success: false, "error-codes": ["missing-input-response"] };
  }

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      secret: TURNSTILE_SECRET_KEY,
      response: token,
      remoteip: remoteIp
    })
  });

  if (!response.ok) {
    return { success: false, "error-codes": ["verification-request-failed"] };
  }
  return response.json().catch(() => ({ success: false, "error-codes": ["invalid-json"] }));
}

function setCorsHeaders(req, res) {
  const origin = req.headers.origin || "";
  if (isAllowedOriginValue(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
}

function isAllowedOrigin(req) {
  const origin = req.headers.origin || "";
  if (!origin) return true;
  return isAllowedOriginValue(origin);
}

function isAllowedOriginValue(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const url = new URL(origin);
    return url.protocol === "https:" && url.hostname.endsWith(".vercel.app") && url.hostname.startsWith("booth-fairy-miami-");
  } catch {
    return false;
  }
}

function checkRateLimit(req) {
  const ip = getClientIp(req);
  const now = Date.now();
  const bucket = rateLimitBuckets.get(ip) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
  if (bucket.resetAt <= now) {
    bucket.count = 0;
    bucket.resetAt = now + RATE_LIMIT_WINDOW_MS;
  }
  bucket.count += 1;
  rateLimitBuckets.set(ip, bucket);
  return bucket.count <= RATE_LIMIT_MAX;
}

function getClientIp(req) {
  return String(req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || req.socket?.remoteAddress || "unknown")
    .split(",")[0]
    .trim();
}

function normalizeWebsiteLead(payload) {
  const eventDate = normalizeDate(payload.eventDate || payload["event-date"]);
  const startTime = normalizeTime(payload.startTime || payload["start-time"]);
  const endTime = normalizeTime(payload.endTime || payload["end-time"]);
  const city = stringify(payload.city);
  const venue = stringify(payload.venue);
  const phone = stringify(payload.phone);
  const email = stringify(payload.email).toLowerCase();
  const missing = [];
  if (!eventDate) missing.push("event date");
  if (!venue && !city) missing.push("venue/city");
  if (!phone) missing.push("phone number");

  const packageInterest = stringify(payload.packageInterest || payload["package-interest"]);
  const serviceRequested = stringify(payload.serviceRequested || payload["service-requested"] || "DSLR Photo Booth - Digital Sharing");
  const message = stringify(payload.message);
  const notes = [
    message ? `Message: ${message}` : "",
    packageInterest ? `Package interest: ${packageInterest}` : "",
    missing.length ? `Missing info to request: ${missing.join(", ")}` : "",
    "Website form lead. Do not confirm availability until calendar is checked."
  ].filter(Boolean).join("\n");

  return {
    clientName: stringify(payload.clientName || payload.name || fallbackName(payload.email, phone)),
    email,
    phone,
    eventType: stringify(payload.eventType || payload["event-type"] || "General Inquiry"),
    eventDate,
    startTime,
    endTime,
    venue,
    city,
    serviceRequested,
    guestCount: normalizeNumber(payload.guestCount || payload["guest-count"], 0),
    budget: normalizeNumber(payload.budget, 0),
    notes,
    status: missing.length ? "Missing Info" : "New Lead"
  };
}

function getSpamReason(lead, payload) {
  const joined = [
    lead.clientName,
    lead.email,
    lead.phone,
    lead.eventType,
    lead.venue,
    lead.city,
    lead.serviceRequested,
    lead.notes,
    stringify(payload.message)
  ].join(" ").toLowerCase();

  const urlCount = (joined.match(/https?:\/\//g) || []).length;
  if (urlCount > 2) return "too_many_links";
  if (/<script|<\/script|<iframe|<\/iframe/i.test(joined)) return "html_injection";

  const vendorSignals = [
    "seo service",
    "guest post",
    "backlink",
    "web design agency",
    "lead generation",
    "rank on google",
    "business loan",
    "wholesale supplier"
  ];
  if (vendorSignals.some((signal) => joined.includes(signal))) return "vendor_spam";
  return "";
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeTime(value) {
  const clean = stringify(value);
  if (!clean) return "";
  const match = clean.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return "";
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return "";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

async function recordAuditLog(action, entityType, entityId, source, metadata = {}) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/audit_logs`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action,
        entity_type: entityType,
        entity_id: entityId,
        source,
        metadata
      })
    });
  } catch {
    // Lead intake should not fail if audit logging has not been migrated yet.
  }
}

function buildLeadRecord(lead) {
  return withLeadIntelligence({
    client_name: lead.clientName || "Website Lead",
    phone: lead.phone || "Not provided",
    email: lead.email || "Not provided",
    event_type: lead.eventType,
    event_date: lead.eventDate || null,
    start_time: lead.startTime || null,
    end_time: lead.endTime || null,
    venue: lead.venue || null,
    city: lead.city || null,
    service_requested: lead.serviceRequested,
    guest_count: lead.guestCount,
    budget: lead.budget,
    notes: lead.notes,
    status: lead.status,
    payment_status: "Not Requested",
    calendar_checked: false,
    source: "Website"
  });
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
  const payload = await parseSupabaseResponse(response);
  if (!response.ok) {
    const error = new Error(payload?.message || payload?.hint || "Supabase request failed.");
    error.details = payload;
    error.statusCode = response.status;
    throw error;
  }
  return payload;
}

async function parseSupabaseResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function safeParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
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

function fallbackName(email, phone) {
  const cleanEmail = stringify(email);
  if (cleanEmail) return cleanEmail.split("@")[0];
  if (phone) return `Lead ${phone.slice(-4)}`;
  return "Website Lead";
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
