// Auto-injects "Final Grade" on ManageBac class pages (percentage-weighted).
// Now SPA-aware: re-runs on subject changes and DOM updates. Table UI removed.

(function () {
  const WAIT_MS = 400;
  const MAX_TRIES = 60;

  // SPA navigation hooks
  function onUrlChange(callback) {
    let last = location.href;

    // Monkey-patch history methods to emit events
    ['pushState', 'replaceState'].forEach(fn => {
      const orig = history[fn];
      history[fn] = function () {
        const ret = orig.apply(this, arguments);
        window.dispatchEvent(new Event('mb-url-change'));
        return ret;
      };
    });

    // Listen to our custom event + back/forward
    window.addEventListener('mb-url-change', () => {
      if (location.href !== last) { last = location.href; callback(); }
    });
    window.addEventListener('popstate', () => {
      if (location.href !== last) { last = location.href; callback(); }
    });

    // Fallback: periodic check (cheap)
    setInterval(() => {
      if (location.href !== last) { last = location.href; callback(); }
    }, 1000);
  }

  // Debounce helper
  function debounce(fn, ms) {
    let t;
    return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  // Observe the main content area for swaps within a subject
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

  // ---- Core calculation flow ----
  function runOnce() {
    chrome.storage.sync.get(['settings'], function (result) {
      let settings = result.settings || { ac: true, cc: true, im: true, pe: true, gc: true, ca: "pw", pc: false };
      if (!settings.gc || settings.ca !== "pw") return;

      let tries = 0;
      const interval = setInterval(() => {
        tries++;
        const ready = jQuery('.highcharts-axis').length > 0 
                   || jQuery('.sidebar-items-list').length > 0
                   || jQuery('.tasks-list-container').length > 0;
        if (!ready && tries < MAX_TRIES) return;
        clearInterval(interval);
        tryShowGrade(settings);
      }, WAIT_MS);
    });
  }

  function tryShowGrade(settings) {
    const categories = extractCategories(settings);
    const final = computeFinal(categories);
    injectHeader(final);
  }

  function extractCategories(settings) {
    const categories = [];

    // Case A: legacy table with "Overall"
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
          const grades = getPercentGrades(name, settings);
          const avg = average(grades);
          categories.push({ name, weight, avg, specialNum: avg * weight / 100 });
        }
      });
      return categories;
    }

    // Case B: modern sidebar
    if (jQuery('.sidebar-items-list').length) {
      jQuery('.sidebar-items-list .list-item:not(.list-item-head)').each(function () {
        const name = jQuery(this).children().first().text().replace(/(\r\n|\n|\r)/gm, "");
        const weight = Number(jQuery(this).children().eq(1).text().replace(/[^0-9]+/g, ''));
        const grades = getPercentGrades(name, settings);
        const avg = average(grades);
        categories.push({ name, weight, avg, specialNum: avg * weight / 100 });
      });
      return categories;
    }

    // Case C: universal fallback
    const perts = jQuery('section :contains("%")').filter(function () { return jQuery(this).children().length === 0; });
    for (let i = 0; i < perts.length; i++) {
      const name = jQuery(perts[i]).parent().find('.label').text();
      const weight = Number(jQuery(perts[i]).text().replace(/[^0-9]+/g, ''));
      const grades = getPercentGrades(name, settings);
      const avg = average(grades);
      categories.push({ name, weight, avg, specialNum: avg * weight / 100 });
    }
    return categories;
  }

  function getPercentGrades(catName, settings) {
    const grades = [];
    jQuery('.tasks-list-container').find(".label:contains(" + catName + ")").each(function () {
      const pointsText = jQuery(this).parentsUntil('.tasks-list-container').last().find(".points").text();
      const pair = pointsText.split('/').map(v => parseFloat(v));
      if (pair.length === 2) {
        const raw = pair[0], max = pair[1];
        if (!isNaN(raw) && !isNaN(max) && max > 0) {
          const pct = Math.round((raw / max) * 10000) / 100;
          grades.push(pct);
          if (settings.pc) {
            jQuery(this).parentsUntil('.tasks-list-container').last().find(".grade").text(String(pct) + "%");
          }
        }
      }
    });
    return grades;
    }

  function average(arr) {
    if (!arr || !arr.length) return NaN;
    const sum = arr.reduce((a, b) => a + parseFloat(b || 0), 0);
    return sum / arr.length;
  }

  function computeFinal(categories) {
    let sumWeight = 0, sumSpecial = 0;
    categories.forEach(c => {
      if (!isNaN(c.avg)) {
        sumWeight += c.weight;
        sumSpecial += c.specialNum;
      }
    });
    let final = Math.round((sumSpecial / (sumWeight || 1)) * 1000) / 10;
    if (isNaN(final)) return "An error has occurred or the grade system isn’t supported.";
    return final + "%";
  }

  function injectHeader(finalText) {
    // Update page header
    const pageHeaders = jQuery('.page-head-tile').find('h3');
    if (pageHeaders.length) {
      pageHeaders.each(function () { this.textContent = "Final Grade: " + finalText; });
    }
    // Tag in content-block header
    if (jQuery('#result').length === 0) {
      const result = document.createElement('h3');
      result.style.color = "red";
      result.style.marginTop = "10px";
      result.style.float = "right";
      result.id = "result";
      result.textContent = "Grade: " + finalText;
      const host = document.querySelector('.content-block > h3:nth-child(3)') || document.querySelector('.content-block h3');
      if (host) host.append(result);
    } else {
      jQuery('#result').text("Grade: " + finalText);
    }
  }

  // ---- bootstrap once, then on SPA changes ----
  jQuery(document).ready(function () {
    runOnce();
    startDomObserver();
    onUrlChange(() => {
      // give MB time to swap content
      setTimeout(() => { runOnce(); startDomObserver(); }, 250);
    });
  });
})();
