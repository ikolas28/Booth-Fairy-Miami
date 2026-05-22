const {
  OAUTH_STATE_COOKIE,
  buildGoogleOauthUrl,
  createOauthState
} = require("./_lib");

module.exports = async (req, res) => {
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
    res.end();
  } catch (error) {
    const message = encodeURIComponent(error.message || "Could not start Gmail connection.");
    res.writeHead(302, { Location: `/admin?gmail_error=${message}` });
    res.end();
  }
};
