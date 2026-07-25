(function () {
  const googleMeasurementId = "G-8D92QEYZ5H";
  // Fill these from Google Ads after creating conversion actions for form leads, call clicks, text clicks, and website calls.
  const googleAdsConversions = {
    conversionId: "",
    completedInquiryLabel: "",
    phoneClickLabel: "",
    textClickLabel: "",
    websiteCallLabel: "",
    phoneConversionNumber: "1-786-315-9117",
  };
  const trackedOnce = new Set();

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () {
    window.dataLayer.push(arguments);
  };

  function getPagePath() {
    return `${window.location.pathname}${window.location.search || ""}${window.location.hash || ""}`;
  }

  function getLinkText(link) {
    return (link.textContent || link.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 100);
  }

  function sanitizeTrackingValue(value) {
    return String(value || "")
      .replace(/[^a-z0-9_-]/gi, "")
      .slice(0, 80);
  }

  function trackEvent(eventName, params = {}) {
    if (typeof window.gtag !== "function") return;

    window.gtag("event", eventName, {
      event_category: "lead_engagement",
      page_path: getPagePath(),
      page_title: document.title,
      ...params,
    });
  }

  function getGoogleAdsSendTo(label) {
    const conversionId = sanitizeGoogleAdsValue(googleAdsConversions.conversionId);
    const conversionLabel = sanitizeGoogleAdsValue(label);
    return conversionId && conversionLabel ? `${conversionId}/${conversionLabel}` : "";
  }

  function sanitizeGoogleAdsValue(value) {
    return String(value || "")
      .replace(/[^a-z0-9_-]/gi, "")
      .slice(0, 120);
  }

  function trackGoogleAdsConversion(label, params = {}) {
    const sendTo = getGoogleAdsSendTo(label);
    if (!sendTo || typeof window.gtag !== "function") return;

    window.gtag("event", "conversion", {
      send_to: sendTo,
      ...params,
    });
  }

  function setupGoogleAdsPhoneCalls() {
    const sendTo = getGoogleAdsSendTo(googleAdsConversions.websiteCallLabel);
    if (!sendTo || typeof window.gtag !== "function") return;

    window.gtag("config", sendTo, {
      phone_conversion_number: googleAdsConversions.phoneConversionNumber,
      phone_conversion_callback: updateGoogleForwardingPhoneLinks,
    });
  }

  function updateGoogleForwardingPhoneLinks(formattedNumber, mobileNumber) {
    const cleanMobileNumber = String(mobileNumber || "").trim();
    const cleanFormattedNumber = String(formattedNumber || "").trim();
    if (!cleanMobileNumber && !cleanFormattedNumber) return;

    document.querySelectorAll('a[href^="tel:"]').forEach((link) => {
      if (cleanMobileNumber) link.href = `tel:${cleanMobileNumber}`;
      if (cleanFormattedNumber && /\d/.test(link.textContent || "")) {
        link.textContent = cleanFormattedNumber;
      }
    });
  }

  function trackOnce(key, eventName, params = {}) {
    if (trackedOnce.has(key)) return;
    trackedOnce.add(key);
    trackEvent(eventName, params);
  }

  window.bfmTrackEvent = trackEvent;
  window.bfmTrackOnce = trackOnce;

  const googleScript = document.createElement("script");
  googleScript.async = true;
  googleScript.src = `https://www.googletagmanager.com/gtag/js?id=${googleMeasurementId}`;
  document.head.appendChild(googleScript);

  window.gtag("js", new Date());
  window.gtag("config", googleMeasurementId);
  if (googleAdsConversions.conversionId) {
    window.gtag("config", googleAdsConversions.conversionId);
    setupGoogleAdsPhoneCalls();
  }

  if (window.location.pathname.endsWith("/thank-you.html")) {
    const searchParams = new URLSearchParams(window.location.search);
    const isWebsiteLead = searchParams.get("source") === "website_form";
    const leadReference = sanitizeTrackingValue(searchParams.get("lead"));
    const crmResult = sanitizeTrackingValue(searchParams.get("crm")) || "unknown";
    const leadStatus = sanitizeTrackingValue(searchParams.get("status"));
    const eventId = leadReference || `website-lead-${Date.now()}`;

    trackEvent("thank_you_view", {
      event_label: "website_inquiry",
      lead_source: isWebsiteLead ? "website_form" : "unknown",
      conversion_state: isWebsiteLead ? "completed" : "unverified",
      lead_reference: leadReference,
    });

    if (searchParams.get("payment") === "success") {
      trackEvent("booking_payment_success", {
        event_label: "stripe_checkout_success",
        booking_source: "stripe_checkout",
      });
    } else if (isWebsiteLead) {
      trackEvent("generate_lead", {
        event_label: "website_inquiry",
        lead_source: "website_form",
        crm_result: crmResult,
        lead_status: leadStatus,
        lead_reference: leadReference,
        event_id: eventId,
      });

      trackGoogleAdsConversion(googleAdsConversions.completedInquiryLabel, {
        transaction_id: eventId,
        event_category: "lead",
        event_label: "completed_inquiry_form",
      });

      trackEvent("crm_lead_completed", {
        event_label: "website_inquiry",
        lead_source: "website_form",
        crm_result: crmResult,
        lead_status: leadStatus,
        lead_reference: leadReference,
      });

      window.fbq?.("track", "Lead", {
        content_name: "Website inquiry",
        lead_source: "website_form",
        crm_result: crmResult,
      }, {
        eventID: eventId,
      });
    }
  }

  document.addEventListener("click", (event) => {
    const link = event.target.closest?.("a[href]");
    if (!link) return;

    const href = link.getAttribute("href") || "";
    const absoluteHref = link.href || href;
    const linkParams = {
      link_text: getLinkText(link),
      link_url: absoluteHref,
    };

    if (href.startsWith("tel:")) {
      trackEvent("phone_click", {
        ...linkParams,
        contact_method: "phone",
      });
      trackEvent("phone_call_click", {
        ...linkParams,
        contact_method: "phone",
      });
      trackGoogleAdsConversion(googleAdsConversions.phoneClickLabel, {
        event_category: "lead",
        event_label: "phone_click",
      });
      return;
    }

    if (href.startsWith("sms:")) {
      trackEvent("text_click", {
        ...linkParams,
        contact_method: "sms",
      });
      trackEvent("text_message_click", {
        ...linkParams,
        contact_method: "sms",
      });
      trackGoogleAdsConversion(googleAdsConversions.textClickLabel, {
        event_category: "lead",
        event_label: "text_click",
      });
      return;
    }

    if (href.startsWith("mailto:")) {
      trackEvent("email_click", {
        ...linkParams,
        contact_method: "email",
      });
      return;
    }

    const isQuoteLink = href === "#quote-form" || href.endsWith("/#quote-form") || href.includes("#quote-form");
    if (!isQuoteLink) return;

    const isPackageLink =
      link.classList.contains("package-button") ||
      Boolean(link.closest("#pricing, .pricing-package-copy, .service-card-featured"));

    if (isPackageLink) {
      trackEvent("package_cta_click", linkParams);
    }

    trackEvent("quote_cta_click", {
      ...linkParams,
      cta_context: isPackageLink ? "package" : "general",
    });
  });

  document.addEventListener(
    "focusin",
    (event) => {
      const field = event.target;
      const form = field.closest?.("#quote-form, .contact-form");
      if (!form || field.name === "website") return;

      trackOnce("quote_form_start", "form_start", {
        form_id: form.id || "quote-form",
        form_name: "website_quote_form",
      });
    },
    true
  );

  if (window.fbq) return;

  const fbq = (window.fbq = function () {
    fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments);
  });

  if (!window._fbq) window._fbq = fbq;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);

  fbq("init", "858672350435032");
  fbq("track", "PageView");
})();
