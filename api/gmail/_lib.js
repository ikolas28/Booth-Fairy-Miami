const crypto = require("crypto");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://hwwhyrpwfewxevocjjzk.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3d2h5cnB3ZmV3eGV2b2NqanprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MDAzMDksImV4cCI6MjA5NDk3NjMwOX0.-55qhrFYuzcAqQRhO01oxP4EJP3jyR9qU-qNDW_pAxI";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GMAIL_ACCOUNT_EMAIL = (process.env.GMAIL_ACCOUNT_EMAIL || "info@boothfairymiami.com").toLowerCase();
const GMAIL_SYNC_QUERY = process.env.GMAIL_SYNC_QUERY || "label:CRM-Lead";
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || "https://www.boothfairymiami.com/api/gmail/callback";
const ADMIN_EMAILS = ["boothfairyllc@gmail.com"];
const OAUTH_STATE_COOKIE = "bfm_gmail_oauth_state";

function setJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function requireEnv(name, value) {
  if (!value) {
    const error = new Error(`Missing ${name} environment variable`);
    error.statusCode = 500;
    throw error;
  }
}

async function supabaseAdmin(path, options = {}) {
  requireEnv("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY);
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

function createOauthState() {
  return crypto.randomBytes(24).toString("hex");
}

function buildGoogleOauthUrl(state) {
  requireEnv("GOOGLE_CLIENT_ID", GOOGLE_CLIENT_ID);
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/gmail.readonly"
    ].join(" "),
    state
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function exchangeCodeForTokens(code) {
  requireEnv("GOOGLE_CLIENT_ID", GOOGLE_CLIENT_ID);
  requireEnv("GOOGLE_CLIENT_SECRET", GOOGLE_CLIENT_SECRET);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code"
    })
  });

  const payload = await parseResponse(response);
  if (!response.ok) {
    const error = new Error(payload?.error_description || payload?.error || "Google token exchange failed.");
    error.details = payload;
    error.statusCode = response.status;
    throw error;
  }
  return payload;
}

async function refreshAccessToken(refreshToken) {
  requireEnv("GOOGLE_CLIENT_ID", GOOGLE_CLIENT_ID);
  requireEnv("GOOGLE_CLIENT_SECRET", GOOGLE_CLIENT_SECRET);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    })
  });
  const payload = await parseResponse(response);
  if (!response.ok) {
    const error = new Error(payload?.error_description || payload?.error || "Google refresh token request failed.");
    error.details = payload;
    error.statusCode = response.status;
    throw error;
  }
  return payload;
}

async function fetchGoogleUserInfo(accessToken) {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const payload = await parseResponse(response);
  if (!response.ok) {
    const error = new Error(payload?.error_description || payload?.error || "Google user info request failed.");
    error.details = payload;
    error.statusCode = response.status;
    throw error;
  }
  return payload;
}

async function getStoredConnection() {
  const rows = await supabaseAdmin("/gmail_connections?id=eq.primary&select=*", {
    method: "GET",
    prefer: "return=representation"
  });
  return rows?.[0] || null;
}

async function saveConnection(connection) {
  const record = {
    id: "primary",
    connected_email: connection.connectedEmail,
    access_token: connection.accessToken,
    refresh_token: connection.refreshToken,
    token_type: connection.tokenType || "Bearer",
    scope: connection.scope || null,
    expires_at: connection.expiresAt || null,
    connected_at: connection.connectedAt || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  await supabaseAdmin("/gmail_connections", {
    method: "POST",
    body: record,
    prefer: "resolution=merge-duplicates,return=representation"
  });
}

async function clearConnection() {
  await supabaseAdmin("/gmail_connections?id=eq.primary", { method: "DELETE" });
}

function expiresAtFromSeconds(expiresIn) {
  if (!expiresIn) return null;
  return new Date(Date.now() + Number(expiresIn) * 1000).toISOString();
}

async function getValidGmailAccessToken() {
  const connection = await getStoredConnection();
  if (!connection) return null;

  const expiresAt = connection.expires_at ? Date.parse(connection.expires_at) : 0;
  if (connection.access_token && expiresAt && expiresAt > Date.now() + 60_000) {
    return {
      accessToken: connection.access_token,
      connectedEmail: connection.connected_email,
      scope: connection.scope,
      query: GMAIL_SYNC_QUERY
    };
  }

  const refreshed = await refreshAccessToken(connection.refresh_token);
  const nextAccessToken = refreshed.access_token;
  const nextRefreshToken = refreshed.refresh_token || connection.refresh_token;

  await saveConnection({
    connectedEmail: connection.connected_email,
    accessToken: nextAccessToken,
    refreshToken: nextRefreshToken,
    tokenType: refreshed.token_type || connection.token_type,
    scope: refreshed.scope || connection.scope,
    expiresAt: expiresAtFromSeconds(refreshed.expires_in),
    connectedAt: connection.connected_at
  });

  return {
    accessToken: nextAccessToken,
    connectedEmail: connection.connected_email,
    scope: refreshed.scope || connection.scope,
    query: GMAIL_SYNC_QUERY
  };
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
  return ADMIN_EMAILS.includes((payload?.email || "").toLowerCase());
}

async function listGmailMessages(accessToken, query) {
  const params = new URLSearchParams({
    userId: "me",
    maxResults: "20",
    q: query
  });
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const payload = await parseResponse(response);
  if (!response.ok) {
    const error = new Error(payload?.error?.message || "Could not list Gmail messages.");
    error.details = payload;
    error.statusCode = response.status;
    throw error;
  }
  return payload?.messages || [];
}

async function fetchGmailMessage(accessToken, id) {
  const params = new URLSearchParams({
    format: "metadata",
    metadataHeaders: ["From", "Subject", "Date"]
  });
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const payload = await parseResponse(response);
  if (!response.ok) {
    const error = new Error(payload?.error?.message || "Could not fetch Gmail message.");
    error.details = payload;
    error.statusCode = response.status;
    throw error;
  }
  return payload;
}

function getHeader(message, name) {
  const headers = message?.payload?.headers || [];
  return headers.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value || "";
}

function extractEmail(fromHeader) {
  const match = fromHeader.match(/<([^>]+)>/);
  return (match?.[1] || fromHeader || "").trim();
}

function extractName(fromHeader) {
  const email = extractEmail(fromHeader);
  const cleaned = fromHeader.replace(/<[^>]+>/, "").replace(/"/g, "").trim();
  return cleaned || email || "Gmail Lead";
}

async function hasImportedMessage(messageId) {
  const rows = await supabaseAdmin(`/gmail_imports?gmail_message_id=eq.${encodeURIComponent(messageId)}&select=id`, {
    method: "GET",
    prefer: "return=representation"
  });
  return Array.isArray(rows) && rows.length > 0;
}

async function importMessageAsLead(message) {
  const fromHeader = getHeader(message, "From");
  const subject = getHeader(message, "Subject");
  const leadEmail = extractEmail(fromHeader);
  const clientName = extractName(fromHeader);
  const leadPayload = {
    client_name: clientName || "Gmail Lead",
    phone: "Not provided",
    email: leadEmail || "not-provided@boothfairymiami.com",
    event_type: "General Inquiry",
    event_date: null,
    venue: null,
    city: null,
    service_requested: "Luxury DSLR Digital Booth",
    guest_count: 0,
    budget: 0,
    notes: [
      subject ? `Subject: ${subject}` : "",
      message.snippet ? `Snippet: ${message.snippet}` : "",
      `Gmail message ID: ${message.id}`,
      message.threadId ? `Gmail thread ID: ${message.threadId}` : ""
    ].filter(Boolean).join("\n"),
    status: "New Lead",
    payment_status: "Not Requested",
    calendar_checked: false,
    source: "Gmail"
  };

  const insertedLead = await supabaseAdmin("/leads", {
    method: "POST",
    body: leadPayload
  });
  const leadId = insertedLead?.[0]?.id || null;

  await supabaseAdmin("/gmail_imports", {
    method: "POST",
    body: {
      gmail_message_id: message.id,
      gmail_thread_id: message.threadId || null,
      lead_id: leadId,
      subject: subject || null,
      from_email: leadEmail || null
    }
  });

  return leadId;
}

async function getStatusPayload() {
  const connection = await getStoredConnection();
  return {
    ok: true,
    configured: Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && SUPABASE_SERVICE_ROLE_KEY),
    connected: Boolean(connection),
    connectedEmail: connection?.connected_email || "",
    syncQuery: GMAIL_SYNC_QUERY,
    allowedMailbox: GMAIL_ACCOUNT_EMAIL,
    lastUpdatedAt: connection?.updated_at || null
  };
}

module.exports = {
  ADMIN_EMAILS,
  GMAIL_ACCOUNT_EMAIL,
  GMAIL_SYNC_QUERY,
  OAUTH_STATE_COOKIE,
  buildGoogleOauthUrl,
  clearConnection,
  createOauthState,
  exchangeCodeForTokens,
  expiresAtFromSeconds,
  extractEmail,
  fetchGoogleUserInfo,
  fetchGmailMessage,
  getStatusPayload,
  getStoredConnection,
  getValidGmailAccessToken,
  hasImportedMessage,
  importMessageAsLead,
  listGmailMessages,
  saveConnection,
  setJson,
  verifyAdminRequest
};
