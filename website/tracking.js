(function () {
  const googleMeasurementId = "G-8D92QEYZ5H";
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

  function trackEvent(eventName, params = {}) {
    if (typeof window.gtag !== "function") return;

    window.gtag("event", eventName, {
      event_category: "lead_engagement",
      page_path: getPagePath(),
      page_title: document.title,
      ...params,
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

  if (window.location.pathname.endsWith("/thank-you.html")) {
    const searchParams = new URLSearchParams(window.location.search);

    trackEvent("thank_you_view", {
      event_label: "website_inquiry",
    });

    if (searchParams.get("payment") === "success") {
      trackEvent("booking_payment_success", {
        event_label: "stripe_checkout_success",
        booking_source: "stripe_checkout",
      });
    } else {
      trackEvent("generate_lead", {
        event_label: "website_inquiry",
        lead_source: "website_form",
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
      return;
    }

    if (href.startsWith("sms:")) {
      trackEvent("text_click", {
        ...linkParams,
        contact_method: "sms",
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

  fbq("init", "2082384575668865");
  fbq("track", "PageView");
})();
