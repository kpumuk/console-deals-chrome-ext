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
    var country, locale;
    if (region === undefined || region === "") {
      region = parsedUrl.region;
    }
    var regionParts = region.split("-");
    var locale = regionParts[0];
    var country = regionParts[1];

    // Fetch sale details
    var url = 'https://store.playstation.com/valkyrie-api/' + locale + '/' + country + '/19/container/' + cid + '?gameContentType=games%2Cbundles%2Caddons&platform=' + platform + '&size=300&bucket=games&t=' + new Date().getTime();
    $.getJSON(url)
      .done(function(d) {
        if (d.included.length == 0) {
          return sendResponse({error: "No results found, reloading in 5 seconds...", retryIn: 5000});
        }

        var hasDiscounts = false;
        var hasPSPlusDiscounts = false;

        var items = d.included.filter(function(a) {
          return  (
                    a.type === "game" ||
                    a.type === "game-related"
                  ) &&
                  (
                    a.attributes["top-category"] === "downloadable_game" ||
                    a.attributes["top-category"] === "add_on"
                  );
        }).sort(function(a, b) {
          return a.attributes.name.localeCompare(b.attributes.name);
        });

        console.log(items);

        $(items).each(function(idx, item) {
          if (item.attributes["badge-info"] && item.attributes["badge-info"]["non-plus-user"]) {
            hasDiscounts = true;
          }

          if (item.attributes["badge-info"] && item.attributes["badge-info"]["plus-user"]) {
            hasPSPlusDiscounts = true;
          }

          item["default-sku"] = item.attributes.skus.find(function(a) {
            return a.id == item.attributes["default-sku-id"];
          });
          // item.name = item.attributes.name;
        });

        var result = "Game";
        var preview = "<thead><tr><th>Game</th>";
        if (hasDiscounts) {
          result += "|Price|% Off";
          preview += "<th>Price</th><th>% Off</th>"
        }
        if (hasPSPlusDiscounts) {
          result += "|PS+|% Off";
          preview += "<th>PS+</th><th>% Off</th>"
        }
        result += "\n:--";
        if (hasDiscounts) { result += "|:--|:--"; }
        if (hasPSPlusDiscounts) { result += "|:--|:--"; }
        result += "\n";
        preview += "</tr></thead><tbody>";

        $(items).each(function(idx, item) {
          var href = 'https://store.playstation.com/' + region + '/product/' + item.id;
          result +=
            "[" + item.attributes.name.replace("[", "\\[").replace("]", "\\]") + "]" +
            "(" + href + ")";
          preview += "<tr>" +
            "<td><a href=\"" + href + "\">" + htmlEscape(item.attributes.name) + '</a></td>';

          var prices = item["default-sku"]["prices"];
          if (hasDiscounts) {
            var price = prices["non-plus-user"]["actual-price"].display;
            var discount = prices["non-plus-user"]["discount-percentage"];
            discount = discount == 0 ? "–" : discount + "%";

            result += "|" + price + "|" + discount;
            preview += "<td>" + price + "</td><td>" + discount + "</td>";
          }
          if (hasPSPlusDiscounts) {
            var plusPrice = prices["plus-user"]["actual-price"].display;
            var plusDiscount = prices["plus-user"]["discount-percentage"];
            plusDiscount = plusDiscount == 0 ? "–" : plusDiscount + "%";

            if (plusDiscount === discount) {
              plusPrice = "";
              plusDiscount = "";
            }

            result += "|" + plusPrice + "|" + plusDiscount;
            preview += "<td>" + plusPrice + "</td><td>" + plusDiscount + "</td>";
          }
          result += "\n";
          preview += "</tr>";
        });

        preview += "</tbody>";
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

  function parsePlaystationStoreUrl() {
    // Parse region
    var result = {};

    var matches = location.hash.match(/cid=([a-zA-Z0-9\-]+).*/);
    if (matches) {
      result.cid = matches[1];

      matches = location.hash.match(/!\/([a-zA-Z]{2}-[a-zA-Z]{2})\//);
      result.region = matches[1];
    } else {
      var matches = location.pathname.match(/\/([a-zA-Z]{2}-[a-zA-Z]{2})\/grid\/([a-zA-Z0-9\-]+).*/);
      if (matches) {
        result.region = matches[1];
        result.cid = matches[2];
      }
    }

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
