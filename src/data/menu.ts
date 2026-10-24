/**
 * Transcribed from this restaurant's photographed menu, published 5 April 2025.
 * These are historical menu prices, not a claim about today's prices or stock.
 * Food photos are deliberately left for the restaurant owner to supply.
 */
export type Category = 'all' | 'mains' | 'grill' | 'soups' | 'bakery' | 'salads' | 'drinks';

export type MenuItem = {
  id: string;
  name: string;
  ko: string;
  category: Exclude<Category, 'all'>;
  description: string;
  descriptionKo: string;
  price?: number;
  image: string;
};

export const menuSource = {
  url: 'https://m.blog.naver.com/infinimind/223823396263',
  date: '2025-04-05',
  note: 'Menu photographed April 2025; current availability and prices may differ.',
};

function dish(
  id: string,
  name: string,
  ko: string,
  category: Exclude<Category, 'all'>,
  description: string,
  descriptionKo: string,
  price?: number,
): MenuItem {
  return { id, name, ko, category, description, descriptionKo, price, image: `/menu/${id}.jpg` };
}

export const menuItems: MenuItem[] = [
  // Hot dishes — all four spreads in the photographed menu.
  dish('plov', 'Plov', '필라프', 'mains', 'Uzbek rice pilaf, served as an individual plate.', '한 접시로 즐기는 우즈베키스탄식 필라프.', 11000),
  dish('uyghur-lagman', 'Uyghur Lagman', '위구르 라그만', 'mains', 'The menu’s Uyghur-style noodle dish.', '위구르식 라그만 면 요리.', 10000),
  dish('fried-lagman', 'Fried Lagman', '튀긴 라그만', 'mains', 'Lagman noodles, stir-fried and served hot.', '뜨겁게 볶아낸 라그만 면 요리.', 10000),
  dish('manti', 'Manti', '만티', 'mains', 'Steamed Central Asian dumplings.', '중앙아시아식 찐만두.', 11000),
  dish('fried-manti', 'Fried Manti', '튀긴 만티', 'mains', 'The fried version of the menu’s manti dumplings.', '바삭하게 튀긴 만티 만두.', 11000),
  dish('oromo', 'Oromo / Hanum', '오로모 / 하눔', 'mains', 'Rolled dumplings, served in generous slices.', '돌돌 말아 쪄낸 롤 만두.', 10000),
  dish('kazan-kebab', 'Kazan Kebab', '카잔 케밥', 'mains', 'A hot lamb dish from the restaurant’s menu.', '카잔 방식으로 조리한 양고기 요리.', 14000),
  dish('chicken-fillet', 'Chicken Fillet', '치킨 필레', 'mains', 'Kurinoe file, the menu’s chicken fillet plate.', '메뉴판의 쿠리노에 필레, 닭고기 필레 요리.', 10000),
  dish('tomato-chicken-fillet', 'Chicken in Tomato Sauce', '토마토 소스 닭고기 필레', 'mains', 'Chicken fillet in tomato sauce.', '토마토 소스로 맛을 낸 닭고기 필레.', 10000),
  dish('tabaka', 'Chicken Tabaka', '닭고기 반개', 'mains', 'A half-chicken plate, listed as tabaka.', '닭 반 마리로 즐기는 타바카.', 10000),
  dish('chicken-sizzling-plate', 'Sizzling Chicken', '치킨 철판구이', 'mains', 'Zharovnya s kuritsey, served on a hot plate.', '뜨거운 철판에 담아내는 닭고기 요리.', 11000),
  dish('lamb-sizzling-plate', 'Sizzling Lamb', '양고기 로스터', 'mains', 'Zharovnya baranina, the menu’s lamb hot plate.', '뜨거운 철판에 담아내는 양고기 요리.', 14000),
  dish('spicy-beef', 'Spicy Beef', '매운 쇠고기', 'mains', 'Ostraya govyadina, the spicy beef plate.', '매콤하게 즐기는 쇠고기 요리.', 14000),
  dish('homestyle-cutlets', 'Homestyle Cutlets', '집에서 만든 커틀릿', 'mains', 'Kotlet po domashnemu, homestyle beef cutlets.', '가정식으로 조리한 쇠고기 커틀릿.', 11000),
  dish('french-style-beef', 'French-style Beef', '프랑스식 고기', 'mains', 'Myaso po frantsuzkiy, a French-style meat plate.', '미야소 포 프란추스키, 프랑스식 고기 요리.', 14000),
  dish('bogatyr-cutlet', 'Bogatyr Cutlet', '영웅적인 커틀릿', 'mains', 'Kotlet y bogatyrskiy, a hearty cutlet plate.', '보가티르 스타일의 커틀릿 한 접시.', 11000),
  dish('brizol', 'Brizol', '브리졸', 'mains', 'The menu’s rolled brizol dish.', '돌돌 말아 담아낸 브리졸 요리.', 11000),
  dish('beef-stroganoff', 'Beef Stroganoff', '비프 스트로가노프', 'mains', 'A classic beef stroganoff plate.', '비프 스트로가노프 한 접시.', 12000),
  dish('goulash', 'Goulash', '굴라쉬', 'mains', 'Gulyash, served as a hot beef plate.', '뜨겁게 즐기는 쇠고기 굴라쉬.', 11000),
  dish('beefsteak', 'Bifshteks', '비슈텍스', 'mains', 'The menu’s beefsteak-style plate.', '메뉴판의 비슈텍스 스테이크 요리.', 11000),
  dish('ragu', 'Ragu', '라구', 'mains', 'The restaurant’s hot ragu dish.', '따뜻하게 즐기는 라구 요리.', 11000),
  dish('norin', 'Norin', '노린', 'mains', 'A Central Asian dish of fine noodles and meat.', '잘게 썬 면과 고기를 함께 즐기는 노린.', 12000),
  dish('chicken-nuggets', 'Chicken Nuggets', '너겟', 'mains', 'A plate of chicken nuggets.', '닭고기 너겟 한 접시.', 11000),
  dish('thai-style-beef', 'Thai-style Beef', '태국식 쇠고기', 'mains', 'Tayskiy, the menu’s Thai-style beef dish.', '타이스키, 태국식 쇠고기 요리.', 12000),
  // The menu lists both sharing pilafs as dishes to order, priced per 1 kg.
  dish('tashkent-plov', 'Tashkent Plov · 1 kg', '타슈켄트 필라프 · 1kg', 'mains', 'A sharing portion of Tashkent-style plov. Arrange in advance.', '함께 나누는 타슈켄트식 필라프. 사전 문의해 주세요.', 85000),
  dish('chayhana-plov', 'Chayhana Plov · 1 kg', '찻집 필라프 · 1kg', 'mains', 'A sharing portion of chayhana-style plov. Arrange in advance.', '함께 나누는 찻집 스타일 필라프. 사전 문의해 주세요.', 85000),
  // Grills and large sharing plates.
  dish('lamb-shashlik', 'Lamb Shashlik', '양고기 케밥', 'grill', 'Shashlyk baranina, grilled lamb on a skewer.', '꼬치에 구워낸 양고기 샤슬릭.', 8000),
  dish('chicken-shashlik', 'Chicken Shashlik', '닭고기 케밥', 'grill', 'Shashlyk kuriniy, grilled chicken on a skewer.', '꼬치에 구워낸 닭고기 샤슬릭.', 6000),
  dish('kebab', 'Kebab', '케밥', 'grill', 'The menu’s classic grilled beef kebab.', '그릴에서 구워내는 쇠고기 케밥.', 8000),
  dish('iskander-kebab', 'Iskander Kebab', '이스칸데르 케밥', 'grill', 'An Iskander-style kebab from the grill menu.', '그릴 메뉴의 이스칸데르 케밥.', 8000),
  dish('iskander-set', 'Iskander Set', '이스칸데르 세트', 'grill', 'The Iskander kebab set plate.', '이스칸데르 케밥 세트 한 접시.', 14000),
  dish('halal-assorti', 'Halal Assorti', '할랄 모듬', 'grill', 'A mixed plate from the restaurant’s grill menu.', '그릴 메뉴를 함께 즐기는 할랄 모듬.', 22000),
  dish('meat-assortment', 'Meat Assortment', '고기 모듬', 'grill', 'A large mixed meat platter for sharing.', '함께 나누어 즐기는 고기 모듬.', 75000),
  // The photo gives two prices without identifying the corresponding sizes.
  dish('koy-toy', 'Koy Toy', '양고기 전체', 'grill', 'A celebration lamb platter. Ask about portions and advance orders.', '모임을 위한 양고기 요리. 크기와 사전 주문을 문의해 주세요.'),
  // Soups, matching the restaurant’s own menu grouping.
  dish('mastava', 'Mastava', '마스타바', 'soups', 'A warming Uzbek rice soup.', '따뜻하게 즐기는 우즈베키스탄식 쌀 수프.', 10000),
  dish('dolma', 'Dolma', '돌마', 'soups', 'The restaurant’s dolma, served in broth.', '국물과 함께 즐기는 돌마.', 12000),
  dish('chuchvara', 'Chuchvara', '추츠바라', 'soups', 'Small dumplings served in a bowl of broth.', '작은 만두를 넣어 끓인 수프.', 10000),
  dish('uzbek-lagman', 'Uzbek Lagman', '우즈벡 라그만', 'soups', 'Uzbek-style lagman from the soup menu.', '국물과 함께 즐기는 우즈벡식 라그만.', 10000),
  dish('koza-shorva', 'Koza Shorva', '수프 한 그릇', 'soups', 'Shorva served in a traditional pot.', '전통 그릇에 담아내는 쇼르바 수프.', 12000),
  dish('beshbarmak', 'Beshbarmak', '베쉬바르막', 'soups', 'A Central Asian meat and noodle dish.', '고기와 넓은 면을 함께 즐기는 중앙아시아 요리.', 10000),
  dish('borscht', 'Borscht', '보르쉬', 'soups', 'The menu’s warming red beet soup.', '따뜻하게 즐기는 붉은 비트 수프.', 10000),
  // Breads and pastries. Samsa is additionally documented in a later review.
  dish('samsa', 'Samsa', '삼사', 'bakery', 'A baked pastry also known as somsa.', '솜사라고도 부르는 오븐에 구운 페이스트리.'),
  dish('lavash-kebab', 'Lavash Kebab', '피타 케밥', 'bakery', 'A kebab wrapped in lavash bread.', '라바시 빵에 싸서 즐기는 케밥.', 9000),
  dish('boorsok', 'Boorsok · 1 kg', '부르석 · 1kg', 'bakery', 'Golden pieces of fried bread, in a 1 kg portion.', '노릇하게 튀긴 빵, 1kg 분량.', 15000),
  dish('bread', 'Bread / Hleb', '빵', 'bakery', 'A round bread to share with the table.', '요리와 함께 나누기 좋은 둥근 빵.', 4000),
  // All nine salads and cold starters.
  dish('greek-salad', 'Greek Salad', '그리스 샐러드', 'salads', 'Grecheskiy salad, a Greek-style cold starter.', '차갑게 즐기는 그리스식 샐러드.', 6000),
  dish('carrot-salad', 'Carrot Salad', '당근 샐러드', 'salads', 'Morkovniy salad, a shredded carrot side.', '잘게 채 썬 당근 샐러드.', 5000),
  dish('caesar-salad', 'Caesar Salad', '시저 샐러드', 'salads', 'The menu’s Caesar-style salad.', '메뉴판의 시저 스타일 샐러드.', 6000),
  dish('vegetable-assortment', 'Vegetable Assortment', '혼합 야채', 'salads', 'Ovoshnoy assorty, a mixed vegetable plate.', '여러 야채를 함께 담아낸 한 접시.', 5000),
  dish('shakarop', 'Shakarop', '샤카랍', 'salads', 'A fresh tomato and onion salad.', '토마토와 양파를 함께 즐기는 샐러드.', 5000),
  dish('fresh-salad', 'Fresh Salad', '신선한 샐러드', 'salads', 'Svejiy salad, the fresh house salad.', '신선하게 즐기는 샐러드 한 접시.', 5000),
  dish('nest-salad', 'Gnezdo Glukharya', '캐퍼칼리 둥지', 'salads', 'A nest-shaped salad from the cold starters.', '둥지 모양으로 담아내는 샐러드.', 6000),
  dish('olivier-salad', 'Olivier Salad', '올리비에', 'salads', 'The classic diced Olivier salad.', '잘게 썬 재료로 만드는 올리비에 샐러드.', 6000),
  dish('teshchin-yazyk', 'Teshchin Yazyk', '시어머니의 혀', 'salads', 'A cold starter listed as Teshchin Yazyk.', '테쉰 야지크라는 이름의 차가운 전채 요리.', 6000),
  // Tea and every cold-drink line on the photographed beverage page.
  dish('tea', 'Tea', '차', 'drinks', 'A warm cup to enjoy with your meal.', '식사와 함께 즐기는 따뜻한 차.', 1000),
  dish('fruit-tea', 'Fruit Tea', '과일 차', 'drinks', 'The menu’s fruit tea.', '과일의 풍미를 즐기는 차.', 3000),
  dish('lemon-tea', 'Tea with Lemon', '레몬 차', 'drinks', 'Tea served with lemon.', '레몬을 곁들인 차.', 2000),
  // Kefir’s printed "200/4,000" and Sprite’s size-price mapping are ambiguous.
  dish('kefir', 'Kefir', '케피어', 'drinks', 'Fermented milk drink. Ask about serving size and price.', '발효 유음료. 용량과 가격을 문의해 주세요.'),
  dish('juice', 'Juice', '주스', 'drinks', 'Ask which juice flavours are available today.', '오늘 준비된 주스 종류를 문의해 주세요.', 6000),
  dish('sprite', 'Sprite', '스프라이트', 'drinks', 'Lemon-lime soft drink. Ask about sizes.', '레몬 라임 탄산음료. 용량을 문의해 주세요.'),
  dish('fanta', 'Fanta', '환타', 'drinks', 'A chilled Fanta soft drink.', '시원하게 즐기는 환타.', 2000),
  dish('barbican', 'Barbican', '바비칸', 'drinks', 'Barbican from the cold-drinks menu.', '차가운 음료 메뉴의 바비칸.', 9000),
  dish('mojito-330', 'Mojito · 330 ml', '모히또 · 330ml', 'drinks', 'A non-alcoholic mojito drink.', '무알코올 모히또 음료.', 4000),
  dish('mojito-500', 'Mojito · 500 ml', '모히또 · 500ml', 'drinks', 'A non-alcoholic mojito drink.', '무알코올 모히또 음료.', 4500),
  dish('gorilla-energy', 'Gorilla Energy Drink', '고릴라 에너지 음료', 'drinks', 'Gorilla energy drink, served chilled.', '시원하게 즐기는 고릴라 에너지 음료.', 4000),
  dish('coca-cola-1250', 'Coca-Cola · 1.25 L', '코카콜라 · 1.25L', 'drinks', 'A larger bottle for the table.', '함께 나누기 좋은 큰 병 콜라.', 4000),
  dish('coca-cola-500-300', 'Coca-Cola · 500 / 300 ml', '코카콜라 · 500 / 300ml', 'drinks', 'The sizes listed together on the menu.', '메뉴판에 함께 표기된 용량의 콜라.', 2000),
  dish('coca-cola-330', 'Coca-Cola · 330 ml', '코카콜라 · 330ml', 'drinks', 'A chilled Coca-Cola.', '시원하게 즐기는 코카콜라.', 2000),
  dish('pepsi-500', 'Pepsi · 500 ml', '펩시 · 500ml', 'drinks', 'A chilled Pepsi.', '시원하게 즐기는 펩시.', 2000),
  dish('pepsi-330', 'Pepsi · 330 ml', '펩시 · 330ml', 'drinks', 'A chilled Pepsi.', '시원하게 즐기는 펩시.', 2000),
  dish('natakhtari-tarragon', 'Natakhtari Tarragon', '나타크타리 타라곤', 'drinks', 'Natakhtari’s tarragon-flavoured soft drink.', '타라곤 향의 나타크타리 탄산음료.', 4000),
  dish('chernogolovka-tarkhun', 'Chernogolovka Tarkhun', '체르노골로브카 타르훈', 'drinks', 'A tarragon-flavoured drink from Chernogolovka.', '타라곤 향의 체르노골로브카 음료.', 5000),
];
