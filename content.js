chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  switch(location.host) {
    case "store.playstation.com":
      return renderPlayStationTable(sendResponse, request.region);
    case "www.xbox.com":
      return renderXboxTable(sendResponse);
    default:
      return sendResponse({error: "Unknown website, should never happen"});
  }

  function renderPlayStationTable(sendResponse, region) {
    // Parse sale ID
    var matches = location.hash.match(/cid=([a-zA-Z0-9\-]+).*/);
    var cid;
    if (matches) {
      cid = matches[1];
    } else {
      return sendResponse({error: "Please navigate to a PlayStation sale page"});
    }
    // Parse region
    var country, locale;
    if (region === undefined || region === "") {
      matches = location.hash.match(/!\/([a-zA-Z]{2}-[a-zA-Z]{2})\//);
      region = matches[1];
    }
    var regionParts = region.split("-");
    var locale = regionParts[0];
    var country = regionParts[1];

    // Fetch sale details
    var cacheBust = new Date().getTime();
    var url = 'https://store.playstation.com/chihiro-api/viewfinder/' + country + '/' + locale + '/19/' + cid + '?platform=ps4&size=300&gkb=1&geoCountry=' + country + '&t=' + cacheBust;
    $.getJSON(url)
      .done(function(d) {
        if (d.links.length == 0) {
          return sendResponse({error: "No results found, reloading in 5 seconds...", retryIn: 5000});
        }

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
              if (!link.plusReward || (reward.bonus_discount || reward.discount || 0) > (link.plusReward.bonus_discount || link.plusReward.discount || 0)) {
                hasPSPlusDiscounts = true;
                link.plusReward = reward;
              }
            } else {
              if (!link.normalReward || reward.discount > link.normalReward.discount) {
                hasDiscounts = true;
                link.normalReward = reward;
              }
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
      })
      .fail(function(jqXHR, textStatus, errorThrown) {
        return sendResponse({error: "Error returned. Maybe sale does not exist for the selected region?"});
      });

    // Async sendResponse
    return true;
  }

  function renderXboxTable(sendResponse) {
    var urlRegion = document.URL.split("/")[3].toLowerCase();
    var countryCode = urlRegion.split("-")[1].toUpperCase();

    var rawGuids = []
    $(".gameDiv[data-bigid]").each(function() {
      rawGuids.push($(this).attr("data-bigid"));
    });
    // console.log(rawGuids);
    var guidUrl = 'https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=' + rawGuids.join(",") + '&market=' + countryCode + '&languages=' + urlRegion + '&MS-CV=DGU1mcuYo0WMMp+F.1';

    var result = "Game|Price|% Off\n|:--|:--|:--\n";
    $.getJSON(guidUrl, function(d) {
      $('.x1Games section.m-product-placement-item').each(function(idx, el) {
        var bigid = $(el).attr('data-bigid');
        var product = d.Products.find(function(g) { return g.ProductId == bigid });
        // console.log(product.DisplaySkuAvailabilities[0].Availabilities);

        result +=
          "[" + $('.x1GameName', el)[0].innerText.replace("[", "\\[").replace("]", "\\]") + "]" +
          "(" + 'https://www.microsoft.com/en-ca/store/p/-/' + bigid + ")|" +
          (product ? "$" + product.DisplaySkuAvailabilities[0].Availabilities[1].OrderManagementData.Price.ListPrice : "—") + "|" +
          $('.x1GamePrice', el)[0].innerText +
          "\n";
      });
      sendResponse({data: result});
    });

    // Async sendResponse
    return true;
  }
});
