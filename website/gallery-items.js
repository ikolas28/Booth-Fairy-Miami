/*
 * Booth Fairy Miami homepage gallery.
 *
 * ADD A PHOTO: copy a JPG, PNG, or WebP into assets/gallery/, then duplicate an
 * image item below and update src, srcSet, width, height, category, alt, caption,
 * and (when needed) objectPosition.
 *
 * ADD A VIDEO: copy an MP4 or WebM plus a poster image into assets/gallery/, then
 * duplicate the video item. Keep videos short and supply a poster so the page
 * does not download the full video until its card becomes active.
 */
window.BFM_GALLERY_ITEMS = Object.freeze([
  {
    src: "assets/gallery/white-dslr-booth-1400.webp",
    srcSet: "assets/gallery/white-dslr-booth-800.webp 800w, assets/gallery/white-dslr-booth-1400.webp 1400w",
    type: "image",
    category: "Booth Setups",
    alt: "White Booth Fairy Miami DSLR photo booth with studio flash and printer",
    caption: "The complete white DSLR booth, studio flash, and print station",
    width: 1400,
    height: 1867,
    objectPosition: "center 48%",
  },
  {
    src: "assets/gallery/props-1400.webp",
    srcSet: "assets/gallery/props-800.webp 800w, assets/gallery/props-1400.webp 1400w",
    type: "image",
    category: "Booth Setups",
    alt: "Colorful party props prepared for a Booth Fairy Miami birthday event",
    caption: "Playful event props, ready for every pose",
    width: 1400,
    height: 1867,
    objectPosition: "center center",
  },
  {
    src: "assets/gallery/countdown.mp4",
    type: "video",
    mimeType: "video/mp4",
    category: "Videos",
    alt: "Booth Fairy Miami photo booth countdown screen in action",
    caption: "The booth countdown before the camera captures the moment",
    poster: "assets/gallery/countdown-poster-800.webp",
    width: 1080,
    height: 1920,
    objectPosition: "center center",
  },
  {
    src: "assets/gallery/white-dslr-photo-booth-1400.webp",
    srcSet: "assets/gallery/white-dslr-photo-booth-800.webp 800w, assets/gallery/white-dslr-photo-booth-1400.webp 1400w",
    type: "image",
    category: "Booth Setups",
    alt: "Close view of a white DSLR photo booth with umbrella flash at a real event setup",
    caption: "A polished welcome screen paired with studio-quality lighting",
    width: 1400,
    height: 1867,
    objectPosition: "center 42%",
  },
  {
    src: "assets/print-booth/print-booth-03.webp",
    type: "image",
    category: "Booth Setups",
    alt: "Booth Fairy Miami DSLR photo booth glowing at a poolside event",
    caption: "A real Miami setup, styled and ready for guests",
    width: 1350,
    height: 1800,
    objectPosition: "center center",
  },
  {
    src: "assets/keepsake-addons/magnetic-photo-strips-detail.webp",
    type: "image",
    category: "Prints",
    alt: "Close-up of personalized Booth Fairy Miami magnetic photo strips",
    caption: "Personalized 2x6 photo strips guests can display at home",
    width: 1200,
    height: 1600,
    objectPosition: "center center",
  },
  {
    src: "assets/keepsake-addons/custom-photo-keychains.webp",
    type: "image",
    category: "Keepsakes",
    alt: "Custom photo keychain made from a Booth Fairy Miami event portrait",
    caption: "Custom photo keychains made from event portraits",
    width: 1200,
    height: 1600,
    objectPosition: "center center",
  },
  {
    src: "assets/print-booth/video-thumb-05.webp",
    type: "image",
    category: "Booth Setups",
    alt: "Premium greenery backdrop used for a Booth Fairy Miami photo booth event",
    caption: "A premium greenery backdrop for an elegant finish",
    width: 1080,
    height: 1440,
    objectPosition: "center center",
  },
]);
