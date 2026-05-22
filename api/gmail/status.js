const { getStatusPayload, setJson } = require("./_lib");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return setJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const payload = await getStatusPayload();
    return setJson(res, 200, payload);
  } catch (error) {
    return setJson(res, error.statusCode || 500, {
      ok: false,
      error: error.message || "Could not read Gmail integration status."
    });
  }
};
