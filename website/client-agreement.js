const AGREEMENT_STORAGE_KEY = "bfmClientAgreementDraft";
const form = document.getElementById("client-agreement-form");

function loadAgreementDraft() {
  try {
    const saved = JSON.parse(localStorage.getItem(AGREEMENT_STORAGE_KEY) || "{}");
    Object.entries(saved).forEach(([key, value]) => {
      const field = form.elements[key];
      if (field) field.value = value;
    });
  } catch {
    // Ignore broken local drafts.
  }

  if (!form.elements.signedDate.value) {
    form.elements.signedDate.value = new Date().toISOString().slice(0, 10);
  }
}

function getAgreementData() {
  return Object.fromEntries(new FormData(form).entries());
}

document.getElementById("save-agreement-button")?.addEventListener("click", () => {
  localStorage.setItem(AGREEMENT_STORAGE_KEY, JSON.stringify(getAgreementData()));
  alert("Agreement draft saved in this browser.");
});

document.getElementById("print-agreement-button")?.addEventListener("click", () => {
  if (!form.reportValidity()) return;
  localStorage.setItem(AGREEMENT_STORAGE_KEY, JSON.stringify(getAgreementData()));
  window.print();
});

document.getElementById("clear-agreement-button")?.addEventListener("click", () => {
  if (!confirm("Clear the agreement draft from this browser?")) return;
  localStorage.removeItem(AGREEMENT_STORAGE_KEY);
  form.reset();
  form.elements.signedDate.value = new Date().toISOString().slice(0, 10);
});

form?.addEventListener("input", () => {
  localStorage.setItem(AGREEMENT_STORAGE_KEY, JSON.stringify(getAgreementData()));
});

loadAgreementDraft();
