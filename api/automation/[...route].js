const {
  setJson,
  supabaseAdmin,
  verifyAdminRequest
} = require("../gmail/_lib");

module.exports = async (req, res) => {
  const route = getRoute(req);
  if (route !== "run-log") {
    return setJson(res, 404, { ok: false, error: "Automation route not found." });
  }

  try {
    if (!await verifyAdminRequest(req)) {
      return setJson(res, 401, { ok: false, error: "Admin authentication required." });
    }

    if (req.method === "GET") return listRuns(req, res);
    if (req.method === "POST") return createRun(req, res);

    res.setHeader("Allow", "GET, POST");
    return setJson(res, 405, { ok: false, error: "Method not allowed" });
  } catch (error) {
    return setJson(res, error.statusCode || 500, {
      ok: false,
      error: error.message || "Could not access automation run logs.",
      details: error.details || null
    });
  }
};

async function listRuns(req, res) {
  const limit = clampNumber(new URL(req.url, "https://www.boothfairymiami.com").searchParams.get("limit"), 1, 100, 50);
  const rows = await supabaseAdmin(`/automation_runs?select=*&order=started_at.desc&limit=${limit}`, { method: "GET" });
  return setJson(res, 200, { ok: true, automationRuns: rows || [] });
}

async function createRun(req, res) {
  const body = typeof req.body === "string" ? safeParse(req.body) : req.body || {};
  const record = {
    agent: normalizeAgent(body.agent || body.automationName || body.automation_name),
    status: String(body.status || "completed").slice(0, 50),
    summary: body.summary || {},
    started_at: body.startedAt || body.started_at || new Date().toISOString(),
    completed_at: body.completedAt || body.completed_at || new Date().toISOString()
  };
  const rows = await supabaseAdmin("/automation_runs", { method: "POST", body: record });
  return setJson(res, 201, { ok: true, automationRun: rows?.[0] || null });
}

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

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function normalizeAgent(value) {
  const text = String(value || "").toLowerCase();
  if (text.includes("market")) return "marketing";
  if (text.includes("reception")) return "receptionist";
  return ["receptionist", "marketing", "system"].includes(text) ? text : "system";
}
