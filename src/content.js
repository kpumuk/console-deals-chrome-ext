chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (location.host) {
        case "store.playstation.com":
            return renderPlayStationTable(sendResponse, request.region, request.platform, request.start, request.size);
        case "www.xbox.com":
            return renderXboxTable(sendResponse);
        default:
            return sendResponse({
                error: "Unknown website, should never happen"
            });
    }

    function renderPlayStationTable(sendResponse, region, platform, start, size) {
        let clearFilterButton = document.querySelector('[data-track-click="web:store:active-filters-clear-button"]');
        clearFilterButton && clearFilterButton.click();

        adjustFilters(region, platform);
        loadDeal()
            .then((dealObj) => {
                let clearFilterButton = document.querySelector('[data-track-click="web:store:active-filters-clear-button"]');
                clearFilterButton && clearFilterButton.click();

                let games = Object.keys(dealObj)
                    .map((key) => dealObj[key])
                    .filter((item) => item.price)
                    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

                var hasDiscounts = games.some((item) => item.discount);
                var hasPlusDiscounts = games.some((item) => item.plusDiscount);

                var reddit = renderPlaystationRedditTable(games, hasDiscounts, hasPlusDiscounts);
                var html = renderPlaystationHTMLTable(games, hasDiscounts, hasPlusDiscounts);

                var total = games.length;

                sendResponse({
                    reddit,
                    html,
                    total,
                    start,
                    size
                });
            });

        // Async sendResponse
        return true;
    }

    function adjustFilters(region, platform) {
        let filterButton = document.querySelector('button[data-qa="ems-sdk-grid-sort-filter-btn-mobile"]');
        filterButton && filterButton.click();

        checkFilters(platform);
        checkSort();

        filterButton = document.querySelector('button[data-qa="ems-sdk-grid-sort-filter-btn-mobile"]');
        filterButton && filterButton.click();
    }

    function checkFilters(platform) {
        let filterMapper = [
            'storeDisplayClassification:FULL_GAME',
            'storeDisplayClassification:GAME_BUNDLE',
            'storeDisplayClassification:PREMIUM_EDITION'
        ];
        Array.from(document.querySelectorAll('.ems-sdk-filters__facet input')).forEach((node) => {
            let filterName = node.parentElement.getAttribute('for');
            let shouldCheck = filterMapper.includes(filterName);
            let needsClick = (shouldCheck && !node.checked) || (!shouldCheck && node.checked);

            if (needsClick) {
                node.parentElement.click();
            }
        });

        if (platform !== 'any') {
            let platformToggle = document.querySelector('[data-qa="ems-sdk-collapsible-menu--targetPlatforms"]');
            if (platformToggle && platformToggle.getAttribute('aria-expanded') !== 'true') {
                platformToggle.click();
            }

            Array.from(document.querySelectorAll('[data-qa="ems-sdk-collabsable-menu-content--targetPlatforms"] button')).forEach((node) => {
                let isPlatform = node.id === `targetPlatforms:${platform.toUpperCase()}`;
                let isChecked = Array.from(node.classList).includes('checked');
                let shouldClick = (isPlatform && !isChecked) || (!isPlatform && isChecked);

                if (shouldClick) {
                    node.click();
                }
            });
        }
    }

    function checkSort() {
        let sortButton = document.querySelector('.ems-sdk-collapsible-menu__sort');
        if (sortButton) {
            sortButton.click();
            let radioButton = document.querySelector('input[value="productName:true"]');
            radioButton && radioButton.click();
        }
    }

    function loadDeal(resolver, dealObj) {
        return new Promise((resolve) => {
            resolver = resolver || resolve;
            dealObj = dealObj || {};
            waitForLoad()
                .then(() => {
                    parsePage(dealObj);

                    let nextButton = document.querySelector('button[data-qa="ems-sdk-grid#ems-sdk-top-paginator-root#next"]');
                    if (nextButton && !nextButton.disabled) {
                        nextButton.click();
                        loadDeal(resolver, dealObj);
                    } else {
                        resolver(dealObj);
                    }
                });
        });
    }

    function waitForLoad(resolver) {
        return new Promise((resolve) => {
            resolver = resolver || resolve;
            if (document.querySelector('.psw-grid-list').textContent) {
                resolver();
            } else {
                setTimeout(() => {
                    waitForLoad(resolver);
                }, 100);
            }
        });
    }

    function parsePage(dealObj) {
        Array.from(document.querySelectorAll('.psw-grid-list li')).forEach((node) => {
            let name = node.querySelector('[data-qa*="#product-name"]')?.textContent.trim();
            let platform = Array.from(node.querySelectorAll('[data-qa*="#game-art#tag"]'))?.map((platformNode) => {
                return platformNode.textContent;
            }).join('-');

            dealObj[`${name}-${platform}`] = dealObj[`${name}-${platform}`] ?? {
                name: name,
                platform: platform,
                url: new URL(
                        node.querySelector('[data-track="web:store:product-tile"]')?.getAttribute('href'),
                        `${document.location.origin}${document.location.pathname.split('/').slice(0,-1).join('/')}`
                    ).href,
                originalPrice: node.querySelector('[data-qa*="#price#price-strikethrough"]')?.textContent
            };

            let product = dealObj[`${name}-${platform}`];

            let discount = node.querySelector('[data-qa*="#discount-badge#text"]');
            if (discount) {
                let price = node.querySelector('[data-qa*="#price#display-price"]');
                let isPlus = Array.from(discount.classList).includes('psw-discount-badge--ps-plus');
                if (isPlus) {
                    Object.assign(product, {
                        plusPrice: price.textContent,
                        plusDiscount: Math.abs(getNumber(discount.textContent)) + '%'
                    });
                } else {
                    Object.assign(product, {
                        price: price.textContent,
                        discount: Math.abs(getNumber(discount.textContent)) + '%'
                    });
                }
            }

            let plusDiscount = node.querySelector('[data-qa*="#service-upsell"]');
            if (plusDiscount) {
                let plusDiscountNum = getNumber(plusDiscount.textContent)
                    + getNumber(product.discount);

                if (plusDiscountNum !== getNumber(product.discount)) {
                    Object.assign(product, {
                        plusPrice: new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency: 'USD',
                            }).format(getNumber(product.originalPrice) * ((100 - Math.abs(plusDiscountNum))/100)),
                        plusDiscount: `${plusDiscountNum}%`
                    });
                }

            }
        });
    }

    function getNumber(str) {
        return Number(String(str).replace(/[^\d.]/g, ''));
    }


    function htmlEscape(value) {
        return $('<div/>').text(value).html();
    }

    function redditEscape(value) {
        return value.replace("[", "\\[").replace("]", "\\]");
    }

    function renderPlaystationRedditTable(games, hasDiscounts, hasPlusDiscounts) {
        var headers = ['Game', 'Platform'];
        if (hasDiscounts) headers.push('Price', '% Off');
        if (hasPlusDiscounts) headers.push('PS+', '% Off');

        var result = redditTableRow(headers) + redditTableRow(headers.map(() => ':--'));

        games.forEach((game) => {
            var cols = [
                '[' + redditEscape(game.name) + '](' + game.url + ')',
                game.platform
            ];

            if (hasDiscounts) cols.push(game.price, game.discount);
            if (hasPlusDiscounts) cols.push(game.plusPrice, game.plusDiscount);

            let row = redditTableRow(cols);

            let pre = Math.floor(result.length / 10000);
            let post = Math.floor((result.length + row.length) / 10000);

            if (pre !== post) {
                result += '\n\n';
                result += redditTableRow(headers) + redditTableRow(headers.map(() => ":--"));
            }

            result += row;
        });
        return result;
    }

    function renderPlaystationHTMLTable(games, hasDiscounts, hasPlusDiscounts) {
        var headers = ["Game (" + games.length + ")"];
        if (hasDiscounts) headers.push("Price", "% Off");
        if (hasPlusDiscounts) headers.push("PS+", "% Off");

        var result = "<thead>" + htmlTableRow(headers, "th") + "</thead><tbody>";

        $(games).each((idx, game) => {
            var cols = ["<a href=\"" + game.url + "\">" + htmlEscape(game.name) + "</a>"];

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
        $(".gameDiv[data-bigid]").each((_idx, el) => {
            rawGuids.push($(el).data("bigid"));
        });
        console.log(rawGuids);
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
            sendResponse({
                reddit: result
            });
        });

        // Async sendResponse
        return true;
    }
});