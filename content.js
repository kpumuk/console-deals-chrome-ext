chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  switch(location.host) {
    case "store.playstation.com":
      return renderPlayStationTable(sendResponse, request.region, request.platform);
    case "www.xbox.com":
      return renderXboxTable(sendResponse);
    default:
      return sendResponse({error: "Unknown website, should never happen"});
  }

  function renderPlayStationTable(sendResponse, region, platform) {
    // Parse URL
    var parsedUrl = parsePlaystationStoreUrl()

    var cid = parsedUrl.cid;
    if (cid === undefined) {
      return sendResponse({error: "Please navigate to a PlayStation sale page"});
    }
    // Parse region
    if (region === undefined || region === "") {
      region = parsedUrl.region;
    }
    var regionParts = region.split("-");
    var locale = regionParts[0];
    var country = regionParts[1];

    // Fetch sale details
    var url = buildPlaystationStoreApiUrl(locale, country, cid, platform);
    $.getJSON(url)
      .done(function(d) {
        if (d.included.length == 0) {
          return sendResponse({error: "No results found, reloading in 5 seconds...", retryIn: 5000});
        }

        var items = d.included.filter(isDiscountedPlaystationGame).
          sort((a, b) => a.attributes.name.localeCompare(b.attributes.name));

        // console.log(items);

        var games = items.map((item) => parsePlaystationGames(region, item));
        var hasDiscounts = !!games.find((item) => item.discount);
        var hasPlusDiscounts = !!games.find((item) => item.plusDiscount);

        var result = renderPlaystationRedditTable(games, hasDiscounts, hasPlusDiscounts);
        var preview = renderPlaystationHTMLTable(games, hasDiscounts, hasPlusDiscounts);

        sendResponse({data: result, preview: preview});
      })
      .fail(function(jqXHR, textStatus, errorThrown) {
        return sendResponse({error: "Error returned. Maybe sale does not exist for the selected region?"});
      });

    // Async sendResponse
    return true;
  }

  function htmlEscape(value) {
    return $('<div/>').text(value).html();
  }

  function buildPlaystationStoreApiUrl(locale, country, cid, platform) {
    var url = [
      'https://store.playstation.com/valkyrie-api',
      locale,
      country,
      '19/container',
      cid
    ].join('/');
    var params = {
      sort:      'name',               // sort field
      direction: 'asc',                // sort direction
      platform:  platform,             // platform ID
      size:      500,                  // how many records to return
      bucket:    'games',              // content type bucket
      t:         new Date().getTime()  // cache buster
    }
    return url + '?' + $.param(params);
  }

  function parsePlaystationStoreUrl() {
    var matches = location.pathname.match(/\/([a-zA-Z]{2}-[a-zA-Z]{2})\/grid\/([a-zA-Z0-9-]+).*/);
    if (matches) {
      return {
        region: matches[1],
        cid: matches[2],
      }
    }
  }

  function parsePlaystationGames(region, item) {
    var result = {
      url:  'https://store.playstation.com/' + region + '/product/' + item.id,
      name: item.attributes.name,
    };

    var badge = item.attributes["badge-info"];
    var itemHasNonPlusDiscount = badge["non-plus-user"] && !badge["non-plus-user"]["is-plus"];
    var itemHasPlusDiscount =
      badge["plus-user"] && (
        !itemHasNonPlusDiscount ||
        badge["plus-user"]["discount-percentage"] != badge["non-plus-user"]["discount-percentage"]
      );

    var defaultSku = item.attributes.skus.find(function(a) {
      return a.id == item.attributes["default-sku-id"];
    });
    var prices = defaultSku["prices"];

    if (itemHasNonPlusDiscount) {
      result["price"] = prices["non-plus-user"]["actual-price"].display;

      var discount = prices["non-plus-user"]["discount-percentage"];
      discount = discount == 0 ? "–" : discount + "%";
      result["discount"] = discount;
    }

    if (itemHasPlusDiscount) {
      result["plusPrice"] = prices["plus-user"]["actual-price"].display;
      var plusDiscount = prices["plus-user"]["discount-percentage"];
      plusDiscount = plusDiscount == 0 ? "–" : plusDiscount + "%";
      result["plusDiscount"] = plusDiscount;
    }

    return result;
  }

  function isDiscountedPlaystationGame(item) {
    // Does it have a discount?
    if (!item.attributes["badge-info"]) return false;
    var badge = item.attributes["badge-info"];
    if (!badge["non-plus-user"] || !badge["plus-user"]) return false;
    // Does it have default SKU?
    if (!item.attributes["default-sku-id"]) return false;
    // Is it a game or game-related content?
    if (!["game", "game-related"].includes(item.type)) return false;

    // Seems to be a game
    return true;
  }

  function renderPlaystationRedditTable(games, hasDiscounts, hasPlusDiscounts) {
    var result = "Game";

    if (hasDiscounts) result += "|Price|% Off";
    if (hasPlusDiscounts) result += "|PS+|% Off";
    result += "\n:--";

    if (hasDiscounts) result += "|:--|:--";
    if (hasPlusDiscounts) result += "|:--|:--";
    result += "\n";

    $(games).each(function(idx, game) {
      result +=
        "[" + game.name.replace("[", "\\[").replace("]", "\\]") + "]" +
        "(" + game.url + ")";

      if (hasDiscounts) result += "|" + (game.price || "") + "|" + (game.discount || "");
      if (hasPlusDiscounts) result += "|" + (game.plusPrice || "") + "|" + (game.plusDiscount || "");

      result += "\n";
    });
    return result;
  }

  function renderPlaystationHTMLTable(games, hasDiscounts, hasPlusDiscounts) {
    var result = "<thead><tr><th>Game (" + games.length + ")</th>";

    if (hasDiscounts) result += "<th>Price</th><th>% Off</th>";
    if (hasPlusDiscounts) result += "<th>PS+</th><th>% Off</th>";
    result += "</tr></thead><tbody>";

    $(games).each(function(idx, game) {
      result += "<tr>" +
        "<td><a href=\"" + game.url + "\">" + htmlEscape(game.name) + '</a></td>';

      if (hasDiscounts) {
        result += "<td>" + (game.price || "") + "</td><td>" + (game.discount || "") + "</td>";
      }
      if (hasPlusDiscounts) {
        result += "<td>" + (game.plusPrice || "") + "</td><td>" + (game.plusDiscount || "") + "</td>";
      }
      result += "</tr>";
    });

    result += "</tbody></table>";
    return result;
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
