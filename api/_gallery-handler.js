const crypto = require("crypto");
const {
  setJson,
  supabaseAdmin,
  verifyAdminRequest
} = require("./gmail/_lib");

const SITE_URL = process.env.SITE_URL || "https://www.boothfairymiami.com";
const SESSION_SECRET = String(process.env.GALLERY_SESSION_SECRET || "").trim();
const ACCESS_COOKIE_PREFIX = "bfm_gallery_";
const MAX_BODY_BYTES = 40_000;
const ACCESS_WINDOW_MS = 15 * 60 * 1000;
const ACCESS_MAX_ATTEMPTS = 10;
const EVENT_WINDOW_MS = 60 * 1000;
const EVENT_MAX_ATTEMPTS = 40;
const accessBuckets = new Map();
const eventBuckets = new Map();
const DEFAULT_GALLERY_WELCOME = "Welcome to your private Booth Fairy Miami gallery. We hope you enjoy reliving the fun, laughter, and special moments from your celebration. Please share this gallery only with invited guests.";
const DEFAULT_EXPIRATION_NOTICE = "This gallery is available for a limited time. Please download and save any photos you would like to keep before the gallery expires.";
const DEFAULT_EXPIRED_MESSAGE = "This online gallery is no longer available. Please contact Booth Fairy Miami if you need assistance accessing your event photos.";
const allowedOrigins = new Set([
  SITE_URL,
  "https://www.boothfairymiami.com",
  "https://boothfairymiami.com"
]);

module.exports = async (req, res, providedRoute = "") => {
  setSecurityHeaders(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  const route = providedRoute || getRoute(req);
  try {
    if (route === "admin" || route.startsWith("admin/")) {
      return await handleAdmin(req, res, route.split("/")[1] || "");
    }
    if (!isAllowedOrigin(req)) {
      return setJson(res, 403, { ok: false, error: "Origin is not allowed." });
    }
    if (route === "resolve") return await handleResolve(req, res);
    if (route === "access") return await handleAccess(req, res);
    if (route === "event") return await handleEvent(req, res);
    return setJson(res, 404, { ok: false, error: "Gallery route not found." });
  } catch (error) {
    return setJson(res, error.statusCode || 500, {
      ok: false,
      error: error.message || "Gallery request failed."
    });
  }
};

async function handleAdmin(req, res, galleryId) {
  if (!await verifyAdminRequest(req)) {
    return setJson(res, 401, { ok: false, error: "Admin authentication required." });
  }

  if (req.method === "GET" && !galleryId) {
    const [galleries, events] = await Promise.all([
      supabaseAdmin("/client_galleries?select=*&order=created_at.desc", { method: "GET" }),
      supabaseAdmin("/gallery_events?select=gallery_id,event_type,button_name,created_at&order=created_at.desc&limit=10000", { method: "GET" })
    ]);
    const analytics = summarizeEvents(events || []);
    return setJson(res, 200, {
      ok: true,
      galleries: (galleries || []).map((gallery) => toAdminGallery(gallery, analytics[gallery.id]))
    });
  }

  if ((req.method === "POST" && !galleryId) || (req.method === "PATCH" && galleryId)) {
    enforceBodyLimit(req);
    const body = parseBody(req.body);
    const existing = galleryId ? await getGalleryById(galleryId) : null;
    if (galleryId && !existing) {
      return setJson(res, 404, { ok: false, error: "Gallery not found." });
    }
    const payload = buildGalleryPayload(body, existing);
    const rows = await supabaseAdmin(
      galleryId
        ? `/client_galleries?id=eq.${encodeURIComponent(galleryId)}`
        : "/client_galleries",
      {
        method: galleryId ? "PATCH" : "POST",
        body: payload,
        prefer: "return=representation"
      }
    );
    return setJson(res, galleryId ? 200 : 201, {
      ok: true,
      gallery: toAdminGallery(rows?.[0] || { ...existing, ...payload })
    });
  }

  if (req.method === "DELETE" && galleryId) {
    await supabaseAdmin(`/client_galleries?id=eq.${encodeURIComponent(galleryId)}`, {
      method: "DELETE",
      prefer: "return=minimal"
    });
    return setJson(res, 200, { ok: true });
  }

  res.setHeader("Allow", "GET, POST, PATCH, DELETE");
  return setJson(res, 405, { ok: false, error: "Method not allowed." });
}

async function handleResolve(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return setJson(res, 405, { ok: false, error: "Method not allowed." });
  }
  const slug = normalizeSlug(new URL(req.url, SITE_URL).searchParams.get("slug"));
  if (!slug) return setJson(res, 400, { ok: false, error: "Invalid gallery URL." });
  const gallery = await getGalleryBySlug(slug);
  if (!gallery || !gallery.enabled) return unavailable(res);
  if (gallery.password_hash && !hasValidSession(req, gallery)) {
    return setJson(res, 401, { ok: false, status: "locked", requiresAccessCode: true });
  }
  return setJson(res, 200, toPublicGallery(gallery));
}

async function handleAccess(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return setJson(res, 405, { ok: false, error: "Method not allowed." });
  }
  if (!checkRateLimit(accessBuckets, req, ACCESS_WINDOW_MS, ACCESS_MAX_ATTEMPTS)) {
    return setJson(res, 429, { ok: false, error: "Too many attempts. Please wait and try again." });
  }
  enforceBodyLimit(req);
  const body = parseBody(req.body);
  const slug = normalizeSlug(body.slug);
  const accessCode = String(body.accessCode || "").slice(0, 200);
  const gallery = slug ? await getGalleryBySlug(slug) : null;
  if (!gallery || !gallery.enabled) return unavailable(res);
  if (!gallery.password_hash) return setJson(res, 200, toPublicGallery(gallery));
  if (!verifyPassword(accessCode, gallery.password_hash)) {
    return setJson(res, 401, { ok: false, status: "locked", error: "That access code is not correct." });
  }
  if (!SESSION_SECRET) {
    return setJson(res, 503, { ok: false, error: "Gallery access is not configured yet. Please contact Booth Fairy Miami." });
  }
  const token = signSession(gallery);
  const maxAge = getSessionMaxAge(gallery);
  res.setHeader("Set-Cookie", `${cookieName(gallery.id)}=${token}; Path=/api/gallery; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`);
  return setJson(res, 200, toPublicGallery(gallery));
}

async function handleEvent(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return setJson(res, 405, { ok: false, error: "Method not allowed." });
  }
  if (!checkRateLimit(eventBuckets, req, EVENT_WINDOW_MS, EVENT_MAX_ATTEMPTS)) {
    return setJson(res, 202, { ok: true });
  }
  enforceBodyLimit(req);
  const body = parseBody(req.body);
  const slug = normalizeSlug(body.slug);
  const gallery = slug ? await getGalleryBySlug(slug) : null;
  if (!gallery || !gallery.enabled) return setJson(res, 202, { ok: true });

  const eventType = String(body.eventType || "");
  if (!["gallery_visit", "button_click", "booking_inquiry"].includes(eventType)) {
    return setJson(res, 400, { ok: false, error: "Invalid gallery event." });
  }
  const sessionId = sanitizeToken(body.sessionId, 100);
  const buttonName = eventType === "button_click" ? sanitizeToken(body.buttonName, 80) : null;
  try {
    await supabaseAdmin("/gallery_events", {
      method: "POST",
      body: {
        gallery_id: gallery.id,
        event_type: eventType,
        button_name: buttonName || null,
        session_id: sessionId || null
      },
      prefer: "return=minimal"
    });
  } catch (error) {
    if (error.statusCode !== 409) throw error;
  }
  return setJson(res, 202, { ok: true });
}

function buildGalleryPayload(body, existing) {
  const slug = normalizeSlug(body.slug);
  const title = cleanText(body.title, 160);
  const embedInput = String(body.touchpixEmbedCode || body.touchpix_embed_url || existing?.touchpix_embed_url || "");
  const touchpixEmbedUrl = validateTouchpixEmbed(embedInput);
  const eventDate = normalizeDate(body.eventDate);
  const expiresAt = normalizeDateTime(body.expiresAt);
  const enabled = body.enabled !== false;
  if (!slug) throw badRequest("Use a URL slug with lowercase letters, numbers, and hyphens.");
  if (!title) throw badRequest("Gallery title is required.");
  if (!touchpixEmbedUrl) throw badRequest("Paste a valid HTTPS Touchpix iframe embed code or Touchpix gallery URL.");
  if (enabled && expiresAt && Date.parse(expiresAt) <= Date.now()) {
    throw badRequest("Expiration date must be in the future. For a 2026 event with six months of access, check that the expiration year is 2027.");
  }
  if (eventDate && expiresAt && Date.parse(expiresAt) < Date.parse(`${eventDate}T00:00:00Z`)) {
    throw badRequest("Expiration date must be after the event date.");
  }

  const payload = {
    slug,
    title,
    client_name: cleanText(body.clientName, 160) || null,
    event_date: eventDate,
    welcome_message: cleanText(body.welcomeMessage, 1200) || DEFAULT_GALLERY_WELCOME,
    expiration_notice: cleanText(body.expirationNotice, 500) || DEFAULT_EXPIRATION_NOTICE,
    expired_message: cleanText(body.expiredMessage, 800) || DEFAULT_EXPIRED_MESSAGE,
    touchpix_embed_url: touchpixEmbedUrl,
    enabled,
    expires_at: expiresAt
  };

  const accessCode = String(body.accessCode || "");
  if (accessCode) {
    if (accessCode.length < 6 || accessCode.length > 200) {
      throw badRequest("Access codes must be between 6 and 200 characters.");
    }
    payload.password_hash = hashPassword(accessCode);
  } else if (body.removePassword) {
    payload.password_hash = null;
  } else if (!existing) {
    payload.password_hash = null;
  }
  return payload;
}

function validateTouchpixEmbed(value) {
  const input = String(value || "").trim();
  const iframeMatch = input.match(/<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/i);
  const candidate = iframeMatch?.[1] || (/^https:\/\//i.test(input) ? input : "");
  if (!candidate) return "";
  try {
    const url = new URL(candidate);
    const configured = String(process.env.TOUCHPIX_ALLOWED_HOSTS || "")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean);
    const host = url.hostname.toLowerCase();
    const allowed = host === "touchpix.com"
      || host.endsWith(".touchpix.com")
      || host === "phtbth-upload.com"
      || host.endsWith(".phtbth-upload.com")
      || configured.some((item) => host === item || host.endsWith(`.${item}`));
    if (url.protocol !== "https:" || url.username || url.password || !allowed) return "";
    return url.toString();
  } catch {
    return "";
  }
}

function toPublicGallery(gallery) {
  const expired = isExpired(gallery);
  const response = {
    ok: true,
    status: expired ? "expired" : "active",
    gallery: {
      slug: gallery.slug,
      title: gallery.title,
      clientName: gallery.client_name || "",
      eventDate: gallery.event_date || "",
      welcomeMessage: gallery.welcome_message || DEFAULT_GALLERY_WELCOME,
      expirationNotice: gallery.expiration_notice || DEFAULT_EXPIRATION_NOTICE,
      expiresAt: gallery.expires_at || "",
      expiredMessage: gallery.expired_message || DEFAULT_EXPIRED_MESSAGE
    }
  };
  if (!expired) response.gallery.embedUrl = gallery.touchpix_embed_url;
  return response;
}

function toAdminGallery(gallery, analytics = {}) {
  return {
    id: gallery.id,
    slug: gallery.slug,
    title: gallery.title,
    clientName: gallery.client_name || "",
    eventDate: gallery.event_date || "",
    welcomeMessage: gallery.welcome_message || DEFAULT_GALLERY_WELCOME,
    expirationNotice: gallery.expiration_notice || DEFAULT_EXPIRATION_NOTICE,
    expiredMessage: gallery.expired_message || DEFAULT_EXPIRED_MESSAGE,
    touchpixEmbedUrl: gallery.touchpix_embed_url,
    enabled: gallery.enabled,
    expiresAt: gallery.expires_at || "",
    hasPassword: Boolean(gallery.password_hash),
    createdAt: gallery.created_at,
    updatedAt: gallery.updated_at,
    analytics: {
      visits: analytics.visits || 0,
      buttonClicks: analytics.buttonClicks || 0,
      bookingInquiries: analytics.bookingInquiries || 0
    }
  };
}

function summarizeEvents(events) {
  return events.reduce((summary, event) => {
    const item = summary[event.gallery_id] || { visits: 0, buttonClicks: 0, bookingInquiries: 0 };
    if (event.event_type === "gallery_visit") item.visits += 1;
    if (event.event_type === "button_click") item.buttonClicks += 1;
    if (event.event_type === "booking_inquiry") item.bookingInquiries += 1;
    summary[event.gallery_id] = item;
    return summary;
  }, {});
}

async function getGalleryBySlug(slug) {
  const rows = await supabaseAdmin(`/client_galleries?slug=eq.${encodeURIComponent(slug)}&select=*&limit=1`, { method: "GET" });
  return rows?.[0] || null;
}

async function getGalleryById(id) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id || ""))) return null;
  const rows = await supabaseAdmin(`/client_galleries?id=eq.${encodeURIComponent(id)}&select=*&limit=1`, { method: "GET" });
  return rows?.[0] || null;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("base64url");
  const derived = crypto.scryptSync(password, salt, 64).toString("base64url");
  return `scrypt$${salt}$${derived}`;
}

function verifyPassword(password, stored) {
  const [algorithm, salt, expected] = String(stored || "").split("$");
  if (algorithm !== "scrypt" || !salt || !expected) return false;
  const actual = crypto.scryptSync(String(password || ""), salt, 64);
  const expectedBuffer = Buffer.from(expected, "base64url");
  return actual.length === expectedBuffer.length && crypto.timingSafeEqual(actual, expectedBuffer);
}

function signSession(gallery) {
  const payload = Buffer.from(JSON.stringify({
    id: gallery.id,
    updatedAt: gallery.updated_at,
    exp: Date.now() + getSessionMaxAge(gallery) * 1000
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function hasValidSession(req, gallery) {
  if (!SESSION_SECRET) return false;
  const token = parseCookies(req.headers.cookie || "")[cookieName(gallery.id)];
  if (!token) return false;
  const [payload, suppliedSignature] = token.split(".");
  if (!payload || !suppliedSignature) return false;
  const expectedSignature = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest();
  const suppliedBuffer = Buffer.from(suppliedSignature, "base64url");
  if (expectedSignature.length !== suppliedBuffer.length || !crypto.timingSafeEqual(expectedSignature, suppliedBuffer)) return false;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return session.id === gallery.id
      && session.updatedAt === gallery.updated_at
      && Number(session.exp) > Date.now();
  } catch {
    return false;
  }
}

function getSessionMaxAge(gallery) {
  const sevenDays = 7 * 24 * 60 * 60;
  if (!gallery.expires_at) return sevenDays;
  const remaining = Math.floor((Date.parse(gallery.expires_at) - Date.now()) / 1000);
  return Math.max(60, Math.min(sevenDays, remaining));
}

function getRoute(req) {
  const pathname = new URL(req.url, SITE_URL).pathname;
  return pathname.replace(/^\/api\/gallery\/?/, "").replace(/\/+$/, "");
}

function isAllowedOrigin(req) {
  const origin = String(req.headers.origin || "");
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;
  const requestHost = String(req.headers.host || "").trim().toLowerCase();
  if (requestHost && origin === `https://${requestHost}`) return true;
  return process.env.VERCEL_ENV !== "production" && /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(origin);
}

function setSecurityHeaders(res) {
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet, noimageindex");
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("X-Content-Type-Options", "nosniff");
}

function enforceBodyLimit(req) {
  if (Number(req.headers["content-length"] || 0) > MAX_BODY_BYTES) {
    const error = new Error("Request is too large.");
    error.statusCode = 413;
    throw error;
  }
}

function checkRateLimit(buckets, req, windowMs, maxAttempts) {
  const now = Date.now();
  const key = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  current.count += 1;
  return current.count <= maxAttempts;
}

function parseBody(body) {
  if (body && typeof body === "object") return body;
  try {
    return JSON.parse(String(body || "{}"));
  } catch {
    throw badRequest("Invalid request body.");
  }
}

function parseCookies(value) {
  return String(value || "").split(";").reduce((cookies, part) => {
    const index = part.indexOf("=");
    if (index < 0) return cookies;
    cookies[part.slice(0, index).trim()] = part.slice(index + 1).trim();
    return cookies;
  }, {});
}

function cookieName(id) {
  return `${ACCESS_COOKIE_PREFIX}${String(id).replace(/-/g, "").slice(0, 20)}`;
}

function isExpired(gallery) {
  return Boolean(gallery.expires_at && Date.parse(gallery.expires_at) <= Date.now());
}

function unavailable(res) {
  return setJson(res, 404, {
    ok: false,
    status: "unavailable",
    error: "This gallery is not available. Please check the private link or contact Booth Fairy Miami."
  });
}

function normalizeSlug(value) {
  const slug = String(value || "").trim().toLowerCase();
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 120 ? slug : "";
}

function normalizeDate(value) {
  const clean = String(value || "").trim();
  if (!clean) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean) || Number.isNaN(Date.parse(`${clean}T00:00:00Z`))) {
    throw badRequest("Event date is invalid.");
  }
  return clean;
}

function normalizeDateTime(value) {
  const clean = String(value || "").trim();
  if (!clean) return null;
  const parsed = Date.parse(clean);
  if (Number.isNaN(parsed)) throw badRequest("Expiration date is invalid.");
  return new Date(parsed).toISOString();
}

function cleanText(value, maxLength) {
  return String(value || "").trim().replace(/\u0000/g, "").slice(0, maxLength);
}

function sanitizeToken(value, maxLength) {
  return String(value || "").replace(/[^a-z0-9_-]/gi, "").slice(0, maxLength);
}

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}
