const {
  findDuplicateLead,
  recordLeadDuplicate
} = require("../_lead-utils");
const {
  setJson,
  supabaseAdmin,
  verifyAdminRequest
} = require("../gmail/_lib");

module.exports = async (req, res) => {
  const route = getRoute(req);
  if (route !== "dedupe") {
    return setJson(res, 404, { ok: false, error: "Lead route not found." });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return setJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    if (!await verifyAdminRequest(req)) {
      return setJson(res, 401, { ok: false, error: "Admin authentication required." });
    }

    const body = typeof req.body === "string" ? safeParse(req.body) : req.body || {};
    const lead = body.lead || body;
    const duplicate = await findDuplicateLead(supabaseAdmin, lead);
    if (duplicate && body.record !== false) {
      await recordLeadDuplicate(supabaseAdmin, lead, duplicate, "admin_dedupe");
    }

    return setJson(res, 200, {
      ok: true,
      duplicateFound: Boolean(duplicate),
      duplicate: duplicate || null
    });
  } catch (error) {
    return setJson(res, error.statusCode || 500, {
      ok: false,
      error: error.message || "Could not check lead duplicates.",
      details: error.details || null
    });
  }
};

function getRoute(req) {
  const pathname = new URL(req.url, "https://www.boothfairymiami.com").pathname;
  return pathname.split("/").filter(Boolean).slice(2).join("/");
}

function safeParse(value) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return {};
  }
}
