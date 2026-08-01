setupAccessibleNavigation();
setupStructuredFooter();
setupDeferredTidio();
setupMobileCtaViewport();
setupRevealEffects();
setupMarketingAttribution();
setupFormPresets();
setupAccessibleDisclosures();
stabilizeHashNavigation();

function setupMobileCtaViewport() {
  const cta = document.querySelector(".mobile-cta");
  if (!cta || cta.closest(".mobile-cta-shell")) return;

  const shell = document.createElement("div");
  shell.className = "mobile-cta-shell";
  shell.setAttribute("role", "group");
  shell.setAttribute("aria-label", "Quick contact actions");
  cta.before(shell);
  shell.appendChild(cta);

  let updateFrame = 0;
  let resumeFrame = 0;
  let resumeTimers = [];

  const clearResumeTimers = () => {
    resumeTimers.forEach((timer) => window.clearTimeout(timer));
    resumeTimers = [];
  };

  const updateViewport = () => {
    window.cancelAnimationFrame(updateFrame);
    updateFrame = window.requestAnimationFrame(() => {
      const viewport = window.visualViewport;
      const layoutHeight = Math.max(window.innerHeight, document.documentElement.clientHeight);
      const viewportHeight = viewport?.height || layoutHeight;
      const keyboardOpen = layoutHeight - viewportHeight > 150;

      shell.classList.toggle("is-keyboard-open", keyboardOpen);
    });
  };

  const reattachAfterResume = () => {
    if (document.hidden) return;

    clearResumeTimers();
    window.cancelAnimationFrame(resumeFrame);
    shell.classList.add("is-resuming");

    resumeFrame = window.requestAnimationFrame(() => {
      void shell.offsetHeight;
      window.requestAnimationFrame(() => {
        shell.classList.remove("is-suspended", "is-resuming");
        updateViewport();
      });
    });

    [120, 350, 900, 1600].forEach((delay) => {
      resumeTimers.push(window.setTimeout(updateViewport, delay));
    });
  };

  updateViewport();
  window.addEventListener("resize", updateViewport, { passive: true });
  window.addEventListener("orientationchange", updateViewport, { passive: true });
  window.addEventListener("focus", reattachAfterResume, { passive: true });
  window.addEventListener("pageshow", reattachAfterResume, { passive: true });
  window.addEventListener("pagehide", () => {
    clearResumeTimers();
    shell.classList.add("is-suspended");
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearResumeTimers();
      shell.classList.add("is-suspended");
      return;
    }

    reattachAfterResume();
  });
  window.visualViewport?.addEventListener("resize", updateViewport, { passive: true });
  window.visualViewport?.addEventListener("scroll", updateViewport, { passive: true });
}

function setupDeferredTidio() {
  if (!document.body?.matches("[data-tidio='deferred']")) return;

  let loaded = false;
  let pendingOpen = false;
  let visitorOpenedChat = false;
  const launcher = document.querySelector("[data-chat-launcher]");

  const openChat = () => {
    const api = window.tidioChatApi;
    if (!api) {
      pendingOpen = true;
      loadTidio();
      return;
    }

    visitorOpenedChat = true;
    launcher?.setAttribute("hidden", "");
    api.show();
    api.open();
  };

  const onTidioReady = () => {
    const api = window.tidioChatApi;
    if (!api) return;

    // Official Widget API methods prevent Tidio flows from exposing an expanded
    // window or an artificial unread badge before the visitor chooses to chat.
    api.close();
    api.hide();
    launcher?.removeAttribute("hidden");
    api.on("close", () => {
      if (!visitorOpenedChat) return;
      api.hide();
      launcher?.removeAttribute("hidden");
    });

    if (pendingOpen) {
      pendingOpen = false;
      openChat();
    }
  };

  const loadTidio = () => {
    if (loaded || document.querySelector("script[data-bfm-tidio]")) return;
    loaded = true;

    const script = document.createElement("script");
    script.src = "https://code.tidio.co/m0gzyoeu10eleavbj0lenf3bzb0w2bkr.js";
    script.async = true;
    script.dataset.bfmTidio = "true";
    document.body.appendChild(script);
  };

  launcher?.addEventListener("click", openChat);
  window.setTimeout(() => launcher?.classList.add("has-notification-dot"), 18000);

  if (launcher && "IntersectionObserver" in window) {
    const obstructibleSections = new Set();
    const launcherGuard = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) obstructibleSections.add(entry.target);
        else obstructibleSections.delete(entry.target);
      });
      launcher.classList.toggle("is-suppressed", obstructibleSections.size > 0);
    }, { threshold: 0.08 });

    ["#gallery", "#keepsake-addons", "#faq", "#quote-form"].forEach((selector) => {
      const section = document.querySelector(selector);
      if (section) launcherGuard.observe(section);
    });
  }

  if (window.tidioChatApi) {
    onTidioReady();
  } else {
    document.addEventListener("tidioChat-ready", onTidioReady, { once: true });
  }

  const isProductionSite = ["www.boothfairymiami.com", "boothfairymiami.com"].includes(window.location.hostname);
  if (isProductionSite && "requestIdleCallback" in window) {
    window.requestIdleCallback(loadTidio, { timeout: 5000 });
  } else if (isProductionSite) {
    window.setTimeout(loadTidio, 3500);
  }
}

function setupStructuredFooter() {
  const footerLinks = document.querySelector(".site-footer .footer-links");
  if (!footerLinks || footerLinks.classList.contains("footer-groups")) return;

  const groups = {
    services: { label: "Services", links: [] },
    locations: { label: "Locations", links: [] },
    company: { label: "Company", links: [] },
  };

  [...footerLinks.querySelectorAll(":scope > a")].forEach((link) => {
    const href = (link.getAttribute("href") || "").toLowerCase();
    const key =
      /photo-booth-rental-|wedding-photo-booth-/.test(href)
        ? "locations"
        : /#services|#pricing|#keepsake-addons|dj-services/.test(href)
          ? "services"
          : "company";
    groups[key].links.push(link);
  });

  const groupElements = Object.values(groups)
    .filter((group) => group.links.length)
    .map((group) => {
      const wrapper = document.createElement("div");
      wrapper.className = "footer-group";

      const heading = document.createElement("p");
      heading.className = "footer-group-title";
      heading.textContent = group.label;

      const list = document.createElement("div");
      list.className = "footer-group-links";
      group.links.forEach((link) => list.appendChild(link));
      wrapper.append(heading, list);
      return wrapper;
    });

  const contact = document.createElement("div");
  contact.className = "footer-contact-card";
  contact.innerHTML = `
    <p class="footer-group-title">Plan Your Event</p>
    <a href="tel:17863159117">(786) 315-9117</a>
    <a href="mailto:info@boothfairymiami.com">info@boothfairymiami.com</a>
    <a class="button button-primary" href="/#quote-form">Check Availability</a>
  `;

  footerLinks.classList.add("footer-groups");
  footerLinks.setAttribute("role", "navigation");
  footerLinks.setAttribute("aria-label", "Footer navigation");
  footerLinks.replaceChildren(...groupElements, contact);
}

function stabilizeHashNavigation() {
  const hash = window.location.hash.slice(1);
  if (!hash) return;

  const scrollToTarget = () => {
    const target = document.getElementById(hash);
    if (!target) return;
    target.scrollIntoView({ behavior: "auto", block: "start" });
  };

  if (document.readyState === "complete") {
    window.setTimeout(scrollToTarget, 80);
  } else {
    window.addEventListener("load", () => window.setTimeout(scrollToTarget, 80), { once: true });
  }
}

function setupRevealEffects() {
  const revealElements = document.querySelectorAll(".reveal");
  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  if (!revealElements.length || prefersReducedMotion || !("IntersectionObserver" in window)) {
    revealElements.forEach((element) => element.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.12,
      rootMargin: "0px 0px -32px 0px",
    }
  );

  revealElements.forEach((element) => observer.observe(element));
}

function setupAccessibleNavigation() {
  const main = document.querySelector("main");
  const header = document.querySelector(".site-header");
  const navShell = header?.querySelector(".nav-shell");
  const desktopNav = navShell?.querySelector(".site-nav");

  if (main) {
    if (!main.id) main.id = "main-content";

    if (!document.querySelector(".skip-link")) {
      const skipLink = document.createElement("a");
      skipLink.className = "skip-link";
      skipLink.href = `#${main.id}`;
      skipLink.textContent = "Skip to main content";
      document.body.prepend(skipLink);
    }
  }

  if (!header || !navShell || !desktopNav || navShell.querySelector(".nav-menu-toggle")) return;

  const menuId = `mobile-navigation-${Math.random().toString(36).slice(2, 8)}`;
  const menuButton = document.createElement("button");
  menuButton.className = "nav-menu-toggle";
  menuButton.type = "button";
  menuButton.setAttribute("aria-expanded", "false");
  menuButton.setAttribute("aria-controls", menuId);
  menuButton.setAttribute("aria-label", "Open navigation menu");
  menuButton.innerHTML = "<span></span><span></span><span></span>";

  const panel = document.createElement("div");
  panel.className = "mobile-nav-panel";
  panel.id = menuId;
  panel.hidden = true;

  const linkList = document.createElement("nav");
  linkList.className = "mobile-nav-links";
  linkList.setAttribute("aria-label", "Mobile navigation");
  desktopNav.querySelectorAll("a").forEach((link) => linkList.append(link.cloneNode(true)));

  const actions = document.createElement("div");
  actions.className = "mobile-nav-actions";
  actions.innerHTML = `
    <a class="button button-secondary" href="sms:17863159117?body=Hi%20Booth%20Fairy%20Miami,%20I%27d%20like%20to%20check%20availability%20for%20my%20event.">Text Us</a>
    <a class="button button-primary" href="/#quote-form">Check Availability</a>
  `;

  panel.append(linkList, actions);
  navShell.append(menuButton);
  header.append(panel);

  const closeMenu = ({ restoreFocus = false } = {}) => {
    panel.hidden = true;
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "Open navigation menu");
    document.body.classList.remove("menu-open");
    if (restoreFocus) menuButton.focus();
  };

  const openMenu = () => {
    panel.hidden = false;
    menuButton.setAttribute("aria-expanded", "true");
    menuButton.setAttribute("aria-label", "Close navigation menu");
    document.body.classList.add("menu-open");
    panel.querySelector("a")?.focus();
  };

  menuButton.addEventListener("click", () => {
    if (panel.hidden) openMenu();
    else closeMenu({ restoreFocus: true });
  });

  panel.addEventListener("click", (event) => {
    if (event.target.closest("a")) closeMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) closeMenu({ restoreFocus: true });
  });

  document.addEventListener("click", (event) => {
    if (!panel.hidden && !header.contains(event.target)) closeMenu();
  });

  window.matchMedia?.("(min-width: 1081px)").addEventListener?.("change", (event) => {
    if (event.matches) closeMenu();
  });
}

function setupFormPresets() {
  const form = document.querySelector("#quote-form");
  if (!form) return;

  const eventDate = form.querySelector("[name='event-date']");
  if (eventDate && !eventDate.min) {
    const localToday = new Date();
    localToday.setMinutes(localToday.getMinutes() - localToday.getTimezoneOffset());
    eventDate.min = localToday.toISOString().slice(0, 10);
  }

  const params = new URLSearchParams(window.location.search);
  const service = params.get("service");
  const packageInterest = params.get("package");
  setSelectValue("#service-requested", service);
  if (packageInterest) {
    setSelectValue("#package-interest", packageInterest);
  } else if (service === "Premium DJ Services") {
    setSelectValue("#package-interest", "Custom Quote");
  } else if (service === "Photo Booth + DJ Bundle") {
    setSelectValue("#package-interest", "DJ + Photo Booth Bundle");
  }
  setSelectValue("#addon-interest", params.get("addon"));

  if (service || params.get("addon")) {
    form.querySelector(".form-optional-details")?.setAttribute("open", "");
  }
}

function setupAccessibleDisclosures() {
  document.querySelectorAll(".faq-list summary, .form-optional-details summary").forEach((summary) => {
    summary.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      const details = summary.closest("details");
      if (details) details.open = !details.open;
    });
  });
}

function revealOptionalFormDetails() {
  const details = document.querySelector("#quote-form .form-optional-details");
  if (details) details.open = true;
}

function setupMarketingAttribution() {
  const storageKey = "bfm_session_attribution_v1";
  const params = new URLSearchParams(window.location.search);
  const clean = (value, maxLength = 160) => String(value || "").trim().slice(0, maxLength);
  const campaignFields = {
    utmSource: clean(params.get("utm_source"), 80),
    utmMedium: clean(params.get("utm_medium"), 80),
    utmCampaign: clean(params.get("utm_campaign"), 120),
    utmContent: clean(params.get("utm_content"), 120),
    utmTerm: clean(params.get("utm_term"), 120),
    gclid: clean(params.get("gclid"), 160),
    fbclid: clean(params.get("fbclid"), 160),
  };
  const hasCampaignData = Object.values(campaignFields).some(Boolean);
  let referrerHost = "";

  try {
    const referrerUrl = document.referrer ? new URL(document.referrer) : null;
    if (referrerUrl && referrerUrl.origin !== window.location.origin) {
      referrerHost = clean(referrerUrl.hostname, 120);
    }
  } catch {
    referrerHost = "";
  }

  let stored = null;
  try {
    stored = JSON.parse(window.sessionStorage.getItem(storageKey) || "null");
  } catch {
    stored = null;
  }

  const attribution = !stored || hasCampaignData
    ? {
        landingPage: clean(window.location.pathname, 200) || "/",
        referrerHost,
        ...campaignFields,
        capturedAt: new Date().toISOString(),
      }
    : stored;

  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(attribution));
  } catch {
    // Attribution remains available for the current page when storage is unavailable.
  }

  window.bfmGetMarketingAttribution = () => ({ ...attribution });
  const form = document.querySelector("#quote-form");
  if (form) form.dataset.marketingAttribution = JSON.stringify(attribution);
}

function setSelectValue(selector, value) {
  if (!value) return false;

  const select = document.querySelector(selector);
  if (!select || !Array.from(select.options).some((option) => option.value === value)) return false;

  select.value = value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function moveToQuoteForm(selectionMessage = "") {
  const form = document.querySelector("#quote-form");
  if (!form) return;

  form.scrollIntoView({ behavior: "smooth", block: "start" });

  if (selectionMessage) {
    showFormStatus(selectionMessage, "selection");
  }
}

function showFormStatus(message, tone = "info") {
  const status = document.querySelector("#form-status");
  if (!status) return;

  status.textContent = message;
  status.dataset.tone = tone;
  status.hidden = !message;
}

async function updateGoogleRatingProof() {
  const ratingElement = document.querySelector("[data-google-rating]");
  const reviewCountElement = document.querySelector("[data-google-review-count]");

  if (!ratingElement || !reviewCountElement) return;

  try {
    const response = await fetch("/api/website/lead?resource=google-rating", {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) return;

    const data = await response.json();
    const rating = Number(data.rating);
    const reviewCount = Number(data.reviewCount);

    if (Number.isFinite(rating) && rating > 0) {
      ratingElement.textContent = rating.toFixed(1);
    }

    if (Number.isFinite(reviewCount) && reviewCount >= 0) {
      reviewCountElement.textContent = new Intl.NumberFormat("en-US").format(reviewCount);
    }

    if (data.googleMapsUri) {
      document.querySelectorAll(".proof-strip a[href*='maps.app.goo.gl']").forEach((link) => {
        link.href = data.googleMapsUri;
      });
    }
  } catch (error) {
    // Keep the static fallback values if live Google rating data is unavailable.
  }
}

updateGoogleRatingProof();

document.querySelectorAll("[data-addon]").forEach((button) => {
  button.addEventListener("click", () => {
    const addonSelect = document.querySelector("#addon-interest");
    const serviceSelect = document.querySelector("#service-requested");
    const addonValue = button.dataset.addon || "";

    if (!addonSelect || !addonValue) return;

    addonSelect.value = addonValue;
    addonSelect.dispatchEvent(new Event("change", { bubbles: true }));
    if (serviceSelect?.value === "Premium DJ Services") {
      serviceSelect.value = "Photo Booth + DJ Bundle";
      serviceSelect.dispatchEvent(new Event("change", { bubbles: true }));
    }
    revealOptionalFormDetails();
    moveToQuoteForm(`${button.closest(".keepsake-card")?.querySelector(".keepsake-label")?.textContent || "Keepsake add-on"} selected. You can adjust it below.`);

    window.setTimeout(() => addonSelect.focus({ preventScroll: true }), 550);
    window.bfmTrackEvent?.("keepsake_addon_select", {
      add_on_interest: addonValue,
      cta_context: "keepsake_addon_section",
    });
  });
});

document.querySelectorAll("[data-package]").forEach((button) => {
  button.addEventListener("click", () => {
    const packageValue = button.dataset.package || "";
    const selected = setSelectValue("#package-interest", packageValue);

    if (!selected) return;

    moveToQuoteForm(`${button.textContent.trim()} selected. Add your event details to check availability.`);
    window.setTimeout(() => document.querySelector("#package-interest")?.focus({ preventScroll: true }), 550);

    window.bfmTrackEvent?.("package_select", {
      package_interest: packageValue,
      cta_context: "pricing_section",
    });
  });
});

document.querySelectorAll("[data-service]").forEach((button) => {
  button.addEventListener("click", () => {
    const serviceValue = button.dataset.service || "";
    const selected = setSelectValue("#service-requested", serviceValue);

    if (!selected) return;

    if (serviceValue === "Photo Booth + DJ Bundle") {
      setSelectValue("#package-interest", "DJ + Photo Booth Bundle");
    }

    revealOptionalFormDetails();
    moveToQuoteForm(`${serviceValue} selected. Share your event details for a tailored quote.`);
    window.setTimeout(() => document.querySelector("#service-requested")?.focus({ preventScroll: true }), 550);

    window.bfmTrackEvent?.("service_select", {
      service_requested: serviceValue,
      cta_context: "service_section",
    });
  });
});

const productionHostnames = new Set(["www.boothfairymiami.com", "boothfairymiami.com"]);
const requiresTurnstile = productionHostnames.has(window.location.hostname);

if (!requiresTurnstile) {
  document.querySelectorAll(".cf-turnstile").forEach((element) => element.remove());
}

document.querySelector(".contact-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const form = event.currentTarget;
  const button = form.querySelector("button[type='submit']");
  const honeypot = form.querySelector("input[name='website']");

  if (!button) return;
  if (honeypot?.value) return;

  const originalText = button.textContent;

  button.textContent = "Sending...";
  button.disabled = true;
  showFormStatus("Sending your inquiry securely…", "info");

  try {
    const formData = new FormData(form);
    const email = String(formData.get("email") || "").trim();
    if (!email) {
      throw new Error("Please include a valid email address.");
    }
    const turnstileToken = formData.get("cf-turnstile-response");
    if (requiresTurnstile && !turnstileToken) {
      throw new Error("Please complete the verification.");
    }

    const crmPayload = Object.fromEntries(formData.entries());
    let marketingAttribution = {};
    try {
      marketingAttribution = JSON.parse(form.dataset.marketingAttribution || "{}");
    } catch {
      marketingAttribution = window.bfmGetMarketingAttribution?.() || {};
    }
    crmPayload.marketingAttribution = marketingAttribution;
    Object.entries(marketingAttribution).forEach(([key, value]) => {
      if (value) formData.set(`attribution-${key}`, String(value));
    });
    const galleryReferral = getGalleryReferral();
    if (galleryReferral) {
      crmPayload["gallery-referral"] = galleryReferral;
      formData.set("gallery-referral", galleryReferral);
    }
    const crmResponse = await fetch("/api/website/lead", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(crmPayload),
    });

    if (!crmResponse.ok) {
      throw new Error("CRM lead submission failed");
    }

    const crmResult = await crmResponse.json().catch(() => ({}));
    const confirmationUrl = buildThankYouUrl(crmResult);

    window.bfmTrackEvent?.("crm_lead_submit_success", {
      form_id: form.id || "quote-form",
      form_name: "website_quote_form",
      service_requested: String(formData.get("service-requested") || ""),
      package_interest: String(formData.get("package-interest") || ""),
      add_on_interest: String(formData.get("addon-interest") || ""),
      lead_reference: sanitizeTrackingValue(crmResult.leadCode),
      crm_result: crmResult.duplicate ? "duplicate" : "created",
    });

    const response = await fetch(form.action, {
      method: form.method,
      body: formData,
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      window.bfmTrackEvent?.("form_notification_failed", {
        form_id: form.id || "quote-form",
        form_name: "website_quote_form",
        lead_reference: sanitizeTrackingValue(crmResult.leadCode),
      });
    }

    window.bfmTrackEvent?.("form_submit_success", {
      form_id: form.id || "quote-form",
      form_name: "website_quote_form",
      lead_reference: sanitizeTrackingValue(crmResult.leadCode),
    });

    if (galleryReferral) {
      fetch("/api/gallery/event", {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: galleryReferral,
          eventType: "booking_inquiry",
          sessionId: getGalleryReferralSessionId()
        })
      }).catch(() => null);
    }

    button.textContent = "Inquiry Sent";
    showFormStatus("Your inquiry was received. We’re taking you to your confirmation now.", "success");
    form.reset();
    window.turnstile?.reset();
    setTimeout(() => {
      window.location.href = confirmationUrl;
    }, 500);
  } catch (error) {
    button.textContent = "Try Again";
    showFormStatus(
      error?.message === "Please complete the verification."
        ? "Please complete the verification, then try again."
        : error?.message === "Please include a valid email address."
          ? "Please include a valid email address so we can reply. Phone is optional."
          : "We couldn’t send your inquiry. Your information is still here—please try again or text us at (786) 315-9117.",
      "error"
    );
    document.querySelector("#form-status")?.focus({ preventScroll: true });
    window.turnstile?.reset();
  } finally {
    setTimeout(() => {
      button.textContent = originalText;
      button.disabled = false;
    }, 1800);
  }
});

function getGalleryReferral() {
  const value = new URLSearchParams(window.location.search).get("gallery_ref") || "";
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) ? value.slice(0, 120) : "";
}

function getGalleryReferralSessionId() {
  try {
    return sessionStorage.getItem("bfmGallerySession") || "";
  } catch {
    return "";
  }
}

function buildThankYouUrl(crmResult = {}) {
  const params = new URLSearchParams({
    source: "website_form",
    crm: crmResult.duplicate ? "duplicate" : "created",
  });
  const leadCode = sanitizeTrackingValue(crmResult.leadCode);
  const status = sanitizeTrackingValue(crmResult.status);

  if (leadCode) params.set("lead", leadCode);
  if (status) params.set("status", status);

  return `thank-you.html?${params.toString()}`;
}

function sanitizeTrackingValue(value) {
  return String(value || "")
    .replace(/[^a-z0-9_-]/gi, "")
    .slice(0, 80);
}
