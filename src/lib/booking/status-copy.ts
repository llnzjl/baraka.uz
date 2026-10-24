import { Locale } from "./validation";
export const terminalStatus: Record<string, Record<Locale, string>> = {
  cancelled: {
    ko: "예약이 취소되었습니다.",
    en: "This reservation has been cancelled.",
    uz: "Bu bandlov bekor qilingan.",
    ru: "Это бронирование отменено.",
  },
  completed: {
    ko: "방문이 완료된 예약입니다.",
    en: "This visit has been completed.",
    uz: "Bu tashrif yakunlangan.",
    ru: "Это посещение завершено.",
  },
  no_show: {
    ko: "미방문으로 처리된 예약입니다.",
    en: "This reservation was marked as a no-show.",
    uz: "Bu bandlov kelinmagan deb belgilangan.",
    ru: "Это бронирование отмечено как неявка.",
  },
};
