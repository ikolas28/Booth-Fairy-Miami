(function () {
  const googleMeasurementId = "G-8D92QEYZ5H";

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () {
    window.dataLayer.push(arguments);
  };

  const googleScript = document.createElement("script");
  googleScript.async = true;
  googleScript.src = `https://www.googletagmanager.com/gtag/js?id=${googleMeasurementId}`;
  document.head.appendChild(googleScript);

  window.gtag("js", new Date());
  window.gtag("config", googleMeasurementId);

  if (window.location.pathname.endsWith("/thank-you.html")) {
    window.gtag("event", "generate_lead", {
      event_category: "engagement",
      event_label: "website_inquiry",
    });
  }

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
