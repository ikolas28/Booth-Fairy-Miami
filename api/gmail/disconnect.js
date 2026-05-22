const { clearConnection, setJson, verifyAdminRequest } = require("./_lib");

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

    await clearConnection();
    return setJson(res, 200, { ok: true });
  } catch (error) {
    return setJson(res, error.statusCode || 500, {
      ok: false,
      error: error.message || "Could not disconnect Gmail."
    });
  }
};
