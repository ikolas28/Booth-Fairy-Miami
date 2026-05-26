const {
  GMAIL_ACCOUNT_EMAIL,
  getValidGmailAccessToken,
  setJson,
  supabaseAdmin,
  verifyAdminRequest
} = require("../gmail/_lib");
const {
  getFinancialSummary,
  syncBookingFinance
} = require("../finance/_lib");

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const INSTAGRAM_ACCESS_TOKEN = cleanEnvValue(process.env.INSTAGRAM_ACCESS_TOKEN);
const INSTAGRAM_USER_ID = cleanEnvValue(process.env.INSTAGRAM_USER_ID);
const INSTAGRAM_GRAPH_HOST = cleanEnvValue(process.env.INSTAGRAM_GRAPH_HOST) || "graph.facebook.com";
const INSTAGRAM_GRAPH_VERSION = cleanEnvValue(process.env.INSTAGRAM_GRAPH_VERSION) || "v23.0";

module.exports = async (req, res) => {
  const route = getRoute(req);
  if (route === "confirm-booking") return handleConfirmBooking(req, res);
  if (route === "calendar-sync") return handleCalendarSync(req, res);
  if (route === "finance-summary") return handleFinanceSummary(req, res);
  if (route === "finance-sync") return handleFinanceSync(req, res);
  if (route === "instagram-publish") return handleInstagramPublish(req, res);
  if (route === "marketing-draft") return handleMarketingDraft(req, res);
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

function cleanEnvValue(value) {
  return String(value || "").trim().replace(/^['"]+|['"]+$/g, "");
}

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
    const confirmationDraft = await createBookingConfirmationDraftIfPossible(lead, booking, calendarSync, now);
    const financeSync = await syncBookingFinance({ lead: { ...lead, payment_status: "Paid", status: "Booked" }, booking }).catch((error) => ({
      ok: false,
      error: error.message || "Google Sheets finance sync failed."
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
        channel: confirmationDraft.id ? "Gmail" : "CRM",
        direction: confirmationDraft.id ? "Outbound" : "Internal",
        subject: confirmationDraft.id ? "Your Booth Fairy Miami booking is confirmed" : "Booking confirmed",
        summary: confirmationDraft.id
          ? "Admin confirmed the booking and created a Gmail confirmation draft for owner review."
          : "Admin confirmed signed agreement and retainer payment. Booking moved to Booked.",
        draft_created: Boolean(confirmationDraft.id),
        gmail_thread_id: confirmationDraft.threadId || null,
        gmail_message_id: confirmationDraft.messageId || null,
        notes: calendarSync.ok
          ? `Google Calendar event synced: ${calendarSync.htmlLink || calendarSync.eventId}.${confirmationDraft.id ? ` Gmail booking confirmation draft ID: ${confirmationDraft.id}.` : ` ${confirmationDraft.skippedReason || "Booking confirmation draft was not created."}`}`
          : `Google Calendar sync failed: ${calendarSync.error}. ${confirmationDraft.id ? `Gmail booking confirmation draft ID: ${confirmationDraft.id}.` : confirmationDraft.skippedReason || "Booking confirmation draft was not created."}`
      }
    });

    return setJson(res, 200, {
      ok: true,
      leadStatus: "Booked",
      paymentStatus: "Paid",
      paymentsUpdated,
      bookingId: booking?.id || "",
      calendarSync,
      confirmationDraft,
      financeSync
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

async function handleFinanceSummary(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return setJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    if (!await verifyAdminRequest(req)) {
      return setJson(res, 401, { ok: false, error: "Admin authentication required." });
    }
    const summary = await getFinancialSummary();
    return setJson(res, summary.ok ? 200 : 409, summary);
  } catch (error) {
    return setJson(res, error.statusCode || 500, {
      ok: false,
      error: error.message || "Could not load finance summary.",
      details: error.details || null
    });
  }
}

async function handleFinanceSync(req, res) {
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
    const lead = leadId ? await getLead(leadId) : null;
    const booking = bookingId ? await getBookingById(bookingId) : lead ? await getBookingForLead(lead.id) : null;
    if (!lead && !booking) return setJson(res, 404, { ok: false, error: "Lead or booking not found." });
    const financeSync = await syncBookingFinance({ lead, booking });
    return setJson(res, financeSync.ok ? 200 : 409, financeSync);
  } catch (error) {
    return setJson(res, error.statusCode || 500, {
      ok: false,
      error: error.message || "Could not sync booking to finance tracker.",
      details: error.details || null
    });
  }
}

async function handleMarketingDraft(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return setJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    if (!await verifyAdminRequest(req)) {
      return setJson(res, 401, { ok: false, error: "Admin authentication required." });
    }

    const body = typeof req.body === "string" ? safeParse(req.body) : req.body || {};
    const campaignId = stringify(body.campaignId || body.campaign_id);
    if (!campaignId) return setJson(res, 400, { ok: false, error: "Missing campaign ID." });

    const campaign = await getCampaignById(campaignId);
    if (!campaign) return setJson(res, 404, { ok: false, error: "Campaign not found." });
    if (campaign.channel !== "Email") {
      return setJson(res, 400, { ok: false, error: "Only Email campaigns can prepare Gmail drafts." });
    }

    const connection = await getValidGmailAccessToken();
    if (!connection) {
      return setJson(res, 409, { ok: false, error: "Gmail is not connected. Reconnect Gmail before preparing campaign drafts." });
    }

    const email = buildMarketingCampaignEmail(campaign);
    const bulkMode = body.bulk !== false;
    const alreadyPrepared = await supabaseAdmin(
      `/message_history?draft_created=eq.true&subject=eq.${encodeURIComponent(email.subject)}&notes=ilike.${encodeURIComponent(`*Campaign ID: ${campaign.id}*`)}&select=id&limit=1`,
      { method: "GET" }
    ).catch(() => []);
    if (alreadyPrepared?.[0]) {
      await updateCampaignStatus(campaign, "Scheduled", "Existing Gmail draft is already prepared for this campaign.");
      return setJson(res, 200, {
        ok: true,
        skipped: true,
        subject: email.subject,
        message: "A Gmail draft already exists for this campaign."
      });
    }

    const audience = bulkMode ? await getMarketingAudience() : [];
    const batchSize = clampNumber(body.batchSize || body.batch_size, 5, 50, 25);
    const batches = bulkMode ? chunkArray(audience, batchSize) : [[]];
    if (bulkMode && !batches.length) {
      return setJson(res, 409, {
        ok: false,
        error: "No eligible marketing recipients found. Add warm leads with usable emails first."
      });
    }

    const drafts = [];
    for (const [index, batch] of batches.entries()) {
      const draft = await createMarketingGmailDraft(connection.accessToken, {
        ...email,
        bcc: batch.map((lead) => lead.email),
        batchIndex: index + 1,
        batchCount: batches.length
      });
      drafts.push(draft);
      await supabaseAdmin("/message_history", {
        method: "POST",
        body: {
          channel: "Gmail",
          direction: "Outbound",
          from_value: GMAIL_ACCOUNT_EMAIL,
          to_value: bulkMode ? `${batch.length} Bcc recipient(s)` : "Add recipients manually in Gmail",
          subject: email.subject,
          summary: bulkMode ? "Bulk marketing Gmail draft created for owner review." : "Marketing campaign Gmail draft created for owner review.",
          draft_created: true,
          gmail_thread_id: draft.threadId || null,
          gmail_message_id: draft.messageId || null,
          notes: [
            `Campaign ID: ${campaign.id}`,
            `Gmail draft ID: ${draft.id}`,
            bulkMode ? `Audience batch ${index + 1} of ${batches.length}: ${batch.map((lead) => lead.email).join(", ")}` : "Owner must add recipients manually.",
            "Owner must review and send manually.",
            "Do not send to unqualified cold lists. Remove anyone who asks to stop."
          ].join("\n")
        }
      }).catch(() => null);
    }

    await updateCampaignStatus(campaign, "Scheduled", bulkMode
      ? `Bulk Gmail campaign drafts prepared for ${audience.length} eligible recipient(s). Subject: ${email.subject}.`
      : `Gmail draft prepared for owner review. Subject: ${email.subject}.`);

    return setJson(res, 200, {
      ok: true,
      campaignId: campaign.id,
      draftId: drafts[0]?.id || "",
      draftIds: drafts.map((draft) => draft.id).filter(Boolean),
      subject: email.subject,
      status: "Scheduled",
      recipientsCount: audience.length,
      batchesCreated: drafts.length,
      batchSize,
      message: bulkMode
        ? `Prepared ${drafts.length} Gmail draft batch(es) for ${audience.length} eligible recipient(s). Review and send manually from Gmail.`
        : "Gmail draft prepared. Add recipients/Bcc and send manually from Gmail."
    });
  } catch (error) {
    return setJson(res, error.statusCode || 500, {
      ok: false,
      error: error.message || "Could not prepare marketing Gmail draft.",
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
    const stripeSecretKey = normalizeStripeSecretKey(STRIPE_SECRET_KEY);
    if (!isValidStripeSecretKey(stripeSecretKey)) {
      return setJson(res, 500, { ok: false, error: `STRIPE_SECRET_KEY must be a Stripe secret key that starts with sk_live_ or sk_test_. Current value looks like: ${describeStripeKeyType(stripeSecretKey)}.` });
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

    const session = await retrieveStripeCheckoutSession(sessionId, stripeSecretKey);
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
    let confirmationDraft = null;
    let financeSync = null;
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
      confirmationDraft = await createBookingConfirmationDraftIfPossible(refreshedLead, booking, calendarSync, now);
      financeSync = await syncBookingFinance({ lead: { ...refreshedLead, payment_status: "Paid", status: "Booked" }, booking, payment }).catch((error) => ({
        ok: false,
        error: error.message || "Google Sheets finance sync failed."
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
      await recordBookingConfirmationHistory(refreshedLead, booking, calendarSync, confirmationDraft);
    }

    return setJson(res, 200, {
      ok: true,
      paid: true,
      leadStatus: signedAgreement && lead.calendar_checked ? "Booked" : "Deposit Paid",
      stripeSessionId: session.id,
      stripePaymentIntentId: stringify(session.payment_intent),
      amountPaid: session.amount_total ? Number(session.amount_total) / 100 : 0,
      bookingId: booking?.id || "",
      calendarSync,
      confirmationDraft,
      financeSync: financeSync || null
    });
  } catch (error) {
    return setJson(res, error.statusCode || 500, {
      ok: false,
      error: error.message || "Could not verify Stripe payment.",
      details: error.details || null
    });
  }
}

async function handleInstagramPublish(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return setJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    if (!await verifyAdminRequest(req)) {
      return setJson(res, 401, { ok: false, error: "Admin authentication required." });
    }

    if (!INSTAGRAM_ACCESS_TOKEN || !INSTAGRAM_USER_ID) {
      return setJson(res, 409, {
        ok: false,
        error: "Instagram publishing is not configured yet. Add INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_USER_ID in Vercel environment variables, then redeploy."
      });
    }

    const body = typeof req.body === "string" ? safeParse(req.body) : req.body || {};
    const campaignId = stringify(body.campaignId || body.campaign_id);
    if (!campaignId) return setJson(res, 400, { ok: false, error: "Missing campaign ID." });

    const campaign = await getCampaignById(campaignId);
    if (!campaign) return setJson(res, 404, { ok: false, error: "Campaign not found." });
    if (campaign.channel !== "Instagram") {
      return setJson(res, 400, { ok: false, error: "Only Instagram campaigns can publish to Instagram." });
    }

    const post = buildInstagramPostFromCampaign(campaign, body);
    if (!post.mediaUrl) {
      return setJson(res, 400, {
        ok: false,
        error: "Add a public Media URL to this campaign before publishing. Use a direct HTTPS image/video URL that Meta can access."
      });
    }
    if (!post.caption) {
      return setJson(res, 400, {
        ok: false,
        error: "Add a Caption section to this Instagram campaign before publishing."
      });
    }

    const publishResult = await publishInstagramPost(post);
    await updateCampaignStatus(
      campaign,
      "Published",
      `Instagram post published. Media ID: ${publishResult.mediaId || "unknown"}.${publishResult.permalink ? ` Permalink: ${publishResult.permalink}.` : ""}`
    );

    await supabaseAdmin("/message_history", {
      method: "POST",
      body: {
        channel: "Instagram",
        direction: "Outbound",
        subject: campaign.title || "Instagram campaign",
        summary: "Instagram campaign published through the CRM after owner approval.",
        draft_created: false,
        notes: [
          `Campaign ID: ${campaign.id}`,
          `Instagram media ID: ${publishResult.mediaId || ""}`,
          publishResult.permalink ? `Permalink: ${publishResult.permalink}` : "",
          `Media URL: ${post.mediaUrl}`,
          `Media type: ${post.mediaType}`
        ].filter(Boolean).join("\n")
      }
    }).catch(() => null);

    return setJson(res, 200, {
      ok: true,
      campaignId: campaign.id,
      status: "Published",
      mediaId: publishResult.mediaId || "",
      permalink: publishResult.permalink || "",
      containerId: publishResult.containerId || ""
    });
  } catch (error) {
    return setJson(res, error.statusCode || 500, {
      ok: false,
      error: error.message || "Could not publish Instagram campaign.",
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
    let confirmationDraft = null;
    let financeSync = null;
    if (nextStatus === "Booked" && lead.calendar_checked) {
      const booking = await createOrUpdateBookedRecord({ ...lead, payment_status: "Paid", status: "Booked" }, now);
      calendarSync = await syncBookingToCalendar(booking, lead).catch((error) => ({
        ok: false,
        error: error.message || "Google Calendar sync failed."
      }));
      confirmationDraft = await createBookingConfirmationDraftIfPossible(lead, booking, calendarSync, now);
      financeSync = await syncBookingFinance({ lead: { ...lead, payment_status: "Paid", status: nextStatus }, booking }).catch((error) => ({
        ok: false,
        error: error.message || "Google Sheets finance sync failed."
      }));
      await recordBookingConfirmationHistory(lead, booking, calendarSync, confirmationDraft);
    }

    return setJson(res, 200, {
      ok: true,
      leadStatus: nextStatus,
      paymentStatus: "Paid",
      paymentsUpdated,
      bookingsUpdated,
      calendarSync,
      confirmationDraft,
      financeSync: financeSync || null
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

async function retrieveStripeCheckoutSession(sessionId, stripeSecretKey = normalizeStripeSecretKey(STRIPE_SECRET_KEY)) {
  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`
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
    service_requested: getBookingServiceRequested(lead),
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
  return /^sk_(live|test)_[A-Za-z0-9]/.test(normalizeStripeSecretKey(value));
}

function normalizeStripeSecretKey(value) {
  return stringify(value)
    .replace(/^STRIPE_SECRET_KEY=/, "")
    .trim()
    .replace(/^['"]|['"]$/g, "");
}

function describeStripeKeyType(value) {
  const key = normalizeStripeSecretKey(value);
  if (!key) return "empty value";
  if (key.startsWith("pk_")) return "publishable key";
  if (key.startsWith("rk_")) return "restricted key";
  if (key.startsWith("whsec_")) return "webhook signing secret";
  if (key.startsWith("sk_")) return "unrecognized Stripe secret format";
  return "unknown key format";
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

async function getCampaignById(campaignId) {
  const rows = await supabaseAdmin(`/campaigns?id=eq.${encodeURIComponent(campaignId)}&select=*&limit=1`, { method: "GET" }).catch(() => []);
  return rows?.[0] || null;
}

async function updateCampaignStatus(campaign, status, note) {
  await supabaseAdmin(`/campaigns?id=eq.${encodeURIComponent(campaign.id)}`, {
    method: "PATCH",
    body: {
      status,
      notes: appendNotes(campaign.notes, `${note} ${new Date().toISOString()}`)
    }
  }).catch(() => null);
}

async function getMarketingAudience() {
  const rows = await supabaseAdmin("/leads?select=id,lead_code,client_name,email,status,payment_status,event_date,source,notes,updated_at&order=updated_at.desc&limit=500", { method: "GET" }).catch(() => []);
  const seen = new Set();
  return (rows || [])
    .filter(isEligibleMarketingLead)
    .filter((lead) => {
      const email = stringify(lead.email).toLowerCase();
      if (seen.has(email)) return false;
      seen.add(email);
      return true;
    })
    .slice(0, 250);
}

function isEligibleMarketingLead(lead) {
  const email = stringify(lead.email).toLowerCase();
  if (!isUsableEmail(email)) return false;
  if (email === GMAIL_ACCOUNT_EMAIL) return false;
  if (["Booked", "Paid", "Completed", "Event Completed", "Review Requested", "Repeat Client", "Lost"].includes(stringify(lead.status))) return false;
  if (stringify(lead.payment_status) === "Paid") return false;
  if (isPastEventDate(lead.event_date)) return false;
  const notes = stringify(lead.notes).toLowerCase();
  if (/\bunsubscribe\b|\bstop\b|do not (email|market|contact)|no marketing|spam complaint|opt[- ]?out/.test(notes)) return false;
  return true;
}

async function getBookingForLead(leadId) {
  const rows = await supabaseAdmin(`/bookings?lead_id=eq.${encodeURIComponent(leadId)}&select=*&limit=1`, { method: "GET" }).catch(() => []);
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
    service_requested: getBookingServiceRequested(lead),
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
  const service = normalizeSearchText(booking.service_requested || getBookingServiceRequested(lead));
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
    booking.service_requested || getBookingServiceRequested(lead) || ""
  ].filter(Boolean);
  return {
    summary: titleParts.join(" - "),
    location: [booking.venue || lead.venue, booking.city || lead.city].filter(Boolean).join(", "),
    description: [
      `Client: ${booking.client_name || lead.client_name || "Pending"}`,
      `Phone: ${booking.phone || lead.phone || "Pending"}`,
      `Email: ${booking.email || lead.email || "Pending"}`,
      `Service: ${booking.service_requested || getBookingServiceRequested(lead) || "Pending"}`,
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

async function createBookingConfirmationDraftIfPossible(lead, booking, calendarSync, now) {
  if (!isUsableEmail(lead.email || booking?.email)) {
    return { id: "", skippedReason: "Client email is missing, so no booking confirmation draft was created." };
  }
  const subject = "Your Booth Fairy Miami booking is confirmed";
  const existing = await supabaseAdmin(
    `/message_history?lead_id=eq.${encodeURIComponent(lead.id)}&draft_created=eq.true&subject=eq.${encodeURIComponent(subject)}&select=id&limit=1`,
    { method: "GET" }
  ).catch(() => []);
  if (existing?.[0]) {
    return { id: "", skippedReason: "A booking confirmation Gmail draft already exists for this lead." };
  }
  const connection = await getValidGmailAccessToken();
  if (!connection) {
    return { id: "", skippedReason: "Gmail is not connected, so no booking confirmation draft was created." };
  }

  const raw = buildRawEmail({
    to: lead.email || booking.email,
    subject,
    body: buildBookingConfirmationEmail(lead, booking, calendarSync)
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
    return { id: "", skippedReason: payload?.error?.message || "Gmail booking confirmation draft could not be created." };
  }
  return {
    id: payload?.id || "",
    messageId: payload?.message?.id || "",
    threadId: payload?.message?.threadId || "",
    createdAt: now
  };
}

async function recordBookingConfirmationHistory(lead, booking, calendarSync, confirmationDraft) {
  await supabaseAdmin("/message_history", {
    method: "POST",
    body: {
      lead_id: lead.id,
      booking_id: booking?.id || null,
      channel: confirmationDraft?.id ? "Gmail" : "CRM",
      direction: confirmationDraft?.id ? "Outbound" : "Internal",
      subject: "Your Booth Fairy Miami booking is confirmed",
      summary: confirmationDraft?.id
        ? "Booking confirmation Gmail draft created for owner review."
        : "Booking confirmation still needs to be sent manually.",
      draft_created: Boolean(confirmationDraft?.id),
      gmail_thread_id: confirmationDraft?.threadId || null,
      gmail_message_id: confirmationDraft?.messageId || null,
      notes: confirmationDraft?.id
        ? `Gmail draft ID: ${confirmationDraft.id}. Owner must review/send manually. Calendar: ${calendarSync?.htmlLink || calendarSync?.eventId || calendarSync?.error || "pending"}.`
        : confirmationDraft?.skippedReason || "No Gmail draft was created."
    }
  }).catch(() => null);
}

function buildBookingConfirmationEmail(lead, booking, calendarSync) {
  const eventDateTime = formatEventDateTime(booking.event_date || lead.event_date, booking.start_time || lead.start_time, booking.end_time || lead.end_time);
  const location = [booking.venue || lead.venue, booking.city || lead.city].filter(Boolean).join(", ") || "venue pending";
  return [
    `Hi ${lead.client_name || booking.client_name || "there"},`,
    "",
    "Your Booth Fairy Miami event is officially booked. Thank you for completing the agreement and retainer/payment steps.",
    "",
    "Booking details:",
    `Date and time: ${eventDateTime}`,
    `Service: ${booking.service_requested || getBookingServiceRequested(lead)}`,
    `Location: ${location}`,
    "",
    "We have your event on our calendar. If any event details change, please reply here so we can update the CRM and calendar before the event.",
    calendarSync?.htmlLink ? `Calendar event: ${calendarSync.htmlLink}` : "",
    "",
    "Warmly,",
    "Booth Fairy Miami",
    "DSLR Photo Booth & DJ Services",
    "(786) 315-9117",
    "www.boothfairymiami.com"
  ].filter((line) => line !== "").join("\n");
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
    await supabaseAdmin(`/followups?id=eq.${encodeURIComponent(row.id)}`, {
      method: "PATCH",
      body: {
        status: "Completed",
        notes: appendNotes(row.notes, `Closed automatically when this lead was marked Booked/Paid on ${now}.`)
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

async function createMarketingGmailDraft(accessToken, email) {
  const raw = buildRawEmail({
    to: GMAIL_ACCOUNT_EMAIL,
    bcc: email.bcc || [],
    subject: email.subject,
    body: [
      email.batchCount > 1 ? `Batch ${email.batchIndex} of ${email.batchCount}` : "",
      email.body
    ].filter(Boolean).join("\n\n")
  });
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ message: { raw } })
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload?.error?.message || "Gmail marketing draft could not be created.");
    error.details = payload;
    error.statusCode = response.status;
    throw error;
  }
  return {
    id: payload?.id || "",
    messageId: payload?.message?.id || "",
    threadId: payload?.message?.threadId || ""
  };
}

function buildMarketingCampaignEmail(campaign) {
  const notes = stringify(campaign.notes);
  const subject = extractMarketingField(notes, "Client-facing subject") || extractMarketingField(notes, "Email subject") || defaultMarketingSubject(campaign);
  const body = extractMarketingBlock(notes, "Client-facing email") || extractMarketingBlock(notes, "Email body") || defaultMarketingBody(campaign);
  return {
    subject: cleanMarketingText(subject),
    body: addMarketingFooter(cleanMarketingText(body))
  };
}

function buildInstagramPostFromCampaign(campaign, body = {}) {
  const notes = stringify(campaign.notes);
  const caption = extractMarketingBlock(notes, "Caption")
    || extractMarketingBlock(notes, "Instagram caption")
    || extractMarketingBlock(notes, "Draft caption")
    || extractMarketingBlock(notes, "Draft story idea")
    || extractMarketingField(notes, "Caption")
    || extractMarketingField(notes, "Instagram caption")
    || extractMarketingField(notes, "Draft caption")
    || extractMarketingField(notes, "Draft story idea")
    || buildInstagramCaptionFallback(campaign);
  const mediaUrl = stringify(
    body.mediaUrl
    || body.media_url
    || extractMarketingField(notes, "Media URL")
    || extractMarketingField(notes, "Image URL")
    || extractMarketingField(notes, "Video URL")
  );
  const mediaType = normalizeInstagramMediaType(
    body.mediaType
    || body.media_type
    || extractMarketingField(notes, "Media type")
    || `${campaign.title || ""} ${mediaUrl}`
  );
  return {
    caption: cleanMarketingText(caption),
    mediaUrl,
    mediaType
  };
}

function buildInstagramCaptionFallback(campaign) {
  const notes = cleanMarketingText(stringify(campaign.notes));
  if (!notes) return "";
  return notes
    .replace(/^Marketing automation batch[^\n.]*[.\s]*/i, "")
    .replace(/\bOwner must review before publishing[.\s]*/i, "")
    .replace(/\bCRM signal:[\s\S]*$/i, "")
    .replace(/\bDo not publish paid ads without owner approval[.\s]*/i, "")
    .trim();
}

function normalizeInstagramMediaType(value) {
  const text = stringify(value).toLowerCase();
  if (text.includes("stor")) {
    return /\.(jpg|jpeg|png|webp)(?:\?|#|$)/i.test(text) ? "STORY_IMAGE" : "STORIES";
  }
  if (text.includes("reel") || text.includes("video") || /\.(mp4|mov)(?:\?|#|$)/i.test(text)) return "REELS";
  return "IMAGE";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function publishInstagramPost(post) {
  const createParams = {
    caption: post.caption
  };
  if (post.mediaType === "REELS" || post.mediaType === "STORIES") {
    createParams.media_type = post.mediaType;
    createParams.video_url = post.mediaUrl;
    if (post.mediaType === "REELS") createParams.share_to_feed = "true";
  } else if (post.mediaType === "STORY_IMAGE") {
    createParams.media_type = "STORIES";
    createParams.image_url = post.mediaUrl;
  } else {
    createParams.image_url = post.mediaUrl;
  }

  const container = await instagramGraphPost(`${INSTAGRAM_USER_ID}/media`, createParams);
  if (!container?.id) {
    const error = new Error("Instagram did not return a media container ID.");
    error.details = container;
    error.statusCode = 502;
    throw error;
  }

  if (post.mediaType === "REELS" || post.mediaType === "STORIES") {
    await waitForInstagramContainer(container.id);
  }

  const published = await instagramGraphPost(`${INSTAGRAM_USER_ID}/media_publish`, {
    creation_id: container.id
  });
  const mediaId = published?.id || "";
  const details = mediaId ? await instagramGraphGet(`${mediaId}?fields=permalink`).catch(() => null) : null;
  return {
    containerId: container.id,
    mediaId,
    permalink: details?.permalink || ""
  };
}

async function waitForInstagramContainer(containerId) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const status = await instagramGraphGet(`${containerId}?fields=status_code,status`).catch(() => null);
    const statusCode = stringify(status?.status_code).toUpperCase();
    if (!statusCode || statusCode === "FINISHED") return;
    if (statusCode === "ERROR" || statusCode === "EXPIRED") {
      const error = new Error(`Instagram media processing failed: ${status?.status || statusCode}`);
      error.details = status;
      error.statusCode = 502;
      throw error;
    }
    await sleep(3000);
  }
}

async function instagramGraphPost(path, params) {
  const body = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") body.set(key, String(value));
  });
  body.set("access_token", INSTAGRAM_ACCESS_TOKEN);

  const response = await fetch(`https://${INSTAGRAM_GRAPH_HOST}/${INSTAGRAM_GRAPH_VERSION}/${path}`, {
    method: "POST",
    body
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload?.error?.message || "Instagram Graph API request failed.");
    error.details = payload;
    error.statusCode = response.status;
    throw error;
  }
  return payload;
}

async function instagramGraphGet(path) {
  const separator = path.includes("?") ? "&" : "?";
  const response = await fetch(`https://${INSTAGRAM_GRAPH_HOST}/${INSTAGRAM_GRAPH_VERSION}/${path}${separator}access_token=${encodeURIComponent(INSTAGRAM_ACCESS_TOKEN)}`);
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload?.error?.message || "Instagram Graph API request failed.");
    error.details = payload;
    error.statusCode = response.status;
    throw error;
  }
  return payload;
}

function extractMarketingField(notes, label) {
  const pattern = new RegExp(`${escapeRegex(label)}\\s*:\\s*([^\\n]+)`, "i");
  return notes.match(pattern)?.[1] || "";
}

function extractMarketingBlock(notes, label) {
  const pattern = new RegExp(`${escapeRegex(label)}\\s*:\\s*\\n([\\s\\S]*?)(?:\\n\\n[A-Z][A-Za-z /+-]+\\s*:|$)`, "i");
  return notes.match(pattern)?.[1]?.trim() || "";
}

function defaultMarketingSubject(campaign) {
  const title = stringify(campaign.title).toLowerCase();
  if (title.includes("dj") || title.includes("bundle")) return "Make your Miami event feel effortless";
  return "A polished digital photo booth experience for your event";
}

function defaultMarketingBody(campaign) {
  const title = stringify(campaign.title).toLowerCase();
  if (title.includes("dj") || title.includes("bundle")) {
    return [
      "Hi there,",
      "",
      "If you are still planning entertainment for your event, Booth Fairy Miami can make the setup feel simple and polished with one coordinated team for music, energy, and guest photos.",
      "",
      "Our luxury DSLR digital photo booth includes instant digital sharing, a premium backdrop look, studio-style lighting, a custom overlay, props, and an attendant. Premium DJ services can also be added for a smoother guest experience from start to finish.",
      "",
      "Reply with your event date, venue or city, and guest count, and we can check availability before sending the best package option.",
      "",
      "Best,",
      "Booth Fairy Miami"
    ].join("\n");
  }

  return [
    "Hi there,",
    "",
    "Booth Fairy Miami offers a luxury DSLR digital photo booth experience for weddings, birthdays, corporate events, and private celebrations across Miami and South Florida.",
    "",
    "The booth is digital-only and includes instant sharing, polished lighting, a custom overlay, a premium backdrop look, props, and an attendant.",
    "",
    "Reply with your event date, venue or city, and guest count, and we can check availability before sending package options.",
    "",
    "Best,",
    "Booth Fairy Miami"
  ].join("\n");
}

function cleanMarketingText(value) {
  return stringify(value)
    .replace(/\b20\d{2}-W\d{2}\b/g, "")
    .replace(/Marketing automation batch.*$/gim, "")
    .trim();
}

function addMarketingFooter(body) {
  const footer = [
    "",
    "P.S. If you no longer want event ideas or availability reminders from Booth Fairy Miami, reply STOP and we will remove you from future marketing messages."
  ].join("\n");
  return body.toLowerCase().includes("reply stop") ? body : `${body}${footer}`;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildRawEmail({ to = "", bcc = [], subject, body }) {
  const bccList = Array.isArray(bcc) ? bcc.filter(Boolean).join(", ") : stringify(bcc);
  const message = [
    to ? `To: ${to}` : "",
    bccList ? `Bcc: ${bccList}` : "",
    `Subject: ${encodeMimeSubject(subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    body
  ].filter((line, index) => index > 0 || line).join("\r\n");
  return Buffer.from(message, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function isPastEventDate(value) {
  if (!value) return false;
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00-05:00`);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
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

function formatEventDateTime(date, startTime, endTime) {
  const dateText = formatDate(date);
  const startText = formatTime(startTime);
  const endText = formatTime(endTime);
  if (startText && endText) return `${dateText} · ${startText} - ${endText}`;
  if (startText) return `${dateText} · ${startText}`;
  return dateText;
}

function formatDate(value) {
  const clean = stringify(value);
  if (!clean) return "date pending";
  const date = new Date(`${clean.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return clean;
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(date);
}

function formatTime(value) {
  const clean = stringify(value).slice(0, 5);
  if (!/^\d{1,2}:\d{2}$/.test(clean)) return "";
  const [hours, minutes] = clean.split(":").map(Number);
  if (hours > 23 || minutes > 59) return "";
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date);
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
