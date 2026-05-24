const {
  getValidGmailAccessToken,
  setJson,
  supabaseAdmin,
  verifyAdminRequest
} = require("../gmail/_lib");

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

module.exports = async (req, res) => {
  const route = getRoute(req);
  if (route === "confirm-booking") return handleConfirmBooking(req, res);
  if (route === "calendar-sync") return handleCalendarSync(req, res);
  if (route === "reconcile-payment") return handleReconcilePayment(req, res);
  if (route === "verify-stripe-payment") return handleVerifyStripePayment(req, res);
  if (route !== "audit-log") {
    return setJson(res, 404, { ok: false, error: "Admin route not found." });
  }
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return setJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    if (!await verifyAdminRequest(req)) {
      return setJson(res, 401, { ok: false, error: "Admin authentication required." });
    }

    const limit = clampNumber(new URL(req.url, "https://www.boothfairymiami.com").searchParams.get("limit"), 1, 100, 50);
    const rows = await supabaseAdmin(`/audit_logs?select=*&order=created_at.desc&limit=${limit}`, { method: "GET" });
    return setJson(res, 200, { ok: true, auditLogs: rows || [] });
  } catch (error) {
    return setJson(res, error.statusCode || 500, {
      ok: false,
      error: error.message || "Could not load audit logs.",
      details: error.details || null
    });
  }
};

async function handleConfirmBooking(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return setJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    if (!await verifyAdminRequest(req)) {
      return setJson(res, 401, { ok: false, error: "Admin authentication required." });
    }

    const body = typeof req.body === "string" ? safeParse(req.body) : req.body || {};
    const leadId = stringify(body.leadId || body.lead_id);
    if (!leadId) {
      return setJson(res, 400, { ok: false, error: "Missing lead ID." });
    }

    const lead = await getLead(leadId);
    if (!lead) {
      return setJson(res, 404, { ok: false, error: "Lead not found." });
    }
    if (!lead.calendar_checked) {
      return setJson(res, 400, { ok: false, error: "Calendar must be checked before confirming the booking." });
    }
    const paymentVerifiedByAdmin = Boolean(body.paymentVerified || body.payment_verified);
    if (!isPaidLead(lead) && !paymentVerifiedByAdmin) {
      return setJson(res, 400, { ok: false, error: "The 50% retainer must be marked paid before confirming the booking." });
    }

    const now = new Date().toISOString();
    const booking = await createOrUpdateBookedRecord(lead, now);
    const paymentsUpdated = await markLeadPaymentsPaid(
      lead,
      now,
      "Marked paid when booking was confirmed after signed agreement."
    );
    const calendarSync = await syncBookingToCalendar(booking, lead).catch((error) => ({
      ok: false,
      error: error.message || "Google Calendar sync failed."
    }));

    await closeBookingFollowups(lead.id, now);
    await supabaseAdmin(`/leads?id=eq.${encodeURIComponent(lead.id)}`, {
      method: "PATCH",
      body: {
        status: "Booked",
        payment_status: "Paid",
        notes: appendNotes(lead.notes, `${paymentVerifiedByAdmin && !isPaidLead(lead) ? "Retainer payment manually verified by admin. " : ""}Signed agreement confirmed by admin on ${now}. Booking is now marked Booked.`)
      }
    });

    await supabaseAdmin("/message_history", {
      method: "POST",
      body: {
        lead_id: lead.id,
        booking_id: booking?.id || null,
        channel: "CRM",
        direction: "Internal",
        subject: "Booking confirmed",
        summary: "Admin confirmed signed agreement and retainer payment. Booking moved to Booked.",
        draft_created: false,
        notes: calendarSync.ok
          ? `Google Calendar event synced: ${calendarSync.htmlLink || calendarSync.eventId}.`
          : `Google Calendar sync failed: ${calendarSync.error}`
      }
    });

    return setJson(res, 200, {
      ok: true,
      leadStatus: "Booked",
      paymentStatus: "Paid",
      paymentsUpdated,
      bookingId: booking?.id || "",
      calendarSync
    });
  } catch (error) {
    return setJson(res, error.statusCode || 500, {
      ok: false,
      error: error.message || "Could not confirm booking.",
      details: error.details || null
    });
  }
}

async function handleCalendarSync(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return setJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    if (!await verifyAdminRequest(req)) {
      return setJson(res, 401, { ok: false, error: "Admin authentication required." });
    }

    const body = typeof req.body === "string" ? safeParse(req.body) : req.body || {};
    const leadId = stringify(body.leadId || body.lead_id);
    const bookingId = stringify(body.bookingId || body.booking_id);
    let booking = bookingId ? await getBookingById(bookingId) : null;
    const lead = leadId ? await getLead(leadId) : booking?.lead_id ? await getLead(booking.lead_id) : null;
    if (!booking && lead) booking = await createOrUpdateBookedRecord(lead, new Date().toISOString());
    if (!booking) return setJson(res, 404, { ok: false, error: "Booking not found." });
    if (booking.booking_status !== "Booked" || booking.deposit_status !== "Paid") {
      return setJson(res, 409, { ok: false, error: "Only Booked events with Paid deposit/payment can sync to Google Calendar." });
    }

    const calendarSync = await syncBookingToCalendar(booking, lead || {});
    return setJson(res, 200, { ok: true, bookingId: booking.id, calendarSync });
  } catch (error) {
    return setJson(res, error.statusCode || 500, {
      ok: false,
      error: error.message || "Could not sync Google Calendar event.",
      details: error.details || null
    });
  }
}

async function handleVerifyStripePayment(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return setJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    if (!await verifyAdminRequest(req)) {
      return setJson(res, 401, { ok: false, error: "Admin authentication required." });
    }
    if (!isValidStripeSecretKey(STRIPE_SECRET_KEY)) {
      return setJson(res, 500, { ok: false, error: "STRIPE_SECRET_KEY must be a Stripe secret key that starts with sk_live_ or sk_test_." });
    }

    const body = typeof req.body === "string" ? safeParse(req.body) : req.body || {};
    const leadId = stringify(body.leadId || body.lead_id);
    const signedAgreement = Boolean(body.signedAgreement || body.signed_agreement);
    if (!leadId) {
      return setJson(res, 400, { ok: false, error: "Missing lead ID." });
    }

    const lead = await getLead(leadId);
    if (!lead) {
      return setJson(res, 404, { ok: false, error: "Lead not found." });
    }

    const payment = await getLatestLeadPayment(lead.id);
    const sessionId = stringify(body.stripeSessionId || body.stripe_session_id || payment?.stripe_session_id || extractStripeSessionId(payment?.link));
    if (!sessionId) {
      return setJson(res, 400, {
        ok: false,
        error: "No Stripe Checkout Session ID found. Open the payment record and make sure it has a Stripe checkout link that starts with cs_live_ or cs_test_."
      });
    }

    const session = await retrieveStripeCheckoutSession(sessionId);
    if (session.payment_status !== "paid") {
      return setJson(res, 409, {
        ok: false,
        paid: false,
        stripeSessionId: session.id,
        paymentStatus: session.payment_status || "unknown",
        error: `Stripe says this checkout session is ${session.payment_status || "not paid"} yet.`
      });
    }

    const now = new Date().toISOString();
    const paidSummary = buildStripePaidSummary(session);
    await applyPaidStripeSessionToLead(lead, session, payment, paidSummary, now);

    let booking = null;
    let calendarSync = null;
    if (signedAgreement) {
      if (!lead.calendar_checked) {
        return setJson(res, 409, {
          ok: true,
          paid: true,
          needsCalendar: true,
          stripeSessionId: session.id,
          error: "Stripe payment is verified, but calendar availability must be checked before marking Booked."
        });
      }
      const refreshedLead = await getLead(lead.id);
      booking = await createOrUpdateBookedRecord({ ...refreshedLead, payment_status: "Paid", status: "Deposit Paid" }, now);
      calendarSync = await syncBookingToCalendar(booking, refreshedLead).catch((error) => ({
        ok: false,
        error: error.message || "Google Calendar sync failed."
      }));
      await closeBookingFollowups(lead.id, now);
      await supabaseAdmin(`/leads?id=eq.${encodeURIComponent(lead.id)}`, {
        method: "PATCH",
        body: {
          status: "Booked",
          payment_status: "Paid",
          notes: appendNotes(refreshedLead.notes, `Stripe session ${session.id} verified as paid and signed agreement confirmed on ${now}. Booking marked Booked.`)
        }
      });
    }

    return setJson(res, 200, {
      ok: true,
      paid: true,
      leadStatus: signedAgreement && lead.calendar_checked ? "Booked" : "Deposit Paid",
      stripeSessionId: session.id,
      stripePaymentIntentId: stringify(session.payment_intent),
      amountPaid: session.amount_total ? Number(session.amount_total) / 100 : 0,
      bookingId: booking?.id || "",
      calendarSync
    });
  } catch (error) {
    return setJson(res, error.statusCode || 500, {
      ok: false,
      error: error.message || "Could not verify Stripe payment.",
      details: error.details || null
    });
  }
}

async function handleReconcilePayment(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return setJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    if (!await verifyAdminRequest(req)) {
      return setJson(res, 401, { ok: false, error: "Admin authentication required." });
    }

    const body = typeof req.body === "string" ? safeParse(req.body) : req.body || {};
    const leadId = stringify(body.leadId || body.lead_id);
    if (!leadId) {
      return setJson(res, 400, { ok: false, error: "Missing lead ID." });
    }

    const lead = await getLead(leadId);
    if (!lead) {
      return setJson(res, 404, { ok: false, error: "Lead not found." });
    }

    const now = new Date().toISOString();
    const currentStatus = stringify(lead.status);
    const nextStatus = ["Booked", "Paid", "Completed", "Event Completed", "Review Requested", "Repeat Client"].includes(currentStatus)
      ? currentStatus
      : "Deposit Paid";

    await supabaseAdmin(`/leads?id=eq.${encodeURIComponent(lead.id)}`, {
      method: "PATCH",
      body: {
        status: nextStatus,
        payment_status: "Paid",
        notes: appendNotes(lead.notes, `Payment/deposit reconciled by admin on ${now}.`)
      }
    });

    const paymentsUpdated = await markLeadPaymentsPaid(
      lead,
      now,
      "Marked paid during admin reconciliation."
    );

    const bookings = await supabaseAdmin(`/bookings?lead_id=eq.${encodeURIComponent(lead.id)}&select=id,notes`, { method: "GET" }).catch(() => []);
    let bookingsUpdated = 0;
    for (const booking of bookings || []) {
      await supabaseAdmin(`/bookings?id=eq.${encodeURIComponent(booking.id)}`, {
        method: "PATCH",
        body: {
          deposit_status: "Paid",
          booking_status: nextStatus === "Booked" ? "Booked" : "Deposit Paid",
          notes: appendNotes(booking.notes, `Deposit reconciled as paid on ${now}.`)
        }
      });
      bookingsUpdated += 1;
    }

    let calendarSync = null;
    if (nextStatus === "Booked" && lead.calendar_checked) {
      const booking = await createOrUpdateBookedRecord({ ...lead, payment_status: "Paid", status: "Booked" }, now);
      calendarSync = await syncBookingToCalendar(booking, lead).catch((error) => ({
        ok: false,
        error: error.message || "Google Calendar sync failed."
      }));
    }

    return setJson(res, 200, {
      ok: true,
      leadStatus: nextStatus,
      paymentStatus: "Paid",
      paymentsUpdated,
      bookingsUpdated,
      calendarSync
    });
  } catch (error) {
    return setJson(res, error.statusCode || 500, {
      ok: false,
      error: error.message || "Could not reconcile payment.",
      details: error.details || null
    });
  }
}

async function getLatestLeadPayment(leadId) {
  const rows = await supabaseAdmin(`/payments?lead_id=eq.${encodeURIComponent(leadId)}&select=*&order=created_at.desc&limit=1`, { method: "GET" }).catch(() => []);
  return rows?.[0] || null;
}

async function markLeadPaymentsPaid(lead, now, reason) {
  const payments = await supabaseAdmin(`/payments?lead_id=eq.${encodeURIComponent(lead.id)}&select=*`, { method: "GET" }).catch(() => []);
  let paymentsUpdated = 0;
  if (payments?.length) {
    for (const payment of payments) {
      await supabaseAdmin(`/payments?id=eq.${encodeURIComponent(payment.id)}`, {
        method: "PATCH",
        body: {
          status: "Paid",
          notes: appendNotes(payment.notes, `${reason} ${now}`)
        }
      });
      paymentsUpdated += 1;
    }
    return paymentsUpdated;
  }

  await supabaseAdmin("/payments", {
    method: "POST",
    body: {
      lead_id: lead.id,
      type: "Deposit Request",
      amount: roundMoney(Number(lead.budget || 0) * 0.5),
      status: "Paid",
      link: null,
      notes: `${reason} Paid deposit record created on ${now}.`
    }
  });
  return 1;
}

async function retrieveStripeCheckoutSession(sessionId) {
  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`
    }
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload?.error?.message || "Stripe checkout session lookup failed.");
    error.details = payload;
    error.statusCode = response.status;
    throw error;
  }
  return payload;
}

async function applyPaidStripeSessionToLead(lead, session, payment, paidSummary, now) {
  if (payment?.id) {
    await patchPaymentPaid(payment, session, paidSummary);
  } else {
    await createPaymentPaid(lead.id, session, paidSummary);
  }

  const existing = await supabaseAdmin(`/payments?lead_id=eq.${encodeURIComponent(lead.id)}&status=eq.Pending&select=*`, { method: "GET" }).catch(() => []);
  for (const row of existing || []) {
    await patchPaymentPaid(row, session, paidSummary);
  }

  await createOrUpdateDepositPaidBooking(lead, session, now);
  await supabaseAdmin(`/leads?id=eq.${encodeURIComponent(lead.id)}`, {
    method: "PATCH",
    body: {
      status: ["Booked", "Paid", "Completed", "Event Completed", "Review Requested", "Repeat Client"].includes(lead.status) ? lead.status : "Deposit Paid",
      payment_status: "Paid",
      notes: appendNotes(lead.notes, paidSummary)
    }
  });
}

async function patchPaymentPaid(payment, session, paidSummary) {
  const body = {
    status: "Paid",
    link: payment.link || session.url || null,
    stripe_session_id: session.id,
    stripe_payment_intent_id: stringify(session.payment_intent) || null,
    notes: appendNotes(payment.notes, paidSummary)
  };
  try {
    await supabaseAdmin(`/payments?id=eq.${encodeURIComponent(payment.id)}`, { method: "PATCH", body });
  } catch (error) {
    if (!isMissingStripePaymentColumn(error)) throw error;
    const { stripe_session_id, stripe_payment_intent_id, ...fallback } = body;
    await supabaseAdmin(`/payments?id=eq.${encodeURIComponent(payment.id)}`, { method: "PATCH", body: fallback });
  }
}

async function createPaymentPaid(leadId, session, paidSummary) {
  const body = {
    lead_id: leadId,
    type: "Deposit Request",
    amount: session.amount_total ? Number(session.amount_total) / 100 : 0,
    status: "Paid",
    link: session.url || null,
    stripe_session_id: session.id,
    stripe_payment_intent_id: stringify(session.payment_intent) || null,
    notes: paidSummary
  };
  try {
    await supabaseAdmin("/payments", { method: "POST", body });
  } catch (error) {
    if (!isMissingStripePaymentColumn(error)) throw error;
    const { stripe_session_id, stripe_payment_intent_id, ...fallback } = body;
    await supabaseAdmin("/payments", { method: "POST", body: fallback });
  }
}

async function createOrUpdateDepositPaidBooking(lead, session, now) {
  const amountPaid = session.amount_total ? Number(session.amount_total) / 100 : 0;
  const existing = await supabaseAdmin(`/bookings?lead_id=eq.${encodeURIComponent(lead.id)}&select=id,notes&limit=1`, { method: "GET" }).catch(() => []);
  const body = {
    lead_id: lead.id,
    client_name: lead.client_name || "Booth Fairy Client",
    email: isUsableEmail(lead.email) ? lead.email : null,
    phone: lead.phone === "Not provided" ? null : lead.phone,
    event_type: lead.event_type || null,
    event_date: lead.event_date || null,
    start_time: lead.start_time || "18:00",
    end_time: lead.end_time || "22:00",
    venue: lead.venue || null,
    city: lead.city || null,
    service_requested: lead.service_requested || "DSLR Photo Booth - Digital Sharing",
    guest_count: lead.guest_count || 0,
    total_quote: amountPaid ? amountPaid * 2 : Number(lead.budget || 0),
    deposit_required: amountPaid || roundMoney(Number(lead.budget || 0) * 0.5),
    deposit_status: "Paid",
    payment_link: session.url || null,
    booking_status: "Deposit Paid",
    contract_sent: false,
    notes: appendNotes(existing?.[0]?.notes, `Stripe session ${session.id} verified as paid on ${now}. Signed agreement still controls final Booked status.`)
  };
  if (existing?.[0]) {
    const rows = await supabaseAdmin(`/bookings?id=eq.${encodeURIComponent(existing[0].id)}`, { method: "PATCH", body });
    return rows?.[0] || null;
  }
  const rows = await supabaseAdmin("/bookings", { method: "POST", body });
  return rows?.[0] || null;
}

function buildStripePaidSummary(session) {
  return [
    `Stripe checkout session verified paid: ${session.id}`,
    session.payment_intent ? `Payment intent: ${session.payment_intent}` : "",
    session.amount_total ? `Amount paid: $${(Number(session.amount_total) / 100).toFixed(2)}` : "",
    "50% retainer/deposit payment confirmed by direct Stripe lookup."
  ].filter(Boolean).join("\n");
}

function extractStripeSessionId(value) {
  const decoded = decodeURIComponent(stringify(value));
  return decoded.match(/\bcs_(?:live|test)_[A-Za-z0-9]+/i)?.[0] || "";
}

function isValidStripeSecretKey(value) {
  return /^sk_(live|test)_[A-Za-z0-9]/.test(stringify(value));
}

function isMissingStripePaymentColumn(error) {
  const text = `${error?.message || ""} ${JSON.stringify(error?.details || {})}`.toLowerCase();
  return text.includes("stripe_session_id") || text.includes("stripe_payment_intent_id") || text.includes("schema cache") || text.includes("column");
}

async function getLead(leadId) {
  const rows = await supabaseAdmin(`/leads?id=eq.${encodeURIComponent(leadId)}&select=*&limit=1`, { method: "GET" });
  return rows?.[0] || null;
}

async function getBookingById(bookingId) {
  const rows = await supabaseAdmin(`/bookings?id=eq.${encodeURIComponent(bookingId)}&select=*&limit=1`, { method: "GET" });
  return rows?.[0] || null;
}

async function createOrUpdateBookedRecord(lead, now) {
  const existing = await supabaseAdmin(`/bookings?lead_id=eq.${encodeURIComponent(lead.id)}&select=*&limit=1`, { method: "GET" });
  const body = {
    lead_id: lead.id,
    client_name: lead.client_name || "Booth Fairy Client",
    email: isUsableEmail(lead.email) ? lead.email : null,
    phone: lead.phone === "Not provided" ? null : lead.phone,
    event_type: lead.event_type || null,
    event_date: lead.event_date || null,
    start_time: lead.start_time || "18:00",
    end_time: lead.end_time || "22:00",
    venue: lead.venue || null,
    city: lead.city || null,
    service_requested: lead.service_requested || "DSLR Photo Booth - Digital Sharing",
    guest_count: lead.guest_count || 0,
    total_quote: Number(lead.budget || 0),
    deposit_required: roundMoney(Number(lead.budget || 0) * 0.5),
    deposit_status: "Paid",
    booking_status: "Booked",
    contract_sent: true,
    notes: appendNotes(existing?.[0]?.notes, `Signed agreement confirmed on ${now}. Booking confirmed after calendar check and paid retainer.`)
  };

  if (existing?.[0]) {
    const rows = await supabaseAdmin(`/bookings?id=eq.${encodeURIComponent(existing[0].id)}`, { method: "PATCH", body });
    return rows?.[0] || { ...existing[0], ...body };
  }
  const rows = await supabaseAdmin("/bookings", { method: "POST", body });
  return rows?.[0] || null;
}

async function syncBookingToCalendar(booking, lead = {}) {
  const connection = await getValidGmailAccessToken();
  if (!connection) {
    const message = "Google account is not connected.";
    await markCalendarSyncFailed(booking.id, message);
    const error = new Error(message);
    error.statusCode = 400;
    throw error;
  }

  const event = buildCalendarEvent(booking, lead);
  const calendarId = process.env.GOOGLE_CALENDAR_ID || "primary";
  const eventId = stringify(booking.google_calendar_event_id || booking.calendar_event_id) || await findExistingCalendarEventId(connection.accessToken, calendarId, booking, lead);
  const url = eventId
    ? `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`
    : `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
  const response = await fetch(url, {
    method: eventId ? "PATCH" : "POST",
    headers: {
      Authorization: `Bearer ${connection.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(event)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error?.message || "Google Calendar event request failed.";
    await markCalendarSyncFailed(booking.id, message);
    const error = new Error(message);
    error.details = payload;
    error.statusCode = response.status;
    throw error;
  }

  await supabaseAdmin(`/bookings?id=eq.${encodeURIComponent(booking.id)}`, {
    method: "PATCH",
    body: {
      calendar_link: payload.htmlLink || booking.calendar_link || null,
      google_calendar_event_id: payload.id || eventId || null,
      calendar_sync_status: "Synced",
      calendar_sync_error: null,
      calendar_synced_at: new Date().toISOString()
    }
  }).catch(() => null);

  return {
    ok: true,
    status: "Synced",
    eventId: payload.id || eventId,
    htmlLink: payload.htmlLink || ""
  };
}

async function findExistingCalendarEventId(accessToken, calendarId, booking, lead = {}) {
  if (!booking?.id) return "";
  const params = new URLSearchParams({
    privateExtendedProperty: `bookingId=${booking.id}`,
    maxResults: "1",
    singleEvents: "true"
  });
  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) return "";
  const extendedMatch = payload?.items?.[0]?.id || "";
  if (extendedMatch) return extendedMatch;

  const eventDate = booking.event_date || lead.event_date;
  if (!eventDate) return "";
  const clientName = normalizeSearchText(booking.client_name || lead.client_name);
  const service = normalizeSearchText(booking.service_requested || lead.service_requested);
  const searchParams = new URLSearchParams({
    timeMin: toRfc3339WithOffset(eventDate, "00:00"),
    timeMax: toRfc3339WithOffset(eventDate, "23:59"),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "10"
  });
  if (clientName) searchParams.set("q", booking.client_name || lead.client_name);
  const searchResponse = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${searchParams.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const searchPayload = await searchResponse.json().catch(() => null);
  if (!searchResponse.ok) return "";

  const match = (searchPayload?.items || []).find((item) => {
    if (item.status === "cancelled") return false;
    const haystack = normalizeSearchText([item.summary, item.description, item.location].filter(Boolean).join(" "));
    if (clientName && haystack.includes(clientName)) return true;
    return haystack.includes("booth fairy") && service.includes("photo booth") && haystack.includes("photo booth");
  });
  return match?.id || "";
}

function buildCalendarEvent(booking, lead = {}) {
  const titleParts = [
    "Booth Fairy Miami",
    booking.client_name || lead.client_name || "Client",
    booking.event_type || lead.event_type || "",
    booking.service_requested || lead.service_requested || ""
  ].filter(Boolean);
  return {
    summary: titleParts.join(" - "),
    location: [booking.venue || lead.venue, booking.city || lead.city].filter(Boolean).join(", "),
    description: [
      `Client: ${booking.client_name || lead.client_name || "Pending"}`,
      `Phone: ${booking.phone || lead.phone || "Pending"}`,
      `Email: ${booking.email || lead.email || "Pending"}`,
      `Service: ${booking.service_requested || lead.service_requested || "Pending"}`,
      `Guests: ${booking.guest_count || lead.guest_count || "Pending"}`,
      "",
      booking.notes || lead.notes || ""
    ].join("\n"),
    start: {
      dateTime: toRfc3339WithOffset(booking.event_date || lead.event_date, booking.start_time || lead.start_time || "18:00"),
      timeZone: "America/New_York"
    },
    end: {
      dateTime: toRfc3339WithOffset(booking.event_date || lead.event_date, booking.end_time || lead.end_time || "22:00"),
      timeZone: "America/New_York"
    },
    extendedProperties: {
      private: {
        bookingId: stringify(booking.id),
        leadId: stringify(booking.lead_id || lead.id)
      }
    }
  };
}

async function markCalendarSyncFailed(bookingId, message) {
  if (!bookingId) return;
  await supabaseAdmin(`/bookings?id=eq.${encodeURIComponent(bookingId)}`, {
    method: "PATCH",
    body: {
      calendar_sync_status: "Failed",
      calendar_sync_error: message || "Google Calendar sync failed."
    }
  }).catch(() => null);
}

async function closeBookingFollowups(leadId, now) {
  const rows = await supabaseAdmin(`/followups?lead_id=eq.${encodeURIComponent(leadId)}&status=eq.Open&select=id,notes`, { method: "GET" }).catch(() => []);
  for (const row of rows || []) {
    if (!/signed agreement|retainer|contract|deposit/i.test(row.notes || "")) continue;
    await supabaseAdmin(`/followups?id=eq.${encodeURIComponent(row.id)}`, {
      method: "PATCH",
      body: {
        status: "Completed",
        notes: appendNotes(row.notes, `Closed automatically when booking was confirmed on ${now}.`)
      }
    }).catch(() => null);
  }
}

function isPaidLead(lead) {
  return ["Paid", "Deposit Paid", "Booked"].includes(String(lead.status || "")) || String(lead.payment_status || "") === "Paid";
}

function isUsableEmail(value) {
  const email = stringify(value).toLowerCase();
  return email && email !== "not provided" && email.includes("@");
}

function buildRawEmail({ to, subject, body }) {
  const message = [
    `To: ${to}`,
    `Subject: ${encodeMimeSubject(subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    body
  ].join("\r\n");
  return Buffer.from(message, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function encodeMimeSubject(subject) {
  return `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
}

function appendNotes(existingNotes, note) {
  return [existingNotes, note].filter(Boolean).join("\n\n");
}

function addDaysIso(days) {
  const date = new Date();
  date.setDate(date.getDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function toRfc3339WithOffset(date, time) {
  const normalizedDate = stringify(date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
    const error = new Error("A valid event date is required before calendar sync.");
    error.statusCode = 400;
    throw error;
  }
  const normalizedTime = normalizeTime(time || "18:00");
  return `${normalizedDate}T${normalizedTime}:00${getMiamiOffset(normalizedDate, normalizedTime)}`;
}

function normalizeTime(value) {
  const clean = stringify(value).slice(0, 5);
  if (/^\d{2}:\d{2}$/.test(clean)) return clean;
  if (/^\d{1}:\d{2}$/.test(clean)) return `0${clean}`;
  const error = new Error("Event times must use HH:MM format before calendar sync.");
  error.statusCode = 400;
  throw error;
}

function getMiamiOffset(date, time) {
  const probe = new Date(`${date}T${time}:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "shortOffset",
    hour: "2-digit",
    minute: "2-digit"
  }).formatToParts(probe);
  const zoneName = parts.find((part) => part.type === "timeZoneName")?.value || "GMT-4";
  const match = zoneName.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
  if (!match) return "-04:00";
  const sign = match[1];
  const hours = String(Number(match[2] || 0)).padStart(2, "0");
  const minutes = String(Number(match[3] || 0)).padStart(2, "0");
  return `${sign}${hours}:${minutes}`;
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function slugify(value) {
  return stringify(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "event";
}

function normalizeSearchText(value) {
  return stringify(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stringify(value) {
  return String(value || "").trim();
}

function safeParse(value) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return {};
  }
}

function getRoute(req) {
  const pathname = new URL(req.url, "https://www.boothfairymiami.com").pathname;
  return pathname.split("/").filter(Boolean).slice(2).join("/");
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}
