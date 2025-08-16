// Auto-injects "Final Grade" (points-based averaging).
// SPA-aware: recalculates on subject changes and DOM swaps. Table UI removed.

(function () {
  const WAIT_MS = 400;
  const MAX_TRIES = 60;

  // ---- SPA navigation hooks ----
  function onUrlChange(callback) {
    let last = location.href;
    ['pushState', 'replaceState'].forEach(fn => {
      const orig = history[fn];
      history[fn] = function () {
        const ret = orig.apply(this, arguments);
        window.dispatchEvent(new Event('mb-url-change'));
        return ret;
      };
    });
    window.addEventListener('mb-url-change', () => {
      if (location.href !== last) { last = location.href; callback(); }
    });
    window.addEventListener('popstate', () => {
      if (location.href !== last) { last = location.href; callback(); }
    });
    setInterval(() => {
      if (location.href !== last) { last = location.href; callback(); }
    }, 1000);
  }

  function debounce(fn, ms) { let t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }

  let domObserver;
  const rerun = debounce(runOnce, 250);
  function startDomObserver() {
    stopDomObserver();
    const target = document.querySelector('main') || document.body;
    domObserver = new MutationObserver(() => rerun());
    domObserver.observe(target, { childList: true, subtree: true });
  }
  function stopDomObserver() {
    if (domObserver) { domObserver.disconnect(); domObserver = null; }
  }

  function runOnce() {
    chrome.storage.sync.get(['settings'], function (result) {
      let settings = result.settings || { ac: true, cc: true, im: true, pe: true, gc: true, ca: "pw", pc: false };
      if (!settings.gc || settings.ca !== "pba") return;

      let tries = 0;
      const interval = setInterval(() => {
        tries++;
        const ready = jQuery('.highcharts-axis').length > 0
                   || jQuery('.sidebar-items-list').length > 0
                   || jQuery('.tasks-list-container').length > 0;
        if (!ready && tries < MAX_TRIES) return;
        clearInterval(interval);
        tryShowGrade();
      }, WAIT_MS);
    });
  }

  function tryShowGrade() {
    const categories = extractCategories();
    const final = computeFinal(categories);
    injectHeader(final);
  }

  function extractCategories() {
    const categories = [];

    // legacy "Overall" table
    let mbCalculated = false;
    jQuery('.table tbody tr').each(function () {
      if (jQuery(this).children().first().text().indexOf('Overall') > -1) mbCalculated = true;
    });
    if (mbCalculated) {
      jQuery('.table tbody tr').each(function () {
        if (jQuery(this).children().first().text().indexOf('Overall') < 0) {
          const title = jQuery(this).children().first().text();
          const name = title.slice(0, -5);
          const weight = Number(title.substr(title.length - 5).replace(/[^0-9.]/g, ""));
          const grades = getLabelScores(name);
          const score = categoryScore(grades);
          categories.push({ name, weight, score });
        }
      });
      return categories;
    }

    // modern sidebar
    if (jQuery('.sidebar-items-list').length) {
      jQuery('.sidebar-items-list .list-item:not(.list-item-head)').each(function () {
        const name = jQuery(this).children().first().text();
        const weight = Number(jQuery(this).children().eq(1).text().replace(/[^0-9]+/g, ''));
        const grades = getLabelScores(name);
        const score = categoryScore(grades);
        categories.push({ name, weight, score });
      });
      return categories;
    }

    // fallback
    const perts = jQuery('section :contains("%")').filter(function () { return jQuery(this).children().length === 0; });
    for (let i = 0; i < perts.length; i++) {
      const name = jQuery(perts[i]).parent().find('.label').text();
      const weight = Number(jQuery(perts[i]).text().replace(/[^0-9]+/g, ''));
      const grades = getLabelScores(name);
      const score = categoryScore(grades);
      categories.push({ name, weight, score });
    }
    return categories;
  }

  function getLabelScores(catName) {
    const grades = [];
    jQuery('.label-score').each(function () {
      const foundCat = jQuery(this).parent().parent().children().last().text();
      if (catName.indexOf(foundCat) > -1) grades.push(jQuery(this).text());
    });
    return grades;
  }

  function categoryScore(grades) {
    let got = 0, max = 0;
    grades.forEach(g => {
      const [a, b] = g.split('/').map(v => parseFloat(v));
      if (!isNaN(a) && !isNaN(b) && b > 0) { got += a; max += b; }
    });
    if (max === 0) return NaN;
    return Math.round((got / max) * 10000) / 100; // %
  }

  function computeFinal(cats) {
    let sumScore = 0, sumWeight = 0;
    cats.forEach(c => {
      if (!isNaN(c.score)) {
        sumScore += c.score * (c.weight / 100);
        sumWeight += c.weight;
      }
    });
    let final = Math.round(((sumScore / (sumWeight || 1)) * 1000)) / 10;
    if (isNaN(final)) return "An error has occurred or the grade system isn’t supported.";
    return final + "%";
  }

  function injectHeader(finalText) {
    const pageHeader = jQuery('.page-head-tile h3');
    if (pageHeader.length) {
      pageHeader.each(function () { this.textContent = "Final Grade: " + finalText; });
    }
    if (jQuery('#result').length === 0) {
      const el = jQuery('<h3 id="result" style="color:red;margin-top:10px;float:right;"></h3>').text("Grade: " + finalText);
      const host = document.querySelector('.content-block > h3:nth-child(3)') || document.querySelector('.content-block h3');
      if (host) host.appendChild(el[0]);
    } else {
      jQuery('#result').text("Grade: " + finalText);
    }
  }

  jQuery(document).ready(function () {
    runOnce();
    startDomObserver();
    onUrlChange(() => { setTimeout(() => { runOnce(); startDomObserver(); }, 250); });
  });
})();
