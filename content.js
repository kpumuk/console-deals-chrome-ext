chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch(location.host) {
    case "store.playstation.com":
      return renderPlayStationTable(sendResponse, request.region, request.platform);
    case "www.xbox.com":
      return renderXboxTable(sendResponse);
    default:
      return sendResponse({error: "Unknown website, should never happen"});
  }

  function renderPlayStationTable(sendResponse, region, platform) {
    var sale = parseSaleInfo(region);

    // Fetch sale details
    var url = buildPlaystationStoreApiUrl(sale.locale, sale.country, sale.cid, platform);
    $.getJSON(url)
      .done((d) => {
        if (d.included.length == 0) {
          return sendResponse({error: "No results found, reloading in 5 seconds...", retryIn: 5000});
        }

        var items = d.included.filter(isDiscountedPlaystationGame).
          sort((a, b) => a.attributes.name.localeCompare(b.attributes.name));

        var games = items.map((item) => parsePlaystationGames(sale.region, item));
        var hasDiscounts = !!games.find((item) => item.discount);
        var hasPlusDiscounts = !!games.find((item) => item.plusDiscount);

        var reddit = renderPlaystationRedditTable(games, hasDiscounts, hasPlusDiscounts);
        var html = renderPlaystationHTMLTable(games, hasDiscounts, hasPlusDiscounts);

        sendResponse({ reddit, html });
      })
      .fail(() => {
        return sendResponse({ error: "Error returned. Maybe sale does not exist for the selected region?" });
      });

    // Async sendResponse
    return true;
  }

  function parseSaleInfo(region) {
    // Parse URL
    var parsedUrl = parsePlaystationStoreUrl()

    var cid = parsedUrl.cid;
    if (cid === undefined) {
      return sendResponse({ error: "Please navigate to a PlayStation sale page" });
    }
    // Parse region
    if (region === undefined || region === "") {
      region = parsedUrl.region;
    }
    var regionParts = region.split("-");
    var locale = regionParts[0];
    var country = regionParts[1];

    return { cid, region, locale, country };
  }

  function htmlEscape(value) {
    return $('<div/>').text(value).html();
  }

  function redditEscape(value) {
    return value.replace("[", "\\[").replace("]", "\\]");
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

    var defaultSku = item.attributes.skus.find((a) => a.id == item.attributes["default-sku-id"]);
    var prices = defaultSku["prices"];

    if (itemHasNonPlusDiscount) extractPlaystationPrice(prices, result, false);
    if (itemHasPlusDiscount) extractPlaystationPrice(prices, result, true);

    return result;
  }

  function extractPlaystationPrice(prices, result, isPlus) {
    var priceInfo = prices[isPlus ? "plus-user" : "non-plus-user"];
    var price = priceInfo["actual-price"].display;
    var discount = priceInfo["discount-percentage"];
    discount = discount == 0 ? "–" : discount + "%";

    result[(isPlus ? "plusPrice" : "price")] = price;
    result[(isPlus ? "plusDiscount" : "discount")] = discount;
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
    var headers = [ "Game" ];
    if (hasDiscounts) headers.push("Price", "% Off");
    if (hasPlusDiscounts) headers.push("PS+", "% Off");

    var result = redditTableRow(headers) + redditTableRow(headers.map(() => ":--"));

    $(games).each((idx, game) => {
      var cols = [ "[" + redditEscape(game.name) + "](" + game.url + ")" ];

      if (hasDiscounts) cols.push(game.price, game.discount);
      if (hasPlusDiscounts) cols.push(game.plusPrice, game.plusDiscount);

      result += redditTableRow(cols);
    });
    return result;
  }

  function renderPlaystationHTMLTable(games, hasDiscounts, hasPlusDiscounts) {
    var headers = [ "Game (" + games.length + ")" ];
    if (hasDiscounts) headers.push("Price", "% Off");
    if (hasPlusDiscounts) headers.push("PS+", "% Off");

    var result = "<thead>" + htmlTableRow(headers, "th") + "</thead><tbody>";

    $(games).each((idx, game) => {
      var cols = [ "<a href=\"" + game.url + "\">" + htmlEscape(game.name) + "</a>" ];

      if (hasDiscounts) cols.push(game.price, game.discount);
      if (hasPlusDiscounts) cols.push(game.plusPrice, game.plusDiscount);

      result += htmlTableRow(cols);
    });

    result += "</tbody></table>";
    return result;
  }

  function htmlTableRow(cols, tag) {
    if (tag === undefined) tag = "td";
    return "<tr>" + cols.map((c) => "<" + tag + ">" + (c || "") + "</" + tag + ">").join() + "</tr>"
  }

  function redditTableRow(cols) {
    return cols.map((c) => c || "").join("|") + "\n";
  }

  function renderXboxTable(sendResponse) {
    var urlRegion = document.URL.split("/")[3].toLowerCase();
    var countryCode = urlRegion.split("-")[1].toUpperCase();

    var rawGuids = []
    $(".gameDiv[data-bigid]").each(() => {
      rawGuids.push($(this).attr("data-bigid"));
    });
    // console.log(rawGuids);
    var guidUrl = 'https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=' + rawGuids.join(",") + '&market=' + countryCode + '&languages=' + urlRegion + '&MS-CV=DGU1mcuYo0WMMp+F.1';

    var result = "Game|Price|% Off\n|:--|:--|:--\n";
    $.getJSON(guidUrl, (d) => {
      $('.x1Games section.m-product-placement-item').each((idx, el) => {
        var bigid = $(el).attr('data-bigid');
        var product = d.Products.find((g) => g.ProductId == bigid);
        // console.log(product.DisplaySkuAvailabilities[0].Availabilities);

        result +=
          "[" + $('.x1GameName', el)[0].innerText.replace("[", "\\[").replace("]", "\\]") + "]" +
          "(" + 'https://www.microsoft.com/en-ca/store/p/-/' + bigid + ")|" +
          (product ? "$" + product.DisplaySkuAvailabilities[0].Availabilities[1].OrderManagementData.Price.ListPrice : "—") + "|" +
          $('.x1GamePrice', el)[0].innerText +
          "\n";
      });
      sendResponse({reddit: result});
    });

    // Async sendResponse
    return true;
  }
});
