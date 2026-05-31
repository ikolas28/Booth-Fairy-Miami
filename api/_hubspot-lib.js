const HUBSPOT_PRIVATE_APP_TOKEN = cleanEnvValue(process.env.HUBSPOT_PRIVATE_APP_TOKEN);
const HUBSPOT_PIPELINE_ID = cleanEnvValue(process.env.HUBSPOT_PIPELINE_ID) || "default";
const HUBSPOT_OWNER_ID = cleanEnvValue(process.env.HUBSPOT_OWNER_ID) || "";
const HUBSPOT_DEAL_STAGE_NEW = cleanEnvValue(process.env.HUBSPOT_DEAL_STAGE_NEW) || "appointmentscheduled";
const HUBSPOT_DEAL_STAGE_CONTACTED = cleanEnvValue(process.env.HUBSPOT_DEAL_STAGE_CONTACTED) || "qualifiedtobuy";
const HUBSPOT_DEAL_STAGE_QUOTE_SENT = cleanEnvValue(process.env.HUBSPOT_DEAL_STAGE_QUOTE_SENT) || "presentationscheduled";
const HUBSPOT_DEAL_STAGE_AWAITING_DEPOSIT = cleanEnvValue(process.env.HUBSPOT_DEAL_STAGE_AWAITING_DEPOSIT) || "contractsent";
const HUBSPOT_DEAL_STAGE_BOOKED = cleanEnvValue(process.env.HUBSPOT_DEAL_STAGE_BOOKED) || "closedwon";
const HUBSPOT_DEAL_STAGE_COMPLETED = cleanEnvValue(process.env.HUBSPOT_DEAL_STAGE_COMPLETED) || "closedwon";
const HUBSPOT_DEAL_STAGE_LOST = cleanEnvValue(process.env.HUBSPOT_DEAL_STAGE_LOST) || "closedlost";

const propertyCache = new Map();
const REQUIRED_HUBSPOT_SCOPES = [
  "crm.objects.contacts.read",
  "crm.objects.contacts.write",
  "crm.objects.deals.read",
  "crm.objects.deals.write"
];
const OPTIONAL_HUBSPOT_SCOPES = [
  "crm.schemas.contacts.read",
  "crm.schemas.deals.read"
];
const FALLBACK_PROPERTY_NAMES = {
  contacts: new Set([
    "email",
    "firstname",
    "lastname",
    "phone",
    "lifecyclestage",
    "hs_lead_status",
    "hubspot_owner_id"
  ]),
  deals: new Set([
    "dealname",
    "pipeline",
    "dealstage",
    "amount",
    "dealtype",
    "hubspot_owner_id",
    "description"
  ])
};

async function getHubSpotStatus() {
  if (!HUBSPOT_PRIVATE_APP_TOKEN) {
    return {
      ok: true,
      configured: false,
      message: "Add HUBSPOT_PRIVATE_APP_TOKEN in Vercel to enable HubSpot sync."
    };
  }

  const connection = await validateCrmAccess();
  const propertyAccess = await validatePropertyAccess();
  return {
    ok: connection.ok,
    configured: true,
    portalReachable: connection.ok,
    ownerId: HUBSPOT_OWNER_ID || "",
    pipelineId: HUBSPOT_PIPELINE_ID,
    defaultStages: getStageSummary(),
    requiredScopes: REQUIRED_HUBSPOT_SCOPES,
    optionalScopes: OPTIONAL_HUBSPOT_SCOPES,
    propertyReadEnabled: propertyAccess.ok,
    warning: propertyAccess.ok ? "" : propertyAccess.error,
    error: connection.error || ""
  };
}

async function validateCrmAccess() {
  try {
    await hubspotFetch("/crm/v3/objects/contacts?limit=1&properties=email");
    await hubspotFetch("/crm/v3/objects/deals?limit=1&properties=dealname");
    return { ok: true, error: "" };
  } catch (error) {
    return { ok: false, error: formatHubSpotError(error) };
  }
}

async function validatePropertyAccess() {
  try {
    await Promise.all([getPropertyNames("contacts"), getPropertyNames("deals")]);
    return { ok: true, error: "" };
  } catch (error) {
    return { ok: false, error: formatHubSpotError(error) };
  }
}

async function syncLeadToHubSpot(lead, options = {}) {
  if (!HUBSPOT_PRIVATE_APP_TOKEN) {
    return {
      ok: false,
      skipped: true,
      reason: "HubSpot sync skipped because HUBSPOT_PRIVATE_APP_TOKEN is not configured."
    };
  }

  const normalized = normalizeLead(lead);
  if (!normalized.email && !normalized.phone) {
    return {
      ok: false,
      skipped: true,
      reason: "HubSpot sync skipped because lead has no usable email or phone."
    };
  }

  const contact = await upsertContact(normalized);
  const deal = await upsertDeal(normalized, contact.id, options);
  return {
    ok: true,
    contactId: contact.id,
    dealId: deal.id,
    contactUrl: `https://app.hubspot.com/contacts/record/0-1/${contact.id}`,
    dealUrl: `https://app.hubspot.com/contacts/record/0-3/${deal.id}`
  };
}

async function upsertContact(lead) {
  const existing = lead.email ? await findContactByEmail(lead.email) : null;
  const properties = await filterExistingProperties("contacts", {
    email: lead.email || undefined,
    firstname: firstName(lead.clientName),
    lastname: lastName(lead.clientName),
    phone: lead.phone || undefined,
    lifecyclestage: "lead",
    hs_lead_status: mapLeadStatus(lead.status),
    hubspot_owner_id: HUBSPOT_OWNER_ID || undefined,
    booth_fairy_lead_source: lead.source || undefined,
    booth_fairy_event_type: lead.eventType || undefined,
    booth_fairy_preferred_service: lead.serviceRequested || undefined,
    booth_fairy_crm_lead_id: lead.id || undefined
  });

  if (existing?.id) {
    await hubspotFetch(`/crm/v3/objects/contacts/${existing.id}`, {
      method: "PATCH",
      body: { properties }
    });
    return { id: existing.id };
  }

  const created = await hubspotFetch("/crm/v3/objects/contacts", {
    method: "POST",
    body: { properties }
  });
  return { id: created.id };
}

async function upsertDeal(lead, contactId, options = {}) {
  if (lead.hubspotDealId) {
    const properties = await buildDealProperties(lead);
    await hubspotFetch(`/crm/v3/objects/deals/${lead.hubspotDealId}`, {
      method: "PATCH",
      body: { properties }
    });
    return { id: lead.hubspotDealId };
  }

  const existing = await findDealByCrmLeadId(lead.id).catch(() => null);
  if (existing?.id) {
    const properties = await buildDealProperties(lead);
    await hubspotFetch(`/crm/v3/objects/deals/${existing.id}`, {
      method: "PATCH",
      body: { properties }
    });
    return { id: existing.id };
  }

  const properties = await buildDealProperties(lead);
  const createBody = {
    properties,
    associations: contactId ? [{
      to: { id: contactId },
      types: [{
        associationCategory: "HUBSPOT_DEFINED",
        associationTypeId: 3
      }]
    }] : []
  };

  const created = await hubspotFetch("/crm/v3/objects/deals", {
    method: "POST",
    body: createBody
  }).catch(async (error) => {
    if (!contactId || !String(error.message || "").toLowerCase().includes("association")) throw error;
    return hubspotFetch("/crm/v3/objects/deals", {
      method: "POST",
      body: { properties }
    });
  });

  return { id: created.id };
}

async function buildDealProperties(lead) {
  const amount = Number(lead.budget || lead.totalQuote || 0);
  const properties = {
    dealname: buildDealName(lead),
    pipeline: HUBSPOT_PIPELINE_ID,
    dealstage: mapDealStage(lead.status, lead.paymentStatus),
    amount: amount > 0 ? String(amount) : undefined,
    dealtype: "newbusiness",
    hubspot_owner_id: HUBSPOT_OWNER_ID || undefined,
    description: buildDealDescription(lead),
    booth_fairy_event_date: lead.eventDate || undefined,
    booth_fairy_event_start_time: lead.startTime || undefined,
    booth_fairy_event_end_time: lead.endTime || undefined,
    booth_fairy_event_type: lead.eventType || undefined,
    booth_fairy_venue: lead.venue || undefined,
    booth_fairy_event_city: lead.city || undefined,
    booth_fairy_service_requested: lead.serviceRequested || undefined,
    booth_fairy_guest_count: lead.guestCount ? String(lead.guestCount) : undefined,
    booth_fairy_deposit_amount: lead.depositAmount ? String(lead.depositAmount) : undefined,
    booth_fairy_balance_due: lead.balanceDue ? String(lead.balanceDue) : undefined,
    booth_fairy_lead_source: lead.source || undefined,
    booth_fairy_crm_lead_id: lead.id || undefined,
    booth_fairy_crm_booking_id: lead.bookingId || undefined
  };
  return filterExistingProperties("deals", properties);
}

async function findContactByEmail(email) {
  const payload = await hubspotFetch("/crm/v3/objects/contacts/search", {
    method: "POST",
    body: {
      filterGroups: [{
        filters: [{ propertyName: "email", operator: "EQ", value: email }]
      }],
      properties: ["email"],
      limit: 1
    }
  });
  return payload.results?.[0] || null;
}

async function findDealByCrmLeadId(leadId) {
  if (!leadId) return null;
  const properties = await getPropertyNames("deals");
  if (!properties.has("booth_fairy_crm_lead_id")) return null;
  const payload = await hubspotFetch("/crm/v3/objects/deals/search", {
    method: "POST",
    body: {
      filterGroups: [{
        filters: [{ propertyName: "booth_fairy_crm_lead_id", operator: "EQ", value: leadId }]
      }],
      properties: ["dealname", "booth_fairy_crm_lead_id"],
      limit: 1
    }
  });
  return payload.results?.[0] || null;
}

async function filterExistingProperties(objectType, properties) {
  const allowed = await getPropertyNames(objectType);
  return Object.fromEntries(Object.entries(properties)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .filter(([key]) => allowed.has(key)));
}

async function getPropertyNames(objectType) {
  if (propertyCache.has(objectType)) return propertyCache.get(objectType);
  try {
    const payload = await hubspotFetch(`/crm/v3/properties/${objectType}`);
    const names = new Set((payload.results || []).map((property) => property.name));
    propertyCache.set(objectType, names);
    return names;
  } catch (error) {
    if (isMissingScopeError(error) && FALLBACK_PROPERTY_NAMES[objectType]) {
      const names = FALLBACK_PROPERTY_NAMES[objectType];
      propertyCache.set(objectType, names);
      return names;
    }
    throw error;
  }
}

async function hubspotFetch(path, options = {}) {
  const response = await fetch(`https://api.hubapi.com${path}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${HUBSPOT_PRIVATE_APP_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await response.text();
  const payload = text ? safeParse(text) : null;
  if (!response.ok) {
    const error = new Error(payload?.message || payload?.error || "HubSpot API request failed.");
    error.statusCode = response.status;
    error.details = payload;
    throw error;
  }
  return payload;
}

function isMissingScopeError(error) {
  const message = `${error?.message || ""} ${JSON.stringify(error?.details || {})}`.toLowerCase();
  return message.includes("scope") || message.includes("forbidden") || error?.statusCode === 403;
}

function formatHubSpotError(error) {
  const details = error?.details || {};
  const message = details.message || error?.message || "HubSpot API request failed.";
  const missingScopes = details.errors
    ?.flatMap((item) => item.context?.requiredScopes || item.context?.missingScopes || [])
    ?.filter(Boolean);
  if (missingScopes?.length) {
    return `HubSpot key is missing scope: ${[...new Set(missingScopes)].join(", ")}`;
  }
  if (String(message).toLowerCase().includes("scope")) {
    return `${message} Required for CRM sync: ${REQUIRED_HUBSPOT_SCOPES.join(", ")}. Optional property detection: ${OPTIONAL_HUBSPOT_SCOPES.join(", ")}.`;
  }
  return message;
}

function normalizeLead(lead = {}) {
  return {
    id: stringify(lead.id || lead.lead_id || lead.crmLeadId),
    bookingId: stringify(lead.booking_id || lead.bookingId),
    hubspotDealId: stringify(lead.hubspot_deal_id || lead.hubspotDealId),
    clientName: stringify(lead.client_name || lead.clientName || lead.name || "Booth Fairy Lead"),
    email: normalizeEmail(lead.email),
    phone: cleanPhone(lead.phone),
    eventType: stringify(lead.event_type || lead.eventType || "General Inquiry"),
    eventDate: normalizeDate(lead.event_date || lead.eventDate),
    startTime: normalizeTime(lead.start_time || lead.startTime),
    endTime: normalizeTime(lead.end_time || lead.endTime),
    venue: stringify(lead.venue),
    city: stringify(lead.city),
    serviceRequested: stringify(lead.service_requested || lead.serviceRequested || "DSLR Photo Booth - Digital Sharing"),
    guestCount: Number(lead.guest_count || lead.guestCount || 0),
    budget: Number(lead.budget || lead.total_quote || lead.totalQuote || 0),
    totalQuote: Number(lead.total_quote || lead.totalQuote || lead.budget || 0),
    depositAmount: Number(lead.deposit_required || lead.depositAmount || 0),
    balanceDue: Number(lead.balance_due || lead.balanceDue || 0),
    source: stringify(lead.source || "Website"),
    status: stringify(lead.status || lead.booking_status || "New Lead"),
    paymentStatus: stringify(lead.payment_status || lead.paymentStatus || "Not Requested"),
    notes: stringify(lead.notes)
  };
}

function mapLeadStatus(status) {
  const value = stringify(status).toLowerCase();
  if (value.includes("new")) return "NEW";
  if (value.includes("contact") || value.includes("quote")) return "CONNECTED";
  if (value.includes("deposit") || value.includes("paid") || value.includes("book")) return "OPEN_DEAL";
  if (value.includes("lost")) return "UNQUALIFIED";
  return "OPEN";
}

function mapDealStage(status, paymentStatus) {
  const value = `${status} ${paymentStatus}`.toLowerCase();
  if (value.includes("lost")) return HUBSPOT_DEAL_STAGE_LOST;
  if (value.includes("completed") || value.includes("review")) return HUBSPOT_DEAL_STAGE_COMPLETED;
  if (value.includes("booked") || value.includes("paid")) return HUBSPOT_DEAL_STAGE_BOOKED;
  if (value.includes("deposit")) return HUBSPOT_DEAL_STAGE_AWAITING_DEPOSIT;
  if (value.includes("quote")) return HUBSPOT_DEAL_STAGE_QUOTE_SENT;
  if (value.includes("contacted") || value.includes("follow")) return HUBSPOT_DEAL_STAGE_CONTACTED;
  return HUBSPOT_DEAL_STAGE_NEW;
}

function getStageSummary() {
  return {
    newInquiry: HUBSPOT_DEAL_STAGE_NEW,
    contacted: HUBSPOT_DEAL_STAGE_CONTACTED,
    quoteSent: HUBSPOT_DEAL_STAGE_QUOTE_SENT,
    awaitingDeposit: HUBSPOT_DEAL_STAGE_AWAITING_DEPOSIT,
    booked: HUBSPOT_DEAL_STAGE_BOOKED,
    completed: HUBSPOT_DEAL_STAGE_COMPLETED,
    lost: HUBSPOT_DEAL_STAGE_LOST
  };
}

function buildDealName(lead) {
  return [
    lead.clientName || "Booth Fairy Lead",
    lead.eventDate || "Date TBD",
    lead.serviceRequested || "Event"
  ].filter(Boolean).join(" | ");
}

function buildDealDescription(lead) {
  return [
    `Booth Fairy Miami CRM lead${lead.id ? `: ${lead.id}` : ""}`,
    `Source: ${lead.source || "Website"}`,
    `Event: ${lead.eventType || "General Inquiry"}`,
    lead.eventDate ? `Date/time: ${lead.eventDate}${lead.startTime ? ` ${lead.startTime}` : ""}${lead.endTime ? ` - ${lead.endTime}` : ""}` : "Date/time: missing",
    `Service: ${lead.serviceRequested || "DSLR Photo Booth - Digital Sharing"}`,
    lead.venue || lead.city ? `Location: ${[lead.venue, lead.city].filter(Boolean).join(", ")}` : "",
    lead.guestCount ? `Guest count: ${lead.guestCount}` : "",
    lead.notes ? `Notes: ${lead.notes}` : "",
    "Business rule: never confirm booking until calendar availability, signed agreement, and payment/retainer are confirmed."
  ].filter(Boolean).join("\n");
}

function firstName(name) {
  return stringify(name).split(/\s+/)[0] || "";
}

function lastName(name) {
  const parts = stringify(name).split(/\s+/).filter(Boolean);
  return parts.length > 1 ? parts.slice(1).join(" ") : "";
}

function normalizeEmail(value) {
  const email = stringify(value).toLowerCase();
  if (!email || email === "not provided" || !email.includes("@")) return "";
  return email;
}

function cleanPhone(value) {
  const phone = stringify(value);
  return phone.toLowerCase() === "not provided" ? "" : phone;
}

function normalizeDate(value) {
  const date = stringify(value);
  return date ? date.slice(0, 10) : "";
}

function normalizeTime(value) {
  const time = stringify(value);
  return time ? time.slice(0, 5) : "";
}

function stringify(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function cleanEnvValue(value) {
  return stringify(value).replace(/^['"]+|['"]+$/g, "");
}

function safeParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

module.exports = {
  getHubSpotStatus,
  syncLeadToHubSpot
};
