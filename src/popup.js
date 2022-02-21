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

    var message = {
      region: $('#region').val(),
      platform: $('#platform').val(),
      start: $('#next').data('start') || 0,
      size: 90,
    };

    chrome.tabs.sendMessage(tabId, message, {}, (response) => {
      if (!response) {
        showError('Did not receive any data. Try reloading the page and retrying again. If the error persists - please check console logs and report to <a href="https://reddit.com/u/kpumukus">/u/kpumukus</a>.');
        return;
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

  function populateRedditTable(index) {
    index = Number(index) || 0;
    let data = JSON.parse($('#reddit-table')[0].dataset['json']);
    $('#reddit-table')
      .text(data.header + data.tables[index]);
    $('#reddit-pager')
      .html(`
        <a data-target="${(index + data.tables.length - 1) % data.tables.length}" href="javascript:void(0)" class="reddit-pager">&lt;</a>
        ${index + 1} of ${data.tables.length}
        <a data-target="${(index + data.tables.length + 1) % data.tables.length}" href="javascript:void(0)" class="reddit-pager">&gt;</a>
      `);

    $('.reddit-pager').click(function() {
      populateRedditTable($(this)[0].dataset.target);
    });
  }

  function showResult(response) {
    $('#reddit-table')[0]
        .dataset.json = JSON.stringify(response.reddit);
    populateRedditTable(0);

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
      $('#reddit-result').hide();
      $('#preview').show();
    } else {
      $('#preview').hide();
      $('#reddit-result')
        .show()
        .find('#reddit-table')
        .focus()
        .select();
    }
  }

  consoleReloadDeals();
  $('#region').change(consoleReloadDeals);
  $('#platform').change(consoleReloadDeals);
  $('#options input[name=show-table]').change(switchResultTable);
  $('#next').click(consoleReloadDeals);
});
