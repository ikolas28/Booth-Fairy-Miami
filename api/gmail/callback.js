const {
  GMAIL_ACCOUNT_EMAIL,
  OAUTH_STATE_COOKIE,
  exchangeCodeForTokens,
  expiresAtFromSeconds,
  fetchGoogleUserInfo,
  saveConnection
} = require("./_lib");

function readCookie(header, name) {
  const source = header || "";
  const parts = source.split(";").map((item) => item.trim());
  const entry = parts.find((item) => item.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : "";
}

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.statusCode = 405;
    return res.end("Method not allowed");
  }

  const state = req.query?.state || "";
  const code = req.query?.code || "";
  const error = req.query?.error || "";
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
};
