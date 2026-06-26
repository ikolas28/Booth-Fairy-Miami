const assert = require("assert");
const { getGmailImportDecision, GMAIL_SYNC_QUERY } = require("../api/gmail/_lib");

function encodeBody(text) {
  return Buffer.from(text, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function message({ from, subject, body = "", snippet = "" }) {
  return {
    id: `${subject}-${from}`.replace(/\W+/g, "-").slice(0, 80),
    threadId: `${from}-${subject}`.replace(/\W+/g, "-").slice(0, 80),
    snippet: snippet || body.slice(0, 160),
    payload: {
      headers: [
        { name: "From", value: from },
        { name: "Subject", value: subject }
      ],
      body: { data: encodeBody(body) }
    }
  };
}

const cases = [
  {
    name: "TikTok notification is skipped",
    expected: false,
    message: message({
      from: "TikTok <no-reply@tiktok.com>",
      subject: "Alejandra Seota reposted: it will be #rapunzel",
      body: "Booth Fairy Miami, Alejandra Seota is your TikTok friend."
    })
  },
  {
    name: "Apple News newsletter is skipped",
    expected: false,
    message: message({
      from: "Good Morning From Apple News <news@apple.com>",
      subject: "ADHD's link to chronic health conditions, and more",
      body: "Here's what you need to know. Unsubscribe anytime."
    })
  },
  {
    name: "Yelp performance promo is skipped",
    expected: false,
    message: message({
      from: "Yelp for Business <no-reply@yelp.com>",
      subject: "Ready for a mid-year pulse check?",
      body: "Time to check your Yelp performance stats."
    })
  },
  {
    name: "Real photo booth pricing inquiry imports",
    expected: true,
    message: message({
      from: "Maria Client <maria@example.com>",
      subject: "Photo booth availability for July 20 wedding",
      body: "Hi, are you available for a wedding in Miami on 07/20/2026? We need photo booth pricing for about 100 guests. My phone is 786-555-1212."
    })
  },
  {
    name: "Real DJ and booth quote inquiry imports",
    expected: true,
    message: message({
      from: "Carlos Client <carlos@example.com>",
      subject: "Quote for DJ and photo booth",
      body: "Looking for a DJ and photo booth package for a corporate event in Doral. Can you send pricing and availability?"
    })
  }
];

for (const item of cases) {
  const decision = getGmailImportDecision(item.message);
  assert.strictEqual(decision.shouldImport, item.expected, `${item.name}: ${decision.reason}`);
  console.log(`${decision.shouldImport ? "IMPORT" : "SKIP"} - ${item.name}`);
}

assert.strictEqual(
  GMAIL_SYNC_QUERY,
  "newer_than:30d label:CRM-Lead -category:promotions -category:social -category:forums",
  "Default Gmail sync query should only scan manually labeled lead candidates."
);

console.log("Gmail lead filter tests passed.");
