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
    threshold: 0.18,
    rootMargin: "0px 0px -40px 0px",
  }
);

document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));

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

  try {
    const formData = new FormData(form);
    const turnstileToken = formData.get("cf-turnstile-response");
    if (requiresTurnstile && !turnstileToken) {
      throw new Error("Please complete the verification.");
    }

    const crmPayload = Object.fromEntries(formData.entries());
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

    const response = await fetch(form.action, {
      method: form.method,
      body: formData,
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok && requiresTurnstile) {
      throw new Error("Form submission failed");
    }

    button.textContent = "Inquiry Sent";
    form.reset();
    window.turnstile?.reset();
    setTimeout(() => {
      window.location.href = "thank-you.html";
    }, 500);
  } catch (error) {
    button.textContent = "Try Again";
    window.turnstile?.reset();
  } finally {
    setTimeout(() => {
      button.textContent = originalText;
      button.disabled = false;
    }, 1800);
  }
});
