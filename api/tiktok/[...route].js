const crypto = require("crypto");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://hwwhyrpwfewxevocjjzk.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3d2h5cnB3ZmV3eGV2b2NqanprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MDAzMDksImV4cCI6MjA5NDk3NjMwOX0.-55qhrFYuzcAqQRhO01oxP4EJP3jyR9qU-qNDW_pAxI";
const ADMIN_EMAILS = ["boothfairyllc@gmail.com"];
const TIKTOK_CLIENT_KEY = cleanEnv(process.env.TIKTOK_CLIENT_KEY);
const TIKTOK_CLIENT_SECRET = cleanEnv(process.env.TIKTOK_CLIENT_SECRET);
const TIKTOK_TOKEN_SECRET = cleanEnv(process.env.TIKTOK_TOKEN_SECRET);
const TIKTOK_REDIRECT_URI = cleanEnv(process.env.TIKTOK_REDIRECT_URI)
  || "https://www.boothfairymiami.com/api/tiktok/callback";
const OAUTH_COOKIE = "bfm_tiktok_oauth";
const CONNECTION_COOKIE = "bfm_tiktok_connection";
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const ALLOWED_MEDIA_HOSTS = new Set(["www.boothfairymiami.com", "boothfairymiami.com"]);

module.exports = async (req, res) => {
  const route = getRoute(req);
  if (!route || route === "status") return handleStatus(req, res);
  if (route === "connect") return handleConnect(req, res);
  if (route === "callback") return handleCallback(req, res);
  if (route === "disconnect") return handleDisconnect(req, res);
  if (route === "upload") return handleUpload(req, res);
  return sendJson(res, 404, { ok: false, error: "TikTok route not found." });
};

module.exports.config = {
  maxDuration: 60
};

async function handleStatus(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  const configured = Boolean(TIKTOK_CLIENT_KEY && TIKTOK_CLIENT_SECRET && TIKTOK_TOKEN_SECRET);
  if (!configured) {
    return sendJson(res, 200, { ok: true, configured: false, connected: false });
  }

  try {
    const connection = readConnection(req);
    if (!connection) {
      return sendJson(res, 200, { ok: true, configured: true, connected: false });
    }

    const current = await getCurrentConnection(connection);
    if (current.updated) setConnectionCookie(res, current.connection);
    const profile = await fetchTikTokProfile(current.connection.accessToken);
    return sendJson(res, 200, {
      ok: true,
      configured: true,
      connected: true,
      displayName: profile.display_name || current.connection.displayName || "boothfairymiami",
      avatarUrl: profile.avatar_url || "",
      scopes: normalizeScopes(current.connection.scope),
      mode: "Sandbox",
      directPost: false
    });
  } catch (error) {
    clearConnectionCookie(res);
    return sendJson(res, 200, {
      ok: true,
      configured: true,
      connected: false,
      error: error.message || "TikTok connection needs to be renewed."
    });
  }
}

async function handleConnect(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    requireTikTokConfig();
    if (!await verifyAdminRequest(req)) {
      return sendJson(res, 401, { ok: false, error: "Admin authentication required." });
    }

    const state = crypto.randomBytes(24).toString("hex");
    setCookie(res, OAUTH_COOKIE, state, { maxAge: 600 });
    const params = new URLSearchParams({
      client_key: TIKTOK_CLIENT_KEY,
      response_type: "code",
      scope: "user.info.basic,video.upload",
      redirect_uri: TIKTOK_REDIRECT_URI,
      state
    });
    return sendJson(res, 200, {
      ok: true,
      authorizeUrl: `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`
    });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, {
      ok: false,
      error: error.message || "Could not start TikTok connection."
    });
  }
}

async function handleCallback(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.end("Method not allowed");
  }

  const url = new URL(req.url, "https://www.boothfairymiami.com");
  const state = String(req.query?.state || url.searchParams.get("state") || "");
  const code = String(req.query?.code || url.searchParams.get("code") || "");
  const oauthError = String(req.query?.error_description || req.query?.error || url.searchParams.get("error_description") || url.searchParams.get("error") || "");
  const cookieState = readCookies(req.headers.cookie)[OAUTH_COOKIE] || "";
  clearCookie(res, OAUTH_COOKIE);

  if (oauthError) {
    return redirectToAdmin(res, "tiktok_error", oauthError);
  }
  if (!code || !state || !cookieState || !timingSafeEqual(state, cookieState)) {
    return redirectToAdmin(res, "tiktok_error", "Invalid TikTok OAuth state.");
  }

  try {
    requireTikTokConfig();
    const tokens = await exchangeAuthorizationCode(code);
    const scopes = normalizeScopes(tokens.scope);
    if (!scopes.includes("video.upload")) {
      throw new Error("TikTok did not grant the required video.upload permission.");
    }

    const profile = await fetchTikTokProfile(tokens.access_token);
    setConnectionCookie(res, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      openId: tokens.open_id,
      scope: tokens.scope,
      displayName: profile.display_name || "boothfairymiami",
      expiresAt: Date.now() + Math.max(Number(tokens.expires_in || 86400) - 120, 60) * 1000
    });
    return redirectToAdmin(res, "tiktok_connected", "1");
  } catch (error) {
    return redirectToAdmin(res, "tiktok_error", error.message || "Could not finish TikTok connection.");
  }
}

async function handleDisconnect(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  }
  if (!await verifyAdminRequest(req)) {
    return sendJson(res, 401, { ok: false, error: "Admin authentication required." });
  }
  clearConnectionCookie(res);
  return sendJson(res, 200, { ok: true });
}

async function handleUpload(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    if (!await verifyAdminRequest(req)) {
      return sendJson(res, 401, { ok: false, error: "Admin authentication required." });
    }

    const connection = readConnection(req);
    if (!connection) {
      return sendJson(res, 400, { ok: false, error: "Connect the TikTok Sandbox account first." });
    }

    const body = parseBody(req.body);
    const mediaUrl = validateMediaUrl(body.videoUrl);
    const current = await getCurrentConnection(connection);
    if (current.updated) setConnectionCookie(res, current.connection);

    const mediaResponse = await fetch(mediaUrl, {
      redirect: "follow",
      headers: { "User-Agent": "BoothFairyMiami-TikTokUploader/1.0" }
    });
    if (!mediaResponse.ok) {
      throw withStatus(new Error(`Could not download the selected media (HTTP ${mediaResponse.status}).`), 400);
    }
    validateMediaUrl(mediaResponse.url || mediaUrl);

    const contentLength = Number(mediaResponse.headers.get("content-length") || 0);
    if (contentLength > MAX_VIDEO_BYTES) {
      throw withStatus(new Error("The selected demo video is larger than 50 MB."), 413);
    }

    const mediaBytes = Buffer.from(await mediaResponse.arrayBuffer());
    if (!mediaBytes.length || mediaBytes.length > MAX_VIDEO_BYTES) {
      throw withStatus(new Error("The selected video must be between 1 byte and 50 MB."), 413);
    }

    const initResponse = await fetch("https://open.tiktokapis.com/v2/post/publish/inbox/video/init/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${current.connection.accessToken}`,
        "Content-Type": "application/json; charset=UTF-8"
      },
      body: JSON.stringify({
        source_info: {
          source: "FILE_UPLOAD",
          video_size: mediaBytes.length,
          chunk_size: mediaBytes.length,
          total_chunk_count: 1
        }
      })
    });
    const initPayload = await parseResponse(initResponse);
    if (!initResponse.ok || initPayload?.error?.code !== "ok" || !initPayload?.data?.upload_url) {
      throw tikTokError(initPayload, "TikTok could not initialize the draft upload.");
    }

    const uploadResponse = await fetch(initPayload.data.upload_url, {
      method: "PUT",
      headers: {
        "Content-Type": normalizeVideoContentType(mediaResponse.headers.get("content-type"), mediaUrl),
        "Content-Length": String(mediaBytes.length),
        "Content-Range": `bytes 0-${mediaBytes.length - 1}/${mediaBytes.length}`
      },
      body: mediaBytes
    });
    if (!uploadResponse.ok) {
      const details = await uploadResponse.text().catch(() => "");
      throw withStatus(new Error(`TikTok media transfer failed (HTTP ${uploadResponse.status}). ${details}`.trim()), 502);
    }

    return sendJson(res, 200, {
      ok: true,
      publishId: initPayload.data.publish_id,
      status: "PROCESSING_UPLOAD",
      message: "Video sent to TikTok. Open the TikTok inbox notification to review and finish the draft."
    });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, {
      ok: false,
      error: error.message || "TikTok draft upload failed.",
      details: error.details || null
    });
  }
}

async function exchangeAuthorizationCode(code) {
  const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: TIKTOK_CLIENT_KEY,
      client_secret: TIKTOK_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: TIKTOK_REDIRECT_URI
    })
  });
  const payload = await parseResponse(response);
  if (!response.ok || !payload?.access_token) {
    throw tikTokError(payload, "TikTok token exchange failed.");
  }
  return payload;
}

async function refreshConnection(connection) {
  const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: TIKTOK_CLIENT_KEY,
      client_secret: TIKTOK_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: connection.refreshToken
    })
  });
  const payload = await parseResponse(response);
  if (!response.ok || !payload?.access_token) {
    throw tikTokError(payload, "TikTok connection expired.");
  }
  return {
    ...connection,
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token || connection.refreshToken,
    openId: payload.open_id || connection.openId,
    scope: payload.scope || connection.scope,
    expiresAt: Date.now() + Math.max(Number(payload.expires_in || 86400) - 120, 60) * 1000
  };
}

async function getCurrentConnection(connection) {
  if (connection.accessToken && Number(connection.expiresAt || 0) > Date.now() + 60_000) {
    return { connection, updated: false };
  }
  if (!connection.refreshToken) throw new Error("TikTok connection expired. Connect the account again.");
  return { connection: await refreshConnection(connection), updated: true };
}

async function fetchTikTokProfile(accessToken) {
  const response = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const payload = await parseResponse(response);
  if (!response.ok || payload?.error?.code !== "ok") {
    throw tikTokError(payload, "Could not read the connected TikTok profile.");
  }
  return payload?.data?.user || {};
}

async function verifyAdminRequest(req) {
  const authHeader = req.headers.authorization || "";
  const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!accessToken) return false;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`
    }
  });
  if (!response.ok) return false;
  const payload = await response.json();
  return ADMIN_EMAILS.includes(String(payload?.email || "").toLowerCase());
}

function validateMediaUrl(value) {
  let url;
  try {
    url = new URL(String(value || ""));
  } catch {
    throw withStatus(new Error("Choose a valid Booth Fairy video URL."), 400);
  }
  if (url.protocol !== "https:" || !ALLOWED_MEDIA_HOSTS.has(url.hostname.toLowerCase())) {
    throw withStatus(new Error("TikTok uploads are limited to media hosted on boothfairymiami.com."), 400);
  }
  return url.toString();
}

function normalizeVideoContentType(value, mediaUrl) {
  const contentType = String(value || "").split(";")[0].trim().toLowerCase();
  if (["video/mp4", "video/quicktime"].includes(contentType)) return contentType;
  return new URL(mediaUrl).pathname.toLowerCase().endsWith(".mov") ? "video/quicktime" : "video/mp4";
}

function readConnection(req) {
  const encrypted = readCookies(req.headers.cookie)[CONNECTION_COOKIE];
  if (!encrypted) return null;
  return decryptJson(encrypted);
}

function setConnectionCookie(res, connection) {
  setCookie(res, CONNECTION_COOKIE, encryptJson(connection), { maxAge: 365 * 24 * 60 * 60 });
}

function clearConnectionCookie(res) {
  clearCookie(res, CONNECTION_COOKIE);
}

function encryptJson(value) {
  requireTikTokConfig();
  const key = crypto.createHash("sha256").update(TIKTOK_TOKEN_SECRET).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

function decryptJson(value) {
  try {
    const data = Buffer.from(value, "base64url");
    const key = crypto.createHash("sha256").update(TIKTOK_TOKEN_SECRET).digest();
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, data.subarray(0, 12));
    decipher.setAuthTag(data.subarray(12, 28));
    return JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString("utf8"));
  } catch {
    throw new Error("TikTok connection cookie is invalid. Connect the account again.");
  }
}

function setCookie(res, name, value, options = {}) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  appendSetCookie(res, `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${options.maxAge || 600}`);
}

function clearCookie(res, name) {
  appendSetCookie(res, `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

function appendSetCookie(res, cookie) {
  const current = res.getHeader("Set-Cookie");
  res.setHeader("Set-Cookie", current ? [...(Array.isArray(current) ? current : [current]), cookie] : cookie);
}

function readCookies(header = "") {
  return String(header || "").split(";").reduce((cookies, part) => {
    const separator = part.indexOf("=");
    if (separator < 0) return cookies;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (name) cookies[name] = decodeURIComponent(value);
    return cookies;
  }, {});
}

function timingSafeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function redirectToAdmin(res, key, value) {
  const params = new URLSearchParams({ [key]: value, section: "content" });
  res.writeHead(302, { Location: `/admin?${params.toString()}` });
  return res.end();
}

function getRoute(req) {
  const route = req.query?.route;
  if (Array.isArray(route)) return route.join("/");
  if (route) return String(route);
  return new URL(req.url, "https://www.boothfairymiami.com").pathname.split("/").filter(Boolean).pop() || "status";
}

function parseBody(body) {
  if (!body) return {};
  if (typeof body === "object") return body;
  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
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

function tikTokError(payload, fallback) {
  const error = withStatus(new Error(
    payload?.error_description
      || payload?.error?.message
      || payload?.message
      || fallback
  ), 502);
  error.details = payload?.error || payload || null;
  return error;
}

function normalizeScopes(value) {
  if (Array.isArray(value)) return value;
  return String(value || "").split(/[ ,]+/).map((scope) => scope.trim()).filter(Boolean);
}

function requireTikTokConfig() {
  const missing = [
    !TIKTOK_CLIENT_KEY && "TIKTOK_CLIENT_KEY",
    !TIKTOK_CLIENT_SECRET && "TIKTOK_CLIENT_SECRET",
    !TIKTOK_TOKEN_SECRET && "TIKTOK_TOKEN_SECRET"
  ].filter(Boolean);
  if (missing.length) throw new Error(`Missing ${missing.join(", ")} environment variable${missing.length === 1 ? "" : "s"}.`);
}

function cleanEnv(value) {
  return String(value || "").trim().replace(/^['"]+|['"]+$/g, "");
}

function withStatus(error, statusCode) {
  error.statusCode = statusCode;
  return error;
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}
