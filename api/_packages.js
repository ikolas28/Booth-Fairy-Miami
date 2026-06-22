const PHOTO_BOOTH_PACKAGES = Object.freeze([
  Object.freeze({ hours: 2, total: 450, deposit: 225, label: "DSLR Print Photo Booth - 2 Hours ($450)" }),
  Object.freeze({ hours: 3, total: 575, deposit: 287.5, label: "DSLR Print Photo Booth - 3 Hours ($575)" }),
  Object.freeze({ hours: 4, total: 700, deposit: 350, label: "DSLR Print Photo Booth - 4 Hours ($700)" })
]);

function resolvePhotoBoothPackage(...values) {
  const text = values.filter(Boolean).join(" ").toLowerCase();
  if (!text || /photo booth \+ dj|dj \+ photo booth|bundle|premium dj/.test(text)) return null;
  if (/\b4\s*(?:-|\u2013)?\s*hours?\b|\b4-hour\b|\$\s*700\b/.test(text)) return PHOTO_BOOTH_PACKAGES[2];
  if (/\b3\s*(?:-|\u2013)?\s*hours?\b|\b3-hour\b|\$\s*575\b/.test(text)) return PHOTO_BOOTH_PACKAGES[1];
  if (/\b2\s*(?:-|\u2013)?\s*hours?\b|\b2-hour\b|\$\s*450\b/.test(text)) return PHOTO_BOOTH_PACKAGES[0];
  if (/dslr|photo booth|photobooth|print booth/.test(text)) return PHOTO_BOOTH_PACKAGES[0];
  return null;
}

function getPhotoBoothPackageLabel(...values) {
  return resolvePhotoBoothPackage(...values)?.label || "";
}

module.exports = {
  PHOTO_BOOTH_PACKAGES,
  getPhotoBoothPackageLabel,
  resolvePhotoBoothPackage
};
