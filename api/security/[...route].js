const {
  setJson,
  verifyAdminRequest
} = require("../gmail/_lib");

const WEBSITE_RATE_LIMIT_WINDOW_MINUTES = 10;
const WEBSITE_RATE_LIMIT_MAX = 8;

module.exports = async (req, res) => {
  const route = getRoute(req);
  if (route !== "rate-limit") {
    return setJson(res, 404, { ok: false, error: "Security route not found." });
  }
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return setJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    if (!await verifyAdminRequest(req)) {
      return setJson(res, 401, { ok: false, error: "Admin authentication required." });
    }

    return setJson(res, 200, {
      ok: true,
      websiteLeadIntake: {
        endpoint: "/api/website/lead",
        turnstile: Boolean(process.env.TURNSTILE_SECRET_KEY),
        maxRequests: WEBSITE_RATE_LIMIT_MAX,
        windowMinutes: WEBSITE_RATE_LIMIT_WINDOW_MINUTES,
        note: "This is an in-function safety limit. Add Vercel Firewall or Cloudflare WAF rules later for stronger edge-level rate limiting."
      }
    });
  } catch (error) {
    return setJson(res, error.statusCode || 500, {
      ok: false,
      error: error.message || "Could not load security rate-limit status."
    });
  }
};

function getRoute(req) {
  const pathname = new URL(req.url, "https://www.boothfairymiami.com").pathname;
  return pathname.split("/").filter(Boolean).slice(2).join("/");
}
