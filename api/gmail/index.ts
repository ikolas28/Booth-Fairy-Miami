export const gmailIntegration = {
  provider: "gmail",
  status: "oauth-ready",
  purpose: "Connect the Booth Fairy inbox, sync labeled inquiries, and turn Gmail messages into CRM leads.",
  routes: [
    "GET /api/gmail/status",
    "GET /api/gmail/connect",
    "GET /api/gmail/callback",
    "POST /api/gmail/sync",
    "POST /api/gmail/disconnect"
  ]
};
