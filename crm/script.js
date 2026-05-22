const ADMIN_EMAIL = "admin@boothfairymiami.com";
const ADMIN_PASSWORD = "BoothFairyAdmin!";
const SESSION_KEY = "bfmAdminAuthenticated";
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
    createdAt: "2026-05-18"
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
    createdAt: "2026-05-16"
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
    createdAt: "2026-05-20"
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
    createdAt: "2026-05-19"
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
    createdAt: "2026-05-17"
  }
];

const seedFollowups = [
  {
    id: crypto.randomUUID(),
    leadId: seedLeads[1].id,
    dueDate: "2026-05-22",
    channel: "Email",
    status: "Open",
    notes: "Send refined proposal with booth + DJ bundle options."
  },
  {
    id: crypto.randomUUID(),
    leadId: seedLeads[2].id,
    dueDate: "2026-05-21",
    channel: "Text",
    status: "Open",
    notes: "Check whether client received deposit link and answer timing questions."
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
    notes: "Deposit placeholder until live Stripe sync is connected."
  }
];

const seedCampaigns = [
  {
    id: crypto.randomUUID(),
    title: "Wedding venue partnership reel",
    channel: "Instagram",
    status: "Idea",
    priority: "High",
    notes: "Show editorial booth coverage plus premium guest experience at a Miami venue."
  },
  {
    id: crypto.randomUUID(),
    title: "Luxury DJ add-on email sequence",
    channel: "Email",
    status: "Drafting",
    priority: "Medium",
    notes: "Warm current booth leads with an elegant DJ upsell flow."
  },
  {
    id: crypto.randomUUID(),
    title: "Wedding Photo Booth Miami SEO article",
    channel: "Website SEO",
    status: "Ready for Review",
    priority: "High",
    notes: "Target local wedding intent and link back to the main booking page."
  }
];

const state = {
  leads: loadData(STORAGE_KEYS.leads, seedLeads),
  followups: loadData(STORAGE_KEYS.followups, seedFollowups),
  payments: loadData(STORAGE_KEYS.payments, seedPayments),
  campaigns: loadData(STORAGE_KEYS.campaigns, seedCampaigns),
  activeSection: "dashboard",
  leadSearch: "",
  leadStatusFilter: "all"
};

const authShell = document.getElementById("auth-shell");
const appShell = document.getElementById("app-shell");
const sectionTitle = document.getElementById("section-title");
const navButtons = [...document.querySelectorAll(".nav-item")];
const sections = [...document.querySelectorAll(".section")];
const loginForm = document.getElementById("login-form");
const authError = document.getElementById("auth-error");
const logoutButton = document.getElementById("logout-button");

init();

function init() {
  populateStatusSelects();
  attachEventListeners();
  refreshSelectMenus();
  renderAll();

  if (sessionStorage.getItem(SESSION_KEY) === "true") {
    unlockApp();
  }
}

function attachEventListeners() {
  loginForm.addEventListener("submit", handleLogin);
  logoutButton.addEventListener("click", handleLogout);

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
    if (event.target.id === "lead-drawer") closeDrawer();
  });

  document.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", () => closeModal(button.dataset.closeModal));
  });

  ["lead-modal", "followup-modal", "payment-modal", "campaign-modal"].forEach((id) => {
    const modal = document.getElementById(id);
    modal.addEventListener("click", (event) => {
      if (event.target.id === id) closeModal(id);
    });
  });

  document.getElementById("lead-form").addEventListener("submit", handleLeadSubmit);
  document.getElementById("followup-form").addEventListener("submit", handleFollowupSubmit);
  document.getElementById("payment-form").addEventListener("submit", handlePaymentSubmit);
  document.getElementById("campaign-form").addEventListener("submit", handleCampaignSubmit);
}

function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById("login-email").value.trim().toLowerCase();
  const password = document.getElementById("login-password").value;

  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    authError.hidden = true;
    sessionStorage.setItem(SESSION_KEY, "true");
    unlockApp();
    return;
  }

  authError.hidden = false;
}

function handleLogout() {
  sessionStorage.removeItem(SESSION_KEY);
  appShell.hidden = true;
  authShell.hidden = false;
}

function unlockApp() {
  authShell.hidden = true;
  appShell.hidden = false;
}

function setSection(sectionName) {
  state.activeSection = sectionName;
  navButtons.forEach((button) => button.classList.toggle("active", button.dataset.section === sectionName));
  sections.forEach((section) => section.classList.toggle("active", section.dataset.section === sectionName));
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
}

function renderKpis() {
  const bookedCount = state.leads.filter((lead) => CONFIRMED_STATUSES.has(lead.status)).length;
  const followupCount = state.followups.filter((followup) => followup.status === "Open").length;
  const pendingPayments = state.payments.filter((payment) => payment.status === "Pending").length;
  const leadsThisMonth = state.leads.filter((lead) => lead.createdAt.startsWith("2026-05")).length;

  const cards = [
    ["Open leads", state.leads.filter((lead) => lead.status !== "Completed" && lead.status !== "Lost").length, "Active inquiries across all channels"],
    ["Confirmed bookings", bookedCount, "Only count after calendar and payment checks"],
    ["Open follow-ups", followupCount, "Reminders still needing action"],
    ["Pending payments", pendingPayments, "Deposit or invoice links awaiting payment"],
    ["May lead volume", leadsThisMonth, "Current seeded month snapshot"],
    ["DJ opportunities", state.leads.filter((lead) => lead.serviceRequested.includes("DJ")).length, "Leads where DJ services are part of the request"],
    ["Instagram inquiries", state.leads.filter((lead) => lead.source === "Instagram").length, "DM and social lead opportunities"],
    ["Website conversion pipeline", state.leads.filter((lead) => lead.source === "Website").length, "Website and form-based inquiries"]
  ];

  document.getElementById("kpi-grid").innerHTML = cards.map(([label, value, meta]) => `
    <article class="kpi-card">
      <p>${label}</p>
      <strong>${value}</strong>
      <p>${meta}</p>
    </article>
  `).join("");
}

function renderStatusGrid() {
  const html = LEAD_STATUSES.map((status) => {
    const count = state.leads.filter((lead) => lead.status === status).length;
    return `
      <article class="status-card">
        <p>${status}</p>
        <strong>${count}</strong>
      </article>
    `;
  }).join("");
  document.getElementById("status-grid").innerHTML = html;
}

function renderNextFollowups() {
  const list = [...state.followups]
    .filter((followup) => followup.status === "Open")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
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
          <strong>${lead?.clientName || "Unknown Lead"}</strong>
          <p>${followup.channel} follow-up due ${formatDate(followup.dueDate)}</p>
        </div>
        <span class="chip chip-muted">${followup.status}</span>
      </div>
    `;
  }).join("");
}

function renderUpcomingBookings() {
  const rows = [...state.leads]
    .filter((lead) => BOOKING_STATUSES.has(lead.status))
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate))
    .slice(0, 6)
    .map((lead) => `
      <tr>
        <td>${lead.clientName}</td>
        <td>${formatDate(lead.eventDate)}</td>
        <td>${lead.serviceRequested}</td>
        <td>${statusChip(lead.status)}</td>
        <td>${lead.paymentStatus}</td>
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
          <strong>${lead.clientName}</strong>
          <p class="card-meta">${lead.eventType} · ${lead.city || "City pending"}</p>
        </div>
        ${statusChip(lead.status)}
      </div>
      <div class="card-meta">
        <span>${formatDate(lead.eventDate)}</span>
        <span>${lead.serviceRequested}</span>
        <span>${lead.source}</span>
        <span>${lead.guestCount || 0} guests</span>
      </div>
      <p class="card-notes">${lead.notes || "No notes yet."}</p>
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
    .filter((lead) => lead.eventDate)
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate))
    .map((lead) => `
      <tr>
        <td>${lead.clientName}</td>
        <td>${formatDate(lead.eventDate)}</td>
        <td>${lead.serviceRequested}</td>
        <td>${lead.venue || "Pending venue"}</td>
        <td>${lead.paymentStatus}</td>
        <td>
          <select class="select-inline" onchange="updateLeadStatus('${lead.id}', this.value)">
            ${LEAD_STATUSES.map((status) => `<option value="${status}" ${status === lead.status ? "selected" : ""}>${status}</option>`).join("")}
          </select>
          <p class="status-note">${lead.calendarChecked === "Yes" ? "Calendar checked" : "Availability still needs confirmation"}</p>
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
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .map((followup) => {
      const lead = state.leads.find((item) => item.id === followup.leadId);
      return `
        <article class="timeline-item">
          <div class="source-card-top">
            <strong>${lead?.clientName || "Unknown Lead"}</strong>
            <span class="chip ${followup.status === "Completed" ? "chip-muted" : ""}">${followup.status}</span>
          </div>
          <p>${followup.notes}</p>
          <div class="card-meta">
            <span>${followup.channel}</span>
            <span>${formatDate(followup.dueDate)}</span>
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
        <td>${lead?.clientName || "Unknown Lead"}</td>
        <td>${payment.type}</td>
        <td>${formatCurrency(payment.amount)}</td>
        <td>${payment.status}</td>
        <td><a href="${payment.link}" target="_blank" rel="noreferrer">Open link</a></td>
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
        <strong>${lead.clientName}</strong>
        ${statusChip(lead.status)}
      </div>
      <p>${lead.eventType} on ${formatDate(lead.eventDate)} · ${lead.serviceRequested}</p>
      <div class="card-meta">
        <span>${lead.email}</span>
        <span>${lead.phone}</span>
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
        <h3>${column}</h3>
        ${items.length ? items.map((campaign) => `
          <article class="campaign-item">
            <div class="campaign-head">
              <strong>${campaign.title}</strong>
              <span class="chip chip-muted">${campaign.priority}</span>
            </div>
            <p>${campaign.notes}</p>
            <div class="card-meta">
              <span>${campaign.channel}</span>
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

function handleLeadSubmit(event) {
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
    createdAt: existingLead?.createdAt || new Date().toISOString().slice(0, 10)
  };

  upsertItem(state.leads, lead);
  closeModal("lead-modal");
  renderAll();
}

function handleFollowupSubmit(event) {
  event.preventDefault();
  const followup = {
    id: document.getElementById("followup-id").value || crypto.randomUUID(),
    leadId: document.getElementById("followup-lead-id").value,
    dueDate: document.getElementById("followup-due-date").value,
    channel: document.getElementById("followup-channel").value,
    status: document.getElementById("followup-status").value,
    notes: document.getElementById("followup-notes").value.trim()
  };
  upsertItem(state.followups, followup);
  closeModal("followup-modal");
  renderAll();
}

function handlePaymentSubmit(event) {
  event.preventDefault();
  const payment = {
    id: document.getElementById("payment-id").value || crypto.randomUUID(),
    leadId: document.getElementById("payment-lead-id").value,
    type: document.getElementById("payment-type").value,
    amount: Number(document.getElementById("payment-amount").value || 0),
    status: document.getElementById("payment-status").value,
    link: document.getElementById("payment-link").value.trim(),
    notes: document.getElementById("payment-notes").value.trim()
  };
  upsertItem(state.payments, payment);
  const lead = state.leads.find((item) => item.id === payment.leadId);
  if (lead && payment.status === "Paid") {
    lead.paymentStatus = "Paid";
  }
  closeModal("payment-modal");
  renderAll();
}

function handleCampaignSubmit(event) {
  event.preventDefault();
  const campaign = {
    id: document.getElementById("campaign-id").value || crypto.randomUUID(),
    title: document.getElementById("campaign-title").value.trim(),
    channel: document.getElementById("campaign-channel").value,
    status: document.getElementById("campaign-status").value,
    priority: document.getElementById("campaign-priority").value,
    notes: document.getElementById("campaign-notes").value.trim()
  };
  upsertItem(state.campaigns, campaign);
  closeModal("campaign-modal");
  renderAll();
}

function openLeadModal(leadId = "") {
  document.getElementById("lead-form").reset();
  document.getElementById("lead-id").value = "";
  document.getElementById("lead-modal-title").textContent = leadId ? "Edit Lead" : "Add Lead";

  if (leadId) {
    const lead = getLeadById(leadId);
    if (!lead) return;
    document.getElementById("lead-id").value = lead.id;
    document.getElementById("lead-client-name").value = lead.clientName;
    document.getElementById("lead-phone").value = lead.phone;
    document.getElementById("lead-email").value = lead.email;
    document.getElementById("lead-event-type").value = lead.eventType;
    document.getElementById("lead-event-date").value = lead.eventDate;
    document.getElementById("lead-venue").value = lead.venue;
    document.getElementById("lead-city").value = lead.city;
    document.getElementById("lead-service-requested").value = lead.serviceRequested;
    document.getElementById("lead-guest-count").value = lead.guestCount;
    document.getElementById("lead-budget").value = lead.budget;
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
    if (!followup) return;
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
    if (!payment) return;
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
    if (!campaign) return;
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
  if (!lead) return;

  const relatedFollowups = state.followups.filter((item) => item.leadId === leadId);
  const relatedPayments = state.payments.filter((item) => item.leadId === leadId);

  document.getElementById("drawer-content").innerHTML = `
    <div class="drawer-content">
      <div>
        <p class="panel-kicker">Lead Detail</p>
        <h2>${lead.clientName}</h2>
        <p class="card-notes">${lead.notes || "No notes recorded yet."}</p>
      </div>
      <div class="drawer-grid">
        <div><dt>Status</dt><dd>${lead.status}</dd></div>
        <div><dt>Source</dt><dd>${lead.source}</dd></div>
        <div><dt>Event type</dt><dd>${lead.eventType}</dd></div>
        <div><dt>Event date</dt><dd>${formatDate(lead.eventDate)}</dd></div>
        <div><dt>Service</dt><dd>${lead.serviceRequested}</dd></div>
        <div><dt>Guests</dt><dd>${lead.guestCount || 0}</dd></div>
        <div><dt>Venue</dt><dd>${lead.venue || "Pending"}</dd></div>
        <div><dt>City</dt><dd>${lead.city || "Pending"}</dd></div>
        <div><dt>Phone</dt><dd>${lead.phone}</dd></div>
        <div><dt>Email</dt><dd>${lead.email}</dd></div>
        <div><dt>Budget</dt><dd>${formatCurrency(lead.budget || 0)}</dd></div>
        <div><dt>Payment</dt><dd>${lead.paymentStatus}</dd></div>
        <div><dt>Calendar checked</dt><dd>${lead.calendarChecked}</dd></div>
      </div>
      <div class="stack-list">
        <div class="stack-item"><strong>Follow-ups</strong><span>${relatedFollowups.length}</span></div>
        ${relatedFollowups.length ? relatedFollowups.map((item) => `<div class="stack-item"><div><strong>${item.channel}</strong><p>${formatDate(item.dueDate)} · ${item.notes}</p></div><span class="chip chip-muted">${item.status}</span></div>`).join("") : emptyState("No reminders", "No follow-up tasks are attached to this lead.")}
      </div>
      <div class="stack-list">
        <div class="stack-item"><strong>Payments</strong><span>${relatedPayments.length}</span></div>
        ${relatedPayments.length ? relatedPayments.map((item) => `<div class="stack-item"><div><strong>${item.type}</strong><p>${formatCurrency(item.amount)} · ${item.status}</p></div><a href="${item.link}" target="_blank" rel="noreferrer">Open</a></div>`).join("") : emptyState("No payments", "No Stripe or invoice links are saved yet.")}
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

function deleteLead(id) {
  if (!confirm("Delete this lead? This also removes its follow-ups and payment tracking.")) return;
  state.leads = state.leads.filter((lead) => lead.id !== id);
  state.followups = state.followups.filter((item) => item.leadId !== id);
  state.payments = state.payments.filter((item) => item.leadId !== id);
  renderAll();
}

function deleteFollowup(id) {
  if (!confirm("Delete this follow-up reminder?")) return;
  state.followups = state.followups.filter((item) => item.id !== id);
  renderAll();
}

function deletePayment(id) {
  if (!confirm("Delete this payment record?")) return;
  state.payments = state.payments.filter((item) => item.id !== id);
  renderAll();
}

function deleteCampaign(id) {
  if (!confirm("Delete this campaign item?")) return;
  state.campaigns = state.campaigns.filter((item) => item.id !== id);
  renderAll();
}

function updateLeadStatus(leadId, nextStatus) {
  const lead = getLeadById(leadId);
  if (!lead) return;
  lead.status = nextStatus;
  if (nextStatus === "Paid") {
    lead.paymentStatus = "Paid";
  }
  renderAll();
}

function populateStatusSelects() {
  const leadStatus = document.getElementById("lead-status");
  const leadStatusFilter = document.getElementById("lead-status-filter");

  leadStatus.innerHTML = LEAD_STATUSES.map((status) => `<option value="${status}">${status}</option>`).join("");
  leadStatusFilter.innerHTML = `<option value="all">All statuses</option>${LEAD_STATUSES.map((status) => `<option value="${status}">${status}</option>`).join("")}`;
}

function refreshSelectMenus() {
  const leadOptions = state.leads
    .sort((a, b) => a.clientName.localeCompare(b.clientName))
    .map((lead) => `<option value="${lead.id}">${lead.clientName} · ${lead.eventType} · ${formatDate(lead.eventDate)}</option>`)
    .join("");

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

function upsertItem(collection, item) {
  const index = collection.findIndex((entry) => entry.id === item.id);
  if (index >= 0) {
    collection[index] = item;
  } else {
    collection.unshift(item);
  }
}

function persistAll() {
  localStorage.setItem(STORAGE_KEYS.leads, JSON.stringify(state.leads));
  localStorage.setItem(STORAGE_KEYS.followups, JSON.stringify(state.followups));
  localStorage.setItem(STORAGE_KEYS.payments, JSON.stringify(state.payments));
  localStorage.setItem(STORAGE_KEYS.campaigns, JSON.stringify(state.campaigns));
}

function loadData(key, fallback) {
  const raw = localStorage.getItem(key);
  if (!raw) return structuredClone(fallback);
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error(`Failed to parse ${key}`, error);
    return structuredClone(fallback);
  }
}

function statusChip(status) {
  const tone = status === "Lost"
    ? "lost"
    : status === "Booked" || status === "Paid" || status === "Completed"
      ? "booked"
      : status === "Missing Info" || status === "Follow-Up Needed" || status === "Deposit Pending"
        ? "attention"
        : "new";
  return `<span class="chip" data-tone="${tone}">${status}</span>`;
}

function formatDate(value) {
  if (!value) return "Pending";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
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
  return `<div class="empty-state"><strong>${title}</strong><p>${copy}</p></div>`;
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
