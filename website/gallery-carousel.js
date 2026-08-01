(function setupPremiumGallery() {
  "use strict";

  const root = document.querySelector("[data-gallery-carousel]");
  const sourceItems = Array.isArray(window.BFM_GALLERY_ITEMS) ? window.BFM_GALLERY_ITEMS : [];
  if (!root || !sourceItems.length) return;

  const track = root.querySelector("[data-gallery-track]");
  const filters = root.querySelector("[data-gallery-filters]");
  const previousButton = root.querySelector("[data-gallery-previous]");
  const nextButton = root.querySelector("[data-gallery-next]");
  const status = root.querySelector("[data-gallery-status]");
  const dialog = document.querySelector("#gallery-lightbox");
  const dialogMedia = dialog?.querySelector("[data-lightbox-media]");
  const dialogCaption = dialog?.querySelector("[data-lightbox-caption]");
  const dialogClose = dialog?.querySelector("[data-lightbox-close]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let items = [...sourceItems];
  let activeIndex = 0;
  let slides = [];
  let activeFilter = "All";
  let isInView = true;
  let isHovered = false;
  let hasFocus = false;
  let isDragging = false;
  let lightboxOpen = false;
  let manualPauseUntil = 0;
  let lastAdvance = Date.now();
  let pointerStartX = 0;
  let pointerDeltaX = 0;
  let suppressClick = false;

  const categories = [...new Set(sourceItems.map((item) => item.category).filter(Boolean))];

  function createFilters() {
    ["All", ...categories].forEach((category) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "gallery-filter";
      button.textContent = category;
      button.dataset.galleryFilter = category;
      button.setAttribute("aria-pressed", String(category === activeFilter));
      button.addEventListener("click", () => applyFilter(category));
      filters.appendChild(button);
    });
  }

  function applyFilter(category) {
    activeFilter = category;
    items = category === "All" ? [...sourceItems] : sourceItems.filter((item) => item.category === category);
    activeIndex = 0;
    filters.querySelectorAll("[data-gallery-filter]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.galleryFilter === category));
    });
    renderSlides();
    noteInteraction();
    announce(`${category} gallery selected. ${items.length} ${items.length === 1 ? "item" : "items"}.`);
  }

  function renderSlides() {
    pauseEveryVideo();
    track.replaceChildren();
    slides = items.map((item, index) => createSlide(item, index));
    track.append(...slides);
    updateSlides({ announceChange: false });
  }

  function createSlide(item, index) {
    const figure = document.createElement("figure");
    figure.className = "gallery-carousel-card";
    figure.dataset.galleryIndex = String(index);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "gallery-media-button";
    button.setAttribute("aria-label", `${item.type === "video" ? "Play" : "Enlarge"}: ${item.caption}`);

    const mediaShell = document.createElement("span");
    mediaShell.className = "gallery-media-shell";

    if (item.type === "video") {
      const video = document.createElement("video");
      video.className = "gallery-card-media";
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = "metadata";
      video.dataset.poster = item.poster || "";
      video.setAttribute("aria-label", item.alt);
      video.style.objectPosition = item.objectPosition || "center";
      video.addEventListener("play", pauseOtherVideos);
      mediaShell.append(video, createPlayIcon());
    } else {
      const image = document.createElement("img");
      image.className = "gallery-card-media";
      image.alt = item.alt;
      image.width = item.width;
      image.height = item.height;
      image.decoding = "async";
      image.loading = index === 0 ? "eager" : "lazy";
      image.sizes = "(max-width: 680px) 78vw, (max-width: 1080px) 56vw, 540px";
      image.style.objectPosition = item.objectPosition || "center";
      image.addEventListener("load", () => figure.classList.add("is-loaded"), { once: true });
      mediaShell.appendChild(image);
    }

    const caption = document.createElement("figcaption");
    const categoryLabel = document.createElement("span");
    const captionText = document.createElement("strong");
    categoryLabel.textContent = item.category;
    captionText.textContent = item.caption;
    caption.append(categoryLabel, captionText);
    button.append(mediaShell, caption);
    button.addEventListener("click", () => {
      if (suppressClick) return;
      if (index !== activeIndex) {
        moveToIndex(index, true);
        return;
      }
      openLightbox(item);
    });
    figure.appendChild(button);
    return figure;
  }

  function createPlayIcon() {
    const icon = document.createElement("span");
    icon.className = "gallery-play-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = "<svg viewBox=\"0 0 24 24\" width=\"22\" height=\"22\"><path d=\"M8 5v14l11-7z\" fill=\"currentColor\"/></svg>";
    return icon;
  }

  function loadSlide(index, priority = false) {
    if (!slides.length) return;
    const normalized = (index + slides.length) % slides.length;
    const slide = slides[normalized];
    const item = items[normalized];
    if (!slide || !item) return;

    const image = slide.querySelector("img.gallery-card-media");
    if (image && !image.src) {
      if (item.srcSet) image.srcset = item.srcSet;
      image.src = item.src;
      if (priority) image.fetchPriority = "high";
    }

    const video = slide.querySelector("video");
    if (video && !video.poster && item.poster) {
      video.poster = item.poster;
    }
    if (video && normalized === activeIndex && !video.src) {
      video.src = item.src;
      video.load();
    }
  }

  function updateSlides({ announceChange = false } = {}) {
    if (!slides.length) return;
    const previousIndex = (activeIndex - 1 + slides.length) % slides.length;
    const nextIndex = (activeIndex + 1) % slides.length;

    slides.forEach((slide, index) => {
      const isActive = index === activeIndex;
      const isPrevious = slides.length > 1 && index === previousIndex;
      const isNext = slides.length > 1 && index === nextIndex;
      slide.classList.toggle("is-active", isActive);
      slide.classList.toggle("is-previous", isPrevious);
      slide.classList.toggle("is-next", isNext);
      slide.classList.toggle("is-hidden", !isActive && !isPrevious && !isNext);
      slide.setAttribute("aria-hidden", String(!isActive));
      slide.querySelector("button").tabIndex = isActive ? 0 : -1;
      const video = slide.querySelector("video");
      if (video && !isActive) {
        video.pause();
        video.currentTime = 0;
      }
    });

    loadSlide(activeIndex, activeIndex === 0);
    loadSlide(previousIndex);
    loadSlide(nextIndex);
    // Gallery videos stay on their poster frame until the visitor explicitly
    // clicks the active card. That click opens the controlled lightbox.
    pauseEveryVideo();
    root.dataset.activeType = items[activeIndex]?.type || "image";
    if (announceChange) announce(`${activeIndex + 1} of ${items.length}: ${items[activeIndex].caption}`);
  }

  function move(direction, manual = false) {
    if (items.length < 2) return;
    activeIndex = (activeIndex + direction + items.length) % items.length;
    if (manual) noteInteraction();
    else lastAdvance = Date.now();
    updateSlides({ announceChange: manual });
  }

  function moveToIndex(index, manual = false) {
    if (index === activeIndex || index < 0 || index >= items.length) return;
    activeIndex = index;
    if (manual) noteInteraction();
    updateSlides({ announceChange: manual });
  }

  function noteInteraction(duration = 7000) {
    manualPauseUntil = Date.now() + duration;
    lastAdvance = Date.now();
  }

  function announce(message) {
    status.textContent = message;
  }

  function pauseEveryVideo(except = null) {
    document.querySelectorAll(".gallery-card-media[type], .gallery-card-media, #gallery-lightbox video").forEach((media) => {
      if (media instanceof HTMLVideoElement && media !== except) media.pause();
    });
  }

  function pauseOtherVideos(event) {
    pauseEveryVideo(event.currentTarget);
  }

  function canAutoAdvance() {
    return !reducedMotion.matches && isInView && !document.hidden && !isHovered && !hasFocus && !isDragging && !lightboxOpen && Date.now() >= manualPauseUntil;
  }

  function openLightbox(item) {
    if (!dialog || !dialogMedia) return;
    lightboxOpen = true;
    noteInteraction();
    pauseEveryVideo();
    dialogMedia.replaceChildren();

    if (item.type === "video") {
      const video = document.createElement("video");
      video.src = item.src;
      video.poster = item.poster || "";
      video.controls = true;
      video.autoplay = true;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = "metadata";
      video.setAttribute("aria-label", item.alt);
      dialogMedia.appendChild(video);
    } else {
      const image = document.createElement("img");
      image.src = item.src;
      if (item.srcSet) image.srcset = item.srcSet;
      image.alt = item.alt;
      image.width = item.width;
      image.height = item.height;
      dialogMedia.appendChild(image);
    }

    dialogCaption.textContent = item.caption;
    dialog.showModal();
    dialogClose.focus();
  }

  function closeLightbox() {
    if (!dialog?.open) return;
    pauseEveryVideo();
    dialog.close();
  }

  function finishLightboxClose() {
    lightboxOpen = false;
    dialogMedia?.replaceChildren();
    lastAdvance = Date.now();
    pauseEveryVideo();
  }

  previousButton.addEventListener("click", () => move(-1, true));
  nextButton.addEventListener("click", () => move(1, true));

  root.addEventListener("mouseenter", () => { isHovered = true; });
  root.addEventListener("mouseleave", () => { isHovered = false; lastAdvance = Date.now(); });
  root.addEventListener("focusin", () => { hasFocus = true; });
  root.addEventListener("focusout", (event) => {
    if (!root.contains(event.relatedTarget)) {
      hasFocus = false;
      lastAdvance = Date.now();
    }
  });

  track.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      move(event.key === "ArrowLeft" ? -1 : 1, true);
      slides[activeIndex]?.querySelector("button")?.focus();
    }
  });

  track.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    isDragging = true;
    pointerStartX = event.clientX;
    pointerDeltaX = 0;
    suppressClick = false;
    track.classList.add("is-dragging");
    track.setPointerCapture?.(event.pointerId);
  });

  track.addEventListener("pointermove", (event) => {
    if (!isDragging) return;
    pointerDeltaX = Math.max(-140, Math.min(140, event.clientX - pointerStartX));
    if (Math.abs(pointerDeltaX) > 8) suppressClick = true;
    track.style.setProperty("--gallery-drag-x", `${pointerDeltaX}px`);
  });

  function endDrag(event) {
    if (!isDragging) return;
    isDragging = false;
    track.releasePointerCapture?.(event.pointerId);
    track.classList.remove("is-dragging");
    track.style.removeProperty("--gallery-drag-x");
    if (Math.abs(pointerDeltaX) >= 45) move(pointerDeltaX < 0 ? 1 : -1, true);
    else noteInteraction();
    window.setTimeout(() => { suppressClick = false; }, 0);
  }

  track.addEventListener("pointerup", endDrag);
  track.addEventListener("pointercancel", endDrag);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pauseEveryVideo();
    else lastAdvance = Date.now();
  });

  reducedMotion.addEventListener?.("change", () => {
    lastAdvance = Date.now();
    pauseEveryVideo();
  });

  dialogClose?.addEventListener("click", closeLightbox);
  dialog?.addEventListener("click", (event) => {
    if (event.target === dialog) closeLightbox();
  });
  dialog?.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeLightbox();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && dialog?.open) closeLightbox();
  });
  dialog?.addEventListener("close", finishLightboxClose);

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(([entry]) => {
      isInView = entry.isIntersecting;
      if (!isInView) pauseEveryVideo();
      else lastAdvance = Date.now();
    }, { rootMargin: "500px 0px", threshold: 0.05 });
    observer.observe(root);
  }

  createFilters();
  renderSlides();
  root.classList.add("is-ready");
  window.setInterval(() => {
    if (canAutoAdvance() && Date.now() - lastAdvance >= 5000) move(1, false);
  }, 500);
})();
