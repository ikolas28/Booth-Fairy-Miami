const {
  setJson,
  supabaseAdmin,
  verifyAdminRequest
} = require("../gmail/_lib");

const CRON_SECRET = process.env.CRON_SECRET;

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
    const summary = await runMarketingAutomation();
    await recordAutomationRun("marketing", "completed", startedAt, summary);
    return setJson(res, 200, { ok: true, ...summary });
  } catch (error) {
    await recordAutomationRun("marketing", "failed", new Date().toISOString(), {
      error: error.message || "Marketing automation failed."
    });
    return setJson(res, error.statusCode || 500, {
      ok: false,
      error: error.message || "Marketing automation failed.",
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

async function runMarketingAutomation() {
  const today = todayIso();
  const weekKey = getWeekKey(new Date());
  const existing = await supabaseAdmin(`/campaigns?notes=ilike.${encodeURIComponent(`*Marketing automation batch ${weekKey}*`)}&select=id`, { method: "GET" });
  if (existing?.length) {
    return {
      campaignsCreated: 0,
      skipped: true,
      reason: `Marketing automation batch ${weekKey} already exists.`
    };
  }

  const leads = await supabaseAdmin("/leads?select=*&order=created_at.desc&limit=100", { method: "GET" });
  const stats = buildLeadStats(leads);
  const campaigns = buildCampaignDrafts(stats, weekKey, today);

  for (const campaign of campaigns) {
    await supabaseAdmin("/campaigns", {
      method: "POST",
      body: campaign
    });
  }

  return {
    campaignsCreated: campaigns.length,
    weekKey,
    topSource: stats.topSource,
    topEventType: stats.topEventType,
    note: "Campaigns were drafted only. Owner approval is required before publishing or running paid ads."
  };
}

function buildLeadStats(leads) {
  const openLeads = leads.filter((lead) => !["Completed", "Lost"].includes(lead.status));
  const djLeads = openLeads.filter((lead) => String(lead.service_requested || "").toLowerCase().includes("dj"));
  const boothLeads = openLeads.filter((lead) => String(lead.service_requested || "").toLowerCase().includes("photo booth") || String(lead.service_requested || "").toLowerCase().includes("dslr"));
  const instagramLeads = openLeads.filter((lead) => lead.source === "Instagram");

  return {
    openCount: openLeads.length,
    djCount: djLeads.length,
    boothCount: boothLeads.length,
    instagramCount: instagramLeads.length,
    instagramTopEventType: topBy(instagramLeads, "event_type") || "",
    instagramTopCity: topBy(instagramLeads, "city") || "",
    topSource: topBy(openLeads, "source") || "Website",
    topEventType: topBy(openLeads, "event_type") || "private events",
    topCity: topBy(openLeads, "city") || "Miami"
  };
}

function buildCampaignDrafts(stats, weekKey, today) {
  const batch = `Marketing automation batch ${weekKey}. Owner must review before publishing.`;
  return [
    {
      title: "Luxury digital photo booth spotlight",
      channel: "Instagram",
      status: "Ready for Review",
      priority: "High",
      notes: [
        batch,
        "Draft caption:",
        `A luxury DSLR digital photo booth experience for ${stats.topEventType} in ${stats.topCity}. Flattering studio flash, polished booth styling, custom overlay, instant sharing, and a digital gallery your guests can enjoy right away.`,
        "",
        "Suggested CTA: Send us your event date to check availability.",
        "Suggested hashtags: #BoothFairyMiami #MiamiPhotoBooth #DigitalPhotoBooth #MiamiEvents #LuxuryEventsMiami",
        `CRM signal: ${stats.instagramCount} open Instagram lead(s). ${stats.instagramTopEventType ? `Top Instagram inquiry type: ${stats.instagramTopEventType}.` : "No dominant Instagram inquiry type yet."}`,
        "Do not mention prints or 360 booth services."
      ].join("\n")
    },
    {
      title: "Instagram event inquiry follow-up",
      channel: "Instagram",
      status: "Ready for Review",
      priority: stats.instagramCount > 0 ? "High" : "Medium",
      notes: [
        batch,
        "Draft story idea:",
        "Post a polished availability prompt for people who already DM about events: 'Planning a Miami celebration? Send your event date, venue/city, guest count, and whether you need digital booth, DJ, or both.'",
        "",
        `CRM signal: ${stats.instagramCount} open Instagram lead(s). ${stats.instagramTopCity ? `Common city from Instagram leads: ${stats.instagramTopCity}.` : "City data is still building."}`,
        "Keep it organic. Do not publish paid ads without owner approval."
      ].join("\n")
    },
    {
      title: "Google Business digital booth post",
      channel: "Google Business",
      status: "Ready for Review",
      priority: "Medium",
      notes: [
        batch,
        "Draft post:",
        "Planning a Miami celebration? Booth Fairy Miami brings a refined DSLR digital photo booth setup with instant sharing, premium backdrop options, studio flash lighting, props, and an attendant. DJ services are also available as a premium add-on for a seamless entertainment experience.",
        "",
        "Suggested CTA: Request a quote.",
        "Owner approval required before posting."
      ].join("\n")
    },
    {
      title: "Photo booth and DJ bundle email",
      channel: "Email",
      status: "Ready for Review",
      priority: stats.djCount > 0 ? "High" : "Medium",
      notes: [
        batch,
        "Audience:",
        "Warm leads who asked about photo booth, DJ, or full event entertainment. Use Bcc if sending to more than one person.",
        "",
        "Client-facing subject:",
        "Make your Miami event feel effortless",
        "",
        "Client-facing email:",
        "Hi there,",
        "",
        "If you are still planning entertainment for your event, Booth Fairy Miami can make the setup feel simple and polished with one coordinated team for music, energy, and guest photos.",
        "",
        "Our luxury DSLR digital photo booth includes instant digital sharing, a premium backdrop look, studio-style lighting, a custom overlay, props, and an attendant. Premium DJ services can also be added for a smoother guest experience from start to finish.",
        "",
        "Reply with your event date, venue or city, and guest count, and we can check availability before sending the best package option.",
        "",
        "Best,",
        "Booth Fairy Miami",
        "",
        "Owner checklist:",
        "- Use only with warm leads or people who asked for event info.",
        "- Add recipients manually in Gmail, preferably Bcc for multiple contacts.",
        "- Review pricing before sending. Do not offer discounts without owner approval.",
        "",
        `CRM signal: ${stats.djCount} open DJ/bundle lead(s), ${stats.boothCount} open booth lead(s).`,
        "Do not auto-send. Use as owner-reviewed campaign copy."
      ].join("\n")
    },
    {
      title: `${stats.topCity} digital photo booth SEO idea`,
      channel: "Website SEO",
      status: "Idea",
      priority: "Medium",
      notes: [
        batch,
        `Draft SEO topic: Luxury Digital Photo Booth for ${stats.topCity} ${stats.topEventType}.`,
        "Content should emphasize DSLR image quality, instant digital sharing, premium backdrop, studio lighting, custom overlay, digital gallery delivery, and DJ add-on options.",
        "Only publish after reviewing page fit and conversion path."
      ].join("\n")
    },
    {
      title: "Luxury Miami digital booth ad concept",
      channel: "Meta Ads",
      status: "Idea",
      priority: "Low",
      notes: [
        batch,
        "Ad concept only. Do not publish paid ads without owner approval.",
        "Creative angle: Luxury Miami digital photo booth with instant sharing for weddings, birthdays, quinceaneras, corporate events, and private parties.",
        "Suggested offer copy must be reviewed before spending any ad budget."
      ].join("\n")
    }
  ];
}

function topBy(items, key) {
  const counts = new Map();
  for (const item of items) {
    const value = String(item[key] || "").trim();
    if (!value || value === "Not provided") continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
}

function getWeekKey(date) {
  const copy = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((copy - yearStart) / 86400000) + 1) / 7);
  return `${copy.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
