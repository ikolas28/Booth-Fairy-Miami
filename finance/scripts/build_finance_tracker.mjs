import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = path.resolve("finance", "outputs");
const outputPath = path.join(outputDir, "Booth Fairy Miami Financial Tracker.xlsx");

const workbook = Workbook.create();

const theme = {
  ink: "#211827",
  muted: "#6B6272",
  primary: "#24172D",
  purple: "#5E36C9",
  softPurple: "#F2ECFA",
  softPink: "#FCEAF2",
  softGreen: "#EAF8F3",
  green: "#1E9F79",
  amber: "#DD9345",
  red: "#D54B65",
  border: "#E7DFE9",
  white: "#FFFFFF",
  surface: "#FBF8FC"
};

const incomeStatuses = ["Not Requested", "Deposit Pending", "Deposit Paid", "Paid", "Paid in Full", "Overdue", "Refunded"];
const services = ["DSLR Photo Booth - Digital Sharing", "Premium DJ Services", "Photo Booth + DJ Bundle"];
const packages = [
  "Starter Digital Package - 2 Hours ($450)",
  "Starter Digital Package - 3 Hours ($575)",
  "Starter Digital Package - 4 Hours ($700)",
  "Premium DJ Services",
  "Photo Booth + DJ Bundle",
  "Custom Quote"
];
const paymentMethods = ["Stripe", "Zelle", "Cash", "Check", "Credit Card", "Other"];
const sources = ["Website", "Gmail", "Tidio", "Instagram", "Referral", "Manual"];
const expenseCategories = ["Website/domain", "Equipment", "Props", "Ads", "Software", "Transportation", "Supplies", "Insurance", "Contract labor", "Other"];
const recurrence = ["One-time", "Monthly", "Annual", "Quarterly"];
const yesNo = ["Yes", "No"];

function addSheet(name) {
  return workbook.worksheets.add(name);
}

function setValues(sheet, range, values) {
  sheet.getRange(range).values = values;
}

function setFormulas(sheet, range, formulas) {
  sheet.getRange(range).formulas = formulas;
}

function styleRange(sheet, range, format) {
  sheet.getRange(range).format = format;
}

function columnRange(col, rows = 500) {
  return `${col}2:${col}${rows}`;
}

function applyTitle(sheet, title, subtitle, endCol = "L") {
  setValues(sheet, `A1:${endCol}1`, [[title, ...Array(colNumber(endCol) - 1).fill("")]]);
  setValues(sheet, `A2:${endCol}2`, [[subtitle, ...Array(colNumber(endCol) - 1).fill("")]]);
  styleRange(sheet, `A1:${endCol}1`, {
    fill: { color: theme.primary },
    font: { color: theme.white, bold: true, size: 18 },
    horizontalAlignment: "left",
    verticalAlignment: "middle"
  });
  styleRange(sheet, `A2:${endCol}2`, {
    fill: { color: theme.primary },
    font: { color: "#E8DDF1", size: 10 },
    horizontalAlignment: "left",
    verticalAlignment: "middle"
  });
  sheet.getRange(`A1:${endCol}1`).merge();
  sheet.getRange(`A2:${endCol}2`).merge();
  sheet.getRange("1:1").format.rowHeightPx = 34;
  sheet.getRange("2:2").format.rowHeightPx = 24;
}

function applyHeader(sheet, range) {
  styleRange(sheet, range, {
    fill: { color: theme.softPurple },
    font: { color: theme.primary, bold: true, size: 10 },
    horizontalAlignment: "center",
    verticalAlignment: "middle",
    border: { bottom: { style: "SOLID", color: theme.border } }
  });
}

function applyBody(sheet, range) {
  styleRange(sheet, range, {
    fill: { color: theme.white },
    font: { color: theme.ink, size: 10 },
    border: { bottom: { style: "SOLID", color: "#F0EAF2" } },
    verticalAlignment: "middle"
  });
}

function setWidths(sheet, widths) {
  for (const [col, width] of Object.entries(widths)) {
    sheet.getRange(`${col}:${col}`).format.columnWidthPx = width;
  }
}

function addValidation(sheet, range, values) {
  sheet.getRange(range).dataValidation = {
    type: "list",
    allowInvalid: false,
    source: values
  };
}

function colNumber(col) {
  return col.split("").reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0);
}

function buildDashboard() {
  const sheet = addSheet("Dashboard");
  applyTitle(sheet, "Booth Fairy Miami Financial Dashboard", "Simple bookkeeping view connected to CRM bookings, payments, and manual expenses.", "L");

  const kpis = [
    ["This Month Income", "=SUMIFS('Income Tracker'!F:F,'Income Tracker'!A:A,\">=\"&EOMONTH(TODAY(),-1)+1,'Income Tracker'!A:A,\"<=\"&EOMONTH(TODAY(),0))"],
    ["This Month Expenses", "=SUMIFS('Expense Tracker'!E:E,'Expense Tracker'!A:A,\">=\"&EOMONTH(TODAY(),-1)+1,'Expense Tracker'!A:A,\"<=\"&EOMONTH(TODAY(),0))"],
    ["Net Profit", "=B4-B5"],
    ["Deposits Received", "=SUMIFS('Income Tracker'!G:G,'Income Tracker'!A:A,\">=\"&EOMONTH(TODAY(),-1)+1,'Income Tracker'!A:A,\"<=\"&EOMONTH(TODAY(),0))"],
    ["Unpaid Balances", "=SUMIF('Income Tracker'!J:J,\"<>Paid\",'Income Tracker'!H:H)"],
    ["YTD Income", "=SUMIFS('Income Tracker'!F:F,'Income Tracker'!A:A,\">=\"&DATE(YEAR(TODAY()),1,1),'Income Tracker'!A:A,\"<=\"&TODAY())"],
    ["YTD Expenses", "=SUMIFS('Expense Tracker'!E:E,'Expense Tracker'!A:A,\">=\"&DATE(YEAR(TODAY()),1,1),'Expense Tracker'!A:A,\"<=\"&TODAY())"],
    ["YTD Profit", "=B9-B10"]
  ];
  setValues(sheet, "A4:A11", kpis.map((row) => [row[0]]));
  setFormulas(sheet, "B4:B11", kpis.map((row) => [row[1]]));
  styleRange(sheet, "A4:B11", {
    fill: { color: theme.white },
    font: { color: theme.ink, size: 11 },
    border: { bottom: { style: "SOLID", color: theme.border } }
  });
  styleRange(sheet, "A4:A11", { font: { color: theme.muted, bold: true } });
  styleRange(sheet, "B4:B11", { font: { color: theme.primary, bold: true, size: 13 }, numberFormat: "$#,##0.00" });

  setValues(sheet, "D4:H4", [["Unpaid Invoices", "Client", "Event Date", "Balance", "Status"]]);
  setFormulas(sheet, "D5:H14", [
    ["=FILTER({'Income Tracker'!B2:B,'Income Tracker'!K2:K,'Income Tracker'!H2:H,'Income Tracker'!J2:J},'Income Tracker'!H2:H>0)"],
    ...Array(9).fill(["", "", "", "", ""])
  ]);
  applyHeader(sheet, "D4:H4");
  applyBody(sheet, "D5:H14");
  styleRange(sheet, "G5:G14", { numberFormat: "$#,##0.00" });

  setValues(sheet, "J4:L4", [["Upcoming Expenses", "Due/Date", "Amount"]]);
  setFormulas(sheet, "J5:L14", [
    ["=FILTER({'Expense Tracker'!D2:D,'Expense Tracker'!A2:A,'Expense Tracker'!E2:E},'Expense Tracker'!A2:A>=TODAY())"],
    ...Array(9).fill(["", "", ""])
  ]);
  applyHeader(sheet, "J4:L4");
  applyBody(sheet, "J5:L14");
  styleRange(sheet, "L5:L14", { numberFormat: "$#,##0.00" });

  setValues(sheet, "A14:C14", [["CRM Sync Notes", "", ""]]);
  setValues(sheet, "A15:C19", [
    ["CRM booking/payment updates write to Income Tracker using CRM booking ID.", "", ""],
    ["Manual expenses are entered in Expense Tracker and summarized back to CRM.", "", ""],
    ["Use Paid Status dropdowns consistently: Deposit Paid, Paid, Paid in Full, Overdue.", "", ""],
    ["Do not delete columns; add notes to the Notes column when needed.", "", ""],
    ["All formulas are built for rows 2:500.", "", ""]
  ]);
  sheet.getRange("A14:C14").merge();
  styleRange(sheet, "A14:C14", { fill: { color: theme.softPink }, font: { bold: true, color: theme.primary } });
  styleRange(sheet, "A15:C19", { fill: { color: theme.white }, font: { color: theme.muted }, wrapText: true });

  setWidths(sheet, { A: 190, B: 140, C: 20, D: 160, E: 150, F: 120, G: 120, H: 130, J: 210, K: 100, L: 110 });
  sheet.freezePanes.freezeRows(3);
}

function buildIncomeTracker() {
  const sheet = addSheet("Income Tracker");
  applyTitle(sheet, "Income Tracker", "CRM-syncable booking income, deposits, balances, and payment status.", "O");
  const headers = [["Date", "Client name", "Event type", "Service type", "Package booked", "Invoice total", "Deposit received", "Remaining balance", "Payment method", "Paid status", "Event date", "Event time", "Lead source", "CRM booking ID", "Notes"]];
  setValues(sheet, "A4:O4", headers);
  applyHeader(sheet, "A4:O4");
  applyBody(sheet, "A5:O500");
  setFormulas(sheet, "H5:H500", Array.from({ length: 496 }, (_, i) => {
    const row = i + 5;
    return [`=IF(F${row}=\"\",\"\",MAX(F${row}-G${row},0))`];
  }));
  addValidation(sheet, "D5:D500", services);
  addValidation(sheet, "E5:E500", packages);
  addValidation(sheet, "I5:I500", paymentMethods);
  addValidation(sheet, "J5:J500", incomeStatuses);
  addValidation(sheet, "M5:M500", sources);
  styleRange(sheet, "A5:A500", { numberFormat: "yyyy-mm-dd" });
  styleRange(sheet, "F5:H500", { numberFormat: "$#,##0.00" });
  styleRange(sheet, "K5:K500", { numberFormat: "yyyy-mm-dd" });
  styleRange(sheet, "L5:L500", { numberFormat: "h:mm AM/PM" });
  setWidths(sheet, { A: 105, B: 170, C: 140, D: 210, E: 230, F: 115, G: 130, H: 130, I: 120, J: 125, K: 115, L: 130, M: 110, N: 210, O: 280 });
  sheet.freezePanes.freezeRows(4);
}

function buildExpenseTracker() {
  const sheet = addSheet("Expense Tracker");
  applyTitle(sheet, "Expense Tracker", "Manual expenses entered here will feed the dashboard and CRM finance summary.", "H");
  const headers = [["Date", "Vendor", "Category", "Description", "Amount", "Payment method", "Recurring / one-time", "Notes"]];
  setValues(sheet, "A4:H4", headers);
  applyHeader(sheet, "A4:H4");
  applyBody(sheet, "A5:H500");
  addValidation(sheet, "C5:C500", expenseCategories);
  addValidation(sheet, "F5:F500", paymentMethods);
  addValidation(sheet, "G5:G500", recurrence);
  styleRange(sheet, "A5:A500", { numberFormat: "yyyy-mm-dd" });
  styleRange(sheet, "E5:E500", { numberFormat: "$#,##0.00" });
  setWidths(sheet, { A: 105, B: 160, C: 150, D: 260, E: 110, F: 130, G: 150, H: 280 });
  sheet.freezePanes.freezeRows(4);
}

function buildMonthlyPL() {
  const sheet = addSheet("Monthly Profit & Loss");
  applyTitle(sheet, "Monthly Profit & Loss", "Formula-driven monthly revenue, expenses, and profit.", "E");
  setValues(sheet, "A4:E4", [["Month", "Revenue", "Expenses", "Profit", "Profit margin"]]);
  applyHeader(sheet, "A4:E4");
  const formulas = [];
  for (let i = 0; i < 24; i += 1) {
    const row = i + 5;
    formulas.push([
      `=EDATE(DATE(YEAR(TODAY()),1,1),${i})`,
      `=SUMIFS('Income Tracker'!F:F,'Income Tracker'!A:A,\">=\"&A${row},'Income Tracker'!A:A,\"<\"&EDATE(A${row},1))`,
      `=SUMIFS('Expense Tracker'!E:E,'Expense Tracker'!A:A,\">=\"&A${row},'Expense Tracker'!A:A,\"<\"&EDATE(A${row},1))`,
      `=B${row}-C${row}`,
      `=IF(B${row}=0,\"\",D${row}/B${row})`
    ]);
  }
  setFormulas(sheet, "A5:E28", formulas);
  applyBody(sheet, "A5:E28");
  styleRange(sheet, "A5:A28", { numberFormat: "mmm yyyy" });
  styleRange(sheet, "B5:D28", { numberFormat: "$#,##0.00" });
  styleRange(sheet, "E5:E28", { numberFormat: "0.0%" });
  setWidths(sheet, { A: 120, B: 120, C: 120, D: 120, E: 120 });
  sheet.freezePanes.freezeRows(4);
}

function buildTaxes() {
  const sheet = addSheet("Taxes / Write-offs");
  applyTitle(sheet, "Taxes / Write-offs", "Track deductible business expenses for year-end review.", "F");
  setValues(sheet, "A4:F4", [["Date", "Expense", "Category", "Amount", "Deductible Y/N", "Notes"]]);
  applyHeader(sheet, "A4:F4");
  applyBody(sheet, "A5:F500");
  addValidation(sheet, "C5:C500", expenseCategories);
  addValidation(sheet, "E5:E500", yesNo);
  styleRange(sheet, "A5:A500", { numberFormat: "yyyy-mm-dd" });
  styleRange(sheet, "D5:D500", { numberFormat: "$#,##0.00" });
  setWidths(sheet, { A: 105, B: 210, C: 150, D: 110, E: 130, F: 280 });
  sheet.freezePanes.freezeRows(4);
}

function buildCrmSync() {
  const sheet = addSheet("CRM Sync");
  applyTitle(sheet, "CRM Sync", "Reference fields used by Booth Fairy Miami CRM. Do not delete this tab.", "G");
  setValues(sheet, "A4:G4", [["Field", "Value", "Notes", "", "", "", ""]]);
  applyHeader(sheet, "A4:G4");
  setValues(sheet, "A5:C12", [
    ["Spreadsheet purpose", "Financial source of truth", "CRM reads dashboard summary and writes booking income rows."],
    ["Income key", "CRM booking ID", "Used to update existing rows instead of creating duplicates."],
    ["Income range", "Income Tracker!A:O", "CRM append/update target."],
    ["Expense range", "Expense Tracker!A:H", "CRM summary source for manual expenses."],
    ["Dashboard range", "Dashboard!A4:L14", "Human-readable summary."],
    ["Version", "1.0", "Created for Booth Fairy Miami CRM."],
    ["Owner", "Booth Fairy Miami", "Regular Google Drive compatible."],
    ["Last reviewed", new Date(), "Update when finance workflow changes."]
  ]);
  styleRange(sheet, "A5:C12", {
    fill: { color: theme.white },
    font: { color: theme.ink, size: 10 },
    border: { bottom: { style: "SOLID", color: theme.border } },
    wrapText: true
  });
  styleRange(sheet, "B12:B12", { numberFormat: "yyyy-mm-dd" });
  setWidths(sheet, { A: 150, B: 220, C: 360 });
  sheet.freezePanes.freezeRows(4);
}

buildDashboard();
buildIncomeTracker();
buildExpenseTracker();
buildMonthlyPL();
buildTaxes();
buildCrmSync();

await fs.mkdir(outputDir, { recursive: true });
const file = await SpreadsheetFile.exportXlsx(workbook);
await file.save(outputPath);
console.log(outputPath);
