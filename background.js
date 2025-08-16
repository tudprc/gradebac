// MV3 service worker kept minimal on purpose.
// We no longer inject scripts from here; content scripts handle everything.
// Still listens for optional messages (e.g., school name) without doing anything noisy.

chrome.runtime.onMessage.addListener((_msg, _sender, _sendResponse) => {
  // Reserved for future lightweight tasks (no DOM/script injection here).
});
