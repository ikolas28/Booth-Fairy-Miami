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
    const response = await fetch(form.action, {
      method: form.method,
      body: new FormData(form),
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Form submission failed");
    }

    button.textContent = "Inquiry Sent";
    form.reset();
    setTimeout(() => {
      window.location.href = "thank-you.html";
    }, 500);
  } catch (error) {
    button.textContent = "Try Again";
  } finally {
    setTimeout(() => {
      button.textContent = originalText;
      button.disabled = false;
    }, 1800);
  }
});
