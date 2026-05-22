const SUPABASE_PROJECT_ID = "hwwhyrpwfewxevocjjzk";
const SUPABASE_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co`;
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3d2h5cnB3ZmV3eGV2b2NqanprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MDAzMDksImV4cCI6MjA5NDk3NjMwOX0.-55qhrFYuzcAqQRhO01oxP4EJP3jyR9qU-qNDW_pAxI";
const LOCAL_ADMIN_EMAIL = "admin@boothfairymiami.com";
const LOCAL_ADMIN_PASSWORD = "BoothFairyAdmin!";
const ALLOWED_ADMIN_EMAILS = ["boothfairyllc@gmail.com"];
const AUTH_SESSION_KEY = "bfmSupabaseSession";
const STORAGE_KEYS = {
  leads: "bfmCrmLeads",
  followups: "bfmCrmFollowups",
  payments: "bfmCrmPayments",
  campaigns: "bfmCrmCampaigns"
};

const LEAD_STATUSES = [
  "New Lead",
  "Missing Info",
  "Quote Sent",
  "Follow-Up Needed",
  "Deposit Pending",
  "Booked",
  "Paid",
  "Completed",
  "Lost"
];

const BOOKING_STATUSES = new Set(["Deposit Pending", "Booked", "Paid", "Completed"]);
const CONFIRMED_STATUSES = new Set(["Booked", "Paid", "Completed"]);
const REMOTE_COLLECTIONS = ["leads", "followups", "payments", "campaigns"];

const seedLeads = [
  {
    id: crypto.randomUUID(),
    clientName: "Sofia Martinez",
    phone: "(786) 555-0181",
    email: "sofia@sample.com",
    eventType: "Wedding",
    eventDate: "2026-08-15",
    venue: "Villa Toscana Miami",
    city: "Miami",
    serviceRequested: "Luxury DSLR Digital Booth",
    guestCount: 120,
    budget: 900,
    notes: "Luxury wedding inquiry. Wants clean white backdrop and digital gallery. Availability still needs to be checked.",
    status: "Quote Sent",
    paymentStatus: "Pending",
    calendarChecked: "No",
    source: "Website",
    createdAt: "2026-05-18",
    updatedAt: "2026-05-18"
  },
  {
    id: crypto.randomUUID(),
    clientName: "Marcos Ruiz",
    phone: "(305) 555-0136",
    email: "marcos@brandlaunch.co",
    eventType: "Brand Activation",
    eventDate: "2026-07-12",
    venue: "Wynwood Event Loft",
    city: "Miami",
    serviceRequested: "Booth + DJ Services",
    guestCount: 180,
    budget: 2000,
    notes: "Needs branded overlay and social capture. Confirm sponsor approvals before final quote.",
    status: "Follow-Up Needed",
    paymentStatus: "Not Requested",
    calendarChecked: "Yes",
    source: "Gmail",
    createdAt: "2026-05-16",
    updatedAt: "2026-05-16"
  },
  {
    id: crypto.randomUUID(),
    clientName: "Alyssa Grant",
    phone: "(954) 555-0194",
    email: "alyssa@sample.com",
    eventType: "Birthday Party",
    eventDate: "2026-06-21",
    venue: "Private Residence",
    city: "Hallandale",
    serviceRequested: "Luxury DSLR Digital Booth",
    guestCount: 55,
    budget: 550,
    notes: "Came in from Tidio chat. Wants quick digital sharing only. Deposit link requested.",
    status: "Deposit Pending",
    paymentStatus: "Pending",
    calendarChecked: "Yes",
    source: "Tidio",
    createdAt: "2026-05-20",
    updatedAt: "2026-05-20"
  },
  {
    id: crypto.randomUUID(),
    clientName: "Camila Vega",
    phone: "(786) 555-0127",
    email: "camila@sample.com",
    eventType: "Baby Shower",
    eventDate: "2026-09-05",
    venue: "Coral Gables Country Club",
    city: "Coral Gables",
    serviceRequested: "Luxury DSLR Digital Booth",
    guestCount: 70,
    budget: 700,
    notes: "Instagram DM lead. Wants feminine floral setup and soft glam editing.",
    status: "New Lead",
    paymentStatus: "Not Requested",
    calendarChecked: "No",
    source: "Instagram",
    createdAt: "2026-05-19",
    updatedAt: "2026-05-19"
  },
  {
    id: crypto.randomUUID(),
    clientName: "Noah Ellis",
    phone: "(786) 555-0108",
    email: "noah@sample.com",
    eventType: "Corporate Holiday Party",
    eventDate: "2026-12-06",
    venue: "Brickell Bay Ballroom",
    city: "Brickell",
    serviceRequested: "High-End DJ Services",
    guestCount: 240,
    budget: 3200,
    notes: "Premium DJ only inquiry. Needs proposal and entertainment timeline. Never confirm until calendar is checked.",
    status: "Missing Info",
    paymentStatus: "Not Requested",
    calendarChecked: "No",
    source: "Website",
    createdAt: "2026-05-17",
    updatedAt: "2026-05-17"
  }
];

const seedFollowups = [
  {
    id: crypto.randomUUID(),
    leadId: seedLeads[1].id,
    dueDate: "2026-05-22",
    channel: "Email",
    status: "Open",
    notes: "Send refined proposal with booth + DJ bundle options.",
    createdAt: "2026-05-20",
    updatedAt: "2026-05-20"
  },
  {
    id: crypto.randomUUID(),
    leadId: seedLeads[2].id,
    dueDate: "2026-05-21",
    channel: "Text",
    status: "Open",
    notes: "Check whether client received deposit link and answer timing questions.",
    createdAt: "2026-05-20",
    updatedAt: "2026-05-20"
  }
];

const seedPayments = [
  {
    id: crypto.randomUUID(),
    leadId: seedLeads[2].id,
    type: "Deposit Request",
    amount: 200,
    status: "Pending",
    link: "https://stripe.example.com/pay/alyssa-deposit",
    notes: "Deposit placeholder until live Stripe sync is connected.",
    createdAt: "2026-05-20",
    updatedAt: "2026-05-20"
  }
];

const seedCampaigns = [
  {
    id: crypto.randomUUID(),
    title: "Wedding venue partnership reel",
    channel: "Instagram",
    status: "Idea",
    priority: "High",
    notes: "Show editorial booth coverage plus premium guest experience at a Miami venue.",
    createdAt: "2026-05-20",
    updatedAt: "2026-05-20"
  },
  {
    id: crypto.randomUUID(),
    title: "Luxury DJ add-on email sequence",
    channel: "Email",
    status: "Drafting",
    priority: "Medium",
    notes: "Warm current booth leads with an elegant DJ upsell flow.",
    createdAt: "2026-05-20",
    updatedAt: "2026-05-20"
  },
  {
    id: crypto.randomUUID(),
    title: "Wedding Photo Booth Miami SEO article",
    channel: "Website SEO",
    status: "Ready for Review",
    priority: "High",
    notes: "Target local wedding intent and link back to the main booking page.",
    createdAt: "2026-05-20",
    updatedAt: "2026-05-20"
  }
];

const COLLECTION_CONFIG = {
  leads: {
    table: "leads",
    toDb: mapLeadToDb,
    fromDb: mapLeadFromDb,
    sort: (items) => items.sort((a, b) => compareDates(a.eventDate, b.eventDate) || compareDates(b.createdAt, a.createdAt))
  },
  followups: {
    table: "followups",
    toDb: mapFollowupToDb,
    fromDb: mapFollowupFromDb,
    sort: (items) => items.sort((a, b) => compareDates(a.dueDate, b.dueDate) || compareDates(b.createdAt, a.createdAt))
  },
  payments: {
    table: "payments",
    toDb: mapPaymentToDb,
    fromDb: mapPaymentFromDb,
    sort: (items) => items.sort((a, b) => compareDates(b.createdAt, a.createdAt))
  },
  campaigns: {
    table: "campaigns",
    toDb: mapCampaignToDb,
    fromDb: mapCampaignFromDb,
    sort: (items) => items.sort((a, b) => compareDates(b.createdAt, a.createdAt))
  }
};

const state = {
  leads: loadData(STORAGE_KEYS.leads, seedLeads),
  followups: loadData(STORAGE_KEYS.followups, seedFollowups),
  payments: loadData(STORAGE_KEYS.payments, seedPayments),
  campaigns: loadData(STORAGE_KEYS.campaigns, seedCampaigns),
  activeSection: "dashboard",
  leadSearch: "",
  leadStatusFilter: "all",
  syncMode: "Local cache",
  syncDetail: "Sign in to sync your CRM."
};

const authState = {
  session: null,
  user: null,
  isLocalFallback: false
};

const authShell = document.getElementById("auth-shell");
const appShell = document.getElementById("app-shell");
const sectionTitle = document.getElementById("section-title");
const navButtons = [...document.querySelectorAll(".nav-item")];
const sections = [...document.querySelectorAll(".section")];
const loginForm = document.getElementById("login-form");
const authError = document.getElementById("auth-error");
const logoutButton = document.getElementById("logout-button");
const googleLoginButton = document.getElementById("google-login-button");
const authLocalNote = document.getElementById("auth-local-note");
const userEmailLabel = document.getElementById("user-email");
const syncModeLabel = document.getElementById("sync-mode-label");
const supabaseStatusChip = document.getElementById("supabase-status-chip");
const setupBanner = document.getElementById("setup-banner");
const emailLoginButton = document.getElementById("email-login-button");

init().catch((error) => {
  console.error("CRM init failed", error);
  showAuthError("The admin CRM could not finish loading. Please refresh and try again.");
});

async function init() {
  populateStatusSelects();
  attachEventListeners();
  showLocalDevNote();
  updateConnectionIndicators();
  renderAll();

  const oauthState = handleOAuthReturn();
  if (oauthState.error) {
    showAuthError(oauthState.error);
  }

  const restored = await restoreSession();
  if (!restored) {
    return;
  }

  unlockApp();
  await hydrateData();
}

function attachEventListeners() {
  loginForm.addEventListener("submit", handleLogin);
  logoutButton.addEventListener("click", handleLogout);
  googleLoginButton.addEventListener("click", handleGoogleLogin);

  navButtons.forEach((button) => {
    button.addEventListener("click", () => setSection(button.dataset.section));
  });

  document.getElementById("quick-add-lead").addEventListener("click", () => openLeadModal());
  document.getElementById("quick-add-followup").addEventListener("click", () => openFollowupModal());
  document.getElementById("new-followup-button").addEventListener("click", () => openFollowupModal());
  document.getElementById("new-payment-button").addEventListener("click", () => openPaymentModal());
  document.getElementById("new-campaign-button").addEventListener("click", () => openCampaignModal());

  document.getElementById("lead-search").addEventListener("input", (event) => {
    state.leadSearch = event.target.value.toLowerCase().trim();
    renderLeadCards();
  });

  document.getElementById("lead-status-filter").addEventListener("change", (event) => {
    state.leadStatusFilter = event.target.value;
    renderLeadCards();
  });

  document.getElementById("drawer-close").addEventListener("click", closeDrawer);
  document.getElementById("lead-drawer").addEventListener("click", (event) => {
    if (event.target.id === "lead-drawer") {
      closeDrawer();
    }
  });

  document.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", () => closeModal(button.dataset.closeModal));
  });

  ["lead-modal", "followup-modal", "payment-modal", "campaign-modal"].forEach((id) => {
    const modal = document.getElementById(id);
    modal.addEventListener("click", (event) => {
      if (event.target.id === id) {
        closeModal(id);
      }
    });
  });

  document.getElementById("lead-form").addEventListener("submit", handleLeadSubmit);
  document.getElementById("followup-form").addEventListener("submit", handleFollowupSubmit);
  document.getElementById("payment-form").addEventListener("submit", handlePaymentSubmit);
  document.getElementById("campaign-form").addEventListener("submit", handleCampaignSubmit);
}

function showLocalDevNote() {
  authLocalNote.hidden = !isLocalhost();
}

function handleOAuthReturn() {
  if (!window.location.hash.startsWith("#")) {
    return { error: "" };
  }

  const params = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  const expiresIn = Number(params.get("expires_in") || 0);
  const errorDescription = params.get("error_description") || params.get("error");

  if (errorDescription) {
    clearLocationHash();
    return { error: decodeURIComponent(errorDescription) };
  }

  if (!accessToken) {
    return { error: "" };
  }

  authState.session = {
    accessToken,
    refreshToken,
    tokenType: params.get("token_type") || "bearer",
    expiresAt: Date.now() + Math.max(expiresIn - 60, 60) * 1000
  };
  saveSession(authState.session);
  clearLocationHash();
  return { error: "" };
}

async function restoreSession() {
  if (authState.session) {
    return validateSession();
  }

  const stored = loadJson(AUTH_SESSION_KEY);
  if (!stored) {
    return false;
  }

  authState.session = stored;
  if (needsRefresh(stored) && stored.refreshToken) {
    const refreshed = await refreshSession(stored.refreshToken);
    if (!refreshed) {
      clearSavedSession();
      return false;
    }
  }

  return validateSession();
}

async function validateSession() {
  if (authState.isLocalFallback) {
    authState.user = { email: LOCAL_ADMIN_EMAIL };
    state.syncMode = "Localhost demo";
    state.syncDetail = "Running on localhost with local-only demo credentials.";
    showSetupBanner("Localhost demo mode is active. Supabase sign-in is still available, but this session is intentionally local-only.", "info");
    return true;
  }

  if (!authState.session?.accessToken) {
    return false;
  }

  const user = await fetchCurrentUser(authState.session.accessToken);
  if (!user && authState.session.refreshToken) {
    const refreshed = await refreshSession(authState.session.refreshToken);
    if (!refreshed) {
      clearSavedSession();
      return false;
    }
    return validateSession();
  }

  if (!user || !isAllowedAdminEmail(user.email)) {
    await clearRemoteSession();
    showAuthError("This Google or email account is not approved for Booth Fairy Miami admin access yet.");
    return false;
  }

  authState.user = user;
  return true;
}

async function handleLogin(event) {
  event.preventDefault();
  showAuthError("");
  emailLoginButton.disabled = true;
  emailLoginButton.textContent = "Signing In...";

  try {
    const email = document.getElementById("login-email").value.trim().toLowerCase();
    const password = document.getElementById("login-password").value;

    if (isLocalhost() && email === LOCAL_ADMIN_EMAIL.toLowerCase() && password === LOCAL_ADMIN_PASSWORD) {
      authState.isLocalFallback = true;
      authState.session = null;
      authState.user = { email: LOCAL_ADMIN_EMAIL };
      unlockApp();
      await hydrateData();
      loginForm.reset();
      return;
    }

    const session = await signInWithPassword(email, password);
    if (!session?.access_token) {
      throw new Error("Supabase did not return a valid session.");
    }

    authState.isLocalFallback = false;
    authState.session = {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      tokenType: session.token_type || "bearer",
      expiresAt: Date.now() + Math.max((session.expires_in || 3600) - 60, 60) * 1000
    };
    saveSession(authState.session);

    const valid = await validateSession();
    if (!valid) {
      throw new Error("Your account is not approved for admin access.");
    }

    unlockApp();
    await hydrateData();
    loginForm.reset();
  } catch (error) {
    console.error(error);
    showAuthError(getFriendlyError(error, "Sign-in failed. Double-check your Supabase admin user and password."));
  } finally {
    emailLoginButton.disabled = false;
    emailLoginButton.textContent = "Sign In With Email";
  }
}

function handleGoogleLogin() {
  showAuthError("");
  const redirectTo = getAuthRedirectUrl();
  const url = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`;
  window.location.href = url;
}

async function handleLogout() {
  if (!authState.isLocalFallback) {
    await clearRemoteSession();
  }

  authState.session = null;
  authState.user = null;
  authState.isLocalFallback = false;
  clearSavedSession();
  appShell.hidden = true;
  authShell.hidden = false;
  hideSetupBanner();
  state.syncMode = "Local cache";
  state.syncDetail = "Sign in to sync your CRM.";
  updateConnectionIndicators();
}

function unlockApp() {
  authShell.hidden = true;
  appShell.hidden = false;
  userEmailLabel.textContent = authState.user?.email || "Signed in";
}

async function hydrateData() {
  if (authState.isLocalFallback) {
    state.syncMode = "Localhost demo";
    state.syncDetail = "Local-only records. Supabase tables are bypassed in this session.";
    showSetupBanner("Localhost demo mode is active. Supabase sign-in is still available, but this session is intentionally local-only.", "info");
    updateConnectionIndicators();
    renderAll();
    return;
  }

  const loaded = await loadRemoteCollections();
  if (loaded) {
    hideSetupBanner();
  }

  updateConnectionIndicators();
  renderAll();
}

async function loadRemoteCollections() {
  try {
    const [leads, followups, payments, campaigns] = await Promise.all([
      fetchCollection("leads"),
      fetchCollection("followups"),
      fetchCollection("payments"),
      fetchCollection("campaigns")
    ]);

    state.leads = leads;
    state.followups = followups;
    state.payments = payments;
    state.campaigns = campaigns;
    state.syncMode = "Supabase live";
    state.syncDetail = "Real CRM records are syncing with Supabase.";
    persistAll();
    return true;
  } catch (error) {
    console.error("Supabase load failed", error);
    state.syncMode = "Local cache";
    state.syncDetail = "Using local cache until the CRM tables are ready.";
    showSetupBanner("Supabase auth is connected, but the CRM tables are not ready yet. Run database/supabase/schema.sql in the Supabase SQL Editor, then refresh the admin CRM.", "warning");
    return false;
  }
}

async function fetchCollection(resourceKey) {
  const config = COLLECTION_CONFIG[resourceKey];
  const rows = await supabaseRest(`/${config.table}?select=*`);
  return config.sort(rows.map(config.fromDb));
}

async function handleLeadSubmit(event) {
  event.preventDefault();
  const existingLead = getLeadById(document.getElementById("lead-id").value);
  const lead = {
    id: document.getElementById("lead-id").value || crypto.randomUUID(),
    clientName: document.getElementById("lead-client-name").value.trim(),
    phone: document.getElementById("lead-phone").value.trim(),
    email: document.getElementById("lead-email").value.trim(),
    eventType: document.getElementById("lead-event-type").value.trim(),
    eventDate: document.getElementById("lead-event-date").value,
    venue: document.getElementById("lead-venue").value.trim(),
    city: document.getElementById("lead-city").value.trim(),
    serviceRequested: document.getElementById("lead-service-requested").value,
    guestCount: Number(document.getElementById("lead-guest-count").value || 0),
    budget: Number(document.getElementById("lead-budget").value || 0),
    source: document.getElementById("lead-source").value,
    status: document.getElementById("lead-status").value,
    paymentStatus: document.getElementById("lead-payment-status").value,
    calendarChecked: document.getElementById("lead-calendar-checked").value,
    notes: document.getElementById("lead-notes").value.trim(),
    createdAt: existingLead?.createdAt || todayIso(),
    updatedAt: todayIso()
  };

  try {
    const savedLead = await upsertResource("leads", lead);
    upsertLocalItem(state.leads, savedLead);
    closeModal("lead-modal");
    renderAll();
  } catch (error) {
    console.error(error);
    alert(getFriendlyError(error, "Lead could not be saved."));
  }
}

async function handleFollowupSubmit(event) {
  event.preventDefault();
  const existing = state.followups.find((item) => item.id === document.getElementById("followup-id").value);
  const followup = {
    id: document.getElementById("followup-id").value || crypto.randomUUID(),
    leadId: document.getElementById("followup-lead-id").value,
    dueDate: document.getElementById("followup-due-date").value,
    channel: document.getElementById("followup-channel").value,
    status: document.getElementById("followup-status").value,
    notes: document.getElementById("followup-notes").value.trim(),
    createdAt: existing?.createdAt || todayIso(),
    updatedAt: todayIso()
  };

  try {
    const savedFollowup = await upsertResource("followups", followup);
    upsertLocalItem(state.followups, savedFollowup);
    closeModal("followup-modal");
    renderAll();
  } catch (error) {
    console.error(error);
    alert(getFriendlyError(error, "Follow-up could not be saved."));
  }
}

async function handlePaymentSubmit(event) {
  event.preventDefault();
  const existing = state.payments.find((item) => item.id === document.getElementById("payment-id").value);
  const payment = {
    id: document.getElementById("payment-id").value || crypto.randomUUID(),
    leadId: document.getElementById("payment-lead-id").value,
    type: document.getElementById("payment-type").value,
    amount: Number(document.getElementById("payment-amount").value || 0),
    status: document.getElementById("payment-status").value,
    link: document.getElementById("payment-link").value.trim(),
    notes: document.getElementById("payment-notes").value.trim(),
    createdAt: existing?.createdAt || todayIso(),
    updatedAt: todayIso()
  };

  try {
    const savedPayment = await upsertResource("payments", payment);
    upsertLocalItem(state.payments, savedPayment);
    const lead = state.leads.find((item) => item.id === savedPayment.leadId);
    if (lead && savedPayment.status === "Paid") {
      lead.paymentStatus = "Paid";
      lead.updatedAt = todayIso();
      const savedLead = await upsertResource("leads", lead);
      upsertLocalItem(state.leads, savedLead);
    }
    closeModal("payment-modal");
    renderAll();
  } catch (error) {
    console.error(error);
    alert(getFriendlyError(error, "Payment record could not be saved."));
  }
}

async function handleCampaignSubmit(event) {
  event.preventDefault();
  const existing = state.campaigns.find((item) => item.id === document.getElementById("campaign-id").value);
  const campaign = {
    id: document.getElementById("campaign-id").value || crypto.randomUUID(),
    title: document.getElementById("campaign-title").value.trim(),
    channel: document.getElementById("campaign-channel").value,
    status: document.getElementById("campaign-status").value,
    priority: document.getElementById("campaign-priority").value,
    notes: document.getElementById("campaign-notes").value.trim(),
    createdAt: existing?.createdAt || todayIso(),
    updatedAt: todayIso()
  };

  try {
    const savedCampaign = await upsertResource("campaigns", campaign);
    upsertLocalItem(state.campaigns, savedCampaign);
    closeModal("campaign-modal");
    renderAll();
  } catch (error) {
    console.error(error);
    alert(getFriendlyError(error, "Campaign could not be saved."));
  }
}

function setSection(sectionName) {
  state.activeSection = sectionName;
  navButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.section === sectionName);
  });
  sections.forEach((section) => {
    section.classList.toggle("active", section.dataset.section === sectionName);
  });
  sectionTitle.textContent = getSectionTitle(sectionName);
}

function getSectionTitle(sectionName) {
  return {
    dashboard: "Dashboard",
    leads: "Leads",
    bookings: "Bookings",
    followups: "Follow-Ups",
    payments: "Payments",
    gmail: "Gmail Leads",
    tidio: "Tidio Leads",
    instagram: "Instagram Leads",
    marketing: "Marketing Campaigns"
  }[sectionName] || "Dashboard";
}

function renderAll() {
  sortCollections();
  renderKpis();
  renderStatusGrid();
  renderNextFollowups();
  renderUpcomingBookings();
  renderLeadCards();
  renderBookings();
  renderFollowups();
  renderPayments();
  renderSourceLeads("Gmail", document.getElementById("gmail-leads"));
  renderSourceLeads("Tidio", document.getElementById("tidio-leads"));
  renderSourceLeads("Instagram", document.getElementById("instagram-leads"));
  renderCampaigns();
  refreshSelectMenus();
  persistAll();
  updateConnectionIndicators();
}

function renderKpis() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const openLeads = state.leads.filter((lead) => !["Completed", "Lost"].includes(lead.status)).length;
  const bookedCount = state.leads.filter((lead) => CONFIRMED_STATUSES.has(lead.status)).length;
  const followupCount = state.followups.filter((followup) => followup.status === "Open").length;
  const pendingPayments = state.payments.filter((payment) => payment.status === "Pending").length;
  const leadsThisMonth = state.leads.filter((lead) => (lead.createdAt || "").startsWith(currentMonth)).length;

  const cards = [
    ["Open leads", openLeads, "Active inquiries across all channels"],
    ["Confirmed bookings", bookedCount, "Only count after calendar and payment checks"],
    ["Open follow-ups", followupCount, "Reminders still needing action"],
    ["Pending payments", pendingPayments, "Deposit or invoice links awaiting payment"],
    [`${formatMonthLabel(currentMonth)} lead volume`, leadsThisMonth, "Current CRM month snapshot"],
    ["DJ opportunities", state.leads.filter((lead) => lead.serviceRequested.includes("DJ")).length, "Leads where DJ services are part of the request"],
    ["Instagram inquiries", state.leads.filter((lead) => lead.source === "Instagram").length, "DM and social lead opportunities"],
    ["Website pipeline", state.leads.filter((lead) => lead.source === "Website").length, "Website and form-based inquiries"]
  ];

  document.getElementById("kpi-grid").innerHTML = cards.map(([label, value, meta]) => `
    <article class="kpi-card">
      <p>${escapeHtml(label)}</p>
      <strong>${escapeHtml(String(value))}</strong>
      <p>${escapeHtml(meta)}</p>
    </article>
  `).join("");
}

function renderStatusGrid() {
  document.getElementById("status-grid").innerHTML = LEAD_STATUSES.map((status) => {
    const count = state.leads.filter((lead) => lead.status === status).length;
    return `
      <article class="status-card">
        <p>${escapeHtml(status)}</p>
        <strong>${count}</strong>
      </article>
    `;
  }).join("");
}

function renderNextFollowups() {
  const list = [...state.followups]
    .filter((followup) => followup.status === "Open")
    .sort((a, b) => compareDates(a.dueDate, b.dueDate))
    .slice(0, 4);

  const container = document.getElementById("next-followups");
  if (!list.length) {
    container.innerHTML = emptyState("No follow-ups yet", "Create reminders for new leads or quotes that need a second touch.");
    return;
  }

  container.innerHTML = list.map((followup) => {
    const lead = state.leads.find((item) => item.id === followup.leadId);
    return `
      <div class="stack-item">
        <div>
          <strong>${escapeHtml(lead?.clientName || "Unknown Lead")}</strong>
          <p>${escapeHtml(followup.channel)} follow-up due ${escapeHtml(formatDate(followup.dueDate))}</p>
        </div>
        <span class="chip chip-muted">${escapeHtml(followup.status)}</span>
      </div>
    `;
  }).join("");
}

function renderUpcomingBookings() {
  const rows = [...state.leads]
    .filter((lead) => BOOKING_STATUSES.has(lead.status))
    .sort((a, b) => compareDates(a.eventDate, b.eventDate))
    .slice(0, 6)
    .map((lead) => `
      <tr>
        <td>${escapeHtml(lead.clientName)}</td>
        <td>${escapeHtml(formatDate(lead.eventDate))}</td>
        <td>${escapeHtml(lead.serviceRequested)}</td>
        <td>${statusChip(lead.status)}</td>
        <td>${escapeHtml(lead.paymentStatus)}</td>
      </tr>
    `)
    .join("");

  document.getElementById("upcoming-bookings").innerHTML = rows || `<tr><td colspan="5">No booking records yet.</td></tr>`;
}

function renderLeadCards() {
  const list = filterLeads(state.leads);
  const container = document.getElementById("lead-cards");

  if (!list.length) {
    container.innerHTML = emptyState("No leads match this filter", "Try another search or add a new inquiry record.");
    return;
  }

  container.innerHTML = list.map((lead) => `
    <article class="card">
      <div class="card-top">
        <div>
          <strong>${escapeHtml(lead.clientName)}</strong>
          <p class="card-meta">${escapeHtml(`${lead.eventType} | ${lead.city || "City pending"}`)}</p>
        </div>
        ${statusChip(lead.status)}
      </div>
      <div class="card-meta">
        <span>${escapeHtml(formatDate(lead.eventDate))}</span>
        <span>${escapeHtml(lead.serviceRequested)}</span>
        <span>${escapeHtml(lead.source)}</span>
        <span>${escapeHtml(String(lead.guestCount || 0))} guests</span>
      </div>
      <p class="card-notes">${escapeHtml(lead.notes || "No notes yet.")}</p>
      <div class="card-actions">
        <button class="button button-secondary" onclick="openLeadDrawer('${lead.id}')">View</button>
        <button class="button button-secondary" onclick="openLeadModal('${lead.id}')">Edit</button>
        <button class="button button-danger" onclick="deleteLead('${lead.id}')">Delete</button>
      </div>
    </article>
  `).join("");
}

function renderBookings() {
  const rows = [...state.leads]
    .filter((lead) => !!lead.eventDate)
    .sort((a, b) => compareDates(a.eventDate, b.eventDate))
    .map((lead) => `
      <tr>
        <td>${escapeHtml(lead.clientName)}</td>
        <td>${escapeHtml(formatDate(lead.eventDate))}</td>
        <td>${escapeHtml(lead.serviceRequested)}</td>
        <td>${escapeHtml(lead.venue || "Pending venue")}</td>
        <td>${escapeHtml(lead.paymentStatus)}</td>
        <td>
          <select class="select-inline" onchange="updateLeadStatus('${lead.id}', this.value)">
            ${LEAD_STATUSES.map((status) => `<option value="${status}" ${status === lead.status ? "selected" : ""}>${status}</option>`).join("")}
          </select>
          <p class="status-note">${escapeHtml(lead.calendarChecked === "Yes" ? "Calendar checked" : "Availability still needs confirmation")}</p>
        </td>
        <td class="row-actions">
          <button class="button button-secondary" onclick="openLeadDrawer('${lead.id}')">View</button>
          <button class="button button-secondary" onclick="openLeadModal('${lead.id}')">Edit</button>
        </td>
      </tr>
    `).join("");

  document.getElementById("booking-rows").innerHTML = rows || `<tr><td colspan="7">No booking records available.</td></tr>`;
}

function renderFollowups() {
  const container = document.getElementById("followup-list");

  if (!state.followups.length) {
    container.innerHTML = emptyState("No reminders yet", "Create a follow-up for quotes, missing info, or unpaid deposits.");
    return;
  }

  container.innerHTML = [...state.followups]
    .sort((a, b) => compareDates(a.dueDate, b.dueDate))
    .map((followup) => {
      const lead = state.leads.find((item) => item.id === followup.leadId);
      return `
        <article class="timeline-item">
          <div class="source-card-top">
            <strong>${escapeHtml(lead?.clientName || "Unknown Lead")}</strong>
            <span class="chip ${followup.status === "Completed" ? "chip-muted" : ""}">${escapeHtml(followup.status)}</span>
          </div>
          <p>${escapeHtml(followup.notes)}</p>
          <div class="card-meta">
            <span>${escapeHtml(followup.channel)}</span>
            <span>${escapeHtml(formatDate(followup.dueDate))}</span>
          </div>
          <div class="timeline-actions">
            <button class="button button-secondary" onclick="openFollowupModal('${followup.id}')">Edit</button>
            <button class="button button-danger" onclick="deleteFollowup('${followup.id}')">Delete</button>
          </div>
        </article>
      `;
    }).join("");
}

function renderPayments() {
  const body = document.getElementById("payment-rows");
  body.innerHTML = state.payments.map((payment) => {
    const lead = state.leads.find((item) => item.id === payment.leadId);
    return `
      <tr>
        <td>${escapeHtml(lead?.clientName || "Unknown Lead")}</td>
        <td>${escapeHtml(payment.type)}</td>
        <td>${escapeHtml(formatCurrency(payment.amount))}</td>
        <td>${escapeHtml(payment.status)}</td>
        <td><a href="${escapeAttribute(payment.link)}" target="_blank" rel="noreferrer">Open link</a></td>
        <td class="row-actions">
          <button class="button button-secondary" onclick="openPaymentModal('${payment.id}')">Edit</button>
          <button class="button button-danger" onclick="deletePayment('${payment.id}')">Delete</button>
        </td>
      </tr>
    `;
  }).join("") || `<tr><td colspan="6">No payment records yet.</td></tr>`;
}

function renderSourceLeads(source, container) {
  const leads = state.leads.filter((lead) => lead.source === source);

  if (!leads.length) {
    container.innerHTML = emptyState(`No ${source} leads yet`, `Once ${source} sync is connected, this section can auto-populate.`);
    return;
  }

  container.innerHTML = leads.map((lead) => `
    <article class="source-card">
      <div class="source-card-top">
        <strong>${escapeHtml(lead.clientName)}</strong>
        ${statusChip(lead.status)}
      </div>
      <p>${escapeHtml(`${lead.eventType} on ${formatDate(lead.eventDate)} | ${lead.serviceRequested}`)}</p>
      <div class="card-meta">
        <span>${escapeHtml(lead.email)}</span>
        <span>${escapeHtml(lead.phone)}</span>
      </div>
      <div class="card-actions">
        <button class="button button-secondary" onclick="openLeadDrawer('${lead.id}')">View</button>
        <button class="button button-secondary" onclick="openLeadModal('${lead.id}')">Edit</button>
      </div>
    </article>
  `).join("");
}

function renderCampaigns() {
  const container = document.getElementById("campaign-board");
  const columns = ["Idea", "Drafting", "Ready for Review", "Scheduled", "Published"];

  container.innerHTML = columns.map((column) => {
    const items = state.campaigns.filter((campaign) => campaign.status === column);
    return `
      <section class="campaign-column">
        <h3>${escapeHtml(column)}</h3>
        ${items.length ? items.map((campaign) => `
          <article class="campaign-item">
            <div class="campaign-head">
              <strong>${escapeHtml(campaign.title)}</strong>
              <span class="chip chip-muted">${escapeHtml(campaign.priority)}</span>
            </div>
            <p>${escapeHtml(campaign.notes)}</p>
            <div class="card-meta">
              <span>${escapeHtml(campaign.channel)}</span>
            </div>
            <div class="card-actions">
              <button class="button button-secondary" onclick="openCampaignModal('${campaign.id}')">Edit</button>
              <button class="button button-danger" onclick="deleteCampaign('${campaign.id}')">Delete</button>
            </div>
          </article>
        `).join("") : emptyState("No campaigns", `Nothing in ${column.toLowerCase()} right now.`)}
      </section>
    `;
  }).join("");
}

function openLeadModal(leadId = "") {
  document.getElementById("lead-form").reset();
  document.getElementById("lead-id").value = "";
  document.getElementById("lead-modal-title").textContent = leadId ? "Edit Lead" : "Add Lead";

  if (leadId) {
    const lead = getLeadById(leadId);
    if (!lead) {
      return;
    }
    document.getElementById("lead-id").value = lead.id;
    document.getElementById("lead-client-name").value = lead.clientName;
    document.getElementById("lead-phone").value = lead.phone;
    document.getElementById("lead-email").value = lead.email;
    document.getElementById("lead-event-type").value = lead.eventType;
    document.getElementById("lead-event-date").value = lead.eventDate;
    document.getElementById("lead-venue").value = lead.venue;
    document.getElementById("lead-city").value = lead.city;
    document.getElementById("lead-service-requested").value = lead.serviceRequested;
    document.getElementById("lead-guest-count").value = lead.guestCount || "";
    document.getElementById("lead-budget").value = lead.budget || "";
    document.getElementById("lead-source").value = lead.source;
    document.getElementById("lead-status").value = lead.status;
    document.getElementById("lead-payment-status").value = lead.paymentStatus;
    document.getElementById("lead-calendar-checked").value = lead.calendarChecked;
    document.getElementById("lead-notes").value = lead.notes;
  }

  openModal("lead-modal");
}

function openFollowupModal(followupId = "") {
  document.getElementById("followup-form").reset();
  document.getElementById("followup-id").value = "";
  document.getElementById("followup-modal-title").textContent = followupId ? "Edit Follow-Up" : "Create Follow-Up";

  if (followupId) {
    const followup = state.followups.find((item) => item.id === followupId);
    if (!followup) {
      return;
    }
    document.getElementById("followup-id").value = followup.id;
    document.getElementById("followup-lead-id").value = followup.leadId;
    document.getElementById("followup-due-date").value = followup.dueDate;
    document.getElementById("followup-channel").value = followup.channel;
    document.getElementById("followup-status").value = followup.status;
    document.getElementById("followup-notes").value = followup.notes;
  }

  openModal("followup-modal");
}

function openPaymentModal(paymentId = "") {
  document.getElementById("payment-form").reset();
  document.getElementById("payment-id").value = "";
  document.getElementById("payment-modal-title").textContent = paymentId ? "Edit Payment" : "Add Payment Link";

  if (paymentId) {
    const payment = state.payments.find((item) => item.id === paymentId);
    if (!payment) {
      return;
    }
    document.getElementById("payment-id").value = payment.id;
    document.getElementById("payment-lead-id").value = payment.leadId;
    document.getElementById("payment-type").value = payment.type;
    document.getElementById("payment-amount").value = payment.amount;
    document.getElementById("payment-status").value = payment.status;
    document.getElementById("payment-link").value = payment.link;
    document.getElementById("payment-notes").value = payment.notes;
  }

  openModal("payment-modal");
}

function openCampaignModal(campaignId = "") {
  document.getElementById("campaign-form").reset();
  document.getElementById("campaign-id").value = "";
  document.getElementById("campaign-modal-title").textContent = campaignId ? "Edit Campaign" : "Add Campaign Idea";

  if (campaignId) {
    const campaign = state.campaigns.find((item) => item.id === campaignId);
    if (!campaign) {
      return;
    }
    document.getElementById("campaign-id").value = campaign.id;
    document.getElementById("campaign-title").value = campaign.title;
    document.getElementById("campaign-channel").value = campaign.channel;
    document.getElementById("campaign-status").value = campaign.status;
    document.getElementById("campaign-priority").value = campaign.priority;
    document.getElementById("campaign-notes").value = campaign.notes;
  }

  openModal("campaign-modal");
}

function openLeadDrawer(leadId) {
  const lead = getLeadById(leadId);
  if (!lead) {
    return;
  }

  const relatedFollowups = state.followups.filter((item) => item.leadId === leadId);
  const relatedPayments = state.payments.filter((item) => item.leadId === leadId);

  document.getElementById("drawer-content").innerHTML = `
    <div class="drawer-content">
      <div>
        <p class="panel-kicker">Lead Detail</p>
        <h2>${escapeHtml(lead.clientName)}</h2>
        <p class="card-notes">${escapeHtml(lead.notes || "No notes recorded yet.")}</p>
      </div>
      <div class="drawer-grid">
        <div><dt>Status</dt><dd>${escapeHtml(lead.status)}</dd></div>
        <div><dt>Source</dt><dd>${escapeHtml(lead.source)}</dd></div>
        <div><dt>Event type</dt><dd>${escapeHtml(lead.eventType)}</dd></div>
        <div><dt>Event date</dt><dd>${escapeHtml(formatDate(lead.eventDate))}</dd></div>
        <div><dt>Service</dt><dd>${escapeHtml(lead.serviceRequested)}</dd></div>
        <div><dt>Guests</dt><dd>${escapeHtml(String(lead.guestCount || 0))}</dd></div>
        <div><dt>Venue</dt><dd>${escapeHtml(lead.venue || "Pending")}</dd></div>
        <div><dt>City</dt><dd>${escapeHtml(lead.city || "Pending")}</dd></div>
        <div><dt>Phone</dt><dd>${escapeHtml(lead.phone)}</dd></div>
        <div><dt>Email</dt><dd>${escapeHtml(lead.email)}</dd></div>
        <div><dt>Budget</dt><dd>${escapeHtml(formatCurrency(lead.budget || 0))}</dd></div>
        <div><dt>Payment</dt><dd>${escapeHtml(lead.paymentStatus)}</dd></div>
        <div><dt>Calendar checked</dt><dd>${escapeHtml(lead.calendarChecked)}</dd></div>
      </div>
      <div class="stack-list">
        <div class="stack-item"><strong>Follow-ups</strong><span>${relatedFollowups.length}</span></div>
        ${relatedFollowups.length ? relatedFollowups.map((item) => `<div class="stack-item"><div><strong>${escapeHtml(item.channel)}</strong><p>${escapeHtml(`${formatDate(item.dueDate)} | ${item.notes}`)}</p></div><span class="chip chip-muted">${escapeHtml(item.status)}</span></div>`).join("") : emptyState("No reminders", "No follow-up tasks are attached to this lead.")}
      </div>
      <div class="stack-list">
        <div class="stack-item"><strong>Payments</strong><span>${relatedPayments.length}</span></div>
        ${relatedPayments.length ? relatedPayments.map((item) => `<div class="stack-item"><div><strong>${escapeHtml(item.type)}</strong><p>${escapeHtml(`${formatCurrency(item.amount)} | ${item.status}`)}</p></div><a href="${escapeAttribute(item.link)}" target="_blank" rel="noreferrer">Open</a></div>`).join("") : emptyState("No payments", "No Stripe or invoice links are saved yet.")}
      </div>
      <div class="card-actions">
        <button class="button button-secondary" onclick="openLeadModal('${lead.id}'); closeDrawer();">Edit Lead</button>
      </div>
    </div>
  `;
  document.getElementById("lead-drawer").hidden = false;
  document.body.classList.add("modal-open");
}

function closeDrawer() {
  document.getElementById("lead-drawer").hidden = true;
  document.body.classList.remove("modal-open");
}

function openModal(id) {
  document.getElementById(id).hidden = false;
  document.body.classList.add("modal-open");
}

function closeModal(id) {
  document.getElementById(id).hidden = true;
  if (document.querySelectorAll(".modal:not([hidden]), .drawer:not([hidden])").length === 0) {
    document.body.classList.remove("modal-open");
  }
}

async function deleteLead(id) {
  if (!confirm("Delete this lead? This also removes its follow-ups and payment tracking.")) {
    return;
  }

  try {
    const followupIds = state.followups.filter((item) => item.leadId === id).map((item) => item.id);
    const paymentIds = state.payments.filter((item) => item.leadId === id).map((item) => item.id);

    for (const followupId of followupIds) {
      await deleteResource("followups", followupId);
    }
    for (const paymentId of paymentIds) {
      await deleteResource("payments", paymentId);
    }
    await deleteResource("leads", id);

    state.leads = state.leads.filter((lead) => lead.id !== id);
    state.followups = state.followups.filter((item) => item.leadId !== id);
    state.payments = state.payments.filter((item) => item.leadId !== id);
    renderAll();
  } catch (error) {
    console.error(error);
    alert(getFriendlyError(error, "Lead could not be deleted."));
  }
}

async function deleteFollowup(id) {
  if (!confirm("Delete this follow-up reminder?")) {
    return;
  }

  try {
    await deleteResource("followups", id);
    state.followups = state.followups.filter((item) => item.id !== id);
    renderAll();
  } catch (error) {
    console.error(error);
    alert(getFriendlyError(error, "Follow-up could not be deleted."));
  }
}

async function deletePayment(id) {
  if (!confirm("Delete this payment record?")) {
    return;
  }

  try {
    await deleteResource("payments", id);
    state.payments = state.payments.filter((item) => item.id !== id);
    renderAll();
  } catch (error) {
    console.error(error);
    alert(getFriendlyError(error, "Payment could not be deleted."));
  }
}

async function deleteCampaign(id) {
  if (!confirm("Delete this campaign item?")) {
    return;
  }

  try {
    await deleteResource("campaigns", id);
    state.campaigns = state.campaigns.filter((item) => item.id !== id);
    renderAll();
  } catch (error) {
    console.error(error);
    alert(getFriendlyError(error, "Campaign could not be deleted."));
  }
}

async function updateLeadStatus(leadId, nextStatus) {
  const lead = getLeadById(leadId);
  if (!lead) {
    return;
  }

  const previousStatus = lead.status;
  lead.status = nextStatus;
  if (nextStatus === "Paid") {
    lead.paymentStatus = "Paid";
  }
  lead.updatedAt = todayIso();

  try {
    const savedLead = await upsertResource("leads", lead);
    upsertLocalItem(state.leads, savedLead);
    renderAll();
  } catch (error) {
    lead.status = previousStatus;
    console.error(error);
    alert(getFriendlyError(error, "Status could not be updated."));
    renderAll();
  }
}

function populateStatusSelects() {
  const leadStatus = document.getElementById("lead-status");
  const leadStatusFilter = document.getElementById("lead-status-filter");

  leadStatus.innerHTML = LEAD_STATUSES.map((status) => `<option value="${status}">${status}</option>`).join("");
  leadStatusFilter.innerHTML = `<option value="all">All statuses</option>${LEAD_STATUSES.map((status) => `<option value="${status}">${status}</option>`).join("")}`;
}

function refreshSelectMenus() {
  const sortedLeads = [...state.leads].sort((a, b) => a.clientName.localeCompare(b.clientName));
  const leadOptions = sortedLeads.map((lead) => `<option value="${lead.id}">${escapeHtml(`${lead.clientName} | ${lead.eventType} | ${formatDate(lead.eventDate)}`)}</option>`).join("");

  document.getElementById("followup-lead-id").innerHTML = leadOptions;
  document.getElementById("payment-lead-id").innerHTML = leadOptions;
}

function filterLeads(leads) {
  return leads.filter((lead) => {
    const matchesStatus = state.leadStatusFilter === "all" || lead.status === state.leadStatusFilter;
    const haystack = [
      lead.clientName,
      lead.city,
      lead.serviceRequested,
      lead.source,
      lead.eventType,
      lead.email,
      lead.phone
    ].join(" ").toLowerCase();
    const matchesSearch = !state.leadSearch || haystack.includes(state.leadSearch);
    return matchesStatus && matchesSearch;
  });
}

function getLeadById(id) {
  return state.leads.find((lead) => lead.id === id);
}

async function upsertResource(resourceKey, item) {
  if (authState.isLocalFallback || state.syncMode !== "Supabase live") {
    return item;
  }

  const config = COLLECTION_CONFIG[resourceKey];
  const existing = state[resourceKey].some((entry) => entry.id === item.id);
  const payload = config.toDb(item);

  if (existing) {
    const rows = await supabaseRest(`/${config.table}?id=eq.${encodeURIComponent(item.id)}`, {
      method: "PATCH",
      body: payload,
      prefer: "return=representation"
    });
    return config.fromDb(rows[0] || payload);
  }

  const rows = await supabaseRest(`/${config.table}`, {
    method: "POST",
    body: payload,
    prefer: "return=representation"
  });
  return config.fromDb(rows[0] || payload);
}

async function deleteResource(resourceKey, id) {
  if (authState.isLocalFallback || state.syncMode !== "Supabase live") {
    return;
  }

  const config = COLLECTION_CONFIG[resourceKey];
  await supabaseRest(`/${config.table}?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    prefer: "return=minimal"
  });
}

function persistAll() {
  localStorage.setItem(STORAGE_KEYS.leads, JSON.stringify(state.leads));
  localStorage.setItem(STORAGE_KEYS.followups, JSON.stringify(state.followups));
  localStorage.setItem(STORAGE_KEYS.payments, JSON.stringify(state.payments));
  localStorage.setItem(STORAGE_KEYS.campaigns, JSON.stringify(state.campaigns));
}

function loadData(key, fallback) {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return structuredClone(fallback);
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error(`Failed to parse ${key}`, error);
    return structuredClone(fallback);
  }
}

function loadJson(key) {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error(`Failed to parse ${key}`, error);
    return null;
  }
}

function saveSession(session) {
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

function clearSavedSession() {
  localStorage.removeItem(AUTH_SESSION_KEY);
}

function needsRefresh(session) {
  return !session?.expiresAt || Date.now() >= session.expiresAt;
}

function statusChip(status) {
  const tone = status === "Lost"
    ? "lost"
    : status === "Booked" || status === "Paid" || status === "Completed"
      ? "booked"
      : status === "Missing Info" || status === "Follow-Up Needed" || status === "Deposit Pending"
        ? "attention"
        : "new";
  return `<span class="chip" data-tone="${tone}">${escapeHtml(status)}</span>`;
}

function formatDate(value) {
  if (!value) {
    return "Pending";
  }

  const normalized = value.length > 10 ? value.slice(0, 10) : value;
  return new Date(`${normalized}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function formatMonthLabel(isoMonth) {
  const [year, month] = isoMonth.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-US", {
    month: "short"
  });
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value || 0);
}

function emptyState(title, copy) {
  return `<div class="empty-state"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(copy)}</p></div>`;
}

function sortCollections() {
  REMOTE_COLLECTIONS.forEach((resourceKey) => {
    state[resourceKey] = COLLECTION_CONFIG[resourceKey].sort([...state[resourceKey]]);
  });
}

function upsertLocalItem(collection, item) {
  const index = collection.findIndex((entry) => entry.id === item.id);
  if (index >= 0) {
    collection[index] = item;
  } else {
    collection.unshift(item);
  }
}

function compareDates(a, b) {
  const first = a ? new Date(a).getTime() : 0;
  const second = b ? new Date(b).getTime() : 0;
  if (first === second) {
    return 0;
  }
  return first > second ? 1 : -1;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function updateConnectionIndicators() {
  syncModeLabel.textContent = state.syncDetail;
  if (state.syncMode === "Supabase live") {
    supabaseStatusChip.textContent = "Tables live";
  } else if (authState.isLocalFallback) {
    supabaseStatusChip.textContent = "Local demo";
  } else if (authState.user) {
    supabaseStatusChip.textContent = "Auth connected";
  } else {
    supabaseStatusChip.textContent = "Sign in required";
  }
}

function showSetupBanner(message, tone = "info") {
  setupBanner.hidden = false;
  setupBanner.dataset.tone = tone;
  setupBanner.innerHTML = `<strong>${tone === "warning" ? "Setup still needed" : "CRM note"}</strong><span>${escapeHtml(message)}</span>`;
}

function hideSetupBanner() {
  setupBanner.hidden = true;
  delete setupBanner.dataset.tone;
  setupBanner.innerHTML = "";
}

function showAuthError(message) {
  if (!message) {
    authError.hidden = true;
    authError.textContent = "";
    return;
  }

  authError.hidden = false;
  authError.textContent = message;
}

function getAuthRedirectUrl() {
  return `${window.location.origin}/admin`;
}

function isLocalhost() {
  return ["localhost", "127.0.0.1"].includes(window.location.hostname);
}

function isAllowedAdminEmail(email) {
  return ALLOWED_ADMIN_EMAILS.includes((email || "").trim().toLowerCase());
}

function clearLocationHash() {
  history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
}

async function signInWithPassword(email, password) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });

  const payload = await parseResponse(response);
  if (!response.ok) {
    throw new Error(payload?.msg || payload?.message || "Supabase sign-in failed.");
  }
  return payload;
}

async function refreshSession(refreshToken) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ refresh_token: refreshToken })
  });

  const payload = await parseResponse(response);
  if (!response.ok || !payload?.access_token) {
    return false;
  }

  authState.session = {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    tokenType: payload.token_type || "bearer",
    expiresAt: Date.now() + Math.max((payload.expires_in || 3600) - 60, 60) * 1000
  };
  saveSession(authState.session);
  return true;
}

async function fetchCurrentUser(accessToken) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

async function clearRemoteSession() {
  try {
    if (authState.session?.accessToken) {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${authState.session.accessToken}`
        }
      });
    }
  } catch (error) {
    console.error("Supabase logout failed", error);
  }

  clearSavedSession();
}

async function supabaseRest(path, options = {}) {
  if (!authState.session?.accessToken) {
    throw new Error("Supabase session missing.");
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method: options.method || "GET",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${authState.session.accessToken}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation"
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const payload = await parseResponse(response);
  if (!response.ok) {
    throw new Error(payload?.message || payload?.hint || "Supabase data request failed.");
  }
  return payload;
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function getFriendlyError(error, fallback) {
  const message = error?.message || "";
  if (message.includes("Invalid login credentials")) {
    return "Supabase did not accept that email or password yet. Create the admin user in Supabase Auth first, then try again.";
  }
  if (message.includes("Email not confirmed")) {
    return "This admin user still needs email confirmation in Supabase Auth.";
  }
  if (message.includes("relation") && message.includes("does not exist")) {
    return "The CRM tables are not created yet in Supabase. Run database/supabase/schema.sql in the SQL Editor first.";
  }
  return message || fallback;
}

function mapLeadToDb(lead) {
  return {
    id: lead.id,
    client_name: lead.clientName,
    phone: lead.phone,
    email: lead.email,
    event_type: lead.eventType,
    event_date: lead.eventDate || null,
    venue: lead.venue || null,
    city: lead.city || null,
    service_requested: lead.serviceRequested,
    guest_count: lead.guestCount || 0,
    budget: lead.budget || 0,
    notes: lead.notes || null,
    status: lead.status,
    payment_status: lead.paymentStatus,
    calendar_checked: lead.calendarChecked === "Yes",
    source: lead.source,
    created_at: lead.createdAt || todayIso(),
    updated_at: todayIso()
  };
}

function mapLeadFromDb(row) {
  return {
    id: row.id,
    clientName: row.client_name || "",
    phone: row.phone || "",
    email: row.email || "",
    eventType: row.event_type || "",
    eventDate: normalizeDateValue(row.event_date),
    venue: row.venue || "",
    city: row.city || "",
    serviceRequested: row.service_requested || "Luxury DSLR Digital Booth",
    guestCount: Number(row.guest_count || 0),
    budget: Number(row.budget || 0),
    notes: row.notes || "",
    status: row.status || "New Lead",
    paymentStatus: row.payment_status || "Not Requested",
    calendarChecked: row.calendar_checked ? "Yes" : "No",
    source: row.source || "Website",
    createdAt: normalizeDateValue(row.created_at) || todayIso(),
    updatedAt: normalizeDateValue(row.updated_at) || todayIso()
  };
}

function mapFollowupToDb(followup) {
  return {
    id: followup.id,
    lead_id: followup.leadId,
    due_date: followup.dueDate || null,
    channel: followup.channel,
    status: followup.status,
    notes: followup.notes || null,
    created_at: followup.createdAt || todayIso(),
    updated_at: todayIso()
  };
}

function mapFollowupFromDb(row) {
  return {
    id: row.id,
    leadId: row.lead_id,
    dueDate: normalizeDateValue(row.due_date),
    channel: row.channel || "Email",
    status: row.status || "Open",
    notes: row.notes || "",
    createdAt: normalizeDateValue(row.created_at) || todayIso(),
    updatedAt: normalizeDateValue(row.updated_at) || todayIso()
  };
}

function mapPaymentToDb(payment) {
  return {
    id: payment.id,
    lead_id: payment.leadId,
    type: payment.type,
    amount: payment.amount || 0,
    status: payment.status,
    link: payment.link || null,
    notes: payment.notes || null,
    created_at: payment.createdAt || todayIso(),
    updated_at: todayIso()
  };
}

function mapPaymentFromDb(row) {
  return {
    id: row.id,
    leadId: row.lead_id,
    type: row.type || "Stripe Payment Link",
    amount: Number(row.amount || 0),
    status: row.status || "Pending",
    link: row.link || "",
    notes: row.notes || "",
    createdAt: normalizeDateValue(row.created_at) || todayIso(),
    updatedAt: normalizeDateValue(row.updated_at) || todayIso()
  };
}

function mapCampaignToDb(campaign) {
  return {
    id: campaign.id,
    title: campaign.title,
    channel: campaign.channel,
    status: campaign.status,
    priority: campaign.priority,
    notes: campaign.notes || null,
    created_at: campaign.createdAt || todayIso(),
    updated_at: todayIso()
  };
}

function mapCampaignFromDb(row) {
  return {
    id: row.id,
    title: row.title || "",
    channel: row.channel || "Instagram",
    status: row.status || "Idea",
    priority: row.priority || "Medium",
    notes: row.notes || "",
    createdAt: normalizeDateValue(row.created_at) || todayIso(),
    updatedAt: normalizeDateValue(row.updated_at) || todayIso()
  };
}

function normalizeDateValue(value) {
  if (!value) {
    return "";
  }
  return String(value).slice(0, 10);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

window.openLeadModal = openLeadModal;
window.openLeadDrawer = openLeadDrawer;
window.openFollowupModal = openFollowupModal;
window.openPaymentModal = openPaymentModal;
window.openCampaignModal = openCampaignModal;
window.deleteLead = deleteLead;
window.deleteFollowup = deleteFollowup;
window.deletePayment = deletePayment;
window.deleteCampaign = deleteCampaign;
window.updateLeadStatus = updateLeadStatus;
window.closeDrawer = closeDrawer;
