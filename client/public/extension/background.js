"use strict";
(() => {
  // extension_src/background.ts
  var BRIDGE_VERSION = "v5.8.13";
  var OFFSCREEN_DOCUMENT_PATH = "offscreen.html";
  var activeSessions = 0;
  var creating = null;
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name === "GROMIT_SESSION") {
      console.log("[GromitBridge] \u26A1 Session Port Connected.");
      activeSessions++;
      port.onDisconnect.addListener(() => {
        activeSessions--;
        console.log(`[GromitBridge] \u{1F4F4} Session Port Disconnected (Remaining: ${activeSessions}).`);
        if (activeSessions <= 0) {
          closeOffscreenDocument();
        }
      });
    }
  });
  async function closeOffscreenDocument() {
    if (!creating) {
      try {
        await chrome.offscreen.closeDocument();
        console.log(`[GromitBridge] \u{1F6D1} Offscreen Document Closed. Session Ended (Active Sessions: ${activeSessions}).`);
      } catch (err) {
        console.debug("[GromitBridge] Offscreen already closed or invalid.");
      }
    }
  }
  async function setupOffscreenDocument(path) {
    const offscreenUrl = chrome.runtime.getURL(path);
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
      documentUrls: [offscreenUrl]
    });
    if (existingContexts.length > 0) {
      return;
    }
    if (creating) {
      await creating;
    } else {
      creating = chrome.offscreen.createDocument({
        url: path,
        reasons: [chrome.offscreen.Reason.DOM_PARSER],
        justification: "Parsing PDF and other document formats requires a full DOM environment."
      });
      await creating;
      creating = null;
    }
  }
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "GET_VERSION") {
      sendResponse({ version: BRIDGE_VERSION });
      return true;
    }
    if (request.type === "EXTRACT_AND_ANALYZE") {
      (async () => {
        try {
          await setupOffscreenDocument(OFFSCREEN_DOCUMENT_PATH);
          console.log("[GromitBridge] Forwarding extraction request to Offscreen Document...");
          const response = await chrome.runtime.sendMessage({
            type: "EXTRACT_FROM_OFFSCREEN",
            fileBase64: request.fileBase64,
            fileName: request.fileName,
            fileType: request.fileType
          });
          sendResponse(response);
        } catch (error) {
          console.error("[GromitBridge] Offscreen Proxy Error:", error);
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;
    }
    if (request.type === "OLLAMA_FETCH") {
      const { url, options } = request;
      console.log(`[GromitBridge ${BRIDGE_VERSION}] Fetching: ${url}`);
      const controller = new AbortController();
      const fetchTimeout = setTimeout(() => {
        controller.abort();
        console.warn(`[GromitBridge ${BRIDGE_VERSION}] Fetch ABORTED after 120s: ${url}`);
      }, 12e4);
      const fetchOptions = {
        method: options.method || "GET",
        headers: {
          "Content-Type": "application/json",
          ...options.headers || {}
        },
        mode: "cors",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        signal: controller.signal
      };
      if (options.body && options.method !== "GET") {
        fetchOptions.body = options.body;
      }
      fetch(url, fetchOptions).then(async (response) => {
        clearTimeout(fetchTimeout);
        const ok = response.ok;
        const status = response.status;
        const text = await response.text().catch(() => "");
        let data = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch (e) {
          data = { raw: text };
        }
        sendResponse({ success: true, ok, status, data });
      }).catch((error) => {
        clearTimeout(fetchTimeout);
        if (error.name === "AbortError") {
          console.warn(`[GromitBridge ${BRIDGE_VERSION}] Fetch timed out for: ${url}`);
          sendResponse({ success: false, error: "TIMEOUT (120s)", status: 408 });
        } else if (!error.status || error.status === 0) {
          console.debug(`[GromitBridge ${BRIDGE_VERSION}] Fetch failed (System Offline):`, url);
          sendResponse({ success: false, error: error.message || "Unknown Network Error", status: 0 });
        } else {
          console.error(`[GromitBridge ${BRIDGE_VERSION}] Fetch Error:`, error);
          sendResponse({ success: false, error: error.message || "Unknown Network Error", status: 0 });
        }
      });
      return true;
    }
    if (request.type === "NATIVE_OCR") {
      const { fileBase64, fileName, command } = request;
      console.log(`[GromitBridge] \u{1F680} Calling Swift Native OCR for ${fileName || command}...`);
      const messagePayload = command ? { command } : { base64: fileBase64, fileName };
      chrome.runtime.sendNativeMessage(
        "com.gromit.ocr",
        messagePayload,
        (response) => {
          if (chrome.runtime.lastError) {
            const errMsg = chrome.runtime.lastError.message;
            console.debug("[GromitBridge] Native Message skipped:", errMsg);
            sendResponse({ success: false, error: errMsg });
          } else {
            console.log(`[GromitBridge] Native OCR Success (${response?.text?.length || 0} chars)`);
            if (command === "ping") {
              sendResponse({ success: true, status: "active", ...response });
            } else {
              sendResponse(response);
            }
          }
        }
      );
      return true;
    }
  });
})();
