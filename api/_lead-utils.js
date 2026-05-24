const CLOSED_STATUSES = new Set(["Event Completed", "Review Requested", "Repeat Client", "Completed", "Lost"]);

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizePhone(value) {
  return String(value || "").replace(/[^\d+]/g, "");
}

function normalizeLeadForIntel(lead = {}) {
  return {
    id: lead.id || "",
    email: normalizeEmail(lead.email),
    phone: normalizePhone(lead.phone),
    eventDate: lead.event_date || lead.eventDate || "",
    eventType: lead.event_type || lead.eventType || "",
    city: lead.city || "",
    venue: lead.venue || "",
    source: lead.source || "Website",
    serviceRequested: lead.service_requested || lead.serviceRequested || "",
    notes: lead.notes || "",
    status: lead.status || "New Lead"
  };
}

function calculateLeadScore(lead) {
  const normalized = normalizeLeadForIntel(lead);
  const text = [
    normalized.eventType,
    normalized.city,
    normalized.venue,
    normalized.serviceRequested,
    normalized.notes
  ].join(" ").toLowerCase();

  let score = 0;
  if (/\b(available|availability|book|booking|reserve|ready to pay|contract|deposit)\b/.test(text)) score += 30;
  if (normalized.eventDate) score += 25;
  if (normalized.phone && normalized.phone !== "Not provided") score += 20;
  if (text.includes("dj") && (text.includes("booth") || text.includes("photo"))) score += 20;
  if (/\b(miami|south florida|brickell|wynwood|doral|coral gables|hialeah|aventura|homestead|fort lauderdale|broward|palm beach)\b/.test(text)) score += 10;
  if (/\b(vendor|supplier|seo|backlink|guest post|lead generation|web design|business loan|wholesale)\b/.test(text)) score -= 30;
  return Math.max(0, Math.min(100, score));
}

function buildLeadTags(lead) {
  const normalized = normalizeLeadForIntel(lead);
  const text = [
    normalized.eventType,
    normalized.city,
    normalized.serviceRequested,
    normalized.notes
  ].join(" ").toLowerCase();
  const tags = new Set();

  if (normalized.source) tags.add(normalized.source);
  if (text.includes("dj")) tags.add("DJ");
  if (text.includes("booth") || text.includes("dslr") || text.includes("photo")) tags.add("Photo Booth");
  if (text.includes("bundle") || (text.includes("dj") && text.includes("booth"))) tags.add("Bundle");
  if (text.includes("wedding")) tags.add("Wedding");
  if (text.includes("quince")) tags.add("Quince");
  if (text.includes("corporate") || text.includes("brand")) tags.add("Corporate");
  if (normalized.eventDate) tags.add("Has Event Date");
  else tags.add("Missing Date");
  if (normalized.phone && normalized.phone !== "Not provided") tags.add("Has Phone");
  else tags.add("Missing Phone");
  if (normalized.status === "Deposit Pending" || normalized.status === "Deposit Paid") tags.add("Hot Lead");
  if (normalized.status === "Calendar Checked" || text.includes("calendar checked")) tags.add("Calendar Checked");

  const score = calculateLeadScore(lead);
  if (score >= 70) tags.add("Hot Lead");
  return [...tags].slice(0, 20);
}

function withLeadIntelligence(lead) {
  return {
    ...lead,
    tags: buildLeadTags(lead),
    lead_score: calculateLeadScore(lead)
  };
}

function stripLeadIntelligence(lead) {
  const { tags, lead_score, ...rest } = lead || {};
  return rest;
}

function isMissingLeadOptionalColumn(error) {
  const text = `${error?.message || ""} ${JSON.stringify(error?.details || {})}`.toLowerCase();
  return text.includes("lead_score") || text.includes("tags") || text.includes("schema cache") || text.includes("column");
}

function stripUnavailableLeadColumns(error, lead) {
  const text = `${error?.message || ""} ${JSON.stringify(error?.details || {})}`.toLowerCase();
  const next = { ...(lead || {}) };
  if (text.includes("tags") || text.includes("lead_score")) {
    delete next.tags;
    delete next.lead_score;
  }
  if (text.includes("start_time")) delete next.start_time;
  if (text.includes("end_time")) delete next.end_time;
  return next;
}

async function insertLeadWithFallback(supabaseAdmin, lead) {
  let payload = lead;
  let lastError = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await supabaseAdmin("/leads", { method: "POST", body: payload });
    } catch (error) {
      if (!isMissingLeadOptionalColumn(error)) throw error;
      lastError = error;
      payload = stripUnavailableLeadColumns(error, stripLeadIntelligence(payload));
    }
  }
  throw lastError;
}

async function patchLeadWithFallback(supabaseAdmin, leadId, patch) {
  let payload = patch;
  let lastError = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await supabaseAdmin(`/leads?id=eq.${encodeURIComponent(leadId)}`, { method: "PATCH", body: payload });
    } catch (error) {
      if (!isMissingLeadOptionalColumn(error)) throw error;
      lastError = error;
      payload = stripUnavailableLeadColumns(error, stripLeadIntelligence(payload));
    }
  }
  throw lastError;
}

async function findDuplicateLead(supabaseAdmin, lead) {
  const normalized = normalizeLeadForIntel(lead);
  const candidates = [];
  if (normalized.email) {
    candidates.push(...await fetchCandidates(supabaseAdmin, `email=eq.${encodeURIComponent(normalized.email)}`));
  }
  if (normalized.phone && normalized.phone !== "Not provided") {
    candidates.push(...await fetchCandidates(supabaseAdmin, `phone=eq.${encodeURIComponent(lead.phone || normalized.phone)}`));
  }

  const unique = [...new Map(candidates.map((item) => [item.id, item])).values()];
  return unique.find((candidate) => {
    if (CLOSED_STATUSES.has(candidate.status)) return false;
    if (normalized.eventDate && candidate.event_date && normalized.eventDate !== candidate.event_date) return false;
    return true;
  }) || null;
}

async function fetchCandidates(supabaseAdmin, filter) {
  try {
    return await supabaseAdmin(`/leads?${filter}&select=id,lead_code,email,phone,event_date,status&order=created_at.desc&limit=10`, { method: "GET" });
  } catch {
    return [];
  }
}

async function recordLeadScore(supabaseAdmin, leadId, lead, reason = "Lead intelligence calculated") {
  try {
    await supabaseAdmin("/lead_scores", {
      method: "POST",
      body: {
        lead_id: leadId,
        score: calculateLeadScore(lead),
        tags: buildLeadTags(lead),
        reason
      }
    });
  } catch {
    // Optional migration may not be applied yet.
  }
}

async function recordLeadDuplicate(supabaseAdmin, incoming, duplicate, source = "automation") {
  try {
    await supabaseAdmin("/lead_duplicates", {
      method: "POST",
      body: {
        incoming_email: incoming.email || null,
        incoming_phone: incoming.phone || null,
        incoming_source: incoming.source || source,
        matched_lead_id: duplicate.id,
        match_reason: incoming.event_date || incoming.eventDate ? "email_or_phone_and_event_date" : "email_or_phone_open_lead",
        confidence: incoming.event_date || incoming.eventDate ? 95 : 80
      }
    });
  } catch {
    // Optional migration may not be applied yet.
  }
}

module.exports = {
  buildLeadTags,
  calculateLeadScore,
  findDuplicateLead,
  normalizeEmail,
  normalizePhone,
  recordLeadDuplicate,
  recordLeadScore,
  insertLeadWithFallback,
  patchLeadWithFallback,
  withLeadIntelligence
};
