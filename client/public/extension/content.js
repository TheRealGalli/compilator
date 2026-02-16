"use strict";
(() => {
  // extension_src/content.ts
  document.documentElement.setAttribute("data-gromit-bridge-active", "true");
  console.log("[GromitBridge] Content Script inizializzato.");
  var sessionPort = chrome.runtime.connect({ name: "GROMIT_SESSION" });
  window.addEventListener("GROMIT_BRIDGE_REQUEST", (event) => {
    const { detail, requestId } = event.detail;
    const sendWithRetry = (retry = true) => {
      try {
        chrome.runtime.sendMessage(detail, (response) => {
          if (chrome.runtime.lastError) {
            const error = chrome.runtime.lastError.message;
            console.warn(`[GromitBridge] Message error: ${error}`);
            if (retry && error?.includes("Could not establish connection")) {
              console.log("[GromitBridge] Retrying message in 500ms...");
              setTimeout(() => sendWithRetry(false), 500);
              return;
            }
            window.dispatchEvent(new CustomEvent("GROMIT_BRIDGE_RESPONSE", {
              detail: { response: { success: false, error }, requestId }
            }));
            return;
          }
          window.dispatchEvent(new CustomEvent("GROMIT_BRIDGE_RESPONSE", {
            detail: { response, requestId }
          }));
        });
      } catch (err) {
        console.error("[GromitBridge] Send Exception:", err);
        window.dispatchEvent(new CustomEvent("GROMIT_BRIDGE_RESPONSE", {
          detail: { response: { success: false, error: err.message }, requestId }
        }));
      }
    };
    sendWithRetry();
  });
  console.log("[GromitBridge] Content Script attivo e pronto. Session Port aperta.");
})();
