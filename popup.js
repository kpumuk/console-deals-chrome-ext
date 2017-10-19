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
      platform: $('#platform').val(),
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
        $('#progress').hide();
        $('#result').show();
        $('#reddit-table').focus().select();
      }

      if (response.retryIn) {
        window.setTimeout(function() { refresh(tabId) }, response.retryIn);
      }
    });
  }

  consoleReloadDeals();
  $('#region').change(consoleReloadDeals);
  $('#platform').change(consoleReloadDeals);
});
