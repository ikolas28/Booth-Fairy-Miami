# Homepage gallery media

Put real Booth Fairy Miami gallery media in this folder.

- Photos: JPG, PNG, or WebP. WebP is preferred for speed.
- Short videos: MP4 or WebM, plus a JPG/PNG/WebP poster image.
- Add the new entry to `website/gallery-items.js`; that file documents every supported field.
- Use accurate alt text and choose an existing category, or add a new category. A filter appears only when at least one item uses it.
- Keep the original aspect ratio. The carousel crops with `object-fit: cover`; use `objectPosition` on the item when a face or booth needs reframing.

The carousel eagerly requests only its first visible image, loads adjacent previews as needed, and gives full videos `preload="metadata"` only when active.
