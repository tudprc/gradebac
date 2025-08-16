jQuery(document).ready(function() {
  clearInterval(search);
  var time = 0;
  var search = setInterval(async () => {
    if(time > 32) { clearInterval(search); }
    else if ($('.checkboxevent').length == 0 && $('li[event_id]').length !== 0) {
      clearInterval(search);
      await chrome.storage.sync.get(function(result) {
        var settings = result.settings;
        if(!settings) {
          settings = { ac: true, cc: true, im: true, pe: true, ca: "pw", gc: true, pc: false };
          chrome.storage.sync.set({settings});
        }
        if(settings.ac || settings.im) { setChecks(result, settings); importance(result); }
        if(settings.cc) { setColors(result); }
        if(settings.pe) { addEvent(); }
        if(result.hc) { $('#hideShow').prop('checked', true); }
      });
    }
    time += 1;
  }, 64);

  // ... (kept your original helpers unchanged)
  // setColors, importance, setChecks, addEvent
  // (full original retained to preserve dashboard UX)
});
