const crypto = require("crypto");
const { syncBookingFinance } = require("../finance/_lib");
const { getPhotoBoothPackageLabel } = require("../_packages");

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
    } else if (event.type === "invoice.paid" || event.type === "invoice.payment_succeeded") {
      await handleInvoicePaid(event.data.object);
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

async function handleInvoicePaid(invoice) {
  if (invoice.status && invoice.status !== "paid") return;

  const lead = await findLeadForInvoice(invoice);
  if (!lead?.id) {
    const error = new Error("Stripe invoice could not be matched to a CRM lead. Add lead_id or lead_code metadata to the invoice, or make sure the invoice email/link matches the CRM lead.");
    error.statusCode = 400;
    throw error;
  }

  const paidNotes = buildInvoicePaidNotes(invoice);
  const payment = await findPaymentForInvoice(lead.id, invoice);
  if (payment?.id) {
    await updateInvoicePayment(payment, invoice, paidNotes);
  } else {
    await createInvoicePayment(lead.id, invoice, paidNotes);
  }

  const booking = await createOrUpdateInvoiceBooking(lead, invoice);
  const nextStatus = ["Booked", "Paid", "Completed", "Event Completed", "Review Requested", "Repeat Client"].includes(lead.status)
    ? lead.status
    : "Deposit Paid";

  await supabaseAdmin(`/leads?id=eq.${encodeURIComponent(lead.id)}`, {
    method: "PATCH",
    body: {
      payment_status: "Paid",
      status: nextStatus,
      notes: appendWebhookNote(lead.notes, paidNotes)
    }
  });

  await createFollowup(lead.id, "Stripe invoice paid. Confirm signed agreement/booking details, then send final booking confirmation if needed.");
  await createInvoiceMessageHistory(lead.id, booking?.id || null, invoice, paidNotes);
  await syncBookingFinance({ lead: { ...lead, payment_status: "Paid", status: nextStatus }, booking }).catch(() => null);
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

async function findLeadForInvoice(invoice) {
  const metadata = invoice.metadata || {};
  const leadId = stringify(metadata.lead_id || metadata.leadId);
  if (leadId) {
    const lead = await getLead(leadId);
    if (lead?.id) return lead;
  }

  const invoiceId = stringify(invoice.id);
  const link = stringify(invoice.hosted_invoice_url || invoice.invoice_pdf);
  const paymentRows = await findPaymentRowsForInvoice(invoiceId, link);
  const paymentLeadId = paymentRows?.find((row) => row.lead_id)?.lead_id;
  if (paymentLeadId) {
    const lead = await getLead(paymentLeadId);
    if (lead?.id) return lead;
  }

  const leadCode = stringify(metadata.lead_code || metadata.leadCode) || extractLeadCode([
    invoice.number,
    invoice.description,
    invoice.footer,
    invoice.custom_fields?.map((field) => `${field.name} ${field.value}`).join(" ")
  ].filter(Boolean).join(" "));
  if (leadCode) {
    const rows = await supabaseAdmin(`/leads?lead_code=eq.${encodeURIComponent(leadCode.toUpperCase())}&select=*&limit=1`, { method: "GET" }).catch(() => []);
    if (rows?.[0]) return rows[0];
  }

  const email = stringify(invoice.customer_email || invoice.customer_details?.email);
  if (email) {
    const rows = await supabaseAdmin(`/leads?email=ilike.${encodeURIComponent(email)}&select=*&order=updated_at.desc&limit=1`, { method: "GET" }).catch(() => []);
    if (rows?.[0]) return rows[0];
  }

  return null;
}

async function findPaymentRowsForInvoice(invoiceId, link) {
  const filters = [];
  if (invoiceId) {
    filters.push(`stripe_invoice_id.eq.${encodeURIComponent(invoiceId)}`);
    filters.push(`link.ilike.*${encodeURIComponent(invoiceId)}*`);
    filters.push(`notes.ilike.*${encodeURIComponent(invoiceId)}*`);
  }
  if (link) {
    filters.push(`link.eq.${encodeURIComponent(link)}`);
  }
  if (!filters.length) return [];

  const path = `/payments?or=(${filters.join(",")})&select=*&order=created_at.desc&limit=5`;
  try {
    return await supabaseAdmin(path, { method: "GET" });
  } catch (error) {
    if (!isMissingStripePaymentColumn(error)) throw error;
    const fallbackFilters = filters.filter((filter) => !filter.startsWith("stripe_invoice_id."));
    if (!fallbackFilters.length) return [];
    return supabaseAdmin(`/payments?or=(${fallbackFilters.join(",")})&select=*&order=created_at.desc&limit=5`, { method: "GET" }).catch(() => []);
  }
}

async function findPaymentForInvoice(leadId, invoice) {
  const invoiceId = stringify(invoice.id);
  const link = stringify(invoice.hosted_invoice_url || invoice.invoice_pdf);
  const invoiceMatches = await findPaymentRowsForInvoice(invoiceId, link);
  const leadMatch = invoiceMatches.find((row) => row.lead_id === leadId);
  if (leadMatch) return leadMatch;

  const pendingRows = await supabaseAdmin(`/payments?lead_id=eq.${encodeURIComponent(leadId)}&status=eq.Pending&select=*&order=created_at.desc&limit=1`, { method: "GET" }).catch(() => []);
  return pendingRows?.[0] || null;
}

async function updateInvoicePayment(payment, invoice, paidNotes) {
  const amounts = getInvoiceAmounts(invoice);
  const body = {
    type: "Invoice",
    amount: amounts.total,
    subtotal: amounts.subtotal,
    tax_amount: amounts.tax,
    total_amount: amounts.total,
    status: "Paid",
    link: payment.link || invoice.hosted_invoice_url || invoice.invoice_pdf || null,
    stripe_invoice_id: invoice.id || null,
    stripe_payment_intent_id: stringify(invoice.payment_intent) || null,
    notes: appendWebhookNote(payment.notes, paidNotes)
  };
  try {
    await supabaseAdmin(`/payments?id=eq.${encodeURIComponent(payment.id)}`, { method: "PATCH", body });
  } catch (error) {
    if (!isMissingStripePaymentColumn(error)) throw error;
    const { stripe_invoice_id, stripe_payment_intent_id, subtotal, tax_amount, total_amount, ...fallback } = body;
    await supabaseAdmin(`/payments?id=eq.${encodeURIComponent(payment.id)}`, { method: "PATCH", body: fallback });
  }
}

async function createInvoicePayment(leadId, invoice, paidNotes) {
  const amounts = getInvoiceAmounts(invoice);
  const body = {
    lead_id: leadId,
    type: "Invoice",
    amount: amounts.total,
    subtotal: amounts.subtotal,
    tax_amount: amounts.tax,
    total_amount: amounts.total,
    status: "Paid",
    link: invoice.hosted_invoice_url || invoice.invoice_pdf || null,
    stripe_invoice_id: invoice.id || null,
    stripe_payment_intent_id: stringify(invoice.payment_intent) || null,
    notes: paidNotes
  };
  try {
    await supabaseAdmin("/payments", { method: "POST", body });
  } catch (error) {
    if (!isMissingStripePaymentColumn(error)) throw error;
    const { stripe_invoice_id, stripe_payment_intent_id, subtotal, tax_amount, total_amount, ...fallback } = body;
    await supabaseAdmin("/payments", { method: "POST", body: fallback });
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
    start_time: lead.start_time || null,
    end_time: lead.end_time || null,
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

async function createOrUpdateInvoiceBooking(lead, invoice) {
  if (!lead?.id) return null;
  const amountPaid = getInvoicePaidAmount(invoice);
  const invoiceTotal = roundMoney(Number(invoice.metadata?.package_total || 0)) || getInvoiceTotalAmount(invoice) || amountPaid || Number(lead.budget || 0);
  const existing = await supabaseAdmin(`/bookings?lead_id=eq.${encodeURIComponent(lead.id)}&select=id,notes&limit=1`, { method: "GET" }).catch(() => []);
  const body = {
    lead_id: lead.id,
    client_name: lead.client_name || invoice.customer_name || "Booth Fairy Client",
    email: lead.email === "Not provided" ? stringify(invoice.customer_email || invoice.customer_details?.email) || null : lead.email,
    phone: lead.phone === "Not provided" ? null : lead.phone,
    event_type: lead.event_type || null,
    event_date: lead.event_date || null,
    start_time: lead.start_time || null,
    end_time: lead.end_time || null,
    venue: lead.venue || null,
    city: lead.city || null,
    service_requested: getBookingServiceRequested(lead),
    guest_count: lead.guest_count || 0,
    total_quote: invoiceTotal,
    deposit_required: amountPaid || roundMoney(invoiceTotal * 0.5),
    deposit_status: "Paid",
    payment_link: invoice.hosted_invoice_url || invoice.invoice_pdf || null,
    booking_status: ["Booked", "Paid", "Completed"].includes(lead.status) ? lead.status : "Deposit Paid",
    contract_sent: ["Booked", "Paid", "Completed"].includes(lead.status),
    notes: appendWebhookNote(existing?.[0]?.notes || "", `Stripe invoice ${invoice.id} paid. Invoice total: $${invoiceTotal.toFixed(2)}. Amount paid: $${amountPaid.toFixed(2)}.`)
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

async function createInvoiceMessageHistory(leadId, bookingId, invoice, summary) {
  try {
    await supabaseAdmin("/message_history", {
      method: "POST",
      body: {
        lead_id: leadId,
        booking_id: bookingId || null,
        channel: "Stripe",
        direction: "Inbound",
        subject: "Stripe invoice paid",
        summary,
        notes: `Invoice ${invoice.id}${invoice.hosted_invoice_url ? `\n${invoice.hosted_invoice_url}` : ""}`
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
  return text.includes("stripe_session_id") || text.includes("stripe_payment_intent_id") || text.includes("stripe_invoice_id") || text.includes("column");
}

function isDuplicateWebhookError(error) {
  const text = `${error.message || ""} ${JSON.stringify(error.details || {})}`.toLowerCase();
  return text.includes("duplicate") || text.includes("webhook_events_provider_event_id_key");
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function buildInvoicePaidNotes(invoice) {
  return [
    `Stripe invoice paid: ${invoice.id}`,
    invoice.number ? `Invoice number: ${invoice.number}` : "",
    invoice.payment_intent ? `Payment intent: ${invoice.payment_intent}` : "",
    invoice.hosted_invoice_url ? `Invoice link: ${invoice.hosted_invoice_url}` : "",
    `Amount paid: $${getInvoicePaidAmount(invoice).toFixed(2)}`,
    "Payment confirmed by Stripe invoice webhook."
  ].filter(Boolean).join("\n");
}

function getInvoicePaidAmount(invoice) {
  return roundMoney(Number(invoice.amount_paid || 0) / 100);
}

function getInvoiceTotalAmount(invoice) {
  return roundMoney(Number(invoice.total || invoice.amount_due || invoice.amount_paid || 0) / 100);
}

function getInvoiceAmounts(invoice) {
  const subtotal = roundMoney(Number(invoice.subtotal || 0) / 100) || roundMoney(Number(invoice.metadata?.deposit_subtotal || 0));
  const taxFromStripe = Number(invoice.total_tax_amounts?.reduce((sum, item) => sum + Number(item.amount || 0), 0) || 0) / 100;
  const tax = roundMoney(taxFromStripe) || roundMoney(Number(invoice.metadata?.deposit_tax || 0));
  const total = getInvoicePaidAmount(invoice) || getInvoiceTotalAmount(invoice) || roundMoney(Number(invoice.metadata?.deposit_total || 0));
  return { subtotal, tax, total };
}

function extractLeadCode(value) {
  return stringify(value).match(/\bBFM-\d{4,}\b/i)?.[0]?.toUpperCase() || "";
}

function getBookingServiceRequested(lead = {}) {
  const service = stringify(lead.service_requested || lead.serviceRequested);
  const notes = stringify(lead.notes);
  const notesPackageLabel = getPhotoBoothPackageLabel(notes);
  const packageLabel = getPhotoBoothPackageLabel(service) || notesPackageLabel;
  const packageLooksPhotoBoothOnly = Boolean(packageLabel);
  const packageLooksBundle = /dj \+ photo booth bundle|photo booth \+ dj bundle/.test(notes.toLowerCase());
  if (service === "Photo Booth + DJ Bundle" && packageLooksPhotoBoothOnly && !packageLooksBundle) {
    return notesPackageLabel || "DSLR Print Photo Booth - 2 Hours ($450)";
  }
  return packageLabel || service || "DSLR Print Photo Booth - 2 Hours ($450)";
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
