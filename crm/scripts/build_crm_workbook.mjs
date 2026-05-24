import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = path.resolve("outputs");
const outputPath = path.join(outputDir, "Booth Fairy Miami CRM.xlsx");

const leadStatuses = [
  "New Lead",
  "Missing Info",
  "Quote Sent",
  "Follow-Up Needed",
  "Booked",
  "Deposit Pending",
  "Paid",
  "Completed",
  "Lost",
];

const depositStatuses = ["Not Requested", "Deposit Pending", "Deposit Paid", "Paid in Full", "Refunded"];
const serviceOptions = ["DSLR Photo Booth - Digital Sharing", "Premium DJ Services", "Photo Booth + DJ Bundle"];
const booleanOptions = ["Yes", "No"];
const followUpStatuses = ["Open", "Scheduled", "Completed", "Canceled"];
const quoteStatuses = ["Draft", "Sent", "Accepted", "Declined", "Expired"];
const paymentStatuses = ["Payment Link Needed", "Sent", "Deposit Pending", "Deposit Paid", "Paid", "Failed", "Refunded"];
const campaignStatuses = ["Idea", "Draft", "Pending Owner Approval", "Approved", "Published", "Paused", "Completed"];

const sheets = [
  {
    name: "Leads",
    headers: [
      "Lead ID",
      "Created Date",
      "Updated Date",
      "Source",
      "Lead Status",
      "Client Name",
      "Email",
      "Phone",
      "Event Type",
      "Event Date",
      "Start Time",
      "End Time",
      "Venue",
      "City",
      "Service Requested",
      "Guest Count",
      "Package Interest",
      "Budget",
      "Deposit Status",
      "Payment Link",
      "Calendar Link",
      "Gmail Thread ID",
      "Gmail Message ID",
      "Last Message Summary",
      "Notes",
      "Marketing Usable",
    ],
    validations: [
      { range: "E2:E1000", source: leadStatuses },
      { range: "O2:O1000", source: serviceOptions },
      { range: "Q2:Q1000", source: [
        "Starter Digital Package - 2 Hours ($450)",
        "Starter Digital Package - 3 Hours ($575)",
        "Starter Digital Package - 4 Hours ($700)",
        "Premium DJ Services",
        "Photo Booth + DJ Bundle",
        "Custom Quote",
      ] },
      { range: "S2:S1000", source: depositStatuses },
      { range: "Z2:Z1000", source: booleanOptions },
    ],
    dateColumns: ["B", "C", "J"],
    timeColumns: ["K", "L"],
    moneyColumns: ["R"],
    widthOverrides: { A: 120, X: 260, Y: 300, Z: 130 },
  },
  {
    name: "Contacts",
    headers: [
      "Contact ID",
      "Created Date",
      "Updated Date",
      "Client Name",
      "Email",
      "Phone",
      "Instagram",
      "Company",
      "City",
      "Preferred Contact Method",
      "Marketing Opt-In",
      "Last Contacted",
      "Related Lead IDs",
      "Notes",
    ],
    validations: [
      { range: "K2:K1000", source: booleanOptions },
      { range: "J2:J1000", source: ["Email", "Phone", "Text", "Instagram DM"] },
    ],
    dateColumns: ["B", "C", "L"],
    widthOverrides: { N: 300 },
  },
  {
    name: "Bookings",
    headers: [
      "Booking ID",
      "Lead ID",
      "Contact ID",
      "Client Name",
      "Email",
      "Phone",
      "Event Type",
      "Event Date",
      "Start Time",
      "End Time",
      "Venue",
      "City",
      "Service Requested",
      "Guest Count",
      "Package Interest",
      "Total Quote",
      "Deposit Required",
      "Deposit Status",
      "Payment Link",
      "Calendar Link",
      "Booking Status",
      "Contract Sent",
      "Notes",
    ],
    validations: [
      { range: "M2:M1000", source: serviceOptions },
      { range: "R2:R1000", source: depositStatuses },
      { range: "U2:U1000", source: leadStatuses },
      { range: "V2:V1000", source: booleanOptions },
    ],
    dateColumns: ["H"],
    timeColumns: ["I", "J"],
    moneyColumns: ["P", "Q"],
    widthOverrides: { W: 300 },
  },
  {
    name: "FollowUps",
    headers: [
      "Follow-Up ID",
      "Lead ID",
      "Contact ID",
      "Client Name",
      "Due Date",
      "Due Time",
      "Follow-Up Type",
      "Status",
      "Owner",
      "Draft Reply Needed",
      "Last Touch Summary",
      "Next Action",
      "Completed Date",
      "Notes",
    ],
    validations: [
      { range: "G2:G1000", source: ["Email", "Call", "Text", "Instagram DM", "Calendar Reminder"] },
      { range: "H2:H1000", source: followUpStatuses },
      { range: "J2:J1000", source: booleanOptions },
    ],
    dateColumns: ["E", "M"],
    timeColumns: ["F"],
    widthOverrides: { K: 260, L: 260, N: 300 },
  },
  {
    name: "Quotes",
    headers: [
      "Quote ID",
      "Lead ID",
      "Booking ID",
      "Created Date",
      "Sent Date",
      "Client Name",
      "Service Requested",
      "Package Name",
      "Package Details",
      "Subtotal",
      "Travel Fee",
      "Discount Approval Status",
      "Total Quote",
      "Deposit Required",
      "Quote Status",
      "Valid Until",
      "Owner Notes",
    ],
    validations: [
      { range: "G2:G1000", source: serviceOptions },
      { range: "L2:L1000", source: ["No Discount", "Owner Approval Needed", "Approved", "Declined"] },
      { range: "O2:O1000", source: quoteStatuses },
    ],
    dateColumns: ["D", "E", "P"],
    moneyColumns: ["J", "K", "M", "N"],
    widthOverrides: { I: 320, Q: 300 },
  },
  {
    name: "Payments",
    headers: [
      "Payment ID",
      "Lead ID",
      "Booking ID",
      "Quote ID",
      "Client Name",
      "Payment Type",
      "Amount",
      "Deposit Amount",
      "Balance Due",
      "Payment Status",
      "Stripe Link",
      "Stripe Invoice ID",
      "Due Date",
      "Paid Date",
      "Notes",
    ],
    validations: [
      { range: "F2:F1000", source: ["Deposit", "Balance", "Full Payment", "Refund"] },
      { range: "J2:J1000", source: paymentStatuses },
    ],
    dateColumns: ["M", "N"],
    moneyColumns: ["G", "H", "I"],
    widthOverrides: { K: 260, O: 300 },
  },
  {
    name: "MarketingCampaigns",
    headers: [
      "Campaign ID",
      "Created Date",
      "Updated Date",
      "Channel",
      "Campaign Type",
      "Campaign Status",
      "Audience",
      "Offer/Angle",
      "Primary Service",
      "Draft Copy",
      "Asset Link",
      "Owner Approval",
      "Publish Date",
      "Budget",
      "Results Summary",
      "Notes",
    ],
    validations: [
      { range: "D2:D1000", source: ["Website SEO", "Instagram", "Google Business Profile", "Email", "Meta Ads", "Google Ads"] },
      { range: "F2:F1000", source: campaignStatuses },
      { range: "I2:I1000", source: serviceOptions },
      { range: "L2:L1000", source: ["Needed", "Approved", "Declined"] },
    ],
    dateColumns: ["B", "C", "M"],
    moneyColumns: ["N"],
    widthOverrides: { H: 240, J: 360, O: 260, P: 280 },
  },
  {
    name: "MessageHistory",
    headers: [
      "Message ID",
      "Lead ID",
      "Contact ID",
      "Booking ID",
      "Date",
      "Channel",
      "Direction",
      "From",
      "To",
      "Subject",
      "Gmail Thread ID",
      "Gmail Message ID",
      "Summary",
      "Draft Created",
      "Sent By",
      "Notes",
    ],
    validations: [
      { range: "F2:F1000", source: ["Gmail", "Website Form", "Tidio", "Instagram DM", "Phone", "Text"] },
      { range: "G2:G1000", source: ["Inbound", "Outbound Draft", "Outbound Sent"] },
      { range: "N2:N1000", source: booleanOptions },
    ],
    dateColumns: ["E"],
    widthOverrides: { M: 320, P: 300 },
  },
  {
    name: "PackageTemplates",
    headers: [
      "Template ID",
      "Service",
      "Package Name",
      "Hours",
      "Base Price",
      "Deposit Due",
      "Balance Due",
      "Includes",
      "Notes",
      "Active",
    ],
    rows: [
      [
        "PKG-001",
        "DSLR Photo Booth - Digital Sharing",
        "Starter Digital Package - 2 Hours",
        2,
        450,
        "=E2*50%",
        "=E2-F2",
        "DSLR booth; instant sharing; one premium backdrop; professional lighting; custom overlay; props; attendant",
        "Digital photos only. No prints. No 360 booth.",
        "Yes",
      ],
      [
        "PKG-002",
        "DSLR Photo Booth - Digital Sharing",
        "Starter Digital Package - 3 Hours",
        3,
        575,
        "=E3*50%",
        "=E3-F3",
        "DSLR booth; instant sharing; one premium backdrop; professional lighting; custom overlay; props; attendant",
        "Digital photos only. No prints. No 360 booth.",
        "Yes",
      ],
      [
        "PKG-003",
        "DSLR Photo Booth - Digital Sharing",
        "Starter Digital Package - 4 Hours",
        4,
        700,
        "=E4*50%",
        "=E4-F4",
        "DSLR booth; instant sharing; one premium backdrop; professional lighting; custom overlay; props; attendant",
        "Digital photos only. No prints. No 360 booth.",
        "Yes",
      ],
      [
        "PKG-004",
        "Premium DJ Services",
        "Premium DJ Services",
        "",
        "",
        "",
        "",
        "High-end DJ services for Miami and South Florida events",
        "Quote per event. Do not publish paid ads or discounts without owner approval.",
        "Yes",
      ],
      [
        "PKG-005",
        "Photo Booth + DJ Bundle",
        "Photo Booth + DJ Bundle",
        "",
        "",
        "",
        "",
        "DSLR digital photo booth package plus premium DJ services",
        "Bundle quote requires owner-approved final pricing.",
        "Yes",
      ],
    ],
    validations: [
      { range: "B2:B1000", source: serviceOptions },
      { range: "J2:J1000", source: booleanOptions },
    ],
    moneyColumns: ["E", "F", "G"],
    widthOverrides: { H: 420, I: 300 },
  },
  {
    name: "QuoteTemplates",
    headers: [
      "Quote Template ID",
      "Trigger",
      "Recommended Package",
      "Email/Draft Copy",
      "Owner Approval Needed",
      "Active",
    ],
    rows: [
      [
        "QT-001",
        "Client asks for photo booth pricing",
        "Starter Digital Package",
        "Thank you for reaching out to Booth Fairy Miami. Our Starter Digital Package includes a DSLR booth, instant digital sharing, one premium backdrop, professional lighting, custom overlay, props, and an attendant. Pricing is $450 for 2 hours, $575 for 3 hours, and $700 for 4 hours. To check availability, please send your event date, venue/city, phone number, and guest count.",
        "No",
        "Yes",
      ],
      [
        "QT-002",
        "Client wants to book",
        "Calendar availability check",
        "I would love to help reserve your date. Before confirming, I need to check calendar availability. Once availability is confirmed, booking is secured with a signed agreement and a non-refundable 50% retainer. The remaining 50% is due on the day of the event.",
        "No",
        "Yes",
      ],
      [
        "QT-003",
        "Client asks about DJ services",
        "Premium DJ Services",
        "We also offer premium DJ services for Miami and South Florida events. DJ pricing is quoted based on event date, venue, hours, sound needs, timeline, and whether you want to bundle DJ with the DSLR digital photo booth.",
        "Yes",
        "Yes",
      ],
      [
        "QT-004",
        "Client asks for prints or 360 booth",
        "DSLR Digital Photo Booth",
        "At this time Booth Fairy Miami offers DSLR digital photo booth service with high-quality digital photos and instant digital sharing. We do not currently offer print packages or 360 photo booth services.",
        "No",
        "Yes",
      ],
    ],
    validations: [
      { range: "E2:E1000", source: booleanOptions },
      { range: "F2:F1000", source: booleanOptions },
    ],
    widthOverrides: { D: 640 },
  },
];

function columnRange(column, rows = 1000) {
  return `${column}2:${column}${rows}`;
}

function applySheetFormatting(sheet, headers, config) {
  const lastColumn = String.fromCharCode("A".charCodeAt(0) + headers.length - 1);
  const fullHeaderRange = `A1:${lastColumn}1`;
  const fullBodyRange = `A2:${lastColumn}1000`;

  sheet.getRange(fullHeaderRange).values = [headers];
  if (config.rows?.length) {
    const rowCount = config.rows.length;
    const rowRange = `A2:${lastColumn}${rowCount + 1}`;
    const values = config.rows.map((row) => row.map((value) => typeof value === "string" && value.startsWith("=") ? null : value));
    const formulas = config.rows.map((row) => row.map((value) => typeof value === "string" && value.startsWith("=") ? value : null));
    sheet.getRange(rowRange).values = values;
    sheet.getRange(rowRange).formulas = formulas;
  }
  sheet.getRange(fullHeaderRange).format = {
    fill: "#111827",
    font: { name: "Aptos", size: 11, color: "#FFFFFF", bold: true },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    wrapText: true,
    borders: { preset: "outside", style: "thin", color: "#111827" },
  };
  sheet.getRange(fullHeaderRange).format.rowHeightPx = 42;
  sheet.getRange(fullBodyRange).format = {
    font: { name: "Aptos", size: 10, color: "#1F2937" },
    verticalAlignment: "top",
    wrapText: true,
    borders: { preset: "inside", style: "thin", color: "#E5E7EB" },
  };
  sheet.getRange(fullBodyRange).format.rowHeightPx = 28;
  sheet.freezePanes.freezeRows(1);

  for (let i = 0; i < headers.length; i += 1) {
    const col = String.fromCharCode("A".charCodeAt(0) + i);
    const headerLength = headers[i].length;
    const baseWidth = Math.min(Math.max(headerLength * 9 + 28, 110), 210);
    sheet.getRange(`${col}:${col}`).format.columnWidthPx = config.widthOverrides?.[col] ?? baseWidth;
  }

  for (const col of config.dateColumns ?? []) {
    sheet.getRange(columnRange(col)).format.numberFormat = "yyyy-mm-dd";
  }

  for (const col of config.timeColumns ?? []) {
    sheet.getRange(columnRange(col)).format.numberFormat = "h:mm AM/PM";
  }

  for (const col of config.moneyColumns ?? []) {
    sheet.getRange(columnRange(col)).format.numberFormat = '"$"#,##0.00';
  }

  for (const validation of config.validations ?? []) {
    sheet.getRange(validation.range).dataValidation = {
      allowBlank: true,
      list: { inCellDropDown: true, source: validation.source },
      errorAlert: {
        style: "warning",
        title: "Use a CRM value",
        message: "Choose one of the approved Booth Fairy Miami CRM values.",
      },
    };
  }

  if (config.name === "Leads") {
    const leadIdFormulas = Array.from({ length: 999 }, (_, index) => {
      const row = index + 2;
      return [`=IF(COUNTA(F${row}:G${row},J${row})=0,"","BFM-"&TEXT(ROW()-1,"0000"))`];
    });
    sheet.getRange("A2:A1000").formulas = leadIdFormulas;
  }
}

const workbook = Workbook.create();

for (const config of sheets) {
  const sheet = workbook.worksheets.add(config.name);
  applySheetFormatting(sheet, config.headers, config);
}

await fs.mkdir(outputDir, { recursive: true });
const file = await SpreadsheetFile.exportXlsx(workbook);
await file.save(outputPath);

console.log(outputPath);
