const STRIPE_API_BASE = "https://api.stripe.com/v1";
const SALES_TAX_PERCENT = 7;

function buildTaxedRetainerPricing(pricing) {
  const packageSubtotal = roundMoney(pricing.total);
  const depositSubtotal = roundMoney(pricing.deposit);
  const packageTax = roundMoney(packageSubtotal * SALES_TAX_PERCENT / 100);
  const depositTax = roundMoney(depositSubtotal * SALES_TAX_PERCENT / 100);
  const packageTotal = roundMoney(packageSubtotal + packageTax);
  const depositTotal = roundMoney(depositSubtotal + depositTax);
  const balanceSubtotal = roundMoney(packageSubtotal - depositSubtotal);
  const balanceTax = roundMoney(packageTax - depositTax);
  const balanceTotal = roundMoney(balanceSubtotal + balanceTax);

  return {
    ...pricing,
    salesTaxPercent: SALES_TAX_PERCENT,
    packageSubtotal,
    packageTax,
    packageTotal,
    depositSubtotal,
    depositTax,
    depositTotal,
    balanceSubtotal,
    balanceTax,
    balanceTotal
  };
}

async function createStripeRetainerInvoice({ lead, pricing, secretKey, taxRateId }) {
  requireStripeSecretKey(secretKey);
  requireTaxRateId(taxRateId);
  await verifyFloridaSalesTaxRate(taxRateId, secretKey);
  const taxed = buildTaxedRetainerPricing(pricing);
  const customer = await findOrCreateCustomer(lead, secretKey);
  const idempotencyRoot = buildIdempotencyRoot(lead, taxed, taxRateId);
  const invoice = await stripeRequest("/invoices", {
      method: "POST",
      secretKey,
      idempotencyKey: `${idempotencyRoot}:invoice`,
      body: {
        customer: customer.id,
        collection_method: "send_invoice",
        days_until_due: "0",
        auto_advance: "false",
        description: buildInvoiceDescription(lead, taxed),
        footer: "The remaining balance is due on the event date. Your booking is confirmed only after the signed agreement and retainer are received.",
        "custom_fields[0][name]": "Lead",
        "custom_fields[0][value]": lead.leadCode || "CRM lead",
        ...buildMetadata(lead, taxed)
      }
  });

  await stripeRequest("/invoiceitems", {
      method: "POST",
      secretKey,
      idempotencyKey: `${idempotencyRoot}:item`,
      body: {
        customer: customer.id,
        invoice: invoice.id,
        currency: "usd",
        amount: String(Math.round(taxed.depositSubtotal * 100)),
        description: `50% reservation retainer - ${taxed.label}`,
        "tax_rates[0]": taxRateId,
        ...buildMetadata(lead, taxed)
      }
  });

  const finalized = await stripeRequest(`/invoices/${encodeURIComponent(invoice.id)}/finalize`, {
      method: "POST",
      secretKey,
      idempotencyKey: `${idempotencyRoot}:finalize`,
      body: { auto_advance: "false" }
  });

  return {
    ...taxed,
    url: finalized.hosted_invoice_url || "",
    invoiceId: finalized.id || invoice.id,
    invoiceNumber: finalized.number || "",
    paymentIntentId: stringify(finalized.payment_intent),
    stripeSubtotal: centsToMoney(finalized.subtotal),
    stripeTax: centsToMoney(finalized.total_tax_amounts?.reduce((sum, item) => sum + Number(item.amount || 0), 0)),
    stripeTotal: centsToMoney(finalized.total),
    skippedReason: ""
  };
}

async function verifyFloridaSalesTaxRate(taxRateId, secretKey) {
  const taxRate = await stripeRequest(`/tax_rates/${encodeURIComponent(taxRateId)}`, { secretKey });
  if (!taxRate.active || Number(taxRate.percentage) !== SALES_TAX_PERCENT || taxRate.inclusive) {
    const error = new Error("STRIPE_SALES_TAX_RATE_ID must reference an active, exclusive Stripe tax rate of exactly 7%.");
    error.statusCode = 500;
    throw error;
  }
}

async function findOrCreateCustomer(lead, secretKey) {
  const query = new URLSearchParams({ email: lead.email, limit: "1" });
  const found = await stripeRequest(`/customers?${query}`, { secretKey });
  if (found.data?.[0]) return found.data[0];

  return stripeRequest("/customers", {
    method: "POST",
    secretKey,
    idempotencyKey: `bfm-customer:${hashValue(lead.email.toLowerCase())}`,
    body: {
      email: lead.email,
      name: lead.clientName || lead.client_name || "Booth Fairy Miami Client",
      phone: lead.phone && lead.phone !== "Not provided" ? lead.phone : undefined,
      "metadata[lead_id]": lead.id || "",
      "metadata[lead_code]": lead.leadCode || lead.lead_code || ""
    }
  });
}

async function stripeRequest(path, { method = "GET", secretKey, body, idempotencyKey } = {}) {
  const headers = { Authorization: `Bearer ${secretKey}` };
  if (body) headers["Content-Type"] = "application/x-www-form-urlencoded";
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey.slice(0, 255);
  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    method,
    headers,
    body: body ? new URLSearchParams(removeUndefined(body)) : undefined
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload?.error?.message || "Stripe invoice request failed.");
    error.details = payload;
    error.statusCode = response.status;
    throw error;
  }
  return payload;
}

function buildMetadata(lead, pricing) {
  return {
    "metadata[lead_id]": lead.id || "",
    "metadata[lead_code]": lead.leadCode || lead.lead_code || "",
    "metadata[payment_type]": "50_percent_retainer",
    "metadata[service_requested]": pricing.label,
    "metadata[client_name]": lead.clientName || lead.client_name || "",
    "metadata[event_date]": lead.eventDate || lead.event_date || "",
    "metadata[sales_tax_percent]": String(pricing.salesTaxPercent),
    "metadata[package_subtotal]": pricing.packageSubtotal.toFixed(2),
    "metadata[package_tax]": pricing.packageTax.toFixed(2),
    "metadata[package_total]": pricing.packageTotal.toFixed(2),
    "metadata[deposit_subtotal]": pricing.depositSubtotal.toFixed(2),
    "metadata[deposit_tax]": pricing.depositTax.toFixed(2),
    "metadata[deposit_total]": pricing.depositTotal.toFixed(2),
    "metadata[balance_subtotal]": pricing.balanceSubtotal.toFixed(2),
    "metadata[balance_tax]": pricing.balanceTax.toFixed(2),
    "metadata[balance_total]": pricing.balanceTotal.toFixed(2)
  };
}

function buildInvoiceDescription(lead, pricing) {
  return [
    `Booth Fairy Miami 50% reservation retainer for ${pricing.label}`,
    lead.eventType || lead.event_type,
    lead.eventDate || lead.event_date,
    lead.venue || lead.city
  ].filter(Boolean).join(" | ").slice(0, 500);
}

function buildIdempotencyRoot(lead, pricing, taxRateId) {
  const value = [lead.id || lead.leadCode || lead.lead_code || lead.email, lead.eventDate || lead.event_date, pricing.depositSubtotal, taxRateId].join(":");
  return `bfm-retainer:${hashValue(value)}`;
}

function hashValue(value) {
  let hash = 2166136261;
  for (const char of String(value || "")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function requireStripeSecretKey(value) {
  if (!/^sk_(live|test)_[A-Za-z0-9]/.test(String(value || ""))) {
    const error = new Error("STRIPE_SECRET_KEY must be a Stripe secret key beginning with sk_live_ or sk_test_.");
    error.statusCode = 500;
    throw error;
  }
}

function requireTaxRateId(value) {
  if (!/^txr_[A-Za-z0-9]+$/.test(String(value || ""))) {
    const error = new Error("Missing or invalid STRIPE_SALES_TAX_RATE_ID. Add the active Florida 7% Stripe tax rate ID in Vercel.");
    error.statusCode = 500;
    throw error;
  }
}

function removeUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null));
}

function centsToMoney(value) {
  return roundMoney(Number(value || 0) / 100);
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function stringify(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

module.exports = {
  SALES_TAX_PERCENT,
  buildTaxedRetainerPricing,
  createStripeRetainerInvoice
};
