// extension_src/content.ts
document.documentElement.setAttribute("data-gromit-bridge-active", "true");
console.log("[GromitBridge] Content Script inizializzato.");
window.addEventListener("GROMIT_BRIDGE_REQUEST", (event) => {
  const { detail, requestId } = event.detail;
  chrome.runtime.sendMessage(detail, (response) => {
    window.dispatchEvent(new CustomEvent("GROMIT_BRIDGE_RESPONSE", {
      detail: { response, requestId }
    }));
  });
});
console.log("[GromitBridge] Content Script attivo e pronto.");
//# sourceMappingURL=content.js.map
