const {
  GMAIL_ACCOUNT_EMAIL,
  OAUTH_STATE_COOKIE,
  buildGoogleOauthUrl,
  clearConnection,
  createOauthState,
  exchangeCodeForTokens,
  expiresAtFromSeconds,
  fetchGmailMessage,
  fetchGoogleUserInfo,
  getGmailImportDecision,
  getStatusPayload,
  getValidGmailAccessToken,
  hasImportedMessage,
  importMessageAsLead,
  listGmailMessages,
  recordSkippedGmailImport,
  saveConnection,
  setJson,
  supabaseAdmin,
  verifyAdminRequest
} = require("./_lib");

const CRON_SECRET = process.env.CRON_SECRET;

module.exports = async (req, res) => {
  const route = getRoute(req);
  if (route === "connect") return handleConnect(req, res);
  if (route === "callback") return handleCallback(req, res);
  if (route === "disconnect") return handleDisconnect(req, res);
  if (route === "status") return handleStatus(req, res);
  if (route === "sync") return handleSync(req, res);
  if (route === "refresh-drafts") return handleRefreshDrafts(req, res);
  return setJson(res, 404, { ok: false, error: "Gmail route not found." });
};

async function handleConnect(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.statusCode = 405;
    return res.end("Method not allowed");
  }

  try {
    const state = createOauthState();
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    res.setHeader("Set-Cookie", `${OAUTH_STATE_COOKIE}=${state}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=600`);
    res.writeHead(302, { Location: buildGoogleOauthUrl(state) });
    return res.end();
  } catch (error) {
    const message = encodeURIComponent(error.message || "Could not start Gmail connection.");
    res.writeHead(302, { Location: `/admin?gmail_error=${message}` });
    return res.end();
  }
}

async function handleCallback(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.statusCode = 405;
    return res.end("Method not allowed");
  }

  const url = new URL(req.url, "https://www.boothfairymiami.com");
  const state = req.query?.state || url.searchParams.get("state") || "";
  const code = req.query?.code || url.searchParams.get("code") || "";
  const error = req.query?.error || url.searchParams.get("error") || "";
  const cookieState = readCookie(req.headers.cookie, OAUTH_STATE_COOKIE);
  const clearCookie = `${OAUTH_STATE_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

  if (error) {
    res.setHeader("Set-Cookie", clearCookie);
    res.writeHead(302, { Location: `/admin?gmail_error=${encodeURIComponent(error)}` });
    return res.end();
  }

  if (!code || !state || !cookieState || state !== cookieState) {
    res.setHeader("Set-Cookie", clearCookie);
    res.writeHead(302, { Location: "/admin?gmail_error=Invalid%20Gmail%20OAuth%20state" });
    return res.end();
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const userInfo = await fetchGoogleUserInfo(tokens.access_token);
    const connectedEmail = (userInfo?.email || "").toLowerCase();

    if (connectedEmail !== GMAIL_ACCOUNT_EMAIL) {
      res.setHeader("Set-Cookie", clearCookie);
      res.writeHead(302, {
        Location: `/admin?gmail_error=${encodeURIComponent(`Connect the approved Gmail inbox: ${GMAIL_ACCOUNT_EMAIL}`)}`
      });
      return res.end();
    }

    await saveConnection({
      connectedEmail,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenType: tokens.token_type,
      scope: tokens.scope,
      expiresAt: expiresAtFromSeconds(tokens.expires_in),
      connectedAt: new Date().toISOString()
    });

    res.setHeader("Set-Cookie", clearCookie);
    res.writeHead(302, { Location: "/admin?gmail_connected=1" });
    return res.end();
  } catch (callbackError) {
    res.setHeader("Set-Cookie", clearCookie);
    res.writeHead(302, {
      Location: `/admin?gmail_error=${encodeURIComponent(callbackError.message || "Could not finish Gmail connection.")}`
    });
    return res.end();
  }
}

async function handleDisconnect(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return setJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    if (!await verifyAdminRequest(req)) {
      return setJson(res, 401, { ok: false, error: "Admin authentication required." });
    }

    await clearConnection();
    return setJson(res, 200, { ok: true });
  } catch (error) {
    return setJson(res, error.statusCode || 500, {
      ok: false,
      error: error.message || "Could not disconnect Gmail."
    });
  }
}

async function handleStatus(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return setJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    return setJson(res, 200, await getStatusPayload());
  } catch (error) {
    return setJson(res, error.statusCode || 500, {
      ok: false,
      error: error.message || "Could not read Gmail integration status."
    });
  }
}

async function handleSync(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return setJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    if (!await verifyAdminRequest(req)) {
      return setJson(res, 401, { ok: false, error: "Admin authentication required." });
    }

    const connection = await getValidGmailAccessToken();
    if (!connection) {
      return setJson(res, 400, { ok: false, error: "Gmail is not connected yet." });
    }

    const messages = await listGmailMessages(connection.accessToken, connection.query);
    let importedCount = 0;
    let skippedCount = 0;
    let ignoredCount = 0;

    for (const messageSummary of messages) {
      if (await hasImportedMessage(messageSummary.id)) {
        skippedCount += 1;
        continue;
      }

      const message = await fetchGmailMessage(connection.accessToken, messageSummary.id);
      const decision = getGmailImportDecision(message);
      if (!decision.shouldImport) {
        await recordSkippedGmailImport(message, decision.reason);
        skippedCount += 1;
        ignoredCount += 1;
        continue;
      }

      await importMessageAsLead(message);
      importedCount += 1;
    }

    return setJson(res, 200, {
      ok: true,
      importedCount,
      skippedCount,
      ignoredCount,
      scannedCount: messages.length
    });
  } catch (error) {
    return setJson(res, error.statusCode || 500, {
      ok: false,
      error: error.message || "Gmail sync failed.",
      details: error.details || null
    });
  }
}

async function handleRefreshDrafts(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return setJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    if (!await verifyAdminRequest(req)) {
      return setJson(res, 401, { ok: false, error: "Admin authentication required." });
    }

    const connection = await getValidGmailAccessToken();
    if (!connection) {
      return setJson(res, 400, { ok: false, error: "Gmail is not connected yet." });
    }

    const draftRows = await supabaseAdmin("/message_history?draft_created=eq.true&channel=eq.Gmail&select=id,notes,subject,lead_id&order=created_at.desc&limit=50", { method: "GET" });
    const liveDraftIds = await listGmailDraftIds(connection.accessToken);
    let checked = 0;
    let removed = 0;
    let missingDraftId = 0;
    const errors = [];

    for (const row of draftRows || []) {
      const draftId = extractDraftId(row.notes);
      if (!draftId) {
        missingDraftId += 1;
        removed += 1;
        await clearDraftApproval(row, "Draft approval removed because no Gmail draft ID was stored for verification.");
        continue;
      }
      checked += 1;
      if (!liveDraftIds.has(draftId)) {
        removed += 1;
        await clearDraftApproval(row, `Draft removed from Approvals because it is not in Gmail's active draft list as of ${new Date().toISOString()}.`);
        continue;
      }

      const result = await gmailDraftExists(connection.accessToken, draftId);
      if (result.error) {
        errors.push({ draftId, error: result.error });
        continue;
      }
      const exists = result.exists;
      if (exists) continue;

      removed += 1;
      await clearDraftApproval(row, `Draft removed from Gmail or no longer accessible on ${new Date().toISOString()}.`);
    }

    return setJson(res, 200, {
      ok: true,
      totalDraftApprovals: draftRows?.length || 0,
      liveDraftCount: liveDraftIds.size,
      checked,
      removed,
      missingDraftId,
      errors
    });
  } catch (error) {
    return setJson(res, error.statusCode || 500, {
      ok: false,
      error: error.message || "Could not refresh Gmail draft approvals.",
      details: error.details || null
    });
  }
}

async function listGmailDraftIds(accessToken) {
  const ids = new Set();
  let pageToken = "";
  do {
    const params = new URLSearchParams({ maxResults: "100" });
    if (pageToken) params.set("pageToken", pageToken);
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/drafts?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(payload?.error?.message || "Could not list Gmail drafts.");
      error.details = payload;
      error.statusCode = response.status;
      throw error;
    }
    for (const draft of payload?.drafts || []) {
      if (draft.id) ids.add(draft.id);
    }
    pageToken = payload?.nextPageToken || "";
  } while (pageToken);
  return ids;
}

async function gmailDraftExists(accessToken, draftId) {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/drafts/${encodeURIComponent(draftId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (response.status === 404 || response.status === 410) return { exists: false };
  if (response.ok) return { exists: true };
  const payload = await response.json().catch(() => null);
  const message = payload?.error?.message || "";
  if (/not found|requested entity was not found|not exist|deleted/i.test(message)) {
    return { exists: false };
  }
  return { exists: true, error: message || `Gmail draft lookup failed with ${response.status}.` };
}

async function clearDraftApproval(row, note) {
  await supabaseAdmin(`/message_history?id=eq.${encodeURIComponent(row.id)}`, {
    method: "PATCH",
    body: {
      draft_created: false,
      notes: [row.notes, note].filter(Boolean).join("\n")
    }
  });
}

function extractDraftId(notes) {
  return String(notes || "").match(/Gmail draft ID:\s*([A-Za-z0-9_-]+)/i)?.[1] || "";
}

function getRoute(req) {
  const pathname = new URL(req.url, "https://www.boothfairymiami.com").pathname;
  return pathname.split("/").filter(Boolean).slice(2).join("/");
}

function readCookie(header, name) {
  const source = header || "";
  const parts = source.split(";").map((item) => item.trim());
  const entry = parts.find((item) => item.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : "";
}
