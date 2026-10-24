# Restaurant content sources

Researched 15 October 2026. The website retains the existing BARAKA creative brand; the public listings below identify the restaurant as 우즈벡할랄식당 / HALAL FOOD. A connection between that public listing and the user-supplied chef account is based on the user's description, not independently verified ownership information.

## Location

- Public name: **우즈벡할랄식당**. Administrative-data mirror spells it **우주벡할랄식당(HALAL FOOD)**.
- Address: **충청북도 청주시 흥덕구 신율로 178, 1층 (복대동)**.
- Lot address: **충청북도 청주시 흥덕구 복대동 167-1**.
- English: **1F, 178 Sinyul-ro, Heungdeok-gu, Cheongju-si, Chungcheongbuk-do, South Korea**.
- Naver place ID: **1337003092**.
- Naver place URL: <https://map.naver.com/p/entry/place/1337003092>.
- Naver mobile URL: <https://m.place.naver.com/restaurant/1337003092/home>.
- Marker coordinates, extracted from the review's original Naver map embed: **36.6334383, 127.4475526** (latitude, longitude).
- The 2025 review describes the location as **공단오거리**, consistent with the user's industrial-complex entrance description.

Sources:

1. [Diningcode listing](https://www.diningcode.com/profile.php?rid=IfSIpLRph9Mq): name, road and lot addresses; hours explicitly require confirmation.
2. [Administrative-data mirror](https://grt.purpleo.kr/article/292004): full address including 1F, public restaurant registration. Data last updated October 2024; not evidence of current operating hours.
3. [Naver review, 5 April 2025](https://m.blog.naver.com/infinimind/223823396263): photographed exterior, menu, and embedded Naver place metadata (ID, address, latitude, longitude).

Naver's place page could not be read through the web tool. The ID is not guessed: it appears in the public Naver blog's `se-map-info` and `v2_map` metadata with the matching restaurant name and street address.

## Business contact

The **restaurant's own printed menu**, photographed in the Naver review, says:

- **043-268-8329** — restaurant telephone.
- **010-2996-8329** — mobile business contact printed on the menu.
- **@halal_food_kr** — restaurant Instagram printed on the menu.

The landline is additionally listed for the same business and street address in the [nearby-business data on this directory page](https://hut.purpleo.kr/article/262). The photographed printed menu is the stronger evidence. Use the landline as the site's primary call link; avoid representing the mobile as the chef's personal phone number.

Hours and chef's personal/full name were not verified in this research. No invented opening times, ratings, certification claims, or personal biography should be used.

## Menu

`src/data/menu.ts` transcribes **72 items**: all the food and beverage entries readable across the photographed menu, plus samsa documented in another customer review. Prices are **historical April 2025 menu prices**, not live pricing. The UI should display the menu date and explain that availability/prices may change.

Main source: [Naver menu photographs](https://m.blog.naver.com/infinimind/223823396263), published 5 April 2025. The public image originals were inspected to read the printed names/prices. Reviewer photos are research references and are **not copied into the website's customer photo gallery**.

Photo sequence in the source (zero-based among `se-image-resource` images):

- 9: welcome/business contact and Greek, carrot, Caesar salads.
- 11: six more salads/cold starters.
- 13: six soups/noodle dishes.
- 15, 17, 19, 21: 24 hot dishes.
- 23: three bakery dishes and two 1 kg sharing pilafs.
- 25: six mangal/grill dishes.
- 27: whole-lamb celebration dish, meat assortment, borscht, and all tea/cold-drink entries.

Samsa is additionally supported by [this Naver review](https://blog.naver.com/miiiin26/224401431141), linked and quoted in the [Diningcode listing](https://www.diningcode.com/profile.php?rid=IfSIpLRph9Mq). Its price was not verified, so it has no price field.

Transcription notes:

- English names are normalized to readable dish names. A few obviously incorrect machine translations on the printed Korean menu are clarified (e.g. chicken shashlik's Korean line says lamb, but its transliteration and chicken symbol identify chicken; brizol has the same Korean label as goulash, so it is rendered 브리졸).
- Descriptions are brief editorial explanations of the named dishes, not verified ingredient/allergen specifications.
- `Koy Toy` lists ₩250,000 and ₩500,000 without identifying the corresponding sizes. The website omits a single numeric price and invites an inquiry.
- Kefir's printed `200/4,000` is ambiguous. Its numeric price is omitted.
- Sprite's printed `4,000/2,000` has an unclear size mapping. Its numeric price is omitted.
- Two plov sharing dishes and boorsok have 1 kg explicitly printed.
- Manti, chicken nuggets, and every beverage line are retained even where a price is surprising; values follow the photographed menu.
- All photo paths are `/menu/<id>.jpg` for owner-provided photos. The UI should render an attractive placeholder if no file exists.

## Chef account

The user supplied **@asr.chef** and authorized use of a photo from that account. This research did not independently retrieve that profile's name or post photo; see any separate asset research by the implementing agent. Do not substitute an unrelated chef's photo or invent a full name.
