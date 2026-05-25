const crypto = require("crypto");
const { syncBookingFinance } = require("../finance/_lib");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://hwwhyrpwfewxevocjjzk.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const SIGNATURE_TOLERANCE_SECONDS = 300;

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    requireEnv("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY);
    requireEnv("STRIPE_WEBHOOK_SECRET", STRIPE_WEBHOOK_SECRET);

    const rawBody = await readRawBody(req);
    const signature = req.headers["stripe-signature"];
    verifyStripeSignature(rawBody, signature);

    const event = JSON.parse(rawBody);
    const shouldProcess = await recordWebhookEvent(event, "processing");
    if (!shouldProcess) {
      return sendJson(res, 200, { ok: true, received: true, duplicate: true });
    }

    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      await handleCheckoutSessionPaid(event.data.object);
    }
    await markWebhookEventProcessed(event);

    return sendJson(res, 200, { ok: true, received: true });
  } catch (error) {
    return sendJson(res, error.statusCode || 400, {
      ok: false,
      error: error.message || "Stripe webhook failed"
    });
  }
}

async function recordWebhookEvent(event, status) {
  try {
    await supabaseAdmin("/webhook_events", {
      method: "POST",
      body: {
        provider: "stripe",
        event_id: event.id || null,
        event_type: event.type || null,
        status,
        payload_summary: event.type || "Stripe event received"
      },
      prefer: "resolution=ignore-duplicates,return=representation"
    });
    return true;
  } catch (error) {
    if (isDuplicateWebhookError(error)) return false;
    return true;
  }
}

async function markWebhookEventProcessed(event) {
  if (!event.id) return;
  try {
    await supabaseAdmin(`/webhook_events?provider=eq.stripe&event_id=eq.${encodeURIComponent(event.id)}`, {
      method: "PATCH",
      body: {
        status: "processed",
        processed_at: new Date().toISOString()
      }
    });
  } catch {
    // Payment update is the critical path.
  }
}

module.exports = handler;
module.exports.config = {
  api: {
    bodyParser: false
  }
};

async function handleCheckoutSessionPaid(session) {
  if (session.payment_status && session.payment_status !== "paid") return;

  const leadId = session.metadata?.lead_id;
  if (!leadId) {
    const error = new Error("Stripe session is missing lead_id metadata.");
    error.statusCode = 400;
    throw error;
  }

  const paidNotes = [
    `Stripe checkout session paid: ${session.id}`,
    session.payment_intent ? `Payment intent: ${session.payment_intent}` : "",
    session.amount_total ? `Amount paid: $${(Number(session.amount_total) / 100).toFixed(2)}` : "",
    "50% retainer/deposit payment confirmed by Stripe webhook."
  ].filter(Boolean).join("\n");

  const paymentRows = await supabaseAdmin(`/payments?lead_id=eq.${encodeURIComponent(leadId)}&status=eq.Pending&order=created_at.desc&limit=1&select=*`, {
    method: "GET"
  });

  if (paymentRows?.[0]) {
    await updatePayment(paymentRows[0], session, paidNotes);
  } else {
    await createPayment(leadId, session, paidNotes);
  }

  const lead = await getLead(leadId);
  const booking = await createOrUpdateBooking(lead, session);

  await supabaseAdmin(`/leads?id=eq.${encodeURIComponent(leadId)}`, {
    method: "PATCH",
    body: {
      payment_status: "Paid",
      status: "Deposit Paid",
      notes: appendWebhookNote(lead.notes, paidNotes)
    }
  });

  await createFollowup(leadId, "Retainer paid. Confirm signed agreement, then send final booking confirmation and event prep details.");
  await createMessageHistory(leadId, session, paidNotes);
  await syncBookingFinance({ lead: { ...lead, payment_status: "Paid", status: "Deposit Paid" }, booking }).catch(() => null);
}

async function updatePayment(payment, session, paidNotes) {
  const body = {
    status: "Paid",
    notes: [payment.notes, paidNotes].filter(Boolean).join("\n\n"),
    link: payment.link || session.url || null
  };

  const withStripeFields = {
    ...body,
    stripe_session_id: session.id,
    stripe_payment_intent_id: session.payment_intent || null
  };

  try {
    await supabaseAdmin(`/payments?id=eq.${encodeURIComponent(payment.id)}`, {
      method: "PATCH",
      body: withStripeFields
    });
  } catch (error) {
    if (isMissingColumnError(error)) {
      await supabaseAdmin(`/payments?id=eq.${encodeURIComponent(payment.id)}`, {
        method: "PATCH",
        body
      });
      return;
    }
    throw error;
  }
}

async function createPayment(leadId, session, paidNotes) {
  const body = {
    lead_id: leadId,
    type: "Deposit Request",
    amount: session.amount_total ? Number(session.amount_total) / 100 : 0,
    status: "Paid",
    link: session.url || null,
    notes: paidNotes
  };

  const withStripeFields = {
    ...body,
    stripe_session_id: session.id,
    stripe_payment_intent_id: session.payment_intent || null
  };

  try {
    await supabaseAdmin("/payments", { method: "POST", body: withStripeFields });
  } catch (error) {
    if (isMissingColumnError(error)) {
      await supabaseAdmin("/payments", { method: "POST", body });
      return;
    }
    throw error;
  }
}

async function getLeadNotes(leadId) {
  const rows = await supabaseAdmin(`/leads?id=eq.${encodeURIComponent(leadId)}&select=notes`, { method: "GET" });
  return rows?.[0]?.notes || "";
}

async function getLead(leadId) {
  const rows = await supabaseAdmin(`/leads?id=eq.${encodeURIComponent(leadId)}&select=*`, { method: "GET" });
  return rows?.[0] || { id: leadId, notes: "" };
}

async function createOrUpdateBooking(lead, session) {
  if (!lead?.id) return;
  const amountPaid = session.amount_total ? Number(session.amount_total) / 100 : 0;
  const existing = await supabaseAdmin(`/bookings?lead_id=eq.${encodeURIComponent(lead.id)}&select=id,notes&limit=1`, { method: "GET" });
  const body = {
    lead_id: lead.id,
    client_name: lead.client_name || "Booth Fairy Client",
    email: lead.email === "Not provided" ? null : lead.email,
    phone: lead.phone === "Not provided" ? null : lead.phone,
    event_type: lead.event_type || null,
    event_date: lead.event_date || null,
    start_time: lead.start_time || "18:00",
    end_time: lead.end_time || "22:00",
    venue: lead.venue || null,
    city: lead.city || null,
    service_requested: getBookingServiceRequested(lead),
    guest_count: lead.guest_count || 0,
    total_quote: amountPaid ? amountPaid * 2 : Number(lead.budget || 0),
    deposit_required: amountPaid || roundMoney(Number(lead.budget || 0) * 0.5),
    deposit_status: "Paid",
    payment_link: session.url || null,
    booking_status: "Deposit Paid",
    contract_sent: false,
    notes: appendWebhookNote(existing?.[0]?.notes || "", "Stripe confirmed the 50% retainer. Owner must verify signed agreement before marking Booked.")
  };

  if (existing?.[0]) {
    const rows = await supabaseAdmin(`/bookings?id=eq.${encodeURIComponent(existing[0].id)}`, { method: "PATCH", body });
    return rows?.[0] || { ...existing[0], ...body };
  }
  const rows = await supabaseAdmin("/bookings", { method: "POST", body });
  return rows?.[0] || null;
}

function appendWebhookNote(existingNotes, note) {
  return [existingNotes, note].filter(Boolean).join("\n\n");
}

async function createFollowup(leadId, notes) {
  try {
    await supabaseAdmin("/followups", {
      method: "POST",
      body: {
        lead_id: leadId,
        due_date: new Date().toISOString().slice(0, 10),
        channel: "Email",
        status: "Open",
        notes
      }
    });
  } catch {
    // Payment status is the critical path. Do not fail Stripe acknowledgement on follow-up creation.
  }
}

async function createMessageHistory(leadId, session, summary) {
  try {
    await supabaseAdmin("/message_history", {
      method: "POST",
      body: {
        lead_id: leadId,
        channel: "Stripe",
        direction: "Inbound",
        subject: "Stripe retainer payment confirmed",
        summary,
        notes: `Checkout session ${session.id}`
      }
    });
  } catch {
    // Optional table may not be migrated yet.
  }
}

function verifyStripeSignature(rawBody, signatureHeader) {
  if (!signatureHeader) {
    const error = new Error("Missing Stripe-Signature header.");
    error.statusCode = 400;
    throw error;
  }

  const parts = Object.fromEntries(signatureHeader.split(",").map((part) => {
    const [key, value] = part.split("=");
    return [key, value];
  }));
  const timestamp = Number(parts.t);
  const signature = parts.v1;
  if (!timestamp || !signature) {
    const error = new Error("Invalid Stripe-Signature header.");
    error.statusCode = 400;
    throw error;
  }

  const age = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
  if (age > SIGNATURE_TOLERANCE_SECONDS) {
    const error = new Error("Stripe webhook signature timestamp is outside tolerance.");
    error.statusCode = 400;
    throw error;
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac("sha256", STRIPE_WEBHOOK_SECRET).update(signedPayload).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(signature, "hex");
  if (expectedBuffer.length !== receivedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)) {
    const error = new Error("Stripe webhook signature verification failed.");
    error.statusCode = 400;
    throw error;
  }
}

async function supabaseAdmin(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method: options.method || "GET",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation"
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = await parseResponse(response);
  if (!response.ok) {
    const error = new Error(payload?.message || payload?.hint || "Supabase admin request failed.");
    error.details = payload;
    error.statusCode = response.status;
    throw error;
  }
  return payload;
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

async function readRawBody(req) {
  if (typeof req.body === "string") return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString("utf8");

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function isMissingColumnError(error) {
  const text = `${error.message || ""} ${JSON.stringify(error.details || {})}`.toLowerCase();
  return text.includes("stripe_session_id") || text.includes("stripe_payment_intent_id") || text.includes("column");
}

function isDuplicateWebhookError(error) {
  const text = `${error.message || ""} ${JSON.stringify(error.details || {})}`.toLowerCase();
  return text.includes("duplicate") || text.includes("webhook_events_provider_event_id_key");
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function getBookingServiceRequested(lead = {}) {
  const service = stringify(lead.service_requested || lead.serviceRequested);
  const notes = stringify(lead.notes).toLowerCase();
  const packageLooksPhotoBoothOnly = /starter digital package|dslr photo booth|digital photo booth|photo booth 2 hours|2 hours \(\$450\)|2-hour|2 hour/.test(notes);
  const packageLooksBundle = /dj \+ photo booth bundle|photo booth \+ dj bundle/.test(notes);
  if (service === "Photo Booth + DJ Bundle" && packageLooksPhotoBoothOnly && !packageLooksBundle) {
    return "DSLR Photo Booth - Digital Sharing";
  }
  return service || "DSLR Photo Booth - Digital Sharing";
}

function stringify(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function requireEnv(name, value) {
  if (!value) {
    const error = new Error(`Missing ${name} environment variable`);
    error.statusCode = 500;
    throw error;
  }
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}
