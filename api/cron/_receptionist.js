const {
  fetchGmailMessage,
  getValidGmailAccessToken,
  getGmailImportDecision,
  hasImportedMessage,
  importMessageAsLead,
  listGmailMessages,
  recordSkippedGmailImport,
  setJson,
  supabaseAdmin,
  verifyAdminRequest
} = require("../gmail/_lib");
const { patchLeadWithFallback } = require("../_lead-utils");

const CRON_SECRET = process.env.CRON_SECRET;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const SERVICE_AGREEMENT_URL = process.env.SERVICE_AGREEMENT_URL || "https://www.boothfairymiami.com/client-agreement.html";
const SERVICE_AGREEMENT_ENGLISH_PDF_URL = process.env.SERVICE_AGREEMENT_ENGLISH_PDF_URL || "https://www.boothfairymiami.com/assets/contracts/booth-fairy-miami-service-agreement-english.pdf";
const SERVICE_AGREEMENT_SPANISH_PDF_URL = process.env.SERVICE_AGREEMENT_SPANISH_PDF_URL || "https://www.boothfairymiami.com/assets/contracts/booth-fairy-miami-acuerdo-de-servicios-espanol.pdf";
const SITE_URL = process.env.SITE_URL || "https://www.boothfairymiami.com";
const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || "primary";
const TIME_ZONE = "America/New_York";

module.exports = async (req, res) => {
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return setJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const authorized = await verifyAutomationRequest(req);
    if (!authorized) {
      return setJson(res, 401, { ok: false, error: "Automation authorization required." });
    }

    const startedAt = new Date().toISOString();
    const summary = await runReceptionistAutomation();
    await recordAutomationRun("receptionist", "completed", startedAt, summary);
    return setJson(res, 200, { ok: true, ...summary });
  } catch (error) {
    await recordAutomationRun("receptionist", "failed", new Date().toISOString(), {
      error: error.message || "Receptionist automation failed."
    });
    return setJson(res, error.statusCode || 500, {
      ok: false,
      error: error.message || "Receptionist automation failed.",
      details: error.details || null
    });
  }
};

async function verifyAutomationRequest(req) {
  if (req.method === "GET") {
    return Boolean(CRON_SECRET) && req.headers.authorization === `Bearer ${CRON_SECRET}`;
  }
  return verifyAdminRequest(req);
}

async function recordAutomationRun(agent, status, startedAt, summary) {
  try {
    await supabaseAdmin("/automation_runs", {
      method: "POST",
      body: {
        agent,
        status,
        summary,
        started_at: startedAt,
        completed_at: new Date().toISOString()
      }
    });
  } catch {
    // Optional automation log migration may not be applied yet.
  }
}

async function runReceptionistAutomation() {
  const summary = {
    gmailImported: 0,
    gmailSkipped: 0,
    contactsPrepared: 0,
    calendarChecked: 0,
    draftsCreated: 0,
    paymentLinksCreated: 0,
    followupsCreated: 0,
    gmailLabelsApplied: 0,
    leadsUpdated: 0,
    errors: []
  };

  await syncGmail(summary);

  const leads = await supabaseAdmin("/leads?select=*&order=updated_at.asc&limit=75", { method: "GET" });
  for (const lead of leads) {
    try {
      await syncLeadGmailLabels(lead, summary);
    } catch (error) {
      summary.errors.push({
        leadId: lead.id,
        leadCode: lead.lead_code,
        error: error.message || "Gmail label automation failed."
      });
    }
  }

  for (const lead of leads.filter((item) => !["Event Completed", "Review Requested", "Repeat Client", "Completed", "Lost", "Booked", "Paid"].includes(item.status))) {
    try {
      await upsertContactFromLead(lead, summary);
      await processLead(lead, summary);
    } catch (error) {
      summary.errors.push({
        leadId: lead.id,
        leadCode: lead.lead_code,
        error: error.message || "Lead automation failed."
      });
    }
  }

  return summary;
}

async function getLeadBooking(leadId) {
  try {
    const rows = await supabaseAdmin(`/bookings?lead_id=eq.${encodeURIComponent(leadId)}&select=id,event_date,booking_status,deposit_status&limit=1`, { method: "GET" });
    return rows?.[0] || null;
  } catch {
    return null;
  }
}

async function syncGmail(summary) {
  const connection = await getValidGmailAccessToken();
  if (!connection) return;

  const messages = await listGmailMessages(connection.accessToken, connection.query);
  for (const messageSummary of messages) {
    if (await hasImportedMessage(messageSummary.id)) {
      summary.gmailSkipped += 1;
      continue;
    }
    const message = await fetchGmailMessage(connection.accessToken, messageSummary.id);
    const decision = getGmailImportDecision(message);
    if (!decision.shouldImport) {
      await recordSkippedGmailImport(message, decision.reason);
      summary.gmailSkipped += 1;
      continue;
    }

    await importMessageAsLead(message);
    summary.gmailImported += 1;
  }
}

async function processLead(lead, summary) {
  const patch = {};
  const noteLines = [];
  const missing = getMissingFields(lead);
  const hasEmail = isUsableEmail(lead.email);

  if (missing.length) {
    if (lead.status !== "Missing Info") {
      patch.status = "Missing Info";
    }
    if (hasEmail) {
      const created = await createDraftOnce({
        lead,
        subject: "Booth Fairy Miami event details needed",
        body: buildMissingInfoEmail(lead, missing),
        tag: "missing-info"
      });
      if (created) {
        summary.draftsCreated += 1;
        noteLines.push(`Receptionist automation drafted missing-info email ${todayIso()}: ${created}.`);
      }
    }
    summary.followupsCreated += await createFollowupOnce(lead, "Email", 2, "Follow up on missing event details before quoting or checking availability.");
  } else if (lead.status === "New Lead") {
    if (hasEmail) {
      const created = await createDraftOnce({
        lead,
        subject: "Booth Fairy Miami digital booth pricing",
        body: buildPricingEmail(lead),
        tag: "pricing"
      });
      if (created) {
        patch.status = "Quote Sent";
        summary.draftsCreated += 1;
        noteLines.push(`Receptionist automation drafted pricing reply ${todayIso()}: ${created}.`);
      }
    }
    summary.followupsCreated += await createFollowupOnce(lead, "Email", 2, "Follow up on quote and ask whether client wants to reserve the date.");
  }

  const checkedLead = { ...lead, ...patch };
  if (canCheckCalendar(checkedLead)) {
    const availability = await checkCalendar(checkedLead);
    summary.calendarChecked += 1;
    patch.calendar_checked = availability.available;
    noteLines.push(availability.available
      ? `Receptionist automation checked calendar ${todayIso()}: no busy blocks found. Booking still needs signed agreement and 50% retainer.`
      : `Receptionist automation checked calendar ${todayIso()}: ${availability.busy.length} busy block(s) found. Do not confirm availability.`);
    if (!availability.available) {
      patch.status = "Follow-Up Needed";
      summary.followupsCreated += await createFollowupOnce(lead, "Email", 1, "Calendar conflict found. Review manually before replying to the client.");
    }
  }

  const nextLead = { ...lead, ...patch };
  if (shouldPrepareBooking(nextLead)) {
    const prepared = await prepareDepositStep(nextLead);
    if (prepared.paymentUrl) summary.paymentLinksCreated += 1;
    if (prepared.draftId) summary.draftsCreated += 1;
    patch.status = "Deposit Pending";
    patch.payment_status = prepared.paymentUrl ? "Pending" : "Not Requested";
    noteLines.push(`Receptionist automation prepared contract/deposit ${todayIso()}. Contract: ${SERVICE_AGREEMENT_URL}. ${prepared.paymentUrl ? `Stripe retainer link: ${prepared.paymentUrl}.` : prepared.paymentSkippedReason} ${prepared.draftId ? `Gmail draft: ${prepared.draftId}.` : prepared.draftSkippedReason}`);
    summary.followupsCreated += await createFollowupOnce(lead, "Email", 1, "Review and send contract/deposit Gmail draft. Confirm signed agreement and 50% retainer before marking booked.");
  }

  if (noteLines.length) {
    patch.notes = appendNotes(lead.notes, noteLines.join("\n"));
  }

  if (Object.keys(patch).length) {
    await patchLeadWithFallback(supabaseAdmin, lead.id, patch);
    summary.leadsUpdated += 1;
    await syncLeadGmailLabels({ ...lead, ...patch }, summary);
  }
}

async function upsertContactFromLead(lead, summary) {
  if (!isUsableEmail(lead.email)) return;
  const existing = await supabaseAdmin(`/contacts?email=eq.${encodeURIComponent(lead.email)}&select=id&limit=1`, { method: "GET" });
  if (existing?.[0]) return;
  await supabaseAdmin("/contacts", {
    method: "POST",
    body: {
      client_name: lead.client_name || "Booth Fairy Lead",
      email: lead.email,
      phone: lead.phone === "Not provided" ? null : lead.phone,
      city: lead.city || null,
      notes: `Created by receptionist automation from lead ${lead.lead_code || lead.id}.`
    }
  });
  summary.contactsPrepared += 1;
}

async function syncLeadGmailLabels(lead, summary) {
  if (!lead?.id) return;
  const labelName = getLeadGmailLabel(lead);
  if (!labelName) return;

  const gmailRefs = await getLeadGmailRefs(lead.id);
  if (!gmailRefs.length) return;

  const connection = await getValidGmailAccessToken();
  if (!connection?.accessToken) return;

  for (const item of gmailRefs) {
    const targetId = item.gmail_thread_id || item.gmail_message_id;
    if (!targetId) continue;
    const applied = item.gmail_thread_id
      ? await moveGmailThreadToLeadLabel(connection.accessToken, targetId, labelName)
      : await moveGmailMessageToLeadLabel(connection.accessToken, targetId, labelName);
    if (applied) summary.gmailLabelsApplied += 1;
  }
}

async function getLeadGmailRefs(leadId) {
  const [imports, history] = await Promise.all([
    supabaseAdmin(`/gmail_imports?lead_id=eq.${encodeURIComponent(leadId)}&select=gmail_message_id,gmail_thread_id&limit=20`, { method: "GET" }).catch(() => []),
    supabaseAdmin(`/message_history?lead_id=eq.${encodeURIComponent(leadId)}&select=gmail_message_id,gmail_thread_id&order=created_at.desc&limit=20`, { method: "GET" }).catch(() => [])
  ]);
  const seen = new Set();
  return [...(imports || []), ...(history || [])].filter((item) => {
    const key = item.gmail_thread_id ? `t:${item.gmail_thread_id}` : item.gmail_message_id ? `m:${item.gmail_message_id}` : "";
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getLeadGmailLabel(lead) {
  const status = String(lead.status || "");
  const paymentStatus = String(lead.payment_status || "");
  if (status === "Lost") return "CRM-Lead/Lost";
  if (["Booked", "Paid", "Event Completed", "Completed", "Review Requested", "Repeat Client"].includes(status)) return "CRM-Lead/Booked";
  if (status === "Deposit Pending" || status === "Deposit Paid" || paymentStatus === "Pending") return "CRM-Lead/Deposit Pending";
  if (status === "Missing Info") return "CRM-Lead/Missing Info";
  if (status === "Quote Sent") return "CRM-Lead/Quote Needed";
  if (status === "Follow-Up" || status === "Follow-Up Needed") return "CRM-Lead/Follow-Up Needed";
  if (isReadyForBookingIntent(lead)) return "CRM-Lead/Booking Interest";
  if (status === "Contacted") return "CRM-Lead/Processed";
  if (status === "New Lead") return "CRM-Lead/New";
  return "CRM-Lead/Processed";
}

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

async function moveGmailThreadToLeadLabel(accessToken, threadId, labelName) {
  const { addLabelId, removeLabelIds } = await getLeadLabelMoveIds(accessToken, labelName);
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

async function moveGmailMessageToLeadLabel(accessToken, messageId, labelName) {
  const { addLabelId, removeLabelIds } = await getLeadLabelMoveIds(accessToken, labelName);
  if (!addLabelId) return false;
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}/modify`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ addLabelIds: [addLabelId], removeLabelIds })
  });
  return response.ok;
}

async function applyGmailThreadLabel(accessToken, threadId, labelName) {
  const labelId = await getOrCreateGmailLabel(accessToken, labelName);
  if (!labelId) return false;
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(threadId)}/modify`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ addLabelIds: [labelId] })
  });
  return response.ok;
}

async function applyGmailMessageLabel(accessToken, messageId, labelName) {
  const labelId = await getOrCreateGmailLabel(accessToken, labelName);
  if (!labelId) return false;
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}/modify`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ addLabelIds: [labelId] })
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
  const listResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/labels", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const listPayload = await listResponse.json().catch(() => null);
  return listResponse.ok ? listPayload?.labels || [] : [];
}

async function getOrCreateGmailLabel(accessToken, labelName) {
  const existing = (await listGmailLabels(accessToken)).find((label) => label.name === labelName);
  if (existing?.id) return existing.id;

  const createResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/labels", {
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
  const createPayload = await createResponse.json().catch(() => null);
  return createResponse.ok ? createPayload?.id || "" : "";
}

async function createDraftOnce({ lead, subject, body, tag }) {
  const existing = await supabaseAdmin(`/message_history?lead_id=eq.${encodeURIComponent(lead.id)}&draft_created=eq.true&subject=eq.${encodeURIComponent(subject)}&select=id&limit=1`, { method: "GET" });
  if (existing?.[0]) return "";

  const draft = await createGmailDraft(lead.email, subject, body);
  if (!draft.id) return "";

  await supabaseAdmin("/message_history", {
    method: "POST",
    body: {
      lead_id: lead.id,
      channel: "Gmail",
      direction: "Outbound",
      to_value: lead.email,
        subject,
        gmail_thread_id: draft.threadId || null,
        gmail_message_id: draft.messageId || null,
        summary: `Receptionist automation prepared ${tag} Gmail draft for owner review.`,
        draft_created: true,
      notes: `Gmail draft ID: ${draft.id}. Owner must review/send manually.`
    }
  });

  return draft.id;
}

async function createGmailDraft(to, subject, body, html = "") {
  const connection = await getValidGmailAccessToken();
  if (!connection) return { id: "", skippedReason: "Google/Gmail is not connected." };

  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${connection.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ message: { raw: buildRawEmail({ to, subject, body, html }) } })
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    return { id: "", skippedReason: payload?.error?.message || "Gmail draft could not be created." };
  }
  return {
    id: payload?.id || "",
    messageId: payload?.message?.id || "",
    threadId: payload?.message?.threadId || "",
    skippedReason: ""
  };
}

async function createFollowupOnce(lead, channel, daysFromNow, notes) {
  const openFollowups = await supabaseAdmin(`/followups?lead_id=eq.${encodeURIComponent(lead.id)}&status=eq.Open&select=id&limit=4`, { method: "GET" });
  if ((openFollowups || []).length >= 3) return 0;

  const existing = await supabaseAdmin(`/followups?lead_id=eq.${encodeURIComponent(lead.id)}&status=eq.Open&notes=eq.${encodeURIComponent(notes)}&select=id&limit=1`, { method: "GET" });
  if (existing?.[0]) return 0;
  await supabaseAdmin("/followups", {
    method: "POST",
    body: {
      lead_id: lead.id,
      due_date: addDaysIso(daysFromNow),
      channel,
      status: "Open",
      notes
    }
  });
  return 1;
}

async function checkCalendar(lead) {
  const connection = await getValidGmailAccessToken();
  if (!connection) {
    const error = new Error("Google account is not connected yet.");
    error.statusCode = 400;
    throw error;
  }
  const window = buildAvailabilityWindow(lead.event_date);
  const response = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${connection.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      timeMin: window.timeMin,
      timeMax: window.timeMax,
      timeZone: TIME_ZONE,
      items: [{ id: GOOGLE_CALENDAR_ID }]
    })
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload?.error?.message || "Google Calendar free/busy request failed.");
    error.details = payload;
    error.statusCode = response.status;
    throw error;
  }
  const busy = payload?.calendars?.[GOOGLE_CALENDAR_ID]?.busy || [];
  return { available: busy.length === 0, busy };
}

async function prepareDepositStep(lead) {
  const depositAmount = normalizeDepositAmount(lead);
  const existingPayment = await supabaseAdmin(`/payments?lead_id=eq.${encodeURIComponent(lead.id)}&status=eq.Pending&select=id,link&limit=1`, { method: "GET" });
  let paymentUrl = existingPayment?.[0]?.link || "";
  let paymentSkippedReason = "";

  if (!paymentUrl) {
    const payment = await createStripeCheckoutSession(lead, depositAmount);
    paymentUrl = payment.url;
    paymentSkippedReason = payment.skippedReason;
    if (paymentUrl) {
      await supabaseAdmin("/payments", {
        method: "POST",
        body: {
          lead_id: lead.id,
          type: "Deposit Request",
          amount: depositAmount,
          status: "Pending",
          link: paymentUrl,
          stripe_session_id: payment.sessionId || null,
          stripe_payment_intent_id: payment.paymentIntentId || null,
          notes: "50% retainer checkout link created by receptionist automation."
        }
      });
    }
  }

  const subject = buildBookingSubject(lead);
  const existingDraft = await supabaseAdmin(`/message_history?lead_id=eq.${encodeURIComponent(lead.id)}&draft_created=eq.true&subject=eq.${encodeURIComponent(subject)}&select=id&limit=1`, { method: "GET" });
  if (existingDraft?.[0]) {
    return { paymentUrl, paymentSkippedReason, draftId: "", draftSkippedReason: "Booking draft already exists." };
  }

  const draft = await createGmailDraft(lead.email, subject, buildBookingEmail(lead, depositAmount, paymentUrl), buildBookingEmailHtml(lead, depositAmount, paymentUrl));
  if (draft.id) {
    await supabaseAdmin("/message_history", {
      method: "POST",
      body: {
        lead_id: lead.id,
        channel: "Gmail",
        direction: "Outbound",
        to_value: lead.email,
        subject,
        gmail_thread_id: draft.threadId || null,
        gmail_message_id: draft.messageId || null,
        summary: "Receptionist automation prepared contract and 50% retainer Gmail draft for owner review.",
        draft_created: true,
        notes: `Gmail draft ID: ${draft.id}. Do not mark booked until signed agreement and retainer are confirmed.`
      }
    });
  }

  return {
    paymentUrl,
    paymentSkippedReason,
    draftId: draft.id,
    draftSkippedReason: draft.skippedReason
  };
}

async function createStripeCheckoutSession(lead, depositAmount) {
  const stripeSecretKey = normalizeStripeSecretKey(STRIPE_SECRET_KEY);
  if (!stripeSecretKey) {
    return { url: "", skippedReason: "Missing STRIPE_SECRET_KEY." };
  }
  if (!isValidStripeSecretKey(stripeSecretKey)) {
    return { url: "", skippedReason: `Stripe key is the wrong type (${describeStripeKeyType(stripeSecretKey)}). Set STRIPE_SECRET_KEY to sk_live_ or sk_test_.` };
  }

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      mode: "payment",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][product_data][name]": `Booth Fairy Miami 50% Retainer - ${lead.client_name}`,
      "line_items[0][price_data][product_data][description]": buildPaymentDescription(lead),
      "line_items[0][price_data][unit_amount]": String(Math.round(depositAmount * 100)),
      "line_items[0][quantity]": "1",
      customer_email: lead.email,
      success_url: `${SITE_URL}/thank-you.html?payment=success`,
      cancel_url: `${SITE_URL}/admin?payment=cancelled`,
      "metadata[lead_id]": lead.id || "",
      "metadata[lead_code]": lead.lead_code || "",
      "metadata[payment_type]": "50_percent_retainer",
      "metadata[client_name]": lead.client_name || "",
      "metadata[event_date]": lead.event_date || ""
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
  return /^sk_(live|test)_[A-Za-z0-9]/.test(normalizeStripeSecretKey(value));
}

function normalizeStripeSecretKey(value) {
  return String(value || "")
    .trim()
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

function getMissingFields(lead) {
  const missing = [];
  if (!lead.event_date) missing.push("event date");
  if (!lead.venue && !lead.city) missing.push("venue or city");
  if (!lead.phone || lead.phone === "Not provided") missing.push("phone number");
  if (!lead.guest_count) missing.push("guest count");
  return missing;
}

function canCheckCalendar(lead) {
  return Boolean(lead.event_date && !lead.calendar_checked && getMissingFields(lead).length === 0);
}

function shouldPrepareBooking(lead) {
  if (!isUsableEmail(lead.email) || !lead.calendar_checked || lead.payment_status === "Paid") return false;
  if (["Deposit Pending", "Deposit Paid", "Booked", "Paid", "Event Completed", "Review Requested", "Repeat Client", "Completed", "Lost"].includes(lead.status)) return false;
  const notes = `${lead.notes || ""} ${lead.status || ""}`.toLowerCase();
  return /\b(book|booking|reserve|contract|deposit|retainer|payment link|ready to pay)\b/.test(notes);
}

function shouldCreateDesignTask(lead) {
  const service = String(lead.service_requested || "").toLowerCase();
  const status = String(lead.status || "");
  const paymentStatus = String(lead.payment_status || "");
  const needsBoothDesign = service.includes("booth") || service.includes("dslr") || service.includes("photo");
  return needsBoothDesign && (["Booked", "Deposit Paid", "Paid"].includes(status) || paymentStatus === "Paid");
}

function inferVideoFormats(lead) {
  const text = `${lead.service_requested || ""} ${lead.notes || ""}`.toLowerCase();
  if (!/\b(video|gif|boomerang|slow motion|slow-motion)\b/.test(text)) return [];
  return ["portrait-long", "portrait", "square", "landscape", "landscape-long"];
}

function getDefaultApprovalDeadline(eventDate) {
  if (!eventDate) return addDaysIso(3);
  const date = new Date(`${eventDate}T12:00:00`);
  date.setDate(date.getDate() - 14);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  if (date < today) return addDaysIso(3);
  return date.toISOString().slice(0, 10);
}

function buildEventFolderPath(lead) {
  return [
    "Booth Fairy Miami CRM",
    "Events",
    `${lead.event_date || "date-pending"}_${slugify(lead.client_name || "client")}_${slugify(lead.event_type || "event")}`
  ].join("/");
}

function buildPricingEmail(lead) {
  return [
    `Hi ${lead.client_name || "there"},`,
    "",
    "Our DSLR digital photo booth includes instant sharing, premium backdrop, studio flash lighting, props, attendant, custom overlay, unlimited sessions, and digital gallery delivery.",
    "",
    "Starter pricing is 2 hours $450, 3 hours $575, 4 hours $700. Additional hours available upon request.",
    "",
    "We also offer professional DJ services and DJ + Photo Booth bundles for a seamless entertainment experience. Before confirming availability, I will check the calendar for your event date.",
    "",
    "Warmly,",
    "Booth Fairy Miami",
    "DSLR Photo Booth & DJ Services",
    "(786) 315-9117",
    "www.boothfairymiami.com",
    "info@boothfairymiami.com"
  ].join("\n");
}

function buildBookingEmail(lead, depositAmount, paymentUrl) {
  return [
    `Hi ${lead.client_name || "there"},`,
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

function buildBookingEmailHtml(lead, depositAmount, paymentUrl) {
  const paymentAction = paymentUrl
    ? `<p><a href="${escapeAttribute(paymentUrl)}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#171125;color:#ffffff;text-decoration:none;font-weight:700;">Pay 50% retainer</a></p>`
    : `<p><strong>50% retainer payment link:</strong> [Add Stripe payment link before sending]</p>`;

  return [
    `<p>Hi ${escapeHtml(lead.client_name || "there")},</p>`,
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

function buildBookingSubject(lead) {
  return `Booth Fairy Miami next steps${lead.event_date ? ` for ${lead.event_date}` : ""}`;
}

function normalizeDepositAmount(lead) {
  const budget = Number(lead.budget || 0);
  if (budget > 0) return roundMoney(budget * 0.5);
  const text = String(lead.service_requested || "").toLowerCase();
  if (text.includes("4 hour") || text.includes("$700")) return 350;
  if (text.includes("3 hour") || text.includes("$575")) return 287.5;
  return 225;
}

function buildPaymentDescription(lead) {
  return [
    lead.event_type,
    lead.event_date,
    lead.service_requested,
    lead.venue || lead.city
  ].filter(Boolean).join(" | ").slice(0, 500);
}

function buildAvailabilityWindow(date) {
  return {
    timeMin: toRfc3339WithOffset(date, "00:00", TIME_ZONE),
    timeMax: toRfc3339WithOffset(date, "23:59", TIME_ZONE)
  };
}

function toRfc3339WithOffset(date, time, timeZone) {
  const offset = getTimeZoneOffset(date, time, timeZone);
  return `${date}T${time}:00${formatOffset(offset)}`;
}

function getTimeZoneOffset(date, time, timeZone) {
  const probe = new Date(`${date}T${time}:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(probe);
  const zoneName = parts.find((part) => part.type === "timeZoneName")?.value || "GMT-5";
  const match = zoneName.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
  if (!match) return -300;
  const sign = match[1] === "+" ? 1 : -1;
  return sign * (Number(match[2] || 0) * 60 + Number(match[3] || 0));
}

function formatOffset(offsetMinutes) {
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absolute = Math.abs(offsetMinutes);
  return `${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")}`;
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

function appendNotes(existing, next) {
  return [existing, next].filter(Boolean).join("\n\n");
}

function isUsableEmail(email) {
  return Boolean(email && email !== "Not provided" && email.includes("@"));
}

function addDaysIso(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function capitalize(value) {
  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "event";
}
