const receptionist = require("./_receptionist");
const marketing = require("./_marketing");

module.exports = async (req, res) => {
  const route = getRoute(req);
  if (route === "receptionist") return receptionist(req, res);
  if (route === "marketing") return marketing(req, res);
  res.statusCode = 404;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ ok: false, error: "Cron route not found." }));
};

function getRoute(req) {
  const pathname = new URL(req.url, "https://www.boothfairymiami.com").pathname;
  return pathname.split("/").filter(Boolean).slice(2).join("/");
}
