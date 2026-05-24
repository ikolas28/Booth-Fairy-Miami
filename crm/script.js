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
  bookings: "bfmCrmBookings",
  payments: "bfmCrmPayments",
  campaigns: "bfmCrmCampaigns",
  messageHistory: "bfmCrmMessageHistory"
};

const LEAD_STATUSES = [
  "New Lead",
  "Missing Info",
  "Quote Sent",
  "Follow-Up Needed",
  "Deposit Pending",
  "Paid",
  "Booked",
  "Completed",
  "Lost"
];

const ACTIVE_STATUSES = new Set(["New Lead", "Missing Info", "Quote Sent", "Follow-Up Needed", "Deposit Pending"]);
const BOOKING_STATUSES = new Set(["Deposit Pending", "Paid", "Booked", "Completed"]);
const CONFIRMED_STATUSES = new Set(["Booked", "Completed"]);
const REMOTE_COLLECTIONS = ["leads", "bookings", "followups", "payments", "campaigns", "messageHistory"];

const seedLeads = [
  {
    id: crypto.randomUUID(),
    leadCode: "BFM-DEMO-001",
    clientName: "Sofia Martinez",
    phone: "(786) 555-0181",
    email: "sofia@sample.com",
    eventType: "Wedding",
    eventDate: "2026-08-15",
    startTime: "18:00",
    endTime: "22:00",
    venue: "Villa Toscana Miami",
    city: "Miami",
    serviceRequested: "DSLR Photo Booth - Digital Sharing",
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
    leadCode: "BFM-DEMO-002",
    clientName: "Marcos Ruiz",
    phone: "(305) 555-0136",
    email: "marcos@brandlaunch.co",
    eventType: "Brand Activation",
    eventDate: "2026-07-12",
    startTime: "19:00",
    endTime: "23:00",
    venue: "Wynwood Event Loft",
    city: "Miami",
    serviceRequested: "Photo Booth + DJ Bundle",
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
    leadCode: "BFM-DEMO-003",
    clientName: "Alyssa Grant",
    phone: "(954) 555-0194",
    email: "alyssa@sample.com",
    eventType: "Birthday Party",
    eventDate: "2026-06-21",
    startTime: "18:00",
    endTime: "20:00",
    venue: "Private Residence",
    city: "Hallandale",
    serviceRequested: "DSLR Photo Booth - Digital Sharing",
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
    leadCode: "BFM-DEMO-004",
    clientName: "Camila Vega",
    phone: "(786) 555-0127",
    email: "camila@sample.com",
    eventType: "Baby Shower",
    eventDate: "2026-09-05",
    startTime: "13:00",
    endTime: "16:00",
    venue: "Coral Gables Country Club",
    city: "Coral Gables",
    serviceRequested: "DSLR Photo Booth - Digital Sharing",
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
    leadCode: "BFM-DEMO-005",
    clientName: "Noah Ellis",
    phone: "(786) 555-0108",
    email: "noah@sample.com",
    eventType: "Corporate Holiday Party",
    eventDate: "2026-12-06",
    startTime: "18:00",
    endTime: "23:00",
    venue: "Brickell Bay Ballroom",
    city: "Brickell",
    serviceRequested: "Premium DJ Services",
    guestCount: 240,
    budget: 3200,
    notes: "Premium DJ only inquiry. Needs proposal and entertainment timeline. Never confirm until calendar is checked.",
    status: "Quote Sent",
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

const seedBookings = [
  {
    id: crypto.randomUUID(),
    leadId: seedLeads[2].id,
    clientName: seedLeads[2].clientName,
    email: seedLeads[2].email,
    phone: seedLeads[2].phone,
    eventType: seedLeads[2].eventType,
    eventDate: seedLeads[2].eventDate,
    startTime: seedLeads[2].startTime,
    endTime: seedLeads[2].endTime,
    venue: seedLeads[2].venue,
    city: seedLeads[2].city,
    serviceRequested: seedLeads[2].serviceRequested,
    guestCount: seedLeads[2].guestCount,
    packageInterest: "Starter Digital Package - 2 Hours",
    totalQuote: 450,
    depositRequired: 225,
    depositStatus: "Pending",
    paymentLink: "",
    calendarLink: "",
    calendarEventId: "",
    calendarSyncStatus: "Pending",
    calendarSyncError: "",
    bookingStatus: "Deposit Pending",
    contractSent: false,
    notes: "Demo booking awaiting retainer.",
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
  bookings: {
    table: "bookings",
    toDb: mapBookingToDb,
    fromDb: mapBookingFromDb,
    sort: (items) => items.sort((a, b) => compareDates(a.eventDate, b.eventDate) || compareDates(b.createdAt, a.createdAt))
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
  },
  messageHistory: {
    table: "message_history",
    toDb: mapMessageHistoryToDb,
    fromDb: mapMessageHistoryFromDb,
    sort: (items) => items.sort((a, b) => compareDates(b.createdAt, a.createdAt))
  }
};

const state = {
  leads: loadData(STORAGE_KEYS.leads, seedLeads),
  bookings: loadData(STORAGE_KEYS.bookings, seedBookings),
  followups: loadData(STORAGE_KEYS.followups, seedFollowups),
  payments: loadData(STORAGE_KEYS.payments, seedPayments),
  campaigns: loadData(STORAGE_KEYS.campaigns, seedCampaigns),
  messageHistory: loadData(STORAGE_KEYS.messageHistory, []),
  activeSection: "dashboard",
  leadSearch: "",
  leadStatusFilter: "all",
  syncMode: "Local cache",
  syncDetail: "Sign in to sync your CRM.",
  gmail: {
    configured: false,
    connected: false,
    connectedEmail: "",
    syncQuery: "",
    allowedMailbox: "info@boothfairymiami.com",
    lastUpdatedAt: "",
    lastSyncSummary: ""
  },
  instagram: {
    configured: false,
    signatureVerification: false,
    webhookUrl: "https://www.boothfairymiami.com/api/instagram/webhook",
    leadIntakeUrl: "https://www.boothfairymiami.com/api/instagram/lead",
    privacyPolicyUrl: "https://www.boothfairymiami.com/privacy-policy.html",
    dataDeletionUrl: "https://www.boothfairymiami.com/data-deletion.html",
    requestedPermissions: [],
    note: ""
  },
  leadScores: [],
  leadDuplicates: [],
  automationRuns: [],
  pendingBanner: null
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
const gmailStatusChip = document.getElementById("gmail-status-chip");
const tidioStatusChip = document.getElementById("tidio-status-chip");
const setupBanner = document.getElementById("setup-banner");
const emailLoginButton = document.getElementById("email-login-button");
const gmailConnectButton = document.getElementById("gmail-connect-button");
const gmailSyncButton = document.getElementById("gmail-sync-button");
const gmailDisconnectButton = document.getElementById("gmail-disconnect-button");
const gmailStatusNote = document.getElementById("gmail-status-note");
const gmailSectionCopy = document.getElementById("gmail-section-copy");
const instagramStatusChip = document.getElementById("instagram-status-chip");
const instagramStatusNote = document.getElementById("instagram-status-note");

init().catch((error) => {
  console.error("CRM init failed", error);
  showAuthError("The admin CRM could not finish loading. Please refresh and try again.");
});

async function init() {
  clearLegacyAuthStorage();
  resetUiState();
  populateStatusSelects();
  attachEventListeners();
  showLocalDevNote();
  await refreshGmailStatus();
  updateConnectionIndicators();
  renderAll();

  handleGmailQueryReturn();

  const oauthState = handleOAuthReturn();
  if (oauthState.error) {
    showAuthError(oauthState.error);
  }

  const restored = await restoreSession();
  if (!restored) {
    authShell.hidden = false;
    appShell.hidden = true;
    applyPendingBanner();
    return;
  }

  unlockApp();
  await hydrateData();
  applyPendingBanner();
}

function attachEventListeners() {
  loginForm.addEventListener("submit", handleLogin);
  logoutButton.addEventListener("click", handleLogout);
  googleLoginButton.addEventListener("click", handleGoogleLogin);
  gmailConnectButton.addEventListener("click", handleGmailConnect);
  gmailSyncButton.addEventListener("click", handleGmailSync);
  gmailDisconnectButton.addEventListener("click", handleGmailDisconnect);

  navButtons.forEach((button) => {
    button.addEventListener("click", () => setSection(button.dataset.section));
  });

  document.getElementById("quick-add-lead").addEventListener("click", () => openLeadModal());
  document.getElementById("quick-add-followup").addEventListener("click", () => openFollowupModal());
  document.getElementById("new-followup-button").addEventListener("click", () => openFollowupModal());
  document.getElementById("new-payment-button").addEventListener("click", () => openPaymentModal());
  document.getElementById("new-campaign-button").addEventListener("click", () => openCampaignModal());
  document.getElementById("run-receptionist-button").addEventListener("click", () => runAgentAutomation("receptionist"));
  document.getElementById("run-marketing-button").addEventListener("click", () => runAgentAutomation("marketing"));
  document.getElementById("instagram-refresh-button").addEventListener("click", async () => {
    await refreshInstagramStatus();
    updateConnectionIndicators();
  });
  document.getElementById("approval-refresh-button").addEventListener("click", async () => {
    await refreshApprovalQueue();
  });
  document.getElementById("lead-intel-refresh-button").addEventListener("click", async () => {
    await refreshLeadIntelligence();
    renderLeadIntelligence();
  });
  document.getElementById("lead-check-calendar-button").addEventListener("click", () => {
    const leadId = document.getElementById("lead-id").value;
    if (!leadId) {
      alert("Save this lead first, then check calendar availability.");
      return;
    }
    checkLeadAvailability(leadId);
  });
  document.getElementById("lead-prepare-booking-button").addEventListener("click", () => {
    const leadId = document.getElementById("lead-id").value;
    if (!leadId) {
      alert("Save this lead first, then prepare contract and deposit.");
      return;
    }
    prepareContractAndDeposit(leadId);
  });

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

function handleGmailQueryReturn() {
  const params = new URLSearchParams(window.location.search);
  const connected = params.get("gmail_connected");
  const error = params.get("gmail_error");

  if (connected === "1") {
    state.pendingBanner = {
      message: "Gmail connected successfully. You can sync labeled inbox leads into the CRM now.",
      tone: "success"
    };
  } else if (error) {
    state.pendingBanner = {
      message: `Gmail connection issue: ${error}`,
      tone: "warning"
    };
  }

  if (connected || error) {
    history.replaceState(null, "", window.location.pathname);
  }
}

function applyPendingBanner() {
  if (!state.pendingBanner) {
    return;
  }

  showSetupBanner(state.pendingBanner.message, state.pendingBanner.tone);
  state.pendingBanner = null;
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

function handleGmailConnect() {
  window.location.href = "/api/gmail/connect";
}

async function handleGmailSync() {
  if (!authState.session?.accessToken) {
    showSetupBanner("Sign in to the CRM before syncing Gmail leads.", "warning");
    return;
  }

  gmailSyncButton.disabled = true;
  gmailSyncButton.textContent = "Syncing...";

  try {
    const response = await fetch("/api/gmail/sync", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authState.session.accessToken}`
      }
    });
    const payload = await parseResponse(response);
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || "Gmail sync could not be completed.");
    }

    const ignoredCopy = payload.ignoredCount
      ? ` Ignored ${payload.ignoredCount} system notification${payload.ignoredCount === 1 ? "" : "s"}.`
      : "";
    state.gmail.lastSyncSummary = `Imported ${payload.importedCount} new lead${payload.importedCount === 1 ? "" : "s"} from ${payload.scannedCount} Gmail message${payload.scannedCount === 1 ? "" : "s"}.${ignoredCopy}`;
    showSetupBanner(state.gmail.lastSyncSummary, "success");
    await refreshGmailStatus();
    await hydrateData();
    setSection("gmail");
  } catch (error) {
    showSetupBanner(`Gmail sync issue: ${getFriendlyError(error, "Could not sync Gmail leads.")}`, "warning");
  } finally {
    gmailSyncButton.disabled = false;
    gmailSyncButton.textContent = "Sync Gmail";
  }
}

async function handleGmailDisconnect() {
  if (!authState.session?.accessToken) {
    showSetupBanner("Sign in to the CRM before disconnecting Gmail.", "warning");
    return;
  }

  gmailDisconnectButton.disabled = true;
  gmailDisconnectButton.textContent = "Disconnecting...";

  try {
    const response = await fetch("/api/gmail/disconnect", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authState.session.accessToken}`
      }
    });
    const payload = await parseResponse(response);
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || "Could not disconnect Gmail.");
    }

    state.gmail.lastSyncSummary = "";
    showSetupBanner("Gmail has been disconnected from the CRM.", "info");
    await refreshGmailStatus();
    renderAll();
  } catch (error) {
    showSetupBanner(`Gmail disconnect issue: ${getFriendlyError(error, "Could not disconnect Gmail.")}`, "warning");
  } finally {
    gmailDisconnectButton.disabled = false;
    gmailDisconnectButton.textContent = "Disconnect";
  }
}

async function handleLogout() {
  if (!authState.isLocalFallback) {
    await clearRemoteSession();
  }

  authState.session = null;
  authState.user = null;
  authState.isLocalFallback = false;
  clearSavedSession();
  resetUiState();
  appShell.hidden = true;
  authShell.hidden = false;
  hideSetupBanner();
  state.syncMode = "Local cache";
  state.syncDetail = "Sign in to sync your CRM.";
  updateConnectionIndicators();
}

function unlockApp() {
  resetUiState();
  authShell.hidden = true;
  appShell.hidden = false;
  userEmailLabel.textContent = authState.user?.email || "Signed in";
}

async function hydrateData() {
  if (authState.isLocalFallback) {
    state.syncMode = "Localhost demo";
    state.syncDetail = "Local-only records. Supabase tables are bypassed in this session.";
    showSetupBanner("Localhost demo mode is active. Supabase sign-in is still available, but this session is intentionally local-only.", "info");
    await refreshGmailStatus();
    updateConnectionIndicators();
    renderAll();
    return;
  }

  const loaded = await loadRemoteCollections();
  if (loaded) {
    hideSetupBanner();
  }

  await refreshLeadIntelligence();
  await refreshGmailStatus();
  await refreshInstagramStatus();
  updateConnectionIndicators();
  renderAll();
}

async function refreshLeadIntelligence() {
  if (authState.isLocalFallback || !authState.session?.accessToken) {
    state.leadScores = [];
    state.leadDuplicates = [];
    state.automationRuns = [];
    return;
  }

  try {
    const [leadScores, leadDuplicates, automationRuns] = await Promise.all([
      supabaseRest("/lead_scores?select=*&order=score.desc,created_at.desc&limit=30"),
      supabaseRest("/lead_duplicates?select=*&order=created_at.desc&limit=20"),
      supabaseRest("/automation_runs?select=*&order=started_at.desc&limit=12")
    ]);
    state.leadScores = leadScores || [];
    state.leadDuplicates = leadDuplicates || [];
    state.automationRuns = automationRuns || [];
  } catch (error) {
    console.error("Lead intelligence load failed", error);
    state.leadScores = [];
    state.leadDuplicates = [];
    state.automationRuns = [];
  }
}

async function refreshGmailStatus() {
  try {
    const response = await fetch("/api/gmail/status");
    const payload = await parseResponse(response);
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || "Could not read Gmail status.");
    }

    state.gmail = {
      ...state.gmail,
      configured: Boolean(payload.configured),
      connected: Boolean(payload.connected),
      connectedEmail: payload.connectedEmail || "",
      syncQuery: payload.syncQuery || "",
      allowedMailbox: payload.allowedMailbox || state.gmail.allowedMailbox,
      lastUpdatedAt: payload.lastUpdatedAt || ""
    };
  } catch (error) {
    if (!isLocalPreview()) {
      console.error("Gmail status check failed", error);
    }
    state.gmail = {
      ...state.gmail,
      configured: false,
      connected: false
    };
  }
}

async function refreshInstagramStatus() {
  try {
    const response = await fetch("/api/instagram/status");
    const payload = await parseResponse(response);
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || "Could not read Instagram status.");
    }
    state.instagram = {
      configured: Boolean(payload.configured),
      signatureVerification: Boolean(payload.signatureVerification),
      webhookUrl: payload.webhookUrl || state.instagram.webhookUrl,
      leadIntakeUrl: payload.leadIntakeUrl || state.instagram.leadIntakeUrl,
      privacyPolicyUrl: payload.privacyPolicyUrl || state.instagram.privacyPolicyUrl,
      dataDeletionUrl: payload.dataDeletionUrl || state.instagram.dataDeletionUrl,
      requestedPermissions: Array.isArray(payload.requestedPermissions) ? payload.requestedPermissions : state.instagram.requestedPermissions,
      note: payload.note || ""
    };
  } catch (error) {
    if (!isLocalPreview()) {
      console.error("Instagram status check failed", error);
    }
    state.instagram = {
      ...state.instagram,
      configured: false,
      note: "Instagram status could not be checked."
    };
  }
}

async function refreshGmailDraftApprovals() {
  if (!authState.session?.accessToken || authState.isLocalFallback) return null;
  const response = await fetch("/api/gmail/refresh-drafts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authState.session.accessToken}`
    }
  });
  const payload = await parseResponse(response);
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || "Could not refresh Gmail draft approvals.");
  }
  return payload;
}

async function refreshApprovalQueue() {
  const button = document.getElementById("approval-refresh-button");
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Refreshing...";

  try {
    const draftRefresh = await refreshGmailDraftApprovals();
    await hydrateData();
    setSection("approvals");
    const removed = draftRefresh?.removed || 0;
    const checked = draftRefresh?.checked || 0;
    const total = draftRefresh?.totalDraftApprovals || 0;
    const errors = draftRefresh?.errors?.length || 0;
    const message = errors
      ? `Approvals refreshed. Checked ${checked} Gmail draft(s), removed ${removed}, but ${errors} draft lookup(s) need attention.`
      : `Approvals refreshed. Checked ${checked} of ${total} Gmail draft approval(s). Removed ${removed} stale item(s).`;
    showSetupBanner(message, removed || errors ? "info" : "success");
    alert(message);
  } catch (error) {
    console.error("Approval refresh failed", error);
    alert(getFriendlyError(error, "Approvals could not refresh."));
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function isLocalPreview() {
  return ["localhost", "127.0.0.1"].includes(window.location.hostname);
}

async function loadRemoteCollections() {
  try {
    const [leads, bookings, followups, payments, campaigns, messageHistory] = await Promise.all([
      fetchCollection("leads"),
      fetchCollection("bookings"),
      fetchCollection("followups"),
      fetchCollection("payments"),
      fetchCollection("campaigns"),
      fetchCollection("messageHistory")
    ]);

    state.leads = leads;
    state.bookings = bookings;
    state.followups = followups;
    state.payments = payments;
    state.campaigns = campaigns;
    state.messageHistory = messageHistory;
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
    leadCode: existingLead?.leadCode || `BFM-LOCAL-${String(state.leads.length + 1).padStart(3, "0")}`,
    clientName: document.getElementById("lead-client-name").value.trim(),
    phone: document.getElementById("lead-phone").value.trim(),
    email: document.getElementById("lead-email").value.trim(),
    eventType: document.getElementById("lead-event-type").value.trim(),
    eventDate: document.getElementById("lead-event-date").value,
    startTime: document.getElementById("lead-start-time").value,
    endTime: document.getElementById("lead-end-time").value,
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
    await reconcileLeadPaymentState(savedLead);
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
    stripeSessionId: existing?.stripeSessionId || "",
    stripePaymentIntentId: existing?.stripePaymentIntentId || "",
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

async function runAgentAutomation(agentName) {
  if (!authState.session?.accessToken) {
    alert("Sign in with Supabase before running agent automations.");
    return;
  }

  const buttonId = `run-${agentName}-button`;
  const button = document.getElementById(buttonId);
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = `Running ${titleCase(agentName)}...`;

  try {
    const response = await fetch(`/api/cron/${agentName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authState.session.accessToken}`
      }
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || `${agentName} automation failed.`);
    }

    await hydrateData();
    setSection("approvals");
    alert(formatAutomationSummary(agentName, payload));
  } catch (error) {
    console.error(error);
    alert(getFriendlyError(error, `${agentName} automation could not run.`));
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function formatAutomationSummary(agentName, payload) {
  if (agentName === "marketing") {
    return [
      "Marketing automation finished.",
      `Campaigns created: ${payload.campaignsCreated || 0}`,
      payload.skipped ? payload.reason : "Drafts are in the approval queue before anything is published."
    ].filter(Boolean).join("\n");
  }

  return [
    "Receptionist automation finished.",
    `Gmail leads imported: ${payload.gmailImported || 0}`,
    `Gmail drafts created: ${payload.draftsCreated || 0}`,
    `Calendar checks: ${payload.calendarChecked || 0}`,
    `Payment links created: ${payload.paymentLinksCreated || 0}`,
    `Gmail labels applied: ${payload.gmailLabelsApplied || 0}`,
    `Follow-ups created: ${payload.followupsCreated || 0}`,
    payload.errors?.length ? `${payload.errors.length} lead(s) need manual review.` : "No automation errors reported."
  ].join("\n");
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
    approvals: "Approvals",
    leads: "Leads",
    bookings: "Bookings",
    followups: "Follow-Ups",
    payments: "Payments",
    gmail: "Gmail",
    tidio: "Tidio",
    instagram: "Instagram",
    marketing: "Marketing"
  }[sectionName] || "Dashboard";
}

function renderAll() {
  sortCollections();
  renderKpis();
  renderStatusGrid();
  renderNextFollowups();
  renderCalendarSyncSummary();
  renderUpcomingBookings();
  renderApprovalQueue();
  renderLeadIntelligence();
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
  updateGmailSection();
}

function renderLeadIntelligence() {
  renderLeadScores();
  renderDuplicateWarnings();
  renderAutomationRuns();
}

function renderLeadScores() {
  const container = document.getElementById("lead-score-list");
  if (!container) return;

  const latestByLead = new Map();
  for (const score of state.leadScores) {
    if (!score.lead_id || latestByLead.has(score.lead_id)) continue;
    latestByLead.set(score.lead_id, score);
  }

  const items = [...latestByLead.values()]
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .slice(0, 6);

  if (!items.length) {
    container.innerHTML = emptyState("No scores yet", "New leads will show tags and scores after intake or agent runs.");
    return;
  }

  container.innerHTML = items.map((score) => {
    const lead = getLeadById(score.lead_id);
    const tags = Array.isArray(score.tags) ? score.tags : [];
    return `
      <div class="intel-item">
        <div class="intel-main">
          <strong>${escapeHtml(lead?.clientName || "Lead pending")}</strong>
          <p class="card-meta">${escapeHtml(lead ? `${lead.source} | ${lead.status}` : score.lead_id)}</p>
          ${tags.length ? `<div class="chip-row">${tags.slice(0, 5).map((tag) => `<span class="chip chip-muted">${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
        </div>
        <button class="score-pill" ${lead ? `onclick="openLeadDrawer('${lead.id}')"` : "disabled"}>${escapeHtml(String(score.score || 0))}</button>
      </div>
    `;
  }).join("");
}

function renderDuplicateWarnings() {
  const container = document.getElementById("duplicate-warning-list");
  if (!container) return;

  const items = state.leadDuplicates
    .filter((item) => !item.resolved)
    .slice(0, 6);

  if (!items.length) {
    container.innerHTML = emptyState("No duplicate warnings", "Duplicate checks will appear here when Gmail, website, Tidio, or Instagram detect a match.");
    return;
  }

  container.innerHTML = items.map((item) => {
    const lead = getLeadById(item.matched_lead_id);
    const identity = item.incoming_email || item.incoming_phone || "Unknown contact";
    const reason = getDuplicateReasonCopy(item, lead);
    const involved = lead
      ? `${lead.clientName} (${lead.leadCode || "CRM record"}) and the new ${item.incoming_source || "lead"} inquiry`
      : `Matched record ${item.matched_lead_id || "not loaded"} and the new ${item.incoming_source || "lead"} inquiry`;
    return `
      <div class="duplicate-card">
        <div class="intel-main">
          <div class="duplicate-title-row">
            <strong>${escapeHtml(lead?.clientName || identity)}</strong>
            <span class="chip" data-tone="attention">${escapeHtml(`${item.confidence || 80}% match`)}</span>
          </div>
          <p>${escapeHtml(reason)}</p>
          <dl class="duplicate-details">
            <div><dt>Possible duplicate</dt><dd>${escapeHtml(identity)}</dd></div>
            <div><dt>Records involved</dt><dd>${escapeHtml(involved)}</dd></div>
            <div><dt>Recommended action</dt><dd>Review both records, merge if they are the same client, or ignore this warning if they are different events.</dd></div>
          </dl>
        </div>
        <div class="duplicate-actions">
          ${lead ? `<button class="button button-secondary button-small" onclick="openLeadDrawer('${lead.id}')">Review duplicate</button>` : ""}
          ${lead ? `<button class="button button-primary button-small" onclick="mergeDuplicateWarning('${item.id}', '${lead.id}')">Merge records</button>` : ""}
          <button class="button button-secondary button-small" onclick="ignoreDuplicateWarning('${item.id}')">Ignore warning</button>
        </div>
      </div>
    `;
  }).join("");
}

function getDuplicateReasonCopy(item, lead) {
  const source = item.incoming_source || "A new lead";
  const reason = String(item.match_reason || "").replace(/_/g, " ");
  if (reason.includes("thread")) {
    return `${source} was flagged because it appears to be part of an existing Gmail conversation${lead ? ` for ${lead.clientName}` : ""}.`;
  }
  if (reason.includes("event date")) {
    return `${source} was flagged because the contact details and event date match an existing CRM record.`;
  }
  if (reason.includes("email") || reason.includes("phone")) {
    return `${source} was flagged because the email or phone number already exists on an open CRM record.`;
  }
  return `${source} may belong to an existing open CRM record.`;
}

function renderAutomationRuns() {
  const container = document.getElementById("automation-run-list");
  if (!container) return;
  const archiveButton = document.getElementById("automation-run-archive-button");

  const items = state.automationRuns.slice(0, 3);
  if (!items.length) {
    container.innerHTML = emptyState("No runs logged", "Run Receptionist or Marketing after the SQL upgrade to see history here.");
    if (archiveButton) archiveButton.hidden = true;
    return;
  }

  container.innerHTML = items.map((run) => {
      const summary = run.summary || {};
      const summaryText = run.agent === "marketing"
        ? `${summary.campaignsCreated || 0} campaign draft(s)`
        : `${summary.gmailImported || 0} Gmail, ${summary.draftsCreated || 0} draft(s), ${summary.paymentLinksCreated || 0} payment link(s)`;
    return `
      <div class="intel-item">
        <div class="intel-main">
          <strong>${escapeHtml(titleCase(run.agent || "system"))}</strong>
          <p class="card-meta">${escapeHtml(formatDateTime(run.started_at))}</p>
          <p class="card-meta">${escapeHtml(summaryText)}</p>
        </div>
        <span class="chip ${run.status === "failed" ? "" : "chip-muted"}" data-tone="${run.status === "failed" ? "lost" : "booked"}">${escapeHtml(run.status || "started")}</span>
      </div>
    `;
  }).join("");

  if (archiveButton) {
    archiveButton.hidden = state.automationRuns.length <= 3;
    archiveButton.onclick = () => alert(buildAutomationRunArchive());
  }
}

function buildAutomationRunArchive() {
  return state.automationRuns
    .slice(0, 12)
    .map((run) => `${titleCase(run.agent || "system")} - ${run.status || "started"} - ${formatDateTime(run.started_at)}`)
    .join("\\n");
}

function renderKpis() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const openLeads = state.leads.filter((lead) => ACTIVE_STATUSES.has(lead.status)).length;
  const bookedCount = state.leads.filter((lead) => CONFIRMED_STATUSES.has(lead.status)).length;
  const followupCount = state.followups.filter((followup) => followup.status === "Open").length;
  const pendingPayments = state.payments.filter((payment) => getEffectivePaymentStatus(payment) === "Pending").length;
  const leadsThisMonth = state.leads.filter((lead) => (lead.createdAt || "").startsWith(currentMonth)).length;

  const cards = [
    ["Open leads", openLeads, "Active inquiries"],
    ["Booked", bookedCount, "Confirmed events"],
    ["Follow-ups", followupCount, "Open tasks"],
    ["Pending payments", pendingPayments, "Awaiting retainer"],
    ["New this month", leadsThisMonth, formatMonthLabel(currentMonth)],
    ["DJ leads", state.leads.filter((lead) => lead.serviceRequested.includes("DJ")).length, "Add-on opportunities"]
  ];

  document.getElementById("kpi-grid").innerHTML = cards.map(([label, value, meta]) => `
    <article class="kpi-card">
      <p>${escapeHtml(label)}</p>
      <strong>${escapeHtml(String(value))}</strong>
      <p>${escapeHtml(meta)}</p>
    </article>
  `).join("");
}

function renderApprovalQueue() {
  const container = document.getElementById("approval-queue");
  if (!container) return;

  const draftItems = state.messageHistory
    .filter((item) => item.draftCreated)
    .slice(0, 12)
    .map((item) => {
      const lead = getLeadById(item.leadId);
      return {
        type: "Gmail Draft",
        title: item.subject || "Prepared Gmail draft",
        meta: lead ? `${lead.clientName} | ${lead.email}` : item.toValue || "Lead pending",
        notes: [item.summary, item.notes].filter(Boolean).join("\n"),
        action: [
          lead ? `<button class="button button-secondary" onclick="openLeadDrawer('${lead.id}')">Review Lead</button>` : "",
          `<button class="button button-secondary" onclick="dismissDraftApproval('${item.id}')">Dismiss</button>`
        ].filter(Boolean).join("")
      };
    });

  const bookingItems = state.leads
    .filter((lead) => ["Deposit Pending", "Deposit Paid", "Paid"].includes(lead.status) || ["Paid", "Deposit Paid"].includes(lead.paymentStatus))
    .slice(0, 8)
    .map((lead) => ({
      type: "Booking Approval",
      title: isLeadPaymentVerified(lead) ? "Payment received, verify signed agreement" : "Verify payment and signed agreement",
      meta: `${lead.clientName} | ${formatEventDateTime(lead.eventDate, lead.startTime, lead.endTime)} | ${lead.paymentStatus}`,
      notes: "Do not mark Booked until calendar is checked, signed agreement is received, and payment is confirmed.",
      action: [
        `<button class="button button-secondary" onclick="openLeadDrawer('${lead.id}')">Review Lead</button>`,
        canShowConfirmBooked(lead) ? `<button class="button button-primary" onclick="confirmSignedBooking('${lead.id}')">${isLeadPaymentVerified(lead) ? "Signed + Booked" : "Verified Paid + Signed"}</button>` : ""
      ].filter(Boolean).join("")
    }));

  const followupItems = state.followups
    .filter((item) => item.status === "Open")
    .slice(0, 8)
    .map((item) => {
      const lead = getLeadById(item.leadId);
      return {
        type: "Follow-Up",
        title: `${item.channel} follow-up due ${formatDate(item.dueDate)}`,
        meta: lead ? `${lead.clientName} | ${lead.status}` : "Lead pending",
        notes: item.notes,
        action: lead ? `<button class="button button-secondary" onclick="openLeadDrawer('${lead.id}')">Review Lead</button>` : ""
      };
    });

  const campaignItems = state.campaigns
    .filter((campaign) => ["Ready for Review", "Idea"].includes(campaign.status))
    .slice(0, 12)
    .map((campaign) => ({
      type: "Marketing Review",
      title: campaign.title,
      meta: `${campaign.channel} | ${campaign.status} | ${campaign.priority}`,
      notes: campaign.notes,
      action: `<button class="button button-secondary" onclick="openCampaignModal('${campaign.id}')">Review Campaign</button>`
    }));

  const grouped = [
    ["Gmail Drafts", draftItems, "No Gmail drafts waiting for review."],
    ["Booking Decisions", bookingItems, "No booking approvals waiting right now."],
    ["Follow-Ups", followupItems, "No open follow-ups."],
    ["Marketing Drafts", campaignItems, "No marketing drafts waiting for review."]
  ];

  container.innerHTML = grouped.map(([title, items, emptyCopy]) => `
    <article class="approval-column">
      <div class="panel-header">
        <div>
          <p class="panel-kicker">Owner Approval</p>
          <h2>${escapeHtml(title)}</h2>
        </div>
        <span class="chip chip-muted">${items.length}</span>
      </div>
      <div class="approval-list">
        ${items.length ? items.map((item) => `
          <div class="approval-item">
            <span class="chip chip-muted">${escapeHtml(item.type)}</span>
            <strong>${escapeHtml(item.title)}</strong>
            <p class="card-meta">${escapeHtml(item.meta)}</p>
            <p>${escapeHtml(item.notes || "Review before taking action.")}</p>
            <div class="card-actions">${item.action}</div>
          </div>
        `).join("") : emptyState("Clear", emptyCopy)}
      </div>
    </article>
  `).join("");
}

function renderStatusGrid() {
  const statuses = LEAD_STATUSES
    .map((status) => [status, state.leads.filter((lead) => lead.status === status).length])
    .filter(([, count]) => count > 0);

  document.getElementById("status-grid").innerHTML = (statuses.length ? statuses : [["No active leads", 0]]).map(([status, count]) => `
    <article class="status-card">
      <span>${escapeHtml(status)}</span>
      <strong>${count}</strong>
    </article>
  `).join("");
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

function renderCalendarSyncSummary() {
  const container = document.getElementById("calendar-sync-summary");
  if (!container) return;

  const activeBookings = state.bookings.filter((booking) => ["Booked", "Deposit Paid", "Paid"].includes(booking.bookingStatus));
  if (!activeBookings.length) {
    container.innerHTML = emptyState("No calendar sync items", "Booked, paid events will show Google Calendar sync status here.");
    return;
  }

  const priority = { Failed: 0, Pending: 1, Synced: 2 };
  const items = activeBookings
    .sort((a, b) => (priority[a.calendarSyncStatus] ?? 1) - (priority[b.calendarSyncStatus] ?? 1) || compareDates(a.eventDate, b.eventDate))
    .slice(0, 4);

  container.innerHTML = items.map((booking) => `
    <div class="stack-item sync-item">
      <div>
        <strong>${escapeHtml(booking.clientName || "Booking")}</strong>
        <p>${escapeHtml(formatEventDateTime(booking.eventDate, booking.startTime, booking.endTime))}</p>
        ${booking.calendarSyncError ? `<p class="status-note">${escapeHtml(booking.calendarSyncError)}</p>` : ""}
      </div>
      <div class="sync-actions">
        ${calendarSyncChip(booking)}
        ${canSyncBookingToCalendar(getLeadById(booking.leadId), booking) ? `<button class="button button-secondary button-small" onclick="syncBookingCalendar('${booking.leadId}', '${booking.id}')">Retry</button>` : ""}
      </div>
    </div>
  `).join("");
}

function renderUpcomingBookings() {
  const rows = [...state.leads]
    .filter((lead) => BOOKING_STATUSES.has(lead.status))
    .sort((a, b) => compareDates(a.eventDate, b.eventDate))
    .slice(0, 6)
    .map((lead) => `
      <tr>
        <td>${escapeHtml(lead.clientName)}</td>
        <td>${escapeHtml(formatEventDateTime(lead.eventDate, lead.startTime, lead.endTime))}</td>
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
          <p class="card-meta">${escapeHtml(lead.leadCode || "Lead ID pending")}</p>
          <p class="card-meta">${escapeHtml(`${lead.eventType} | ${lead.city || "City pending"}`)}</p>
        </div>
        ${statusChip(lead.status)}
      </div>
      <div class="card-meta">
        <span>${escapeHtml(formatEventDateTime(lead.eventDate, lead.startTime, lead.endTime))}</span>
        <span>${escapeHtml(lead.serviceRequested)}</span>
        <span>${escapeHtml(lead.source)}</span>
        <span>${escapeHtml(String(lead.guestCount || 0))} guests</span>
        ${lead.leadScore ? `<span>Score ${escapeHtml(String(lead.leadScore))}</span>` : ""}
      </div>
      ${Array.isArray(lead.tags) && lead.tags.length ? `<div class="chip-row">${lead.tags.slice(0, 5).map((tag) => `<span class="chip chip-muted">${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
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
    .map((lead) => {
      const booking = getBookingForLead(lead.id);
      return `
      <tr>
        <td>${escapeHtml(lead.clientName)}</td>
        <td>${escapeHtml(formatEventDateTime(lead.eventDate, lead.startTime, lead.endTime))}</td>
        <td>${escapeHtml(lead.serviceRequested)}</td>
        <td>${escapeHtml(lead.venue || "Pending venue")}</td>
        <td>${escapeHtml(lead.paymentStatus)}</td>
        <td>${calendarSyncChip(booking)}${booking?.calendarSyncError ? `<p class="status-note">${escapeHtml(booking.calendarSyncError)}</p>` : ""}</td>
        <td>
          <select class="select-inline" onchange="updateLeadStatus('${lead.id}', this.value)">
            ${LEAD_STATUSES.map((status) => `<option value="${status}" ${status === lead.status ? "selected" : ""}>${status}</option>`).join("")}
          </select>
          <p class="status-note">${escapeHtml(lead.calendarChecked === "Yes" ? "Calendar checked" : "Availability still needs confirmation")}</p>
        </td>
        <td class="row-actions">
          <button class="button button-secondary" onclick="checkLeadAvailability('${lead.id}')">Check Calendar</button>
          ${canSyncBookingToCalendar(lead, booking) ? `<button class="button button-secondary" onclick="syncBookingCalendar('${lead.id}', '${booking.id}')">Sync Calendar</button>` : ""}
          <button class="button button-primary" onclick="prepareContractAndDeposit('${lead.id}')">Prepare Deposit</button>
          ${canShowConfirmBooked(lead) ? `<button class="button button-primary" onclick="confirmSignedBooking('${lead.id}')">${isLeadPaymentVerified(lead) ? "Signed + Booked" : "Verified Paid + Signed"}</button>` : ""}
          <button class="button button-secondary" onclick="openLeadDrawer('${lead.id}')">View</button>
        </td>
      </tr>
    `;
    }).join("");

  document.getElementById("booking-rows").innerHTML = rows || `<tr><td colspan="8">No booking records available.</td></tr>`;
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
    const effectiveStatus = getEffectivePaymentStatus(payment, lead);
    const statusSource = effectiveStatus !== payment.status ? "Synced from booked lead" : "";
    return `
      <tr>
        <td>${escapeHtml(lead?.clientName || "Unknown Lead")}</td>
        <td>${escapeHtml(payment.type)}</td>
        <td>${escapeHtml(formatCurrency(payment.amount))}</td>
        <td>
          ${statusChip(effectiveStatus)}
          ${statusSource ? `<p class="status-note">${escapeHtml(statusSource)}</p>` : ""}
        </td>
        <td><a href="${escapeAttribute(payment.link)}" target="_blank" rel="noreferrer">Open link</a></td>
        <td class="row-actions">
          ${lead ? `<button class="button button-secondary" onclick="verifyStripePayment('${lead.id}', false)">Verify Stripe</button>` : ""}
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
    const emptyCopy = source === "Tidio"
      ? "New chat inquiries will appear here as soon as the Tidio flow posts them into the CRM."
      : source === "Gmail"
        ? "Once Gmail is connected and synced, labeled inbox inquiries will appear here."
        : source === "Instagram"
          ? "Instagram DMs/comments will appear here after Meta webhooks or the Instagram lead intake endpoint is connected."
          : `Once ${source} sync is connected, this section can auto-populate.`;
    container.innerHTML = emptyState(`No ${source} leads yet`, emptyCopy);
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
    document.getElementById("lead-start-time").value = lead.startTime || "";
    document.getElementById("lead-end-time").value = lead.endTime || "";
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
  const relatedMessages = state.messageHistory
    .filter((item) => item.leadId === leadId)
    .sort((a, b) => compareDates(b.messageAt || b.createdAt, a.messageAt || a.createdAt))
    .slice(0, 8);

  document.getElementById("drawer-content").innerHTML = `
    <div class="drawer-content">
      <div>
        <p class="panel-kicker">Lead Detail</p>
        <h2>${escapeHtml(lead.clientName)}</h2>
        <p class="card-meta">${escapeHtml(lead.leadCode || "Lead ID pending")}</p>
        <p class="card-notes">${escapeHtml(lead.notes || "No notes recorded yet.")}</p>
      </div>
      <div class="drawer-grid">
        <div><dt>Status</dt><dd>${escapeHtml(lead.status)}</dd></div>
        <div><dt>Lead ID</dt><dd>${escapeHtml(lead.leadCode || "Pending")}</dd></div>
        <div><dt>Source</dt><dd>${escapeHtml(lead.source)}</dd></div>
        <div><dt>Event type</dt><dd>${escapeHtml(lead.eventType)}</dd></div>
        <div><dt>Event date + time</dt><dd>${escapeHtml(formatEventDateTime(lead.eventDate, lead.startTime, lead.endTime))}</dd></div>
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
      <div class="stack-list">
        <div class="stack-item"><strong>Message history</strong><span>${relatedMessages.length}</span></div>
        ${relatedMessages.length ? relatedMessages.map((item) => `
          <article class="message-card">
            <div class="message-head">
              <div>
                <strong>${escapeHtml(item.subject || `${item.channel} message`)}</strong>
                <p>${escapeHtml(`${item.channel || "Message"} | ${item.direction || "Logged"} | ${formatDateTime(item.messageAt || item.createdAt)}`)}</p>
              </div>
              ${item.draftCreated ? `<span class="chip chip-muted">Draft</span>` : ""}
            </div>
            <p class="message-body">${escapeHtml(item.summary || item.notes || "No message summary saved.")}</p>
          </article>
        `).join("") : emptyState("No messages", "Customer emails and receptionist drafts will appear here after Gmail sync.")}
      </div>
      <div class="card-actions">
        <button class="button button-secondary" onclick="checkLeadAvailability('${lead.id}')">Check Calendar</button>
        <button class="button button-primary" onclick="prepareContractAndDeposit('${lead.id}')">Prepare Deposit</button>
        ${relatedPayments.length ? `<button class="button button-secondary" onclick="verifyStripePayment('${lead.id}', false)">Verify Stripe</button>` : ""}
        ${relatedPayments.length && lead.calendarChecked === "Yes" ? `<button class="button button-primary" onclick="verifyStripePayment('${lead.id}', true)">Verify Stripe + Signed</button>` : ""}
        ${canShowConfirmBooked(lead) ? `<button class="button button-primary" onclick="confirmSignedBooking('${lead.id}')">${isLeadPaymentVerified(lead) ? "Signed + Booked" : "Verified Paid + Signed"}</button>` : ""}
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

  if (nextStatus === "Booked") {
    if (lead.calendarChecked !== "Yes" || lead.paymentStatus !== "Paid") {
      alert("Do not mark Booked until calendar is checked and the 50% retainer/payment is confirmed.");
      renderAll();
      return;
    }
    if (!confirm("Only mark Booked after the signed service agreement is received. Continue?")) {
      renderAll();
      return;
    }
  }

  const previousStatus = lead.status;
  lead.status = nextStatus;
  lead.updatedAt = todayIso();

  try {
    const savedLead = await upsertResource("leads", lead);
    upsertLocalItem(state.leads, savedLead);
    await reconcileLeadPaymentState(savedLead);
    renderAll();
    if (nextStatus === "Booked" && savedLead.paymentStatus === "Paid") {
      const booking = getBookingForLead(savedLead.id);
      await syncBookingCalendar(savedLead.id, booking?.id || "");
    }
  } catch (error) {
    lead.status = previousStatus;
    console.error(error);
    alert(getFriendlyError(error, "Status could not be updated."));
    renderAll();
  }
}

async function reconcileLeadPaymentState(lead) {
  if (!lead || !isLeadPaymentVerified(lead)) return;
  if (authState.session?.accessToken && !authState.isLocalFallback) {
    const response = await fetch("/api/admin/reconcile-payment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authState.session.accessToken}`
      },
      body: JSON.stringify({ leadId: lead.id })
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || "Could not sync payment/deposit records.");
    }
    await hydrateData();
    return;
  }

  const relatedPayments = state.payments.filter((payment) => payment.leadId === lead.id);
  if (!relatedPayments.length) {
    const payment = {
      id: crypto.randomUUID(),
      leadId: lead.id,
      type: "Deposit Request",
      amount: calculateDepositAmount(lead),
      status: "Paid",
      link: "",
      notes: "Payment marked paid from lead status. Verify Stripe/payment record if this was changed manually.",
      createdAt: todayIso(),
      updatedAt: todayIso()
    };
    const savedPayment = await upsertResource("payments", payment);
    upsertLocalItem(state.payments, savedPayment);
    return;
  }

  for (const payment of relatedPayments) {
    if (payment.status === "Paid") continue;
    const updatedPayment = {
      ...payment,
      status: "Paid",
      notes: [
        payment.notes,
        `Marked paid because lead payment/status was set to paid on ${todayIso()}.`
      ].filter(Boolean).join("\n"),
      updatedAt: todayIso()
    };
    const savedPayment = await upsertResource("payments", updatedPayment);
    upsertLocalItem(state.payments, savedPayment);
  }
}

async function verifyStripePayment(leadId, signedAgreement = false) {
  const lead = getLeadById(leadId);
  if (!lead) return;
  if (!authState.session?.accessToken) {
    alert("Sign in with Supabase before verifying Stripe payments.");
    return;
  }
  const message = signedAgreement
    ? "Verify Stripe payment and confirm the signed agreement was received? If paid, this will move the event to Booked and sync Google Calendar."
    : "Verify this lead's Stripe checkout session now? If paid, this will mark the deposit paid.";
  if (!confirm(message)) return;

  try {
    const response = await fetch("/api/admin/verify-stripe-payment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authState.session.accessToken}`
      },
      body: JSON.stringify({ leadId, signedAgreement })
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || "Stripe payment could not be verified.");
    }

    await hydrateData();
    renderAll();
    closeDrawer();
    setSection(signedAgreement ? "bookings" : "payments");
    alert([
      payload.paid ? "Stripe payment verified as paid." : "Stripe payment is not paid yet.",
      payload.leadStatus ? `Lead status: ${payload.leadStatus}` : "",
      payload.amountPaid ? `Amount paid: ${formatCurrency(payload.amountPaid)}` : "",
      payload.calendarSync?.ok ? "Google Calendar synced." : payload.calendarSync?.error || ""
    ].filter(Boolean).join("\n"));
  } catch (error) {
    console.error(error);
    alert(getFriendlyError(error, "Could not verify Stripe payment."));
  }
}

async function syncBookingCalendar(leadId, bookingId = "") {
  if (!authState.session?.accessToken) {
    alert("Sign in with Supabase before syncing Google Calendar.");
    return;
  }

  try {
    const response = await fetch("/api/admin/calendar-sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authState.session.accessToken}`
      },
      body: JSON.stringify({ leadId, bookingId })
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      throw Object.assign(new Error(payload?.error || "Calendar sync failed."), { details: payload?.details });
    }
    await hydrateData();
    renderAll();
    alert(payload.calendarSync?.htmlLink ? `Google Calendar synced.\n${payload.calendarSync.htmlLink}` : "Google Calendar synced.");
  } catch (error) {
    console.error(error);
    alert(getFriendlyError(error, "Could not sync this booking to Google Calendar."));
  }
}

async function checkLeadAvailability(leadId) {
  const lead = getLeadById(leadId);
  if (!lead) return;
  if (!lead.eventDate) {
    alert("Add the event date before checking calendar availability.");
    return;
  }
  if (!authState.session?.accessToken) {
    alert("Sign in with Supabase before checking calendar availability.");
    return;
  }

  try {
    const response = await fetch("/api/calendar/availability", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authState.session.accessToken}`
      },
      body: JSON.stringify({
        date: lead.eventDate,
        startTime: lead.startTime || "00:00",
        endTime: lead.endTime || "23:59",
        timeZone: "America/New_York"
      })
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error || "Calendar check failed.");
    }

    lead.calendarChecked = payload.available ? "Yes" : "No";
    lead.notes = [
      lead.notes,
      payload.available
        ? `Calendar checked ${todayIso()}: no busy blocks found for ${formatEventDateTime(lead.eventDate, lead.startTime, lead.endTime)}. Booking still requires signed contract and 50% retainer.`
        : `Calendar checked ${todayIso()}: ${payload.busy.length} busy block(s) found for ${formatEventDateTime(lead.eventDate, lead.startTime, lead.endTime)}. Do not confirm availability yet.`
    ].filter(Boolean).join("\n\n");
    lead.updatedAt = todayIso();

    const savedLead = await upsertResource("leads", lead);
    upsertLocalItem(state.leads, savedLead);
    renderAll();
    alert(payload.available ? "Calendar looks open. Booking still needs contract + 50% retainer." : "Calendar has a conflict. Do not confirm this booking yet.");
  } catch (error) {
    console.error(error);
    const message = getFriendlyError(error, "Calendar availability could not be checked.");
    if (message.toLowerCase().includes("insufficient authentication scopes")) {
      alert("Google Calendar permission is missing. Go to Gmail, click Disconnect, then Connect Gmail again and approve Calendar permissions.");
      return;
    }
    const detail = error?.details?.error?.message || error?.details?.message || "";
    alert(detail && detail !== message ? `${message}\n\nGoogle detail: ${detail}` : message);
  }
}

async function prepareContractAndDeposit(leadId) {
  const lead = getLeadById(leadId);
  if (!lead) return;
  if (lead.calendarChecked !== "Yes") {
    alert("Check calendar availability before preparing contract and deposit.");
    return;
  }
  if (!lead.email || lead.email === "Not provided") {
    alert("Add the client's email before preparing contract and deposit.");
    return;
  }
  if (!authState.session?.accessToken) {
    alert("Sign in with Supabase before preparing contract and deposit.");
    return;
  }

  try {
    const depositAmount = calculateDepositAmount(lead);
    const response = await fetch("/api/receptionist/prepare-booking", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authState.session.accessToken}`
      },
      body: JSON.stringify({ lead, depositAmount })
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw Object.assign(new Error(payload?.error || "Could not prepare booking next step."), { details: payload?.details });
    }

    const nextLead = {
      ...lead,
      status: "Deposit Pending",
      paymentStatus: payload.paymentReady ? "Pending" : "Not Requested",
      notes: [
        lead.notes,
        `Receptionist prepared contract/deposit step ${todayIso()}. Contract: ${payload.contractUrl}. ${payload.paymentReady ? `Stripe retainer link: ${payload.paymentUrl}` : payload.paymentSkippedReason}. ${payload.gmailDraftReady ? `Gmail draft created: ${payload.gmailDraftId}` : payload.gmailDraftSkippedReason}.`
      ].filter(Boolean).join("\n\n"),
      updatedAt: todayIso()
    };
    const savedLead = await upsertResource("leads", nextLead);
    upsertLocalItem(state.leads, savedLead);

    const payment = {
      id: crypto.randomUUID(),
      leadId: lead.id,
      type: "Deposit Request",
      amount: payload.depositAmount,
      status: "Pending",
      link: payload.paymentUrl || "",
      stripeSessionId: payload.stripeSessionId || "",
      stripePaymentIntentId: payload.stripePaymentIntentId || "",
      notes: payload.paymentReady
        ? "50% retainer checkout link created by receptionist automation."
        : `Payment link still needed. ${payload.paymentSkippedReason || "Add Stripe payment link manually."}`,
      createdAt: todayIso(),
      updatedAt: todayIso()
    };
    const savedPayment = await upsertResource("payments", payment);
    upsertLocalItem(state.payments, savedPayment);

    const followup = {
      id: crypto.randomUUID(),
      leadId: lead.id,
      dueDate: addDaysIso(1),
      channel: "Email",
      status: "Open",
      notes: payload.gmailDraftReady
        ? `Review and send Gmail draft ${payload.gmailDraftId}. Confirm signed agreement and 50% retainer before marking booked.`
        : `Draft/send contract + deposit email manually. ${payload.gmailDraftSkippedReason || ""}`.trim(),
      createdAt: todayIso(),
      updatedAt: todayIso()
    };
    const savedFollowup = await upsertResource("followups", followup);
    upsertLocalItem(state.followups, savedFollowup);

    if (payload.gmailDraftReady) {
      const message = {
        id: crypto.randomUUID(),
        leadId: lead.id,
        bookingId: "",
        messageAt: new Date().toISOString(),
        channel: "Gmail",
        direction: "Outbound",
        fromValue: "",
        toValue: lead.email,
        subject: payload.subject || "Booth Fairy Miami next steps",
        gmailThreadId: payload.gmailDraftThreadId || "",
        gmailMessageId: payload.gmailDraftMessageId || "",
        summary: "Receptionist prepared contract and 50% retainer Gmail draft for owner review.",
        draftCreated: true,
        notes: `Gmail draft ID: ${payload.gmailDraftId}. Owner must review/send manually before any booking is confirmed.`,
        createdAt: new Date().toISOString()
      };
      const savedMessage = await upsertResource("messageHistory", message);
      upsertLocalItem(state.messageHistory, savedMessage);
    }

    renderAll();
    alert([
      "Contract/deposit step prepared.",
      payload.gmailDraftReady ? "Gmail draft created." : payload.gmailDraftSkippedReason,
      payload.paymentReady ? "Stripe retainer link created." : payload.paymentSkippedReason,
      "Lead moved to Deposit Pending."
    ].filter(Boolean).join("\n"));
  } catch (error) {
    console.error(error);
    alert(getFriendlyError(error, "Could not prepare contract and deposit step."));
  }
}

function canConfirmBooked(lead) {
  return lead
    && lead.status !== "Booked"
    && lead.calendarChecked === "Yes"
    && isLeadPaymentVerified(lead);
}

function canShowConfirmBooked(lead) {
  return lead
    && lead.status !== "Booked"
    && lead.calendarChecked === "Yes"
    && (isLeadPaymentVerified(lead) || lead.status === "Deposit Pending");
}

function canSyncBookingToCalendar(lead, booking) {
  if (!booking) return false;
  const isBooked = booking.bookingStatus === "Booked" || lead?.status === "Booked";
  const isPaid = booking.depositStatus === "Paid" || lead?.paymentStatus === "Paid";
  return isBooked && isPaid && booking.calendarSyncStatus !== "Synced";
}

function isLeadPaymentVerified(lead) {
  return lead.paymentStatus === "Paid" || ["Booked", "Completed"].includes(lead.status);
}

async function confirmSignedBooking(leadId) {
  const lead = getLeadById(leadId);
  if (!lead) return;
  if (!canShowConfirmBooked(lead)) {
    alert("Only confirm once calendar is checked and the retainer step exists.");
    return;
  }
  const paymentVerified = isLeadPaymentVerified(lead);
  const confirmCopy = paymentVerified
    ? "Confirm the signed agreement was received and mark this event Booked? This will sync the booking to Google Calendar."
    : "This lead is not marked Paid in the CRM yet. Only continue if you personally verified the 50% retainer payment in Stripe/Gmail and received the signed agreement. Mark as Booked now?";
  if (!confirm(confirmCopy)) {
    return;
  }
  if (!authState.session?.accessToken) {
    alert("Sign in with Supabase before confirming a booking.");
    return;
  }

  try {
    const response = await fetch("/api/admin/confirm-booking", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authState.session.accessToken}`
      },
      body: JSON.stringify({ leadId, paymentVerified: !paymentVerified })
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      throw Object.assign(new Error(payload?.error || "Could not confirm booking."), { details: payload?.details });
    }

    await hydrateData();
    renderAll();
    closeDrawer();
    setSection("bookings");
    alert([
      "Booking confirmed.",
      payload.calendarSync?.ok ? "Google Calendar synced." : payload.calendarSync?.error || "Calendar sync pending."
    ].filter(Boolean).join("\n"));
  } catch (error) {
    console.error(error);
    alert(getFriendlyError(error, "Could not confirm booking."));
  }
}

async function dismissDraftApproval(messageId) {
  if (!confirm("Remove this Gmail draft from the Approvals queue? This will not delete anything in Gmail.")) return;
  try {
    const existing = state.messageHistory.find((item) => item.id === messageId);
    if (!existing) return;
    const updated = {
      ...existing,
      draftCreated: false,
      notes: [existing.notes, `Dismissed from approval queue on ${new Date().toISOString()}.`].filter(Boolean).join("\n")
    };
    const saved = await upsertResource("messageHistory", updated);
    upsertLocalItem(state.messageHistory, saved);
    renderApprovalQueue();
  } catch (error) {
    console.error(error);
    alert(getFriendlyError(error, "Could not dismiss this draft approval."));
  }
}

async function ignoreDuplicateWarning(warningId) {
  const warning = state.leadDuplicates.find((item) => item.id === warningId);
  if (!warning) return;

  warning.resolved = true;
  renderLeadIntelligence();

  if (state.syncMode !== "Supabase live") {
    return;
  }

  try {
    await supabaseRest(`/lead_duplicates?id=eq.${encodeURIComponent(warningId)}`, {
      method: "PATCH",
      body: { resolved: true }
    });
  } catch (error) {
    warning.resolved = false;
    renderLeadIntelligence();
    alert(getFriendlyError(error, "Could not ignore this duplicate warning."));
  }
}

function mergeDuplicateWarning(warningId, leadId) {
  const warning = state.leadDuplicates.find((item) => item.id === warningId);
  const lead = getLeadById(leadId);
  if (!lead) return;

  openLeadDrawer(leadId);
  alert([
    "Merge records",
    "",
    `Keep this CRM record for ${lead.clientName}.`,
    `Copy any missing details from the ${warning?.incoming_source || "new"} inquiry into this lead, then ignore the duplicate warning once reviewed.`,
    "",
    "This avoids creating a second booking for the same client conversation."
  ].join("\n"));
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

function getBookingForLead(leadId) {
  return state.bookings.find((booking) => booking.leadId === leadId);
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
  localStorage.setItem(STORAGE_KEYS.bookings, JSON.stringify(state.bookings));
  localStorage.setItem(STORAGE_KEYS.followups, JSON.stringify(state.followups));
  localStorage.setItem(STORAGE_KEYS.payments, JSON.stringify(state.payments));
  localStorage.setItem(STORAGE_KEYS.campaigns, JSON.stringify(state.campaigns));
  localStorage.setItem(STORAGE_KEYS.messageHistory, JSON.stringify(state.messageHistory));
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
  const raw = sessionStorage.getItem(key);
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
  sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

function clearSavedSession() {
  sessionStorage.removeItem(AUTH_SESSION_KEY);
}

function clearLegacyAuthStorage() {
  localStorage.removeItem(AUTH_SESSION_KEY);
}

function resetUiState() {
  document.querySelectorAll(".modal, .drawer").forEach((element) => {
    element.hidden = true;
  });
  document.body.classList.remove("modal-open");
}

function needsRefresh(session) {
  return !session?.expiresAt || Date.now() >= session.expiresAt;
}

function statusChip(status) {
  const tone = status === "Lost"
    ? "lost"
    : ["Booked", "Paid", "Deposit Paid", "Completed", "Event Completed", "Review Requested", "Repeat Client"].includes(status)
      ? "booked"
      : ["Missing Info", "Follow-Up", "Follow-Up Needed", "Deposit Pending"].includes(status)
        ? "attention"
      : "new";
  return `<span class="chip" data-tone="${tone}">${escapeHtml(status)}</span>`;
}

function getEffectivePaymentStatus(payment, lead = getLeadById(payment?.leadId)) {
  const booking = payment?.leadId ? getBookingForLead(payment.leadId) : null;
  if (
    lead?.paymentStatus === "Paid" ||
    ["Booked", "Paid", "Deposit Paid", "Completed", "Event Completed", "Review Requested", "Repeat Client"].includes(lead?.status) ||
    booking?.depositStatus === "Paid"
  ) {
    return "Paid";
  }
  return payment?.status || "Pending";
}

function calendarSyncChip(booking) {
  const status = booking?.calendarSyncStatus || "Pending";
  const tone = status === "Synced" ? "booked" : status === "Failed" ? "lost" : "attention";
  const label = status === "Synced"
    ? "Synced to Google Calendar"
    : status === "Failed"
      ? "Sync Failed"
      : "Pending Sync";
  return `<span class="chip" data-tone="${tone}">${escapeHtml(label)}</span>`;
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

function formatEventDateTime(date, startTime = "", endTime = "") {
  const formattedDate = formatDate(date);
  const start = formatTime(startTime);
  const end = formatTime(endTime);
  if (start && end) return `${formattedDate} · ${start} - ${end}`;
  if (start) return `${formattedDate} · ${start}`;
  return formattedDate;
}

function formatTime(value) {
  const clean = normalizeTimeValue(value);
  if (!clean) return "";
  const [hour, minute] = clean.split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return "";
  return new Date(2026, 0, 1, hour, minute).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatDateTime(value) {
  if (!value) return "Pending";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function titleCase(value) {
  return String(value || "")
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
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

function addDaysIso(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function calculateDepositAmount(lead) {
  const budget = Number(lead.budget || 0);
  if (budget > 0) {
    return Math.round(budget * 50) / 100;
  }
  const service = `${lead.serviceRequested || ""}`.toLowerCase();
  if (service.includes("4 hour") || service.includes("$700")) return 350;
  if (service.includes("3 hour") || service.includes("$575")) return 287.5;
  return 225;
}

function updateConnectionIndicators() {
  syncModeLabel.textContent = state.syncDetail;
  if (supabaseStatusChip && state.syncMode === "Supabase live") {
    supabaseStatusChip.textContent = "Tables live";
  } else if (supabaseStatusChip && authState.isLocalFallback) {
    supabaseStatusChip.textContent = "Local demo";
  } else if (supabaseStatusChip && authState.user) {
    supabaseStatusChip.textContent = "Auth connected";
  } else if (supabaseStatusChip) {
    supabaseStatusChip.textContent = "Sign in required";
  }

  if (gmailStatusChip && !state.gmail.configured) {
    gmailStatusChip.textContent = "OAuth setup needed";
  } else if (gmailStatusChip && state.gmail.connected) {
    gmailStatusChip.textContent = `Connected: ${state.gmail.connectedEmail}`;
  } else if (gmailStatusChip) {
    gmailStatusChip.textContent = "Ready to connect";
  }

  const tidioLeadCount = state.leads.filter((lead) => lead.source === "Tidio").length;
  if (tidioStatusChip && state.syncMode === "Supabase live" && tidioLeadCount > 0) {
    tidioStatusChip.textContent = `${tidioLeadCount} live lead${tidioLeadCount === 1 ? "" : "s"} synced`;
  } else if (tidioStatusChip && state.syncMode === "Supabase live") {
    tidioStatusChip.textContent = "Webhook live";
  } else if (tidioStatusChip && authState.user) {
    tidioStatusChip.textContent = "Auth ready";
  } else if (tidioStatusChip) {
    tidioStatusChip.textContent = "Sign in to verify";
  }

  const instagramLeadCount = state.leads.filter((lead) => lead.source === "Instagram").length;
  if (instagramStatusChip && state.instagram.configured && instagramLeadCount > 0) {
    instagramStatusChip.textContent = `${instagramLeadCount} live lead${instagramLeadCount === 1 ? "" : "s"} synced`;
  } else if (instagramStatusChip && state.instagram.configured) {
    instagramStatusChip.textContent = "Webhook ready";
  } else if (instagramStatusChip) {
    instagramStatusChip.textContent = "Webhook token needed";
  }

  if (instagramStatusNote) {
    instagramStatusNote.textContent = state.instagram.configured
      ? `Webhook URL: ${state.instagram.webhookUrl}. Privacy: ${state.instagram.privacyPolicyUrl}. Deletion: ${state.instagram.dataDeletionUrl}. ${state.instagram.signatureVerification ? "Signature verification is enabled." : "Add INSTAGRAM_APP_SECRET to verify Meta signatures."}`
      : "Add INSTAGRAM_WEBHOOK_VERIFY_TOKEN in Vercel, then paste the webhook URL into your Meta app.";
  }
}

function updateGmailSection() {
  gmailConnectButton.hidden = state.gmail.connected;
  gmailDisconnectButton.hidden = !state.gmail.connected;
  gmailSyncButton.disabled = !state.gmail.connected || !authState.session?.accessToken;

  if (!state.gmail.configured) {
    gmailSectionCopy.textContent = "Add Google OAuth credentials in Vercel, then connect info@boothfairymiami.com to start syncing inbox leads.";
    gmailStatusNote.textContent = "Gmail API credentials are not configured in Vercel yet.";
    return;
  }

  if (state.gmail.connected) {
    gmailSectionCopy.textContent = "The CRM can now import labeled Gmail inquiries from the connected Booth Fairy inbox.";
    gmailStatusNote.textContent = state.gmail.lastSyncSummary || `Connected to ${state.gmail.connectedEmail}. Sync query: ${state.gmail.syncQuery}`;
    return;
  }

  gmailSectionCopy.textContent = `Connect ${state.gmail.allowedMailbox} and sync only the inbox leads you label for the CRM.`;
  gmailStatusNote.textContent = `Ready to connect. Current sync query: ${state.gmail.syncQuery}`;
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
    start_time: lead.startTime || null,
    end_time: lead.endTime || null,
    venue: lead.venue || null,
    city: lead.city || null,
    service_requested: lead.serviceRequested,
    guest_count: lead.guestCount || 0,
    budget: lead.budget || 0,
    notes: lead.notes || null,
    status: lead.status,
    tags: Array.isArray(lead.tags) ? lead.tags : [],
    lead_score: Number(lead.leadScore || lead.lead_score || 0),
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
    leadCode: row.lead_code || "",
    clientName: row.client_name || "",
    phone: row.phone || "",
    email: row.email || "",
    eventType: row.event_type || "",
    eventDate: normalizeDateValue(row.event_date),
    startTime: normalizeTimeValue(row.start_time),
    endTime: normalizeTimeValue(row.end_time),
    venue: row.venue || "",
    city: row.city || "",
    serviceRequested: row.service_requested || "DSLR Photo Booth - Digital Sharing",
    guestCount: Number(row.guest_count || 0),
    budget: Number(row.budget || 0),
    notes: row.notes || "",
    status: row.status || "New Lead",
    tags: Array.isArray(row.tags) ? row.tags : [],
    leadScore: Number(row.lead_score || 0),
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

function mapBookingToDb(booking) {
  return {
    id: booking.id,
    lead_id: booking.leadId || null,
    client_name: booking.clientName || "Booth Fairy Client",
    email: booking.email || null,
    phone: booking.phone || null,
    event_type: booking.eventType || null,
    event_date: booking.eventDate || null,
    start_time: booking.startTime || null,
    end_time: booking.endTime || null,
    venue: booking.venue || null,
    city: booking.city || null,
    service_requested: booking.serviceRequested || null,
    guest_count: Number(booking.guestCount || 0),
    package_interest: booking.packageInterest || null,
    total_quote: Number(booking.totalQuote || 0),
    deposit_required: Number(booking.depositRequired || 0),
    deposit_status: booking.depositStatus || "Not Requested",
    payment_link: booking.paymentLink || null,
    calendar_link: booking.calendarLink || null,
    google_calendar_event_id: booking.calendarEventId || null,
    calendar_sync_status: booking.calendarSyncStatus || "Pending",
    calendar_sync_error: booking.calendarSyncError || null,
    booking_status: booking.bookingStatus || "Deposit Pending",
    contract_sent: Boolean(booking.contractSent),
    notes: booking.notes || null,
    created_at: booking.createdAt || todayIso(),
    updated_at: todayIso()
  };
}

function mapBookingFromDb(row) {
  return {
    id: row.id,
    leadId: row.lead_id || "",
    clientName: row.client_name || "Booth Fairy Client",
    email: row.email || "",
    phone: row.phone || "",
    eventType: row.event_type || "",
    eventDate: normalizeDateValue(row.event_date),
    startTime: normalizeTimeValue(row.start_time),
    endTime: normalizeTimeValue(row.end_time),
    venue: row.venue || "",
    city: row.city || "",
    serviceRequested: row.service_requested || "",
    guestCount: Number(row.guest_count || 0),
    packageInterest: row.package_interest || "",
    totalQuote: Number(row.total_quote || 0),
    depositRequired: Number(row.deposit_required || 0),
    depositStatus: row.deposit_status || "Not Requested",
    paymentLink: row.payment_link || "",
    calendarLink: row.calendar_link || "",
    calendarEventId: row.google_calendar_event_id || row.calendar_event_id || "",
    calendarSyncStatus: row.calendar_sync_status || "Pending",
    calendarSyncError: row.calendar_sync_error || "",
    calendarSyncedAt: row.calendar_synced_at || "",
    bookingStatus: row.booking_status || "Deposit Pending",
    contractSent: Boolean(row.contract_sent),
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
    stripe_session_id: payment.stripeSessionId || null,
    stripe_payment_intent_id: payment.stripePaymentIntentId || null,
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
    stripeSessionId: row.stripe_session_id || "",
    stripePaymentIntentId: row.stripe_payment_intent_id || "",
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

function mapMessageHistoryToDb(message) {
  return {
    id: message.id,
    lead_id: message.leadId || null,
    contact_id: message.contactId || null,
    booking_id: message.bookingId || null,
    message_at: message.messageAt || new Date().toISOString(),
    channel: message.channel,
    direction: message.direction,
    from_value: message.fromValue || null,
    to_value: message.toValue || null,
    subject: message.subject || null,
    gmail_thread_id: message.gmailThreadId || null,
    gmail_message_id: message.gmailMessageId || null,
    summary: message.summary || null,
    draft_created: Boolean(message.draftCreated),
    sent_by: message.sentBy || null,
    notes: message.notes || null,
    created_at: message.createdAt || new Date().toISOString()
  };
}

function mapMessageHistoryFromDb(row) {
  return {
    id: row.id,
    leadId: row.lead_id || "",
    contactId: row.contact_id || "",
    bookingId: row.booking_id || "",
    messageAt: row.message_at || "",
    channel: row.channel || "",
    direction: row.direction || "",
    fromValue: row.from_value || "",
    toValue: row.to_value || "",
    subject: row.subject || "",
    gmailThreadId: row.gmail_thread_id || "",
    gmailMessageId: row.gmail_message_id || "",
    summary: row.summary || "",
    draftCreated: Boolean(row.draft_created),
    sentBy: row.sent_by || "",
    notes: row.notes || "",
    createdAt: row.created_at || ""
  };
}

function normalizeDateValue(value) {
  if (!value) {
    return "";
  }
  return String(value).slice(0, 10);
}

function normalizeTimeValue(value) {
  if (!value) return "";
  return String(value).slice(0, 5);
}

function parseAssetWidth(size) {
  const match = String(size || "").match(/^(\d+)x(\d+)$/);
  return match ? Number(match[1]) : null;
}

function parseAssetHeight(size) {
  const match = String(size || "").match(/^(\d+)x(\d+)$/);
  return match ? Number(match[2]) : null;
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
window.checkLeadAvailability = checkLeadAvailability;
window.syncBookingCalendar = syncBookingCalendar;
window.prepareContractAndDeposit = prepareContractAndDeposit;
window.verifyStripePayment = verifyStripePayment;
window.confirmSignedBooking = confirmSignedBooking;
window.dismissDraftApproval = dismissDraftApproval;
window.ignoreDuplicateWarning = ignoreDuplicateWarning;
window.mergeDuplicateWarning = mergeDuplicateWarning;
window.closeDrawer = closeDrawer;
