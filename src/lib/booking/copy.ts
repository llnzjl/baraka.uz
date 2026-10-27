import { Locale } from "./validation";
const en = {
  title: "A place at our table.",
  intro:
    "Choose Noon (11:00 AM–2:00 PM) or Evening (5:00 PM–12:00 AM). Select an available 30-minute start time in Korea Standard Time.",
  date: "Date",
  guests: "Guests",
  time: "Available times",
  name: "Your name",
  phone: "Korean mobile number",
  email: "Email (optional)",
  notes: "Special requests (optional)",
  notesHint:
    "Do not include health, religious, identification or payment details. Call to discuss sensitive dietary needs.",
  loading: "Checking availability…",
  empty: "No available times. Try another date or party size.",
  unavailable:
    "Online reservations are unavailable. Please call the restaurant.",
  submit: "Reserve a table",
  sending: "Submitting…",
  confirmed: "Your table is confirmed.",
  pending: "Awaiting approval. Your table is not confirmed yet.",
  reference: "Booking reference",
  saved:
    "Save this reference. Contact the restaurant for changes or cancellation. Email is optional; this screen confirms your status even if email is delayed.",
  requiredConsent:
    "I agree to collection and use of my name, mobile number and booking details to manage this reservation.",
  optionalConsent:
    "I separately agree to collection and use of the optional email and special requests I provide for this reservation.",
  adult: "I am at least 14 years old.",
  privacy: "Privacy notice",
  retention: "Personal information retention after your visit:",
  days: "days. Expired records are deleted by the scheduled retention job. You may refuse consent; required consent is needed to book online. Optional consent is not required.",
  contact: "Privacy contact",
  controller: "Data controller",
  invalid: "Check the form, mobile number and consents.",
  conflict: "That time is no longer available. Choose another time.",
  bot: "Complete the security check.",
  rate: "Too many requests. Wait and try again.",
  error:
    "We could not verify the result. Retry without changing the form; the same request will not create a second booking.",
  changed: "The privacy notice changed. Review it and try again.",
  newBooking: "Make another reservation",
  language: "Booking language",
  back: "Back to the restaurant",
  manual:
    "Staff: confirm that the guest received the privacy notice and gave the required consent.",
};
export const bookingCopy: Record<Locale, typeof en> = {
  en,
  ko: {
    title: "당신을 위한 식탁.",
    intro:
      "매일 24시간 영업합니다. 날짜와 인원을 선택하면 한국 표준시(Asia/Seoul) 기준으로 예약 가능한 시간이 표시됩니다. 오늘은 아직 지나지 않은 시간만 표시됩니다.",
    date: "날짜",
    guests: "인원",
    time: "예약 가능한 시간",
    name: "성함",
    phone: "한국 휴대전화 번호",
    email: "이메일 (선택)",
    notes: "요청 사항 (선택)",
    notesHint:
      "건강·종교 정보, 신분증 번호, 결제 정보는 입력하지 마세요. 민감한 식이 관련 사항은 전화로 문의해 주세요.",
    loading: "예약 가능 시간 확인 중…",
    empty: "예약 가능한 시간이 없습니다. 다른 날짜나 인원을 선택해 주세요.",
    unavailable:
      "현재 온라인 예약을 이용할 수 없습니다. 매장으로 전화해 주세요.",
    submit: "테이블 예약하기",
    sending: "예약 처리 중…",
    confirmed: "예약이 확정되었습니다.",
    pending: "승인 대기 중입니다. 아직 예약이 확정되지 않았습니다.",
    reference: "예약 번호",
    saved:
      "예약 번호를 보관해 주세요. 변경·취소는 매장으로 문의해 주세요. 이메일은 선택 사항이며, 이메일 도착이 지연되어도 이 화면의 예약 상태는 유효합니다.",
    requiredConsent:
      "예약 관리를 위한 성함, 휴대전화 번호 및 예약 정보의 수집·이용에 동의합니다.",
    optionalConsent:
      "선택적으로 입력한 이메일 및 요청 사항의 예약 목적 수집·이용에 별도로 동의합니다.",
    adult: "만 14세 이상입니다.",
    privacy: "개인정보 처리 안내",
    retention: "방문 후 개인정보 보유기간:",
    days: "일. 동의를 거부할 수 있으나 필수 항목에 동의하지 않으면 온라인 예약이 어렵습니다. 선택 항목 동의는 필수가 아닙니다.",
    contact: "개인정보 문의",
    controller: "개인정보처리자",
    invalid: "입력 내용, 휴대전화 번호 및 동의 항목을 확인해 주세요.",
    conflict:
      "해당 시간은 더 이상 예약할 수 없습니다. 다른 시간을 선택해 주세요.",
    bot: "보안 확인을 완료해 주세요.",
    rate: "요청이 많습니다. 잠시 후 다시 시도해 주세요.",
    error:
      "예약 결과를 확인하지 못했습니다. 내용을 변경하지 않고 다시 시도해 주세요. 동일한 요청은 중복 예약되지 않습니다.",
    changed: "개인정보 안내가 변경되었습니다. 다시 확인해 주세요.",
    newBooking: "다른 예약하기",
    language: "예약 언어",
    back: "레스토랑으로 돌아가기",
    manual:
      "직원 입력: 고객에게 개인정보 안내를 제공하고 필요한 동의를 받았는지 확인해 주세요.",
  },
  uz: {
    title: "Dasturxonimizda siz uchun joy.",
    intro:
      "Har kuni 24 soat ochiqmiz. Bo‘sh vaqtlarni ko‘rish uchun sana va mehmonlar sonini tanlang. Vaqt Koreya vaqti (Asia/Seoul) bo‘yicha. Bugun uchun faqat hali o‘tmagan vaqtlar ko‘rsatiladi.",
    date: "Sana",
    guests: "Mehmonlar soni",
    time: "Bo‘sh vaqtlar",
    name: "Ismingiz",
    phone: "Koreya mobil raqami",
    email: "Elektron pochta (ixtiyoriy)",
    notes: "Maxsus so‘rovlar (ixtiyoriy)",
    notesHint:
      "Sog‘liq, din, shaxsni tasdiqlovchi yoki to‘lov ma’lumotlarini yozmang. Maxsus parhez talablari haqida telefon orqali gaplashing.",
    loading: "Bo‘sh joylar tekshirilmoqda…",
    empty: "Bo‘sh vaqt yo‘q. Boshqa sana yoki mehmonlar sonini tanlang.",
    unavailable:
      "Onlayn bandlov hozir mavjud emas. Restoranga qo‘ng‘iroq qiling.",
    submit: "Stol band qilish",
    sending: "Yuborilmoqda…",
    confirmed: "Stolingiz band qilindi.",
    pending: "Tasdiqlanishi kutilmoqda. Bandlov hali tasdiqlanmagan.",
    reference: "Bandlov raqami",
    saved:
      "Raqamni saqlang. O‘zgartirish yoki bekor qilish uchun restoran bilan bog‘laning. Elektron pochta ixtiyoriy; xat kechiksa ham ekrandagi holat amal qiladi.",
    requiredConsent:
      "Bandlovni boshqarish uchun ismim, mobil raqamim va bandlov ma’lumotlarini yig‘ish va ishlatishga roziman.",
    optionalConsent:
      "Ixtiyoriy kiritgan elektron pochta va so‘rovlarimni bandlov uchun yig‘ish va ishlatishga alohida roziman.",
    adult: "Men kamida 14 yoshdaman.",
    privacy: "Maxfiylik xabarnomasi",
    retention: "Tashrifdan keyingi shaxsiy ma’lumotlarni saqlash muddati:",
    days: "kun. Rozilikni rad etishingiz mumkin; onlayn bandlov uchun majburiy rozilik kerak. Ixtiyoriy rozilik shart emas.",
    contact: "Maxfiylik bo‘yicha aloqa",
    controller: "Ma’lumotlar boshqaruvchisi",
    invalid: "Shakl, mobil raqam va roziliklarni tekshiring.",
    conflict: "Bu vaqt endi mavjud emas. Boshqa vaqtni tanlang.",
    bot: "Xavfsizlik tekshiruvini yakunlang.",
    rate: "So‘rovlar ko‘p. Biroz kutib qayta urinib ko‘ring.",
    error:
      "Natijani tekshira olmadik. Shaklni o‘zgartirmasdan qayta yuboring; ayni so‘rov ikkinchi bandlov yaratmaydi.",
    changed: "Maxfiylik xabarnomasi o‘zgardi. Qayta o‘qib chiqing.",
    newBooking: "Yana band qilish",
    language: "Bandlov tili",
    back: "Restoranga qaytish",
    manual:
      "Xodim: mehmon maxfiylik xabarnomasini olganini va rozilik berganini tekshiring.",
  },
  ru: {
    title: "Место за нашим столом.",
    intro:
      "Открыто круглосуточно, каждый день. Выберите дату и число гостей, чтобы увидеть свободное время по Корее (Asia/Seoul). На сегодня показано только время, которое ещё не прошло.",
    date: "Дата",
    guests: "Число гостей",
    time: "Доступное время",
    name: "Ваше имя",
    phone: "Корейский мобильный номер",
    email: "Электронная почта (необязательно)",
    notes: "Особые пожелания (необязательно)",
    notesHint:
      "Не указывайте сведения о здоровье, религии, документах или оплате. Чувствительные вопросы питания обсудите по телефону.",
    loading: "Проверяем наличие мест…",
    empty: "Свободного времени нет. Выберите другую дату или число гостей.",
    unavailable: "Онлайн-бронирование недоступно. Позвоните в ресторан.",
    submit: "Забронировать стол",
    sending: "Отправляем…",
    confirmed: "Ваш стол забронирован.",
    pending: "Ожидает одобрения. Бронирование ещё не подтверждено.",
    reference: "Номер бронирования",
    saved:
      "Сохраните номер. Для изменения или отмены свяжитесь с рестораном. Почта необязательна; статус на экране действителен, даже если письмо задерживается.",
    requiredConsent:
      "Я согласен на сбор и использование имени, мобильного номера и данных бронирования для управления этой бронью.",
    optionalConsent:
      "Я отдельно согласен на сбор и использование указанных мной необязательных почты и пожеланий для этой брони.",
    adult: "Мне не менее 14 лет.",
    privacy: "Уведомление о конфиденциальности",
    retention: "Срок хранения личных данных после посещения:",
    days: "дней. Вы можете отказаться от согласия; обязательное согласие нужно для онлайн-брони. Необязательное согласие не требуется.",
    contact: "Контакт по вопросам данных",
    controller: "Оператор данных",
    invalid: "Проверьте поля, мобильный номер и согласия.",
    conflict: "Это время больше недоступно. Выберите другое.",
    bot: "Пройдите проверку безопасности.",
    rate: "Слишком много запросов. Подождите и попробуйте снова.",
    error:
      "Не удалось проверить результат. Повторите запрос без изменения формы; тот же запрос не создаст вторую бронь.",
    changed:
      "Уведомление о конфиденциальности изменилось. Прочитайте его снова.",
    newBooking: "Новое бронирование",
    language: "Язык бронирования",
    back: "Вернуться в ресторан",
    manual:
      "Сотрудник: убедитесь, что гость получил уведомление о конфиденциальности и дал согласие.",
  },
};
