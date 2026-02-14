// extension_src/background.ts
var BRIDGE_VERSION = "4.0.0";
var OFFSCREEN_DOCUMENT_PATH = "offscreen.html";
var creating = null;
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
    console.log("[GromitBridge] Delegating OLLAMA_FETCH to Offscreen:", url);
    (async () => {
      try {
        await setupOffscreenDocument(OFFSCREEN_DOCUMENT_PATH);
        const response = await chrome.runtime.sendMessage({
          type: "OLLAMA_FETCH_OFFSCREEN",
          url,
          options
        });
        sendResponse(response);
      } catch (error) {
        console.error("[GromitBridge] Offscreen Fetch Error:", error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
});
//# sourceMappingURL=background.js.map
