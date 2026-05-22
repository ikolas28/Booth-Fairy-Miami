const {
  fetchGmailMessage,
  getValidGmailAccessToken,
  hasImportedMessage,
  importMessageAsLead,
  listGmailMessages,
  setJson,
  verifyAdminRequest
} = require("./_lib");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return setJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const isAdmin = await verifyAdminRequest(req);
    if (!isAdmin) {
      return setJson(res, 401, { ok: false, error: "Admin authentication required." });
    }

    const connection = await getValidGmailAccessToken();
    if (!connection) {
      return setJson(res, 400, { ok: false, error: "Gmail is not connected yet." });
    }

    const messages = await listGmailMessages(connection.accessToken, connection.query);
    let importedCount = 0;
    let skippedCount = 0;

    for (const messageSummary of messages) {
      const alreadyImported = await hasImportedMessage(messageSummary.id);
      if (alreadyImported) {
        skippedCount += 1;
        continue;
      }

      const message = await fetchGmailMessage(connection.accessToken, messageSummary.id);
      await importMessageAsLead(message);
      importedCount += 1;
    }

    return setJson(res, 200, {
      ok: true,
      importedCount,
      skippedCount,
      scannedCount: messages.length
    });
  } catch (error) {
    return setJson(res, error.statusCode || 500, {
      ok: false,
      error: error.message || "Gmail sync failed.",
      details: error.details || null
    });
  }
};
