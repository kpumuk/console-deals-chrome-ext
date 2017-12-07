$(function() {
  function consoleReloadDeals() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      refresh(tabs[0].id);
    });
  }

  function refresh(tabId) {
    $('#error').hide();
    $('#result').hide();
    $('#progress').show();

    var options = {
      region: $('#region').val(),
      platform: $('#platform').val()
    };
    chrome.tabs.sendMessage(tabId, options, function(response) {
      if (!response) {
        $('#error-message').html('Did not receive any data. Try reloading the page and retrying again. If the error persists - please check console logs and report to <a href="https://reddit.com/u/kpumukus">/u/kpumukus</a>.');
        $('#progress').hide();
        $('#error').show();
      } else if (response.error) {
        $('#error-message').text(response.error);
        $('#progress').hide();
        $('#error').show();
      } else {
        $('#error').hide();
        $('#reddit-table').text(response.data);
        $('#preview-table').html(response.preview);
        $('#progress').hide();
        switchResultTable();
        $('#result').show();
        // Simple trick to make sure reddit table contents is selected
        switchResultTable();
      }

      if (response.retryIn) {
        window.setTimeout(function() { refresh(tabId) }, response.retryIn);
      }
    });
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
});
