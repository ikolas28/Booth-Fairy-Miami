const {
  getValidGmailAccessToken,
  supabaseAdmin
} = require("../gmail/_lib");

const FINANCE_SPREADSHEET_ID = process.env.FINANCE_SPREADSHEET_ID || "1OZdmNJhZDbResMdnRpA860g_Tu3qtDVFMMHDogqOQmA";
const INCOME_SHEET = "Income Tracker";
const EXPENSE_SHEET = "Expense Tracker";
const TRACKER_URL = `https://docs.google.com/spreadsheets/d/${FINANCE_SPREADSHEET_ID}/edit`;

async function syncBookingFinance({ lead, booking, payment } = {}) {
  if (!booking?.id && !lead?.id) return { ok: false, skipped: true, reason: "Missing booking or lead." };
  const connection = await getValidGmailAccessToken();
  if (!connection) return { ok: false, skipped: true, reason: "Google account is not connected." };
  if (!String(connection.scope || "").includes("spreadsheets")) {
    return { ok: false, skipped: true, reason: "Google Sheets permission is missing. Reconnect Google/Gmail and approve Sheets access." };
  }

  const leadId = lead?.id || booking?.lead_id || "";
  const sourceLead = lead?.id ? lead : await getLead(leadId);
  const sourceBooking = booking?.id ? booking : await getBookingForLead(leadId);
  const sourcePayment = payment || await getLatestPayment(leadId);
  const rowNumber = await findIncomeRow(connection.accessToken, sourceBooking?.id || sourceLead?.id);
  const targetRow = rowNumber || await findFirstBlankIncomeRow(connection.accessToken);
  const row = buildIncomeRow(sourceLead || {}, sourceBooking || {}, sourcePayment || {}, targetRow);

  await sheetsValuesUpdate(connection.accessToken, `${INCOME_SHEET}!A${targetRow}:O${targetRow}`, [row]);
  return {
    ok: true,
    spreadsheetId: FINANCE_SPREADSHEET_ID,
    spreadsheetUrl: TRACKER_URL,
    sheet: INCOME_SHEET,
    rowNumber: targetRow,
    bookingId: sourceBooking?.id || ""
  };
}

async function getFinancialSummary() {
  const connection = await getValidGmailAccessToken();
  if (!connection) return { ok: false, connected: false, error: "Google account is not connected." };
  if (!String(connection.scope || "").includes("spreadsheets")) {
    return { ok: false, connected: true, needsReconnect: true, error: "Google Sheets permission is missing. Disconnect and reconnect Google/Gmail." };
  }

  const [incomeRows, expenseRows] = await Promise.all([
    sheetsValuesGet(connection.accessToken, `${INCOME_SHEET}!A5:O500`),
    sheetsValuesGet(connection.accessToken, `${EXPENSE_SHEET}!A5:H500`)
  ]);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const income = incomeRows.map(parseIncomeRow).filter((row) => row.date);
  const expenses = expenseRows.map(parseExpenseRow).filter((row) => row.date);
  const thisMonthIncome = sum(income.filter((row) => isBetween(row.date, monthStart, monthEnd)).map((row) => row.invoiceTotal));
  const depositsReceived = sum(income.filter((row) => isBetween(row.date, monthStart, monthEnd)).map((row) => row.depositReceived));
  const thisMonthExpenses = sum(expenses.filter((row) => isBetween(row.date, monthStart, monthEnd)).map((row) => row.amount));
  const unpaidBalances = sum(income.filter((row) => !/^paid( in full)?$/i.test(row.paidStatus) && row.remainingBalance > 0).map((row) => row.remainingBalance));
  const ytdIncome = sum(income.filter((row) => row.date >= yearStart).map((row) => row.invoiceTotal));
  const ytdExpenses = sum(expenses.filter((row) => row.date >= yearStart).map((row) => row.amount));

  return {
    ok: true,
    connected: true,
    spreadsheetId: FINANCE_SPREADSHEET_ID,
    spreadsheetUrl: TRACKER_URL,
    thisMonthIncome,
    depositsReceived,
    thisMonthExpenses,
    monthlyProfit: thisMonthIncome - thisMonthExpenses,
    unpaidBalances,
    upcomingInvoices: income.filter((row) => row.remainingBalance > 0).slice(0, 5),
    ytdIncome,
    ytdExpenses,
    ytdProfit: ytdIncome - ytdExpenses
  };
}

function buildIncomeRow(lead, booking, payment, rowNumber) {
  const invoiceTotal = money(booking.total_quote) || money(lead.budget) || defaultPackageTotal(lead.service_requested || booking.service_requested);
  const depositReceived = getPaidDepositAmount(lead, booking, payment, invoiceTotal);
  const service = booking.service_requested || lead.service_requested || "DSLR Photo Booth - Digital Sharing";
  const packageBooked = booking.package_interest || inferPackage(service, invoiceTotal);
  return [
    todayIso(),
    booking.client_name || lead.client_name || "Booth Fairy Client",
    booking.event_type || lead.event_type || "",
    service,
    packageBooked,
    invoiceTotal,
    depositReceived,
    `=IF(F${rowNumber}="","",MAX(F${rowNumber}-G${rowNumber},0))`,
    inferPaymentMethod(payment),
    inferPaidStatus(lead, booking, depositReceived, invoiceTotal),
    booking.event_date || lead.event_date || "",
    formatEventTime(booking.start_time || lead.start_time, booking.end_time || lead.end_time),
    lead.source || "",
    booking.id || lead.id || "",
    buildNotes(lead, booking, payment)
  ];
}

async function findIncomeRow(accessToken, bookingId) {
  if (!bookingId) return 0;
  const rows = await sheetsValuesGet(accessToken, `${INCOME_SHEET}!N5:N500`);
  const index = rows.findIndex((row) => String(row?.[0] || "") === String(bookingId));
  return index >= 0 ? index + 5 : 0;
}

async function findFirstBlankIncomeRow(accessToken) {
  const rows = await sheetsValuesGet(accessToken, `${INCOME_SHEET}!A5:A500`);
  const index = rows.findIndex((row) => !String(row?.[0] || "").trim());
  return index >= 0 ? index + 5 : rows.length + 5;
}

async function sheetsValuesGet(accessToken, range) {
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(FINANCE_SPREADSHEET_ID)}/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throwGoogleSheetsError(payload, response.status);
  return payload?.values || [];
}

async function sheetsValuesUpdate(accessToken, range, values) {
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(FINANCE_SPREADSHEET_ID)}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ values })
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throwGoogleSheetsError(payload, response.status);
  return payload;
}

function throwGoogleSheetsError(payload, statusCode) {
  const error = new Error(payload?.error?.message || "Google Sheets request failed.");
  error.details = payload;
  error.statusCode = statusCode;
  throw error;
}

async function getLead(leadId) {
  if (!leadId) return null;
  const rows = await supabaseAdmin(`/leads?id=eq.${encodeURIComponent(leadId)}&select=*&limit=1`, { method: "GET" }).catch(() => []);
  return rows?.[0] || null;
}

async function getBookingForLead(leadId) {
  if (!leadId) return null;
  const rows = await supabaseAdmin(`/bookings?lead_id=eq.${encodeURIComponent(leadId)}&select=*&limit=1`, { method: "GET" }).catch(() => []);
  return rows?.[0] || null;
}

async function getLatestPayment(leadId) {
  if (!leadId) return null;
  const rows = await supabaseAdmin(`/payments?lead_id=eq.${encodeURIComponent(leadId)}&select=*&order=created_at.desc&limit=1`, { method: "GET" }).catch(() => []);
  return rows?.[0] || null;
}

function parseIncomeRow(row) {
  return {
    date: parseDate(row[0]),
    clientName: stringify(row[1]),
    invoiceTotal: money(row[5]),
    depositReceived: money(row[6]),
    remainingBalance: money(row[7]),
    paidStatus: stringify(row[9]),
    eventDate: stringify(row[10]),
    crmBookingId: stringify(row[13])
  };
}

function parseExpenseRow(row) {
  return {
    date: parseDate(row[0]),
    vendor: stringify(row[1]),
    category: stringify(row[2]),
    amount: money(row[4])
  };
}

function parseDate(value) {
  if (!value) return null;
  if (typeof value === "number") return new Date(Math.round((value - 25569) * 86400 * 1000));
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function isBetween(date, start, end) {
  return date && date >= start && date <= end;
}

function sum(values) {
  return values.reduce((total, value) => total + money(value), 0);
}

function money(value) {
  const parsed = Number(String(value || "").replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}

function getPaidDepositAmount(lead, booking, payment, invoiceTotal) {
  const paid = String(lead.payment_status || payment?.status || booking.deposit_status || "").toLowerCase().includes("paid")
    || ["Booked", "Paid", "Deposit Paid", "Completed"].includes(String(lead.status || booking.booking_status || ""));
  if (!paid) return 0;
  return money(payment?.amount) || money(booking.deposit_required) || Math.round(invoiceTotal * 50) / 100;
}

function inferPaidStatus(lead, booking, depositReceived, invoiceTotal) {
  if (depositReceived >= invoiceTotal && invoiceTotal > 0) return "Paid in Full";
  if (depositReceived > 0) return "Deposit Paid";
  if (String(lead.payment_status || "").toLowerCase() === "pending") return "Deposit Pending";
  return booking.deposit_status || lead.payment_status || "Not Requested";
}

function inferPaymentMethod(payment) {
  const text = `${payment?.type || ""} ${payment?.link || ""}`.toLowerCase();
  if (text.includes("stripe") || text.includes("checkout.stripe")) return "Stripe";
  return payment?.type || "";
}

function inferPackage(service, total) {
  if (service === "Photo Booth + DJ Bundle") return "Photo Booth + DJ Bundle";
  if (service === "Premium DJ Services") return "Premium DJ Services";
  if (total >= 700) return "Starter Digital Package - 4 Hours ($700)";
  if (total >= 575) return "Starter Digital Package - 3 Hours ($575)";
  return "Starter Digital Package - 2 Hours ($450)";
}

function defaultPackageTotal(service) {
  if (String(service || "").includes("DJ")) return 0;
  return 450;
}

function formatEventTime(start, end) {
  return [formatTime(start), formatTime(end)].filter(Boolean).join(" - ");
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

function buildNotes(lead, booking, payment) {
  return [
    lead.lead_code ? `Lead: ${lead.lead_code}` : "",
    payment?.stripe_session_id ? `Stripe session: ${payment.stripe_session_id}` : "",
    booking.calendar_link ? `Calendar: ${booking.calendar_link}` : "",
    booking.notes || lead.notes || ""
  ].filter(Boolean).join("\n").slice(0, 1200);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function stringify(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

module.exports = {
  FINANCE_SPREADSHEET_ID,
  TRACKER_URL,
  getFinancialSummary,
  syncBookingFinance
};
