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
const { syncLeadToHubSpot } = require("../_hubspot-lib");
const { getPhotoBoothPackageLabel } = require("../_packages");
const SITE_URL = process.env.SITE_URL || "https://www.boothfairymiami.com";
const ALLOWED_ORIGINS = new Set([
  SITE_URL,
  "https://www.boothfairymiami.com",
  "https://boothfairymiami.com"
]);
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 8;
const MAX_BODY_BYTES = 12_000;
const GOOGLE_RATING_CACHE_MAX_AGE_SECONDS = 60 * 60;
const DEFAULT_GOOGLE_RATING = "5.0";
const DEFAULT_GOOGLE_REVIEW_COUNT = 4;
const DEFAULT_GOOGLE_MAPS_URI = "https://maps.app.goo.gl/J58XHk8V5N2ZDfx4A";
const DEFAULT_PLACE_TEXT_QUERIES = [
  "Booth Fairy Miami",
  "Booth Fairy Miami photo booth",
  "Booth Fairy Miami Hialeah FL",
  "Booth Fairy Miami Miami FL"
];
const rateLimitBuckets = new Map();
let cachedGoogleRatingPayload = null;
let cachedGoogleRatingAt = 0;

module.exports = async (req, res) => {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method === "GET" && getRequestQueryValue(req, "resource") === "google-rating") {
    return handleGoogleRatingRequest(req, res);
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST, OPTIONS");
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

  const payload = parseRequestBody(req.body);
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
    const hubspotSync = leadId
      ? await syncLeadToHubSpot({ ...leadRecord, id: leadId, lead_code: data?.[0]?.lead_code }).catch((error) => ({
        ok: false,
        error: error.message || "HubSpot sync failed."
      }))
      : null;
    if (leadId && hubspotSync) {
      await patchLeadHubSpotSync(leadId, hubspotSync).catch(() => null);
    }

    return sendJson(res, 201, {
      ok: true,
      leadId,
      leadCode: data?.[0]?.lead_code || null,
      status: data?.[0]?.status || normalized.status,
      hubspotSync: summarizeHubSpotSync(hubspotSync)
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

async function patchLeadHubSpotSync(leadId, sync) {
  if (!sync) return;
  const body = sync.ok ? {
    hubspot_contact_id: sync.contactId || null,
    hubspot_deal_id: sync.dealId || null,
    hubspot_sync_status: "Synced",
    hubspot_sync_error: null,
    hubspot_synced_at: new Date().toISOString()
  } : {
    hubspot_sync_status: sync.skipped ? "Skipped" : "Failed",
    hubspot_sync_error: sync.reason || sync.error || "HubSpot sync failed.",
    hubspot_synced_at: new Date().toISOString()
  };
  await supabaseAdmin(`/leads?id=eq.${encodeURIComponent(leadId)}`, {
    method: "PATCH",
    body
  });
}

function summarizeHubSpotSync(sync) {
  if (!sync) return { ok: false, skipped: true, reason: "No HubSpot sync attempted." };
  return {
    ok: Boolean(sync.ok),
    skipped: Boolean(sync.skipped),
    contactId: sync.contactId || "",
    dealId: sync.dealId || "",
    reason: sync.reason || sync.error || ""
  };
}

function setCorsHeaders(req, res) {
  const origin = req.headers.origin || "";
  if (isAllowedOriginValue(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
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
  const serviceRequested = normalizeServiceRequested(payload, packageInterest);
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

function normalizeServiceRequested(payload, packageInterest = "") {
  const selected = stringify(payload.serviceRequested || payload["service-requested"]);
  const packageText = packageInterest.toLowerCase();
  if (/dj \+ photo booth bundle|photo booth \+ dj bundle/.test(packageText)) {
    return "Photo Booth + DJ Bundle";
  }
  const fixedPackage = getPhotoBoothPackageLabel(packageInterest, selected);
  return fixedPackage || selected || "DSLR Print Photo Booth - 2 Hours ($450)";
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

function parseRequestBody(body) {
  if (!body) return {};
  if (typeof body === "string") return safeParse(body) || {};
  if (Buffer.isBuffer(body)) return safeParse(body.toString("utf8")) || {};
  if (typeof body === "object") return body;
  return {};
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

function getRequestQueryValue(req, key) {
  if (req.query && req.query[key] !== undefined) {
    return Array.isArray(req.query[key]) ? stringify(req.query[key][0]) : stringify(req.query[key]);
  }

  try {
    const url = new URL(req.url, "https://www.boothfairymiami.com");
    return stringify(url.searchParams.get(key));
  } catch {
    return "";
  }
}

function fallbackGoogleRatingPayload(reason = "fallback") {
  return {
    rating: DEFAULT_GOOGLE_RATING,
    reviewCount: DEFAULT_GOOGLE_REVIEW_COUNT,
    googleMapsUri: DEFAULT_GOOGLE_MAPS_URI,
    source: "fallback",
    reason,
    updatedAt: new Date().toISOString()
  };
}

function normalizeGooglePlaceName(placeId) {
  const trimmedPlaceId = stringify(placeId);
  if (!trimmedPlaceId) return "";
  return trimmedPlaceId.startsWith("places/") ? trimmedPlaceId : `places/${trimmedPlaceId}`;
}

function formatGoogleRating(value) {
  const numericRating = Number(value);
  if (!Number.isFinite(numericRating) || numericRating <= 0) return DEFAULT_GOOGLE_RATING;
  return numericRating.toFixed(1);
}

function buildGoogleRatingPayload(place) {
  const reviewCount = Number(place?.userRatingCount);
  return {
    rating: formatGoogleRating(place?.rating),
    reviewCount: Number.isFinite(reviewCount) && reviewCount >= 0 ? reviewCount : DEFAULT_GOOGLE_REVIEW_COUNT,
    googleMapsUri: place?.googleMapsUri || DEFAULT_GOOGLE_MAPS_URI,
    source: "google-places",
    updatedAt: new Date().toISOString()
  };
}

async function fetchGooglePlaceById(apiKey, placeName) {
  const response = await fetch(`https://places.googleapis.com/v1/${encodeURI(placeName)}`, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "id,displayName,rating,userRatingCount,googleMapsUri"
    }
  });

  if (!response.ok) {
    const error = new Error(`Google Places details request failed with ${response.status}`);
    error.googleStatusCode = response.status;
    throw error;
  }

  return response.json();
}

async function fetchGooglePlaceByTextSearch(apiKey) {
  const textQueries = process.env.GOOGLE_PLACE_TEXT_QUERY
    ? [process.env.GOOGLE_PLACE_TEXT_QUERY]
    : DEFAULT_PLACE_TEXT_QUERIES;

  for (const textQuery of textQueries) {
    const place = await fetchFirstGooglePlaceByTextSearch(apiKey, textQuery);
    if (place) return place;
  }

  for (const textQuery of textQueries) {
    const place = await fetchFirstLegacyGooglePlaceByTextSearch(apiKey, textQuery);
    if (place) return place;
  }

  return null;
}

async function fetchFirstGooglePlaceByTextSearch(apiKey, textQuery) {
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.rating,places.userRatingCount,places.googleMapsUri"
    },
    body: JSON.stringify({
      textQuery,
      locationBias: {
        circle: {
          center: {
            latitude: 25.9552664,
            longitude: -80.4482804
          },
          radius: 50000
        }
      }
    })
  });

  if (!response.ok) {
    const error = new Error(`Google Places text search request failed with ${response.status}`);
    error.googleStatusCode = response.status;
    throw error;
  }

  const searchResults = await response.json();
  return Array.isArray(searchResults.places) ? searchResults.places[0] : null;
}

async function fetchFirstLegacyGooglePlaceByTextSearch(apiKey, textQuery) {
  const params = new URLSearchParams({
    query: textQuery,
    key: apiKey
  });
  const response = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?${params.toString()}`);

  if (!response.ok) {
    const error = new Error(`Legacy Google Places text search request failed with ${response.status}`);
    error.googleStatusCode = response.status;
    throw error;
  }

  const searchResults = await response.json();
  if (searchResults.status && !["OK", "ZERO_RESULTS"].includes(searchResults.status)) {
    const error = new Error(`Legacy Google Places text search returned ${searchResults.status}`);
    error.googleStatusCode = searchResults.status;
    throw error;
  }

  const place = Array.isArray(searchResults.results) ? searchResults.results[0] : null;
  if (!place) return null;

  return {
    rating: place.rating,
    userRatingCount: place.user_ratings_total,
    googleMapsUri: place.place_id
      ? `https://www.google.com/maps/search/?api=1&query=Booth%20Fairy%20Miami&query_place_id=${encodeURIComponent(place.place_id)}`
      : DEFAULT_GOOGLE_MAPS_URI
  };
}

async function handleGoogleRatingRequest(req, res) {
  const now = Date.now();
  const forceRefresh = getRequestQueryValue(req, "refresh") === "1";
  res.setHeader(
    "Cache-Control",
    `s-maxage=${GOOGLE_RATING_CACHE_MAX_AGE_SECONDS}, stale-while-revalidate=${GOOGLE_RATING_CACHE_MAX_AGE_SECONDS}`
  );

  if (!forceRefresh && cachedGoogleRatingPayload && now - cachedGoogleRatingAt < GOOGLE_RATING_CACHE_MAX_AGE_SECONDS * 1000) {
    return sendJson(res, 200, cachedGoogleRatingPayload);
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  const placeName = normalizeGooglePlaceName(process.env.GOOGLE_PLACE_ID);

  if (!apiKey) {
    return sendJson(res, 200, fallbackGoogleRatingPayload("missing-google-places-config"));
  }

  try {
    const place = placeName
      ? await fetchGooglePlaceById(apiKey, placeName)
      : await fetchGooglePlaceByTextSearch(apiKey);

    if (!place) throw new Error("Google Places did not return a matching place.");

    const payload = buildGoogleRatingPayload(place);
    cachedGoogleRatingPayload = payload;
    cachedGoogleRatingAt = now;

    return sendJson(res, 200, payload);
  } catch (error) {
    const payload = cachedGoogleRatingPayload || fallbackGoogleRatingPayload(
      error?.googleStatusCode
        ? `google-places-request-failed-${error.googleStatusCode}`
        : "google-places-unavailable"
    );
    return sendJson(res, 200, payload);
  }
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}
