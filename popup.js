var settings;
chrome.storage.sync.get(['settings'], function(result) {
  settings = result.settings;
  if (!settings) {
    settings = { ac: true, cc: true, im: true, pe: true, gc: true, ca: "pw", pc: false };
  }

  document.getElementById('ac').checked = settings.ac;
  document.getElementById('cc').checked = settings.cc;
  document.getElementById("algorithmSelect").value = settings.ca;
  document.getElementById("im").checked = settings.im;
  document.getElementById("pe").checked = settings.pe;
  document.getElementById("gc").checked = settings.gc;
  document.getElementById("pc").checked = settings.pc;

  let info = document.getElementById("info");
  info.addEventListener('click', () => {
    document.getElementById("itab").style.display = "block";
    document.getElementsByClassName("right")[0].style.cssText = "background: rgb(255, 255, 255)";
    document.getElementsByClassName("left")[0].style.cssText = "background: rgb(189, 189, 189)";
    document.getElementById("stab").style.display = "none";
  });

  let settingsEl = document.getElementById("settings");
  settingsEl.addEventListener('click', () => {
    document.getElementById("itab").style.display = "none";
    document.getElementsByClassName("right")[0].style.cssText = "background: rgb(189, 189, 189)";
    document.getElementsByClassName("left")[0].style.cssText = "background: rgb(255, 255, 255)";
    document.getElementById("stab").style.display = "block";
  });
});

document.getElementById("save").addEventListener('click', () => {
  const select = document.getElementById("algorithmSelect");
  const settingsSet = {
    ac: document.getElementById('ac').checked,
    cc: document.getElementById('cc').checked,
    ca: select.value,
    im: document.getElementById('im').checked,
    pe: document.getElementById('pe').checked,
    gc: document.getElementById('gc').checked,
    pc: document.getElementById('pc').checked
  };
  chrome.storage.sync.set({ settings: settingsSet }, () => {
    // simply refresh the active tab so the grade shows with new settings
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs && tabs[0]) chrome.tabs.update(tabs[0].id, { url: tabs[0].url });
    });
  });
});

// open links in new tab
document.addEventListener('DOMContentLoaded', function () {
  var links = document.getElementsByTagName("a");
  for (var i = 0; i < links.length; i++) {
    (function () {
      var ln = links[i];
      var location = ln.href;
      ln.onclick = function () { chrome.tabs.create({ active: true, url: location }); };
    })();
  }
});