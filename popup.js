$(function() {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, {greeting: "hello"}, function(response) {
      if (!response) {
        $('#error-message').html('Did not receive any data. Try reloading the page and retrying again. If the error persists - please check console logs and report to <a href="https://reddit.com/u/kpumukus">/u/kpumukus</a>.');
        $('#progress').hide();
        $('#error').show();
      } else if (response.error) {
        $('#error-message').text(response.error);
        $('#progress').hide();
        $('#error').show();
      } else {
        $('#reddit-table').text(response.data).focus().select();
        $('#progress').hide();
        $('#result').show();
      }
    });
  });

  $('#reddit-table').focus(function() { $(this).select() });
});
