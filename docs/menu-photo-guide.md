# Menu photo guide

The site has designed photo placeholders for all 72 menu items. You can replace them one at a time with the restaurant's own photos.

## Add a photo

1. Find the dish in the table below.
2. Save its photo in `public/menu/` using the listed filename, for example `public/menu/plov.jpg`.
3. Refresh the page when developing locally. For the production website, rebuild and redeploy so the new photo is included.

The server page automatically detects `.jpg`, `.jpeg`, `.png`, `.webp`, and `.avif`. Keep the same dish ID before the extension: `plov.webp` also works. Use lowercase filenames and keep only one photo per dish ID to avoid ambiguity. A file needs to be a real image in its stated format; renaming a different file type does not convert it.

Landscape photos around **1200 x 900 pixels** work well. Keep the dish in the centre with some space around it because cards crop photos to fit. Export web-friendly files for faster loading. You can leave any dish without a photo and its designed placeholder will remain.

## Edit the restaurant's content

- Menu names, Korean names, descriptions, and prices: `src/data/menu.ts`.
- Restaurant contact, address, Instagram, and map links: `src/data/restaurant.ts`.
- Menu provenance and the April 2025 price date: `docs/restaurant-sources.md`.

Keep menu IDs stable after adding photos; each filename is matched to its ID. Prices are in whole Korean won. An omitted price displays the site's price-inquiry state. Verify current prices with the restaurant before replacing the dated source prices.

## Complete photo filename list

The `.jpg` filenames below are examples; the other supported extensions work with the same ID.

### Mains

| Dish ID | Filename in public/menu | Display name | Korean name |
| --- | --- | --- | --- |
| `plov` | `plov.jpg` | Plov | 필라프 |
| `uyghur-lagman` | `uyghur-lagman.jpg` | Uyghur Lagman | 위구르 라그만 |
| `fried-lagman` | `fried-lagman.jpg` | Fried Lagman | 튀긴 라그만 |
| `manti` | `manti.jpg` | Manti | 만티 |
| `fried-manti` | `fried-manti.jpg` | Fried Manti | 튀긴 만티 |
| `oromo` | `oromo.jpg` | Oromo / Hanum | 오로모 / 하눔 |
| `kazan-kebab` | `kazan-kebab.jpg` | Kazan Kebab | 카잔 케밥 |
| `chicken-fillet` | `chicken-fillet.jpg` | Chicken Fillet | 치킨 필레 |
| `tomato-chicken-fillet` | `tomato-chicken-fillet.jpg` | Chicken in Tomato Sauce | 토마토 소스 닭고기 필레 |
| `tabaka` | `tabaka.jpg` | Chicken Tabaka | 닭고기 반개 |
| `chicken-sizzling-plate` | `chicken-sizzling-plate.jpg` | Sizzling Chicken | 치킨 철판구이 |
| `lamb-sizzling-plate` | `lamb-sizzling-plate.jpg` | Sizzling Lamb | 양고기 로스터 |
| `spicy-beef` | `spicy-beef.jpg` | Spicy Beef | 매운 쇠고기 |
| `homestyle-cutlets` | `homestyle-cutlets.jpg` | Homestyle Cutlets | 집에서 만든 커틀릿 |
| `french-style-beef` | `french-style-beef.jpg` | French-style Beef | 프랑스식 고기 |
| `bogatyr-cutlet` | `bogatyr-cutlet.jpg` | Bogatyr Cutlet | 영웅적인 커틀릿 |
| `brizol` | `brizol.jpg` | Brizol | 브리졸 |
| `beef-stroganoff` | `beef-stroganoff.jpg` | Beef Stroganoff | 비프 스트로가노프 |
| `goulash` | `goulash.jpg` | Goulash | 굴라쉬 |
| `beefsteak` | `beefsteak.jpg` | Bifshteks | 비슈텍스 |
| `ragu` | `ragu.jpg` | Ragu | 라구 |
| `norin` | `norin.jpg` | Norin | 노린 |
| `chicken-nuggets` | `chicken-nuggets.jpg` | Chicken Nuggets | 너겟 |
| `thai-style-beef` | `thai-style-beef.jpg` | Thai-style Beef | 태국식 쇠고기 |
| `tashkent-plov` | `tashkent-plov.jpg` | Tashkent Plov · 1 kg | 타슈켄트 필라프 · 1kg |
| `chayhana-plov` | `chayhana-plov.jpg` | Chayhana Plov · 1 kg | 찻집 필라프 · 1kg |

### Grill and sharing plates

| Dish ID | Filename in public/menu | Display name | Korean name |
| --- | --- | --- | --- |
| `lamb-shashlik` | `lamb-shashlik.jpg` | Lamb Shashlik | 양고기 케밥 |
| `chicken-shashlik` | `chicken-shashlik.jpg` | Chicken Shashlik | 닭고기 케밥 |
| `kebab` | `kebab.jpg` | Kebab | 케밥 |
| `iskander-kebab` | `iskander-kebab.jpg` | Iskander Kebab | 이스칸데르 케밥 |
| `iskander-set` | `iskander-set.jpg` | Iskander Set | 이스칸데르 세트 |
| `halal-assorti` | `halal-assorti.jpg` | Halal Assorti | 할랄 모듬 |
| `meat-assortment` | `meat-assortment.jpg` | Meat Assortment | 고기 모듬 |
| `koy-toy` | `koy-toy.jpg` | Koy Toy | 양고기 전체 |

### Soups

| Dish ID | Filename in public/menu | Display name | Korean name |
| --- | --- | --- | --- |
| `mastava` | `mastava.jpg` | Mastava | 마스타바 |
| `dolma` | `dolma.jpg` | Dolma | 돌마 |
| `chuchvara` | `chuchvara.jpg` | Chuchvara | 추츠바라 |
| `uzbek-lagman` | `uzbek-lagman.jpg` | Uzbek Lagman | 우즈벡 라그만 |
| `koza-shorva` | `koza-shorva.jpg` | Koza Shorva | 수프 한 그릇 |
| `beshbarmak` | `beshbarmak.jpg` | Beshbarmak | 베쉬바르막 |
| `borscht` | `borscht.jpg` | Borscht | 보르쉬 |

### Bread and pastries

| Dish ID | Filename in public/menu | Display name | Korean name |
| --- | --- | --- | --- |
| `samsa` | `samsa.jpg` | Samsa | 삼사 |
| `lavash-kebab` | `lavash-kebab.jpg` | Lavash Kebab | 피타 케밥 |
| `boorsok` | `boorsok.jpg` | Boorsok · 1 kg | 부르석 · 1kg |
| `bread` | `bread.jpg` | Bread / Hleb | 빵 |

### Salads and cold starters

| Dish ID | Filename in public/menu | Display name | Korean name |
| --- | --- | --- | --- |
| `greek-salad` | `greek-salad.jpg` | Greek Salad | 그리스 샐러드 |
| `carrot-salad` | `carrot-salad.jpg` | Carrot Salad | 당근 샐러드 |
| `caesar-salad` | `caesar-salad.jpg` | Caesar Salad | 시저 샐러드 |
| `vegetable-assortment` | `vegetable-assortment.jpg` | Vegetable Assortment | 혼합 야채 |
| `shakarop` | `shakarop.jpg` | Shakarop | 샤카랍 |
| `fresh-salad` | `fresh-salad.jpg` | Fresh Salad | 신선한 샐러드 |
| `nest-salad` | `nest-salad.jpg` | Gnezdo Glukharya | 캐퍼칼리 둥지 |
| `olivier-salad` | `olivier-salad.jpg` | Olivier Salad | 올리비에 |
| `teshchin-yazyk` | `teshchin-yazyk.jpg` | Teshchin Yazyk | 시어머니의 혀 |

### Tea and drinks

| Dish ID | Filename in public/menu | Display name | Korean name |
| --- | --- | --- | --- |
| `tea` | `tea.jpg` | Tea | 차 |
| `fruit-tea` | `fruit-tea.jpg` | Fruit Tea | 과일 차 |
| `lemon-tea` | `lemon-tea.jpg` | Tea with Lemon | 레몬 차 |
| `kefir` | `kefir.jpg` | Kefir | 케피어 |
| `juice` | `juice.jpg` | Juice | 주스 |
| `sprite` | `sprite.jpg` | Sprite | 스프라이트 |
| `fanta` | `fanta.jpg` | Fanta | 환타 |
| `barbican` | `barbican.jpg` | Barbican | 바비칸 |
| `mojito-330` | `mojito-330.jpg` | Mojito · 330 ml | 모히또 · 330ml |
| `mojito-500` | `mojito-500.jpg` | Mojito · 500 ml | 모히또 · 500ml |
| `gorilla-energy` | `gorilla-energy.jpg` | Gorilla Energy Drink | 고릴라 에너지 음료 |
| `coca-cola-1250` | `coca-cola-1250.jpg` | Coca-Cola · 1.25 L | 코카콜라 · 1.25L |
| `coca-cola-500-300` | `coca-cola-500-300.jpg` | Coca-Cola · 500 / 300 ml | 코카콜라 · 500 / 300ml |
| `coca-cola-330` | `coca-cola-330.jpg` | Coca-Cola · 330 ml | 코카콜라 · 330ml |
| `pepsi-500` | `pepsi-500.jpg` | Pepsi · 500 ml | 펩시 · 500ml |
| `pepsi-330` | `pepsi-330.jpg` | Pepsi · 330 ml | 펩시 · 330ml |
| `natakhtari-tarragon` | `natakhtari-tarragon.jpg` | Natakhtari Tarragon | 나타크타리 타라곤 |
| `chernogolovka-tarkhun` | `chernogolovka-tarkhun.jpg` | Chernogolovka Tarkhun | 체르노골로브카 타르훈 |

