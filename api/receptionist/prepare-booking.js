const {
  getValidGmailAccessToken,
  setJson,
  verifyAdminRequest
} = require("../gmail/_lib");

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const SERVICE_AGREEMENT_URL = process.env.SERVICE_AGREEMENT_URL || "https://www.boothfairymiami.com/client-agreement.html";
const SERVICE_AGREEMENT_ENGLISH_PDF_URL = process.env.SERVICE_AGREEMENT_ENGLISH_PDF_URL || "https://www.boothfairymiami.com/assets/contracts/booth-fairy-miami-service-agreement-english.pdf";
const SERVICE_AGREEMENT_SPANISH_PDF_URL = process.env.SERVICE_AGREEMENT_SPANISH_PDF_URL || "https://www.boothfairymiami.com/assets/contracts/booth-fairy-miami-acuerdo-de-servicios-espanol.pdf";
const SITE_URL = process.env.SITE_URL || "https://www.boothfairymiami.com";
const CRM_LEAD_LABELS = [
  "CRM-Lead",
  "CRM-Lead/Booked",
  "CRM-Lead/Booking Interest",
  "CRM-Lead/Deposit Pending",
  "CRM-Lead/Follow-Up Needed",
  "CRM-Lead/Lost",
  "CRM-Lead/Missing Info",
  "CRM-Lead/New",
  "CRM-Lead/Processed",
  "CRM-Lead/Quote Needed"
];

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

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const lead = normalizeLead(body.lead || {});
    if (!lead.email || lead.email === "Not provided") {
      return setJson(res, 400, { ok: false, error: "Lead needs a client email before drafting contract and deposit steps." });
    }
    if (lead.calendarChecked !== "Yes") {
      return setJson(res, 400, { ok: false, error: "Calendar must be checked before preparing contract and deposit." });
    }

    const depositAmount = normalizeDepositAmount(body.depositAmount, lead);
    const payment = await createStripeCheckoutSession(lead, depositAmount);
    const draft = await createGmailDraftIfPossible(lead, depositAmount, payment.url);

    return setJson(res, 200, {
      ok: true,
      contractUrl: SERVICE_AGREEMENT_URL,
      depositAmount,
      paymentUrl: payment.url,
      stripeSessionId: payment.sessionId || "",
      stripePaymentIntentId: payment.paymentIntentId || "",
      paymentReady: Boolean(payment.url),
      paymentSkippedReason: payment.skippedReason || "",
      gmailDraftId: draft.id,
      gmailDraftMessageId: draft.messageId || "",
      gmailDraftThreadId: draft.threadId || "",
      gmailDraftReady: Boolean(draft.id),
      gmailDraftSkippedReason: draft.skippedReason || "",
      subject: buildSubject(lead),
      emailBody: buildEmailBody(lead, depositAmount, payment.url)
    });
  } catch (error) {
    return setJson(res, error.statusCode || 500, {
      ok: false,
      error: error.message || "Could not prepare contract and deposit step.",
      details: error.details || null
    });
  }
};

function normalizeLead(lead) {
  return {
    id: stringify(lead.id),
    leadCode: stringify(lead.leadCode || lead.lead_code),
    clientName: stringify(lead.clientName || lead.client_name || "there"),
    email: stringify(lead.email),
    phone: stringify(lead.phone),
    eventType: stringify(lead.eventType || lead.event_type || "event"),
    eventDate: stringify(lead.eventDate || lead.event_date),
    venue: stringify(lead.venue),
    city: stringify(lead.city),
    serviceRequested: stringify(lead.serviceRequested || lead.service_requested || "DSLR Photo Booth - Digital Sharing"),
    budget: Number(lead.budget || 0),
    calendarChecked: stringify(lead.calendarChecked || (lead.calendar_checked ? "Yes" : "No"))
  };
}

function normalizeDepositAmount(value, lead) {
  const explicit = Number(value);
  if (Number.isFinite(explicit) && explicit > 0) return roundMoney(explicit);
  if (lead.budget > 0) return roundMoney(lead.budget * 0.5);
  const packageAmount = getPackageAmount(lead.serviceRequested);
  return roundMoney(packageAmount * 0.5);
}

function getPackageAmount(serviceRequested) {
  const text = serviceRequested.toLowerCase();
  if (text.includes("4 hour") || text.includes("$700")) return 700;
  if (text.includes("3 hour") || text.includes("$575")) return 575;
  return 450;
}

async function createStripeCheckoutSession(lead, depositAmount) {
  if (!STRIPE_SECRET_KEY) {
    return { url: "", skippedReason: "Missing STRIPE_SECRET_KEY. Add it in Vercel to create Stripe deposit links automatically." };
  }
  if (!isValidStripeSecretKey(STRIPE_SECRET_KEY)) {
    const error = new Error("Stripe is using the wrong API key type. Set STRIPE_SECRET_KEY in Vercel to a secret key that starts with sk_live_ for production or sk_test_ for preview.");
    error.statusCode = 500;
    throw error;
  }

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      mode: "payment",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][product_data][name]": `Booth Fairy Miami 50% Retainer - ${lead.clientName}`,
      "line_items[0][price_data][product_data][description]": buildPaymentDescription(lead),
      "line_items[0][price_data][unit_amount]": String(Math.round(depositAmount * 100)),
      "line_items[0][quantity]": "1",
      customer_email: lead.email,
      success_url: `${SITE_URL}/thank-you.html?payment=success`,
      cancel_url: `${SITE_URL}/admin?payment=cancelled`,
      "metadata[lead_id]": lead.id || "",
      "metadata[lead_code]": lead.leadCode || "",
      "metadata[payment_type]": "50_percent_retainer",
      "metadata[client_name]": lead.clientName || "",
      "metadata[event_date]": lead.eventDate || ""
    })
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload?.error?.message || "Stripe checkout session failed.");
    error.details = payload;
    error.statusCode = response.status;
    throw error;
  }

  return {
    url: payload?.url || "",
    sessionId: payload?.id || "",
    paymentIntentId: payload?.payment_intent || "",
    skippedReason: ""
  };
}

function isValidStripeSecretKey(value) {
  return /^sk_(live|test)_[A-Za-z0-9]/.test(String(value || ""));
}

async function createGmailDraftIfPossible(lead, depositAmount, paymentUrl) {
  const connection = await getValidGmailAccessToken();
  if (!connection) {
    return { id: "", skippedReason: "Google/Gmail is not connected." };
  }

  const raw = buildRawEmail({
    to: lead.email,
    subject: buildSubject(lead),
    body: buildEmailBody(lead, depositAmount, paymentUrl),
    html: buildEmailHtml(lead, depositAmount, paymentUrl)
  });

  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${connection.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ message: { raw } })
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    return {
      id: "",
      skippedReason: payload?.error?.message || "Gmail draft could not be created. Reconnect Gmail and approve compose permission."
    };
  }

  if (payload?.message?.threadId) {
    await moveGmailThreadToLeadLabel(connection.accessToken, payload.message.threadId, "CRM-Lead/Deposit Pending").catch(() => null);
  }

  return {
    id: payload?.id || "",
    messageId: payload?.message?.id || "",
    threadId: payload?.message?.threadId || "",
    skippedReason: ""
  };
}

async function moveGmailThreadToLeadLabel(accessToken, threadId, destinationLabelName) {
  const { addLabelId, removeLabelIds } = await getLeadLabelMoveIds(accessToken, destinationLabelName);
  if (!addLabelId) return false;
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(threadId)}/modify`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ addLabelIds: [addLabelId], removeLabelIds })
  });
  return response.ok;
}

async function getLeadLabelMoveIds(accessToken, destinationLabelName) {
  const addLabelId = await getOrCreateGmailLabel(accessToken, destinationLabelName);
  const labels = await listGmailLabels(accessToken);
  const removeLabelIds = labels
    .filter((label) => CRM_LEAD_LABELS.includes(label.name) && label.name !== destinationLabelName)
    .map((label) => label.id)
    .filter(Boolean);
  return { addLabelId, removeLabelIds };
}

async function listGmailLabels(accessToken) {
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/labels", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const payload = await response.json().catch(() => null);
  return response.ok ? payload?.labels || [] : [];
}

async function getOrCreateGmailLabel(accessToken, labelName) {
  const existing = (await listGmailLabels(accessToken)).find((label) => label.name === labelName);
  if (existing?.id) return existing.id;

  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/labels", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: labelName,
      labelListVisibility: "labelShow",
      messageListVisibility: "show"
    })
  });
  const payload = await response.json().catch(() => null);
  return response.ok ? payload?.id || "" : "";
}

function buildSubject(lead) {
  const datePart = lead.eventDate ? ` for ${lead.eventDate}` : "";
  return `Booth Fairy Miami next steps${datePart}`;
}

function buildEmailBody(lead, depositAmount, paymentUrl) {
  return [
    `Hi ${lead.clientName || "there"},`,
    "",
    "Your date looks open. To reserve it, please review the service agreement and submit the non-refundable 50% retainer. The remaining balance is due the day of the event.",
    "",
    "Next steps:",
    `1. Review the service agreement: ${SERVICE_AGREEMENT_URL}`,
    paymentUrl ? `2. Pay the 50% retainer: ${paymentUrl}` : "2. Pay the 50% retainer: [Add Stripe payment link before sending]",
    `Retainer due today: $${depositAmount.toFixed(2)}`,
    "",
    "Please note: your booking is not confirmed until the signed agreement and retainer payment are received.",
    "",
    "Warmly,",
    "Booth Fairy Miami",
    "DSLR Photo Booth & DJ Services",
    "(786) 315-9117",
    "www.boothfairymiami.com",
    "info@boothfairymiami.com"
  ].join("\n");
}

function buildEmailHtml(lead, depositAmount, paymentUrl) {
  const safeName = escapeHtml(lead.clientName || "there");
  const paymentAction = paymentUrl
    ? `<p><a href="${escapeAttribute(paymentUrl)}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#171125;color:#ffffff;text-decoration:none;font-weight:700;">Pay 50% retainer</a></p>`
    : `<p><strong>50% retainer payment link:</strong> [Add Stripe payment link before sending]</p>`;

  return [
    `<p>Hi ${safeName},</p>`,
    "<p>Your date looks open. To reserve it, please review the service agreement and submit the non-refundable 50% retainer. The remaining balance is due the day of the event.</p>",
    "<p><strong>Next steps:</strong></p>",
    "<ol>",
    `<li><a href="${escapeAttribute(SERVICE_AGREEMENT_URL)}">Review the service agreement</a> <span style="color:#6e647d;">(English and Spanish PDFs are available on this page)</span></li>`,
    `<li>Submit the 50% retainer: <strong>$${depositAmount.toFixed(2)}</strong></li>`,
    "</ol>",
    paymentAction,
    "<p><strong>Please note:</strong> your booking is not confirmed until the signed agreement and retainer payment are received.</p>",
    "<p>Warmly,<br>Booth Fairy Miami<br>DSLR Photo Booth &amp; DJ Services<br>(786) 315-9117<br><a href=\"https://www.boothfairymiami.com\">www.boothfairymiami.com</a><br>info@boothfairymiami.com</p>"
  ].join("\n");
}

function buildRawEmail({ to, subject, body, html = "" }) {
  const message = [
    `To: ${to}`,
    `Subject: ${encodeMimeSubject(subject)}`,
    "MIME-Version: 1.0",
    html ? "Content-Type: text/html; charset=UTF-8" : "Content-Type: text/plain; charset=UTF-8",
    "",
    html || body
  ].join("\r\n");
  return Buffer.from(message, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

function encodeMimeSubject(subject) {
  return `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
}

function buildPaymentDescription(lead) {
  return [
    lead.eventType,
    lead.eventDate,
    lead.serviceRequested,
    lead.venue || lead.city
  ].filter(Boolean).join(" | ").slice(0, 500);
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function stringify(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}
