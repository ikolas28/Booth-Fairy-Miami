export const tidioIntegration = {
  provider: "tidio",
  status: "scaffolded",
  purpose: "Capture website chat leads for CRM follow-up.",
  endpoint: "/api/tidio/lead",
  notes: [
    "Use Tidio Flows -> API call action with POST /api/tidio/lead",
    "Protect the endpoint with the TIDIO_WEBHOOK_SECRET bearer token",
    "Set SUPABASE_SERVICE_ROLE_KEY in Vercel before using the endpoint"
  ],
};
