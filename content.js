chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  return renderTable(sendResponse);

  function renderTable(sendResponse) {
    var matches = location.hash.match(/cid=([a-zA-Z0-9\-]+).*/);
    var cid;
    if (matches) {
      cid = matches[1];
    } else {
      return sendResponse({error: "Please navigate to a PlayStation sale page"});
      // return false;
    }
    var url = 'https://store.playstation.com/chihiro-api/viewfinder/US/en/19/' + cid + '?size=300';
    $.getJSON(url, function(d) {
      var filteredLinks = $.grep(d.links, function(link) {
        return link.playable_platform.find(function(platform) {
          return !!platform.match(/^ps4/i);
        });
      });

      var sortedLinks = filteredLinks.sort(function(a, b) {
        if (a.name > b.name) return 1;
        if (a.name < b.name) return -1;
        return 0
      });

      var hasDiscounts = false;
      var hasPSPlusDiscounts = false;
      $(sortedLinks).each(function(idx, link) {
        $(link.default_sku.rewards).each(function(_, reward) {
          if (reward.bonus_discount) {
            hasDiscounts = true;
            hasPSPlusDiscounts = true;
            link.plusReward = reward;
            link.normalReward = reward;
          } else if (reward.isPlus) {
            hasPSPlusDiscounts = true;
            link.plusReward = reward;
          } else {
            hasDiscounts = true;
            link.normalReward = reward;
          }
        })
      });

      var result = "Game";
      if (hasDiscounts) { result += "|Price|% Off"; }
      if (hasPSPlusDiscounts) { result += "|PS+|% Off"; }
      result += "\n:--";
      if (hasDiscounts) { result += "|:--|:--"; }
      if (hasPSPlusDiscounts) { result += "|:--|:--"; }
      result += "\n";

      $(sortedLinks).each(function(idx, link) {
        result +=
          "[" + link.name.replace("[", "\\[").replace("]", "\\]") + "]" +
          "(" + 'https://store.playstation.com/#!cid=' + link.id + ")";

        if (hasDiscounts) {
          result += "|" +
          (link.normalReward ? link.normalReward.display_price : link.default_sku.display_price) + "|" +
          (link.normalReward ? link.normalReward.discount + "%" : "–");
        }
        if (hasPSPlusDiscounts) {
          result += "|" +
            (link.plusReward ? link.plusReward.bonus_display_price || link.plusReward.display_price || '—' : (hasDiscounts ? '–' : link.default_sku.display_price || '–')) + "|" +
            (link.plusReward ? link.plusReward.bonus_discount || link.plusReward.discount || '—' : '–') + (link.plusReward && (link.plusReward.bonus_discount || link.plusReward.discount) ? "%" : '');
        }
        result += "\n";
      });

      sendResponse({data: result});
    });
    // Async sendResponse
    return true;
  }
});
