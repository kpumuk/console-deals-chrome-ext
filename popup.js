$(function() {
  function consoleReloadDeals() {
    chrome.tabs.query(
      { active: true, currentWindow: true },
      (tabs) => refresh(tabs[0].id)
    );
  }

  function refresh(tabId) {
    $('#error').hide();
    $('#result').hide();
    $('#progress').show();

    var options = {
      region: $('#region').val(),
      platform: $('#platform').val(),
      start: $('#next').data('start') || 0,
      size: 90,
    };

    chrome.tabs.sendMessage(tabId, options, (response) => {
      if (!response) {
        showError('Did not receive any data. Try reloading the page and retrying again. If the error persists - please check console logs and report to <a href="https://reddit.com/u/kpumukus">/u/kpumukus</a>.');
      } else if (response.error) {
        showError(response.error);
      } else {
        showResult(response);
      }

      if (response.retryIn) {
        window.setTimeout(() => refresh(tabId), response.retryIn);
      }
    });
  }

  function showError(htmlMessage) {
    $('#error-message').html(htmlMessage);
    $('#progress').hide();
    $('#error').show();
  }

  function showResult(response) {
    $('#reddit-table').text(response.reddit);
    $('#preview-table').html(response.html);
    $('#progress').hide();
    switchResultTable();
    $('#result').show();
    // Simple trick to make sure reddit table contents is selected
    switchResultTable();

    // Do we have more results?
    if (response.start + response.size < response.total) {
      $('#next').
        show().
        html('Next (from ' + (0 + response.start + response.size) + ') &raquo;').
        data('start', response.start + response.size);
    } else if (response.total > response.size) {
      $('#next').
        show().
        html('From Beginning &raquo;').
        data('start', 0);
    } else {
      $('#next').hide();
    }
  }

  function switchResultTable() {
    var table = $('#options input[name=show-table]:checked').val();
    if (table === "preview") {
      $('#reddit-table').hide();
      $('#preview').show();
    } else {
      $('#preview').hide();
      $('#reddit-table').show().focus().select();
    }
  }

  consoleReloadDeals();
  $('#region').change(consoleReloadDeals);
  $('#platform').change(consoleReloadDeals);
  $('#options input[name=show-table]').change(switchResultTable);
  $('#next').click(consoleReloadDeals);
});
