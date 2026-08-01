(function setupPremiumGallery() {
  "use strict";

  const root = document.querySelector("[data-gallery-carousel]");
  const sourceItems = Array.isArray(window.BFM_GALLERY_ITEMS) ? window.BFM_GALLERY_ITEMS : [];
  if (!root || !sourceItems.length) return;

  const track = root.querySelector("[data-gallery-track]");
  const filters = root.querySelector("[data-gallery-filters]");
  const previousButton = root.querySelector("[data-gallery-previous]");
  const nextButton = root.querySelector("[data-gallery-next]");
  const pagination = root.querySelector("[data-gallery-pagination]");
  const counter = root.querySelector("[data-gallery-counter]");
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
  let dragCandidate = false;
  let isDragging = false;
  let dragPointerId = null;
  let pointerStartX = 0;
  let pointerStartY = 0;
  let pointerDeltaX = 0;
  let blockNextClick = false;
  let lightboxOpen = false;
  let lightboxTrigger = null;
  let manualPauseUntil = 0;
  let lastAdvance = Date.now();

  const categories = [...new Set(sourceItems.map((item) => item.category).filter(Boolean))];

  function createFilters() {
    filters.replaceChildren();
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
    createPagination();
    updateSlides();
  }

  function createSlide(item, index) {
    const figure = document.createElement("figure");
    figure.className = "gallery-carousel-card";
    figure.dataset.galleryIndex = String(index);
    figure.dataset.mediaType = item.type;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "gallery-media-button";

    const mediaShell = document.createElement("span");
    mediaShell.className = "gallery-media-shell";

    const image = document.createElement("img");
    image.className = `gallery-card-media${item.type === "video" ? " gallery-video-poster" : ""}`;
    image.alt = item.alt;
    image.width = item.width;
    image.height = item.height;
    image.decoding = "async";
    image.loading = index === 0 ? "eager" : "lazy";
    image.sizes = "(max-width: 680px) 72vw, (max-width: 1080px) 46vw, 352px";
    image.style.objectPosition = item.objectPosition || "center";
    image.dataset.src = item.type === "video" ? (item.poster || "") : item.src;
    if (item.type !== "video" && item.srcSet) image.dataset.srcset = item.srcSet;
    image.addEventListener("load", () => figure.classList.add("is-loaded"), { once: true });
    image.addEventListener("error", () => showCardFallback(figure, mediaShell), { once: true });
    mediaShell.appendChild(image);

    if (item.type === "video") {
      mediaShell.appendChild(createPlayIcon());
      if (!item.poster) showCardFallback(figure, mediaShell);
    }

    const caption = document.createElement("figcaption");
    const categoryLabel = document.createElement("span");
    const captionText = document.createElement("strong");
    categoryLabel.textContent = item.category;
    captionText.textContent = item.caption;
    caption.append(categoryLabel, captionText);
    button.append(mediaShell, caption);
    button.addEventListener("click", () => {
      if (blockNextClick) return;
      if (index !== activeIndex) {
        moveToIndex(index, true);
        return;
      }
      openLightbox(item, button);
    });
    figure.appendChild(button);
    return figure;
  }

  function createPlayIcon() {
    const icon = document.createElement("span");
    icon.className = "gallery-play-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = "<svg viewBox=\"0 0 24 24\" width=\"22\" height=\"22\" aria-hidden=\"true\"><path d=\"M8 5v14l11-7z\" fill=\"currentColor\"/></svg>";
    return icon;
  }

  function showCardFallback(figure, mediaShell) {
    figure.classList.add("is-loaded", "has-media-error");
    if (mediaShell.querySelector(".gallery-card-fallback")) return;
    const fallback = document.createElement("span");
    fallback.className = "gallery-card-fallback";
    fallback.textContent = "Preview unavailable";
    mediaShell.appendChild(fallback);
  }

  function createPagination() {
    if (!pagination) return;
    pagination.replaceChildren();
    items.forEach((item, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "gallery-dot";
      button.dataset.galleryDot = String(index);
      button.setAttribute("aria-label", `Show gallery item ${index + 1}: ${item.caption}`);
      button.addEventListener("click", () => moveToIndex(index, true));
      pagination.appendChild(button);
    });
  }

  function loadSlide(index, priority = false) {
    if (!slides.length) return;
    const normalized = (index + slides.length) % slides.length;
    const slide = slides[normalized];
    const image = slide?.querySelector("img.gallery-card-media");
    if (!image || image.src || !image.dataset.src) return;
    if (image.dataset.srcset) image.srcset = image.dataset.srcset;
    if (priority) image.fetchPriority = "high";
    image.src = image.dataset.src;
  }

  function updateSlides({ announceChange = false } = {}) {
    if (!slides.length) return;
    const previousIndex = (activeIndex - 1 + slides.length) % slides.length;
    const nextIndex = (activeIndex + 1) % slides.length;

    slides.forEach((slide, index) => {
      const isActive = index === activeIndex;
      const isPrevious = slides.length > 2 && index === previousIndex;
      const isNext = slides.length > 1 && index === nextIndex;
      const isVisible = isActive || isPrevious || isNext;
      const button = slide.querySelector("button");
      const item = items[index];

      slide.classList.toggle("is-active", isActive);
      slide.classList.toggle("is-previous", isPrevious);
      slide.classList.toggle("is-next", isNext);
      slide.classList.toggle("is-hidden", !isVisible);
      slide.setAttribute("aria-hidden", String(!isVisible));
      button.tabIndex = isVisible ? 0 : -1;

      if (isActive) {
        button.setAttribute("aria-label", `${item.type === "video" ? "Play video" : "Open image"}: ${item.caption}`);
      } else if (isPrevious) {
        button.setAttribute("aria-label", `Show previous gallery item: ${item.caption}`);
      } else if (isNext) {
        button.setAttribute("aria-label", `Show next gallery item: ${item.caption}`);
      } else {
        button.removeAttribute("aria-label");
      }
    });

    loadSlide(activeIndex, activeIndex === 0);
    loadSlide(previousIndex);
    loadSlide(nextIndex);
    updatePagination();
    pauseEveryVideo();
    root.dataset.activeType = items[activeIndex]?.type || "image";
    if (announceChange) announce(`${activeIndex + 1} of ${items.length}: ${items[activeIndex].caption}`);
  }

  function updatePagination() {
    pagination?.querySelectorAll("[data-gallery-dot]").forEach((dot, index) => {
      const isActive = index === activeIndex;
      dot.classList.toggle("is-active", isActive);
      dot.setAttribute("aria-current", isActive ? "true" : "false");
    });
    if (counter) counter.textContent = `${activeIndex + 1} / ${items.length}`;
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

  function noteInteraction(duration = 6500) {
    manualPauseUntil = Date.now() + duration;
    lastAdvance = Date.now();
  }

  function announce(message) {
    if (status) status.textContent = message;
  }

  function pauseEveryVideo(except = null) {
    document.querySelectorAll("#gallery-lightbox video").forEach((video) => {
      if (video !== except) video.pause();
    });
  }

  function canAutoAdvance() {
    return !reducedMotion.matches && isInView && !document.hidden && !isHovered && !hasFocus && !dragCandidate && !isDragging && !lightboxOpen && Date.now() >= manualPauseUntil;
  }

  function inferVideoType(item) {
    if (item.mimeType) return item.mimeType;
    return item.src.toLowerCase().endsWith(".webm") ? "video/webm" : "video/mp4";
  }

  function openLightbox(item, trigger) {
    if (!dialog || !dialogMedia || !dialogCaption) return;
    lightboxOpen = true;
    lightboxTrigger = trigger;
    noteInteraction();
    pauseEveryVideo();
    dialogMedia.replaceChildren();
    dialogMedia.classList.add("is-loading");

    if (item.type === "video") {
      const video = document.createElement("video");
      const source = document.createElement("source");
      source.src = item.src;
      source.type = inferVideoType(item);
      video.poster = item.poster || "";
      video.controls = true;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = "metadata";
      video.setAttribute("aria-label", item.alt);
      video.addEventListener("loadeddata", () => dialogMedia.classList.remove("is-loading"), { once: true });
      video.addEventListener("error", () => showLightboxError("This video could not be played. Please try again later."), { once: true });
      video.appendChild(source);
      dialogMedia.appendChild(video);
      dialog.showModal();
      dialogClose?.focus();
      video.play().catch(() => {
        dialogMedia.classList.remove("is-loading");
      });
    } else {
      const image = document.createElement("img");
      image.src = item.src;
      if (item.srcSet) image.srcset = item.srcSet;
      image.alt = item.alt;
      image.width = item.width;
      image.height = item.height;
      image.addEventListener("load", () => dialogMedia.classList.remove("is-loading"), { once: true });
      image.addEventListener("error", () => showLightboxError("This photo could not be loaded. Please try again later."), { once: true });
      dialogMedia.appendChild(image);
      dialog.showModal();
      dialogClose?.focus();
    }

    dialogCaption.textContent = item.caption;
  }

  function showLightboxError(message) {
    dialogMedia?.classList.remove("is-loading");
    dialogMedia?.replaceChildren();
    const fallback = document.createElement("div");
    fallback.className = "gallery-lightbox-error";
    fallback.setAttribute("role", "alert");
    fallback.textContent = message;
    dialogMedia?.appendChild(fallback);
  }

  function closeLightbox() {
    if (!dialog?.open) return;
    const video = dialogMedia?.querySelector("video");
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
    dialog.close();
  }

  function finishLightboxClose() {
    lightboxOpen = false;
    dialogMedia?.classList.remove("is-loading");
    dialogMedia?.replaceChildren();
    lastAdvance = Date.now();
    lightboxTrigger?.focus();
    lightboxTrigger = null;
  }

  function resetDrag() {
    dragCandidate = false;
    isDragging = false;
    dragPointerId = null;
    pointerDeltaX = 0;
    track.classList.remove("is-dragging");
    track.style.removeProperty("--gallery-drag-x");
  }

  previousButton?.addEventListener("click", () => move(-1, true));
  nextButton?.addEventListener("click", () => move(1, true));

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
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    move(event.key === "ArrowLeft" ? -1 : 1, true);
    slides[activeIndex]?.querySelector("button")?.focus();
  });

  track.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    dragCandidate = true;
    dragPointerId = event.pointerId;
    pointerStartX = event.clientX;
    pointerStartY = event.clientY;
    pointerDeltaX = 0;
    blockNextClick = false;
    noteInteraction();
  });

  track.addEventListener("pointermove", (event) => {
    if (!dragCandidate || event.pointerId !== dragPointerId) return;
    const deltaX = event.clientX - pointerStartX;
    const deltaY = event.clientY - pointerStartY;

    if (!isDragging) {
      if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) return;
      if (event.pointerType !== "mouse" && Math.abs(deltaY) > Math.abs(deltaX)) {
        resetDrag();
        return;
      }
      isDragging = true;
      blockNextClick = true;
      track.classList.add("is-dragging");
      track.setPointerCapture?.(event.pointerId);
    }

    event.preventDefault();
    pointerDeltaX = Math.max(-120, Math.min(120, deltaX));
    track.style.setProperty("--gallery-drag-x", `${pointerDeltaX}px`);
  });

  function endDrag(event) {
    if (!dragCandidate || event.pointerId !== dragPointerId) return;
    const completedDrag = isDragging;
    const completedDelta = pointerDeltaX;
    if (completedDrag && track.hasPointerCapture?.(event.pointerId)) {
      track.releasePointerCapture(event.pointerId);
    }
    resetDrag();
    if (completedDrag && Math.abs(completedDelta) >= 42) {
      move(completedDelta < 0 ? 1 : -1, true);
    } else {
      noteInteraction();
    }
    if (completedDrag) window.setTimeout(() => { blockNextClick = false; }, 250);
  }

  track.addEventListener("pointerup", endDrag);
  track.addEventListener("pointercancel", (event) => {
    if (event.pointerId !== dragPointerId) return;
    resetDrag();
    window.setTimeout(() => { blockNextClick = false; }, 250);
  });

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
  dialog?.addEventListener("close", finishLightboxClose);

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(([entry]) => {
      isInView = entry.isIntersecting;
      if (!isInView) pauseEveryVideo();
      else lastAdvance = Date.now();
    }, { rootMargin: "160px 0px", threshold: 0.08 });
    observer.observe(root);
  }

  createFilters();
  renderSlides();
  root.classList.add("is-ready");

  if (window.location.hash === "#gallery") {
    const alignGalleryHash = () => root.closest("#gallery")?.scrollIntoView({ block: "start", behavior: "auto" });
    window.requestAnimationFrame(alignGalleryHash);
    window.addEventListener("load", () => window.setTimeout(alignGalleryHash, 120), { once: true });
  }

  window.setInterval(() => {
    if (canAutoAdvance() && Date.now() - lastAdvance >= 5000) move(1);
  }, 500);
})();
