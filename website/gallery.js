(function () {
  const slug = getSlug();
  const sessionId = getSessionId();
  const elements = {
    loading: document.getElementById("loading-state"),
    access: document.getElementById("access-state"),
    message: document.getElementById("message-state"),
    embed: document.getElementById("embed-section"),
    cta: document.getElementById("gallery-cta"),
    frame: document.getElementById("touchpix-frame"),
    title: document.getElementById("gallery-title"),
    meta: document.getElementById("event-meta"),
    welcome: document.getElementById("welcome-message"),
    notice: document.getElementById("expiration-notice"),
    messageTitle: document.getElementById("message-title"),
    messageCopy: document.getElementById("message-copy"),
    accessForm: document.getElementById("access-form"),
    accessCode: document.getElementById("access-code"),
    accessError: document.getElementById("access-error")
  };

  if (!slug) {
    showMessage("Gallery unavailable", "Please check the private gallery link or contact Booth Fairy Miami.");
    return;
  }

  elements.accessForm.addEventListener("submit", unlockGallery);
  document.querySelectorAll("[data-gallery-action]").forEach((link) => {
    const action = link.dataset.galleryAction;
    if (action === "book_photo_booth") {
      link.href = `/?gallery_ref=${encodeURIComponent(slug)}#quote-form`;
    }
    link.addEventListener("click", () => {
      track("button_click", { buttonName: action });
      window.bfmTrackEvent?.("gallery_button_click", {
        gallery_slug: slug,
        button_name: action
      });
    });
  });

  loadGallery();

  async function loadGallery() {
    try {
      const response = await fetch(`/api/gallery/resolve?slug=${encodeURIComponent(slug)}`, {
        credentials: "same-origin",
        headers: { Accept: "application/json" }
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 401 && payload.status === "locked") {
        showOnly(elements.access);
        elements.accessCode.focus();
        return;
      }
      if (!response.ok || !payload.ok) {
        showMessage("Gallery unavailable", payload.error || "Please contact Booth Fairy Miami for assistance.");
        return;
      }
      renderGallery(payload);
    } catch {
      showMessage("Gallery unavailable", "We could not load this gallery. Please try again or contact Booth Fairy Miami.");
    }
  }

  async function unlockGallery(event) {
    event.preventDefault();
    const button = elements.accessForm.querySelector("button");
    elements.accessError.hidden = true;
    button.disabled = true;
    button.textContent = "Checking…";
    try {
      const response = await fetch("/api/gallery/access", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ slug, accessCode: elements.accessCode.value })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Access could not be verified.");
      elements.accessCode.value = "";
      renderGallery(payload);
    } catch (error) {
      elements.accessError.textContent = error.message;
      elements.accessError.hidden = false;
    } finally {
      button.disabled = false;
      button.textContent = "View Photos";
    }
  }

  function renderGallery(payload) {
    const gallery = payload.gallery || {};
    document.title = `${gallery.title || "Private Client Gallery"} | Booth Fairy Miami`;
    elements.title.textContent = gallery.title || "Your event photos";
    elements.welcome.textContent = gallery.welcomeMessage || "Welcome to your private Booth Fairy Miami gallery. We hope you enjoy reliving the fun, laughter, and special moments from your celebration. Please share this gallery only with invited guests.";
    renderMeta(gallery);
    if (gallery.expirationNotice) {
      elements.notice.textContent = gallery.expirationNotice;
      elements.notice.hidden = false;
    }
    elements.cta.hidden = false;
    track("gallery_visit");
    window.bfmTrackEvent?.("gallery_view", {
      gallery_slug: slug,
      gallery_status: payload.status
    });
    if (payload.status === "expired") {
      showMessage("This gallery has expired", gallery.expiredMessage || "This online gallery is no longer available. Please contact Booth Fairy Miami if you need assistance accessing your event photos.", true);
      return;
    }
    if (!gallery.embedUrl) {
      showMessage("Gallery unavailable", "Please contact Booth Fairy Miami for assistance.", true);
      return;
    }
    elements.frame.src = gallery.embedUrl;
    showOnly(elements.embed);
    elements.cta.hidden = false;
  }

  function renderMeta(gallery) {
    const values = [];
    if (gallery.clientName) values.push(gallery.clientName);
    if (gallery.eventDate) {
      const date = new Date(`${gallery.eventDate}T12:00:00`);
      values.push(new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(date));
    }
    elements.meta.replaceChildren(...values.map((value) => {
      const span = document.createElement("span");
      span.textContent = value;
      return span;
    }));
    elements.meta.hidden = !values.length;
  }

  function showMessage(title, copy, preserveIntro) {
    if (!preserveIntro) {
      elements.title.textContent = title;
      elements.welcome.textContent = copy;
    }
    elements.messageTitle.textContent = title;
    elements.messageCopy.textContent = copy;
    showOnly(elements.message);
  }

  function showOnly(active) {
    [elements.loading, elements.access, elements.message, elements.embed].forEach((element) => {
      element.hidden = element !== active;
    });
  }

  function track(eventType, extra = {}) {
    fetch("/api/gallery/event", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, eventType, sessionId, ...extra })
    }).catch(() => null);
  }

  function getSlug() {
    const parts = window.location.pathname.split("/").filter(Boolean);
    if (parts[0] !== "gallery" || !parts[1]) return "";
    return parts[1].toLowerCase();
  }

  function getSessionId() {
    const key = "bfmGallerySession";
    try {
      let value = sessionStorage.getItem(key);
      if (!value) {
        value = crypto.randomUUID();
        sessionStorage.setItem(key, value);
      }
      return value;
    } catch {
      return "";
    }
  }
})();
