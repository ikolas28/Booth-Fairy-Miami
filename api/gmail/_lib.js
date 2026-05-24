const crypto = require("crypto");
const {
  findDuplicateLead,
  insertLeadWithFallback,
  patchLeadWithFallback,
  recordLeadDuplicate,
  recordLeadScore,
  withLeadIntelligence
} = require("../_lead-utils");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://hwwhyrpwfewxevocjjzk.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3d2h5cnB3ZmV3eGV2b2NqanprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MDAzMDksImV4cCI6MjA5NDk3NjMwOX0.-55qhrFYuzcAqQRhO01oxP4EJP3jyR9qU-qNDW_pAxI";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GMAIL_ACCOUNT_EMAIL = (process.env.GMAIL_ACCOUNT_EMAIL || "info@boothfairymiami.com").toLowerCase();
const GMAIL_SYNC_QUERY = normalizeGmailSyncQuery(process.env.GMAIL_SYNC_QUERY);
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || "https://www.boothfairymiami.com/api/gmail/callback";
const ADMIN_EMAILS = ["boothfairyllc@gmail.com"];
const OAUTH_STATE_COOKIE = "bfm_gmail_oauth_state";
const DEFAULT_IGNORED_GMAIL_SENDERS = [
  "notification@facebookmail.com",
  "noreply@business.facebook.com",
  "info@email.manychat.com",
  "no-reply@accounts.google.com",
  "no-reply@google.com",
  "noreply@google.com",
  "no-reply@stripe.com",
  "noreply@stripe.com",
  "support@stripe.com",
  "facebookmail.com",
  "business.facebook.com",
  "email.manychat.com",
  "manychat.com",
  "instagram.com",
  "instagrammail.com",
  "stripe.com",
  "google.com",
  "accounts.google.com",
  "wix.com",
  "squarespace.com"
];
const GMAIL_IGNORED_SENDERS = parseIgnoredSenders(process.env.GMAIL_IGNORED_SENDERS);

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
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.compose",
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/calendar.freebusy",
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/drive.file"
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
    maxResults: "50",
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
  const params = new URLSearchParams();
  params.set("format", "full");
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
  return normalizeEmail(match?.[1] || fromHeader || "");
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

function parseIgnoredSenders(value = "") {
  const configured = value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set([...DEFAULT_IGNORED_GMAIL_SENDERS, ...configured])];
}

function buildDefaultGmailSyncQuery() {
  return `newer_than:30d {label:CRM-Lead to:${GMAIL_ACCOUNT_EMAIL}}`;
}

function normalizeGmailSyncQuery(value = "") {
  const configured = String(value || "").trim();
  if (!configured || configured === "label:CRM-Lead") {
    return buildDefaultGmailSyncQuery();
  }
  return configured;
}

function normalizeEmail(value) {
  return String(value || "").trim().replace(/^mailto:/i, "").toLowerCase();
}

function getEmailDomain(email) {
  return normalizeEmail(email).split("@").pop() || "";
}

function isIgnoredGmailSender(email) {
  const normalizedEmail = normalizeEmail(email);
  const domain = getEmailDomain(normalizedEmail);
  return GMAIL_IGNORED_SENDERS.some((blocked) => {
    if (!blocked) return false;
    if (blocked.includes("@")) return normalizedEmail === blocked;
    return domain === blocked || domain.endsWith(`.${blocked}`);
  });
}

function getGmailImportDecision(message) {
  const fromHeader = getHeader(message, "From");
  const senderHeader = getHeader(message, "Sender");
  const fromEmail = extractEmail(fromHeader);
  const senderEmail = extractEmail(senderHeader);
  const subject = getHeader(message, "Subject");

  if ([GMAIL_ACCOUNT_EMAIL, ...ADMIN_EMAILS].includes(fromEmail) || [GMAIL_ACCOUNT_EMAIL, ...ADMIN_EMAILS].includes(senderEmail)) {
    return {
      shouldImport: false,
      reason: `Skipped Booth Fairy outbound message: ${fromEmail || senderEmail || "unknown sender"}`,
      fromEmail,
      subject
    };
  }

  if (isIgnoredGmailSender(fromEmail) || isIgnoredGmailSender(senderEmail) || isIgnoredSystemNotification(message, subject)) {
    return {
      shouldImport: false,
      reason: `Skipped system notification sender: ${fromEmail || senderEmail || "unknown sender"}`,
      fromEmail,
      subject
    };
  }

  return {
    shouldImport: true,
    reason: "",
    fromEmail,
    subject
  };
}

function isIgnoredSystemNotification(message, subject = "") {
  const text = [
    subject,
    message?.snippet || "",
    getReadableMessageText(message).slice(0, 1200)
  ].join(" ").toLowerCase();
  return [
    "your stripe verification link",
    "unrecognized device signed in to your stripe account",
    "security alert",
    "2-step verification",
    "verification code",
    "app password created",
    "catch up on moments you've missed",
    "recently added to their stories",
    "see what's been happening on instagram",
    "squarespace verification code"
  ].some((phrase) => text.includes(phrase));
}

async function recordSkippedGmailImport(message, reason) {
  const decision = getGmailImportDecision(message);
  await supabaseAdmin("/gmail_imports", {
    method: "POST",
    body: {
      gmail_message_id: message.id,
      gmail_thread_id: message.threadId || null,
      lead_id: null,
      subject: `[Skipped] ${decision.subject || reason || "Non-lead Gmail message"}`.slice(0, 500),
      from_email: decision.fromEmail || null
    },
    prefer: "resolution=ignore-duplicates,return=minimal"
  });
}

async function importMessageAsLead(message) {
  const decision = getGmailImportDecision(message);
  if (!decision.shouldImport) {
    await recordSkippedGmailImport(message, decision.reason);
    return null;
  }

  const fromHeader = getHeader(message, "From");
  const subject = decision.subject;
  const leadEmail = decision.fromEmail;
  const clientName = extractName(fromHeader);
  const extracted = extractLeadDetailsFromGmail(message, subject);
  const readableBody = getReadableMessageText(message);
  const readableSummary = buildReadableEmailSummary({ subject, snippet: message.snippet, body: readableBody });
  const leadPayload = withLeadIntelligence({
    client_name: clientName || "Gmail Lead",
    phone: extracted.phone || "Not provided",
    email: leadEmail || "not-provided@boothfairymiami.com",
    event_type: extracted.eventType || "General Inquiry",
    event_date: extracted.eventDate || null,
    start_time: extracted.startTime || null,
    end_time: extracted.endTime || null,
    venue: extracted.venue || null,
    city: extracted.city || null,
    service_requested: extracted.serviceRequested || "DSLR Photo Booth - Digital Sharing",
    guest_count: 0,
    budget: 0,
    notes: [
      subject ? `Subject: ${subject}` : "",
      readableSummary ? `Email summary: ${readableSummary}` : "",
      extracted.eventDate ? `Client-provided event date: ${extracted.eventDate}` : "",
      extracted.startTime ? `Client-provided start time: ${extracted.startTime}` : "",
      extracted.bookingIntent ? "Client indicated booking intent." : "",
      `Gmail message ID: ${message.id}`,
      message.threadId ? `Gmail thread ID: ${message.threadId}` : "",
      getMissingInfoLine(extracted),
      "Do not confirm availability until calendar is checked."
    ].filter(Boolean).join("\n"),
    status: getInitialGmailStatus(extracted),
    payment_status: "Not Requested",
    calendar_checked: false,
    source: "Gmail"
  });

  const existingLead = await findExistingLeadForGmail(message, leadPayload);
  if (existingLead) {
    if (existingLead.matchReason !== "gmail_thread") {
      await recordLeadDuplicate(supabaseAdmin, leadPayload, existingLead, "gmail");
    }
    await updateExistingLeadFromGmail(existingLead.id, leadPayload, extracted, message, subject, fromHeader);
    await supabaseAdmin("/gmail_imports", {
      method: "POST",
      body: {
        gmail_message_id: message.id,
        gmail_thread_id: message.threadId || null,
        lead_id: existingLead.id,
        subject: existingLead.matchReason === "gmail_thread" ? `[Reply] ${subject || "Gmail reply"}` : `[Duplicate] ${subject || "Gmail lead"}`,
        from_email: leadEmail || null
      },
      prefer: "resolution=ignore-duplicates,return=minimal"
    });
    return existingLead.id;
  }

  const insertedLead = await insertLeadWithFallback(supabaseAdmin, leadPayload);
  const leadId = insertedLead?.[0]?.id || null;
  if (leadId) {
    await recordLeadScore(supabaseAdmin, leadId, leadPayload, "Gmail lead captured");
  }

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

  try {
    await supabaseAdmin("/message_history", {
      method: "POST",
      body: {
        lead_id: leadId,
        message_at: message.internalDate ? new Date(Number(message.internalDate)).toISOString() : new Date().toISOString(),
        channel: "Gmail",
        direction: "Inbound",
        from_value: fromHeader || leadEmail || null,
        to_value: GMAIL_ACCOUNT_EMAIL,
        subject: subject || null,
        gmail_thread_id: message.threadId || null,
        gmail_message_id: message.id,
        summary: readableSummary || message.snippet || subject || "Imported Gmail lead.",
        draft_created: false,
        notes: "Imported by Gmail lead sync."
      }
    });
  } catch {
    // Keep Gmail lead intake working if the optional message history table has not been migrated yet.
  }

  return leadId;
}

async function findExistingLeadForGmail(message, leadPayload) {
  const threadLead = await findLeadByGmailThread(message.threadId);
  if (threadLead) return { ...threadLead, matchReason: "gmail_thread" };

  const duplicate = await findDuplicateLead(supabaseAdmin, { ...leadPayload, event_date: null });
  return duplicate ? { ...duplicate, matchReason: "email_or_phone" } : null;
}

async function findLeadByGmailThread(threadId) {
  if (!threadId) return null;

  const imports = await supabaseAdmin(`/gmail_imports?gmail_thread_id=eq.${encodeURIComponent(threadId)}&lead_id=not.is.null&select=lead_id&order=imported_at.desc&limit=1`, { method: "GET" }).catch(() => []);
  const importedLeadId = imports?.[0]?.lead_id;
  if (importedLeadId) {
    const lead = await fetchLeadById(importedLeadId);
    if (lead) return lead;
  }

  const history = await supabaseAdmin(`/message_history?gmail_thread_id=eq.${encodeURIComponent(threadId)}&lead_id=not.is.null&select=lead_id&order=created_at.desc&limit=1`, { method: "GET" }).catch(() => []);
  const historyLeadId = history?.[0]?.lead_id;
  return historyLeadId ? fetchLeadById(historyLeadId) : null;
}

async function fetchLeadById(leadId) {
  const rows = await supabaseAdmin(`/leads?id=eq.${encodeURIComponent(leadId)}&select=id,lead_code,email,phone,event_date,status&limit=1`, { method: "GET" }).catch(() => []);
  return rows?.[0] || null;
}

async function updateExistingLeadFromGmail(leadId, leadPayload, extracted, message, subject, fromHeader) {
  const rows = await supabaseAdmin(`/leads?id=eq.${encodeURIComponent(leadId)}&select=*&limit=1`, { method: "GET" });
  const existing = rows?.[0] || {};
  const patch = {};
  const readableSummary = buildReadableEmailSummary({
    subject,
    snippet: message.snippet,
    body: getReadableMessageText(message)
  });
  const noteLines = [
    `Client Gmail reply imported ${new Date().toISOString()}.`,
    subject ? `Subject: ${subject}` : "",
    readableSummary ? `Email says: ${readableSummary}` : "",
    extracted.eventDate ? `Updated event date from reply: ${extracted.eventDate}` : "",
    extracted.startTime ? `Client-provided start time: ${extracted.startTime}` : "",
    extracted.bookingIntent ? "Client indicated booking intent." : "",
    `Gmail message ID: ${message.id}`,
    message.threadId ? `Gmail thread ID: ${message.threadId}` : ""
  ].filter(Boolean);

  if (extracted.eventDate) patch.event_date = extracted.eventDate;
  if (extracted.startTime) patch.start_time = extracted.startTime;
  if (extracted.endTime) patch.end_time = extracted.endTime;
  if (extracted.serviceRequested) patch.service_requested = extracted.serviceRequested;
  if (extracted.eventType && (!existing.event_type || existing.event_type === "General Inquiry")) patch.event_type = extracted.eventType;
  if (extracted.phone && (!existing.phone || existing.phone === "Not provided")) patch.phone = extracted.phone;
  if (extracted.city && !existing.city) patch.city = extracted.city;
  if (extracted.venue && !existing.venue) patch.venue = extracted.venue;

  const nextLead = { ...existing, ...patch };
  const missing = getMissingDetails(nextLead);
  if (missing.length) {
    patch.status = "Missing Info";
    noteLines.push(`Missing info to request: ${missing.join(", ")}`);
  } else if (extracted.bookingIntent && !["Deposit Pending", "Deposit Paid", "Booked", "Paid", "Completed", "Lost"].includes(existing.status)) {
    patch.status = "Follow-Up Needed";
  }

  patch.notes = [existing.notes, noteLines.join("\n")].filter(Boolean).join("\n\n");
  const intelligent = withLeadIntelligence({ ...existing, ...patch });
  patch.tags = intelligent.tags;
  patch.lead_score = intelligent.lead_score;

  await patchLeadWithFallback(supabaseAdmin, leadId, patch);
  await recordLeadScore(supabaseAdmin, leadId, { ...existing, ...patch }, "Gmail reply updated existing lead");

  try {
    await supabaseAdmin("/message_history", {
      method: "POST",
      body: {
        lead_id: leadId,
        message_at: message.internalDate ? new Date(Number(message.internalDate)).toISOString() : new Date().toISOString(),
        channel: "Gmail",
        direction: "Inbound",
        from_value: fromHeader || leadPayload.email || null,
        to_value: GMAIL_ACCOUNT_EMAIL,
        subject: subject || null,
        gmail_thread_id: message.threadId || null,
        gmail_message_id: message.id,
        summary: readableSummary || message.snippet || subject || "Gmail reply updated existing lead.",
        draft_created: false,
        notes: "Updated existing lead instead of creating a duplicate."
      }
    });
  } catch {
    // Optional message history table should not block lead update.
  }
}

function extractLeadDetailsFromGmail(message, subject = "") {
  const text = `${subject || ""}\n${message?.snippet || ""}\n${getReadableMessageText(message)}`;
  const timeRange = extractTimeRange(text);
  return {
    eventDate: extractEventDate(text),
    startTime: timeRange.startTime || extractStartTime(text),
    endTime: timeRange.endTime,
    phone: extractPhone(text),
    serviceRequested: inferServiceRequested(text),
    eventType: inferEventType(text),
    city: inferCity(text),
    venue: "",
    bookingIntent: /\b(book|booking|reserve|ready|retainer|deposit|invoice|agreement|contract)\b/i.test(text)
  };
}

function buildReadableEmailSummary({ subject = "", snippet = "", body = "" } = {}) {
  const text = normalizeEmailBody(body || snippet || "");
  const cleanSubject = String(subject || "").trim();
  const excerpt = text.length > 900 ? `${text.slice(0, 900).trim()}...` : text;
  return [cleanSubject ? `Subject: ${cleanSubject}` : "", excerpt ? `Message: ${excerpt}` : ""]
    .filter(Boolean)
    .join("\n");
}

function getReadableMessageText(message) {
  const payload = message?.payload || {};
  const textPart = findMessagePart(payload, "text/plain");
  const htmlPart = textPart ? null : findMessagePart(payload, "text/html");
  const raw = decodeGmailBody(textPart?.body?.data || htmlPart?.body?.data || payload.body?.data || "");
  return htmlPart && !textPart ? htmlToText(raw) : normalizeEmailBody(raw);
}

function findMessagePart(part, mimeType) {
  if (!part) return null;
  if (part.mimeType === mimeType && part.body?.data) return part;
  for (const child of part.parts || []) {
    const found = findMessagePart(child, mimeType);
    if (found) return found;
  }
  return null;
}

function decodeGmailBody(value) {
  if (!value) return "";
  try {
    const normalized = String(value).replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(normalized, "base64").toString("utf8");
  } catch {
    return "";
  }
}

function htmlToText(value) {
  return normalizeEmailBody(String(value || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'"));
}

function normalizeEmailBody(value) {
  return String(value || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !/^on .+ wrote:$/i.test(line) && !/^>/.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractTimeRange(text) {
  const source = String(text || "");
  const match = source.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|–|—|to|until)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (!match) return { startTime: "", endTime: "" };

  const endSuffix = match[6].toLowerCase();
  const startSuffix = (match[3] || endSuffix).toLowerCase();
  return {
    startTime: formatClockTime(match[1], match[2], startSuffix),
    endTime: formatClockTime(match[4], match[5], endSuffix)
  };
}

function extractEventDate(text) {
  const source = String(text || "");
  const iso = source.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) return validIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const slash = source.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](20\d{2}|\d{2})\b/);
  if (!slash) return "";
  const month = Number(slash[1]);
  const day = Number(slash[2]);
  let year = Number(slash[3]);
  if (year < 100) year += 2000;
  return validIsoDate(year, month, day);
}

function validIsoDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "";
  return date.toISOString().slice(0, 10);
}

function extractStartTime(text) {
  const match = String(text || "").match(/\b(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (!match) return "";
  return formatClockTime(match[1], match[2], match[3]);
}

function formatClockTime(hourValue, minuteValue, suffixValue) {
  let hour = Number(hourValue);
  const minute = Number(minuteValue || 0);
  const suffix = String(suffixValue || "").toLowerCase();
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return "";
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return "";
  if (suffix === "pm" && hour < 12) hour += 12;
  if (suffix === "am" && hour === 12) hour = 0;
  if (hour < 0 || hour > 23) return "";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function extractPhone(text) {
  const match = String(text || "").match(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/);
  return match?.[0] || "";
}

function inferServiceRequested(text) {
  const source = String(text || "").toLowerCase();
  const wantsNoDj = /\b(no dj|without dj|not dj|no d\.?j\.?)\b/.test(source);
  const wantsDj = /\bdj\b/.test(source) && !wantsNoDj;
  const wantsBooth = /\b(dslr|photo booth|photobooth|booth|digital booth)\b/.test(source);
  if (wantsBooth && wantsDj) return "Photo Booth + DJ Bundle";
  if (wantsDj && !wantsBooth) return "Premium DJ Services";
  if (wantsBooth || wantsNoDj) return "DSLR Photo Booth - Digital Sharing";
  return "";
}

function inferEventType(text) {
  const source = String(text || "").toLowerCase();
  if (source.includes("wedding")) return "Wedding";
  if (source.includes("quince")) return "Quinceañera";
  if (source.includes("birthday")) return "Birthday";
  if (source.includes("corporate")) return "Corporate Event";
  if (source.includes("baby shower")) return "Baby Shower";
  return "";
}

function inferCity(text) {
  const source = String(text || "").toLowerCase();
  const cities = ["miami", "hialeah", "doral", "brickell", "wynwood", "coral gables", "miami beach", "homestead", "aventura", "hollywood", "hallandale"];
  return cities.find((city) => source.includes(city)) || "";
}

function getInitialGmailStatus(extracted) {
  return getMissingDetails({
    event_date: extracted.eventDate,
    phone: extracted.phone || "Not provided",
    venue: extracted.venue,
    city: extracted.city
  }).length ? "Missing Info" : "New Lead";
}

function getMissingInfoLine(extracted) {
  const missing = getMissingDetails({
    event_date: extracted.eventDate,
    phone: extracted.phone || "Not provided",
    venue: extracted.venue,
    city: extracted.city
  });
  return missing.length ? `Missing info to request: ${missing.join(", ")}` : "";
}

function getMissingDetails(lead) {
  const missing = [];
  if (!lead.event_date) missing.push("event date");
  if (!lead.venue && !lead.city) missing.push("venue/city");
  if (!lead.phone || lead.phone === "Not provided") missing.push("phone number");
  return missing;
}

async function getStatusPayload() {
  const connection = await getStoredConnection();
  return {
    ok: true,
    configured: Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && SUPABASE_SERVICE_ROLE_KEY),
    connected: Boolean(connection),
    connectedEmail: connection?.connected_email || "",
    driveFileScope: String(connection?.scope || "").includes("drive.file"),
    syncQuery: GMAIL_SYNC_QUERY,
    allowedMailbox: GMAIL_ACCOUNT_EMAIL,
    lastUpdatedAt: connection?.updated_at || null
  };
}

module.exports = {
  ADMIN_EMAILS,
  GMAIL_ACCOUNT_EMAIL,
  GMAIL_IGNORED_SENDERS,
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
  getGmailImportDecision,
  hasImportedMessage,
  importMessageAsLead,
  listGmailMessages,
  recordSkippedGmailImport,
  saveConnection,
  setJson,
  supabaseAdmin,
  verifyAdminRequest
};
