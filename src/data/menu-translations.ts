import { menuItems, type MenuItem } from "./menu";
import type { Language } from "@/lib/site-language";

// [Russian name, Uzbek name, Russian description, Uzbek description].
export const menuTranslations: Record<string, readonly [string, string, string, string]> = {
  "plov": ["Плов", "Osh", "Узбекский плов, порция на одного.", "Bir kishilik o‘zbek palovi."],
  "uyghur-lagman": ["Уйгурский лагман", "Uyg‘urcha lag‘mon", "Лагман по-уйгурски.", "Uyg‘ur usulida tayyorlangan lag‘mon."],
  "fried-lagman": ["Жареный лагман", "Qovurma lag‘mon", "Обжаренная лапша лагман, подаётся горячей.", "Qovurilgan lag‘mon, issiq holda tortiladi."],
  "manti": ["Манты", "Manti", "Среднеазиатские манты на пару.", "Bug‘da pishirilgan manti."],
  "fried-manti": ["Жареные манты", "Qovurma manti", "Обжаренные манты.", "Qovurilgan manti."],
  "oromo": ["Оромо / Ханум", "O‘rama / Xonim", "Паровой рулет, нарезанный порциями.", "Bug‘da pishirilgan, bo‘laklab tortiladigan o‘rama."],
  "kazan-kebab": ["Казан-кебаб", "Qozon kabob", "Горячее блюдо из баранины.", "Qo‘y go‘shtidan tayyorlangan issiq taom."],
  "chicken-fillet": ["Куриное филе", "Tovuq filesi", "Порция куриного филе.", "Tovuq filesidan tayyorlangan taom."],
  "tomato-chicken-fillet": ["Куриное филе в томатном соусе", "Pomidor sousidagi tovuq filesi", "Куриное филе с томатным соусом.", "Pomidor sousida tayyorlangan tovuq filesi."],
  "tabaka": ["Цыплёнок табака", "Tovuq tabaka", "Половина цыплёнка табака.", "Yarim tovuq tabaka."],
  "chicken-sizzling-plate": ["Жаровня с курицей", "Tovuq jaz", "Курица на горячей жаровне.", "Qizigan tovada tortiladigan tovuq go‘shti."],
  "lamb-sizzling-plate": ["Жаровня с бараниной", "Qo‘y go‘shtidan jaz", "Баранина на горячей жаровне.", "Qizigan tovada tortiladigan qo‘y go‘shti."],
  "spicy-beef": ["Острая говядина", "Achchiq mol go‘shti", "Острое блюдо из говядины.", "Achchiq qilib tayyorlangan mol go‘shti."],
  "homestyle-cutlets": ["Котлеты по-домашнему", "Uy usulidagi kotletlar", "Домашние котлеты из говядины.", "Mol go‘shtidan uy usulida tayyorlangan kotletlar."],
  "french-style-beef": ["Мясо по-французски", "Fransuzcha go‘sht", "Мясное блюдо по-французски.", "Fransuz usulida tayyorlangan go‘shtli taom."],
  "bogatyr-cutlet": ["Котлета «Богатырь»", "Bogatir kotleti", "Сытная котлета «Богатырь».", "To‘yimli Bogatir kotleti."],
  "brizol": ["Бризоль", "Brizol", "Бризоль в виде рулета.", "O‘rama shaklida tortiladigan brizol."],
  "beef-stroganoff": ["Бефстроганов", "Befstroganov", "Классический бефстроганов.", "An’anaviy befstroganov."],
  "goulash": ["Гуляш", "Gulyash", "Горячий гуляш из говядины.", "Mol go‘shtidan issiq gulyash."],
  "beefsteak": ["Бифштекс", "Bifshteks", "Бифштекс из меню ресторана.", "Restoran taomnomasidagi bifshteks."],
  "ragu": ["Рагу", "Ragu", "Горячее рагу от ресторана.", "Restoran usulidagi issiq ragu."],
  "norin": ["Нарын", "Norin", "Тонко нарезанная лапша с мясом.", "Mayda to‘g‘ralgan xamir va go‘shtdan norin."],
  "chicken-nuggets": ["Куриные наггетсы", "Tovuq naggetslari", "Порция куриных наггетсов.", "Bir porsiya tovuq naggetslari."],
  "thai-style-beef": ["Говядина по-тайски", "Taycha mol go‘shti", "Говядина в тайском стиле.", "Tay usulida tayyorlangan mol go‘shti."],
  "tashkent-plov": ["Ташкентский плов · 1 кг", "Toshkent oshi · 1 kg", "Ташкентский плов для компании. Закажите заранее.", "Davra uchun Toshkent oshi. Oldindan buyurtma bering."],
  "chayhana-plov": ["Чайханский плов · 1 кг", "Choyxona oshi · 1 kg", "Чайханский плов для компании. Закажите заранее.", "Davra uchun choyxona oshi. Oldindan buyurtma bering."],
  "lamb-shashlik": ["Шашлык из баранины", "Qo‘y go‘shtidan shashlik", "Баранина, приготовленная на шампуре.", "Sixda pishirilgan qo‘y go‘shti."],
  "chicken-shashlik": ["Куриный шашлык", "Tovuq shashligi", "Курица, приготовленная на шампуре.", "Sixda pishirilgan tovuq go‘shti."],
  "kebab": ["Кебаб", "Kabob", "Классический кебаб из говядины на гриле.", "Grilda pishirilgan mol go‘shti kabobi."],
  "iskander-kebab": ["Искандер-кебаб", "Iskandar kabob", "Кебаб в стиле Искандер.", "Iskandar usulidagi kabob."],
  "iskander-set": ["Набор «Искандер»", "Iskandar to‘plami", "Набор с Искандер-кебабом.", "Iskandar kabobli taomlar to‘plami."],
  "halal-assorti": ["Халяль-ассорти", "Halol assorti", "Ассорти из блюд на гриле.", "Grilda pishirilgan taomlar assortisi."],
  "meat-assortment": ["Мясное ассорти", "Go‘shtli assorti", "Большое мясное ассорти для компании.", "Davra uchun katta go‘shtli assorti."],
  "koy-toy": ["Кой той", "Qo‘y to‘y", "Праздничное блюдо из баранины. Уточните размер порции и предзаказ.", "Bayramona qo‘y go‘shti taomi. Porsiya va oldindan buyurtma haqida so‘rang."],
  "mastava": ["Мастава", "Mastava", "Согревающий узбекский рисовый суп.", "Issiq o‘zbek mastavasi."],
  "dolma": ["Долма", "Do‘lma", "Долма в бульоне.", "Sho‘rvada tortiladigan do‘lma."],
  "chuchvara": ["Чучвара", "Chuchvara", "Маленькие пельмени в бульоне.", "Sho‘rvada tortiladigan chuchvara."],
  "uzbek-lagman": ["Узбекский лагман", "O‘zbekcha lag‘mon", "Лагман по-узбекски с бульоном.", "Sho‘rvali o‘zbekcha lag‘mon."],
  "koza-shorva": ["Шурпа в горшочке", "Ko‘za sho‘rva", "Шурпа в традиционном горшочке.", "An’anaviy ko‘zada tortiladigan sho‘rva."],
  "beshbarmak": ["Бешбармак", "Beshbarmoq", "Среднеазиатское блюдо из мяса и лапши.", "Go‘sht va xamirdan Markaziy Osiyo taomi."],
  "borscht": ["Борщ", "Borsh", "Горячий суп со свёклой.", "Lavlagili issiq sho‘rva."],
  "samsa": ["Самса", "Somsa", "Печёная самса.", "Pishirilgan somsa."],
  "lavash-kebab": ["Кебаб в лаваше", "Lavash kabob", "Кебаб, завёрнутый в лаваш.", "Lavashga o‘ralgan kabob."],
  "boorsok": ["Боорсок · 1 кг", "Bo‘g‘irsoq · 1 kg", "Золотистые кусочки жареного теста, 1 кг.", "Oltinrang qilib qovurilgan bo‘g‘irsoq, 1 kg."],
  "bread": ["Хлеб", "Non", "Круглый хлеб к общему столу.", "Dasturxon uchun yumaloq non."],
  "greek-salad": ["Греческий салат", "Yunoncha salat", "Холодный салат в греческом стиле.", "Yunon usulidagi sovuq salat."],
  "carrot-salad": ["Морковный салат", "Sabzili salat", "Салат из нашинкованной моркови.", "Somoncha to‘g‘ralgan sabzidan salat."],
  "caesar-salad": ["Салат «Цезарь»", "Sezar salati", "Салат в стиле «Цезарь».", "Sezar usulidagi salat."],
  "vegetable-assortment": ["Овощное ассорти", "Sabzavotli assorti", "Тарелка разных овощей.", "Turli sabzavotlar assortisi."],
  "shakarop": ["Шакароп", "Shakarob", "Свежий салат из помидоров и лука.", "Pomidor va piyozdan yangi salat."],
  "fresh-salad": ["Свежий салат", "Yangi salat", "Свежий салат от ресторана.", "Restoran usulidagi yangi salat."],
  "nest-salad": ["Гнездо глухаря", "Gluxar uyasi", "Салат, оформленный в виде гнезда.", "Uya shaklida bezatilgan salat."],
  "olivier-salad": ["Оливье", "Olivye", "Классический салат оливье.", "An’anaviy olivye salati."],
  "teshchin-yazyk": ["Тёщин язык", "Qaynona tili", "Холодная закуска «Тёщин язык».", "Qaynona tili nomli sovuq gazak."],
  "tea": ["Чай", "Choy", "Горячий чай к вашему блюду.", "Taomingizga hamroh issiq choy."],
  "fruit-tea": ["Фруктовый чай", "Mevali choy", "Фруктовый чай из меню.", "Meva ta’mli choy."],
  "lemon-tea": ["Чай с лимоном", "Limonli choy", "Чай с добавлением лимона.", "Limon bilan tortiladigan choy."],
  "kefir": ["Кефир", "Kefir", "Кисломолочный напиток. Уточните объём и цену.", "Achitilgan sut ichimligi. Hajmi va narxini so‘rang."],
  "juice": ["Сок", "Sharbat", "Уточните, какие соки есть сегодня.", "Bugun qaysi sharbatlar borligini so‘rang."],
  "sprite": ["Спрайт", "Sprite", "Газированный напиток со вкусом лимона и лайма. Уточните объём.", "Limon va laym ta’mli gazli ichimlik. Hajmini so‘rang."],
  "fanta": ["Фанта", "Fanta", "Охлаждённая «Фанта».", "Sovutilgan Fanta."],
  "barbican": ["Барбикан", "Barbican", "Barbican из меню холодных напитков.", "Sovuq ichimliklar taomnomasidagi Barbican."],
  "mojito-330": ["Мохито · 330 мл", "Moxito · 330 ml", "Безалкогольный мохито.", "Alkogolsiz moxito."],
  "mojito-500": ["Мохито · 500 мл", "Moxito · 500 ml", "Безалкогольный мохито.", "Alkogolsiz moxito."],
  "gorilla-energy": ["Энергетик Gorilla", "Gorilla energetik ichimligi", "Охлаждённый энергетический напиток Gorilla.", "Sovutilgan Gorilla energetik ichimligi."],
  "coca-cola-1250": ["Кока-Кола · 1,25 л", "Coca-Cola · 1,25 l", "Большая бутылка для общего стола.", "Davra uchun katta idishdagi kola."],
  "coca-cola-500-300": ["Кока-Кола · 500 / 300 мл", "Coca-Cola · 500 / 300 ml", "Объёмы, указанные вместе в меню.", "Taomnomada birga ko‘rsatilgan hajmlar."],
  "coca-cola-330": ["Кока-Кола · 330 мл", "Coca-Cola · 330 ml", "Охлаждённая «Кока-Кола».", "Sovutilgan Coca-Cola."],
  "pepsi-500": ["Пепси · 500 мл", "Pepsi · 500 ml", "Охлаждённая «Пепси».", "Sovutilgan Pepsi."],
  "pepsi-330": ["Пепси · 330 мл", "Pepsi · 330 ml", "Охлаждённая «Пепси».", "Sovutilgan Pepsi."],
  "natakhtari-tarragon": ["Натахтари Тархун", "Natakhtari Tarxun", "Газированный напиток Natakhtari со вкусом тархуна.", "Tarxun ta’mli Natakhtari gazli ichimligi."],
  "chernogolovka-tarkhun": ["Черноголовка Тархун", "Chernogolovka Tarxun", "Напиток «Черноголовка» со вкусом тархуна.", "Tarxun ta’mli Chernogolovka ichimligi."],
};

type DishText = Pick<MenuItem, "id" | "name" | "ko" | "description" | "descriptionKo">;
const originalDishes = new Map(menuItems.map(item => [item.id, item]));
export function localizedDish(item: DishText, language: Language) {
  if (language === "ko") return { name: item.ko, description: item.descriptionKo };
  const original = originalDishes.get(item.id);
  const translation = menuTranslations[item.id];
  if (language === "en" || !original || !translation) return { name: item.name, description: item.description };
  const offset = language === "ru" ? 0 : 1;
  // Preserve owner edits and new dishes instead of showing an outdated translation.
  return {
    name: item.name === original.name ? translation[offset] : item.name,
    description: item.description === original.description ? translation[offset + 2] : item.description,
  };
}

export function dishSearchText(item: DishText) {
  return ["ko", "en", "ru", "uz"].map(language => {
    const text = localizedDish(item, language as Language);
    return `${text.name} ${text.description}`;
  }).join(" ").toLocaleLowerCase();
}
