"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, X } from "./SiteIcons";
import { restaurant } from "@/data/restaurant";

const photos = [
  { src: "/images/plov-editorial.jpg", en: "The art of plov · editorial photograph", ko: "플로프의 풍미 · 음식 참고 사진" },
  { src: "/images/hero-food.jpg", en: "From Chef Asr’s grill", ko: "셰프 Asr의 그릴 요리" },
  { src: "/images/chef.jpg", en: "The hands behind the flavour", ko: "맛을 만드는 손길" },
];

export default function SilkRoadSections({ language }: { language: "ko" | "en" }) {
  const t = (en: string, ko: string) => language === "ko" ? ko : en;
  const [active, setActive] = useState<number | null>(null);
  const modal = useRef<HTMLDialogElement>(null);
  const touchX = useRef<number | null>(null);
  function move(direction: number) { setActive(current => current === null ? null : (current + direction + photos.length) % photos.length); }
  useEffect(() => {
    if (active !== null && !modal.current?.open) modal.current?.showModal();
    if (active === null) modal.current?.close();
  }, [active]);
  useEffect(() => {
    if (active === null) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") { event.preventDefault(); move(1); }
      if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", onKey); };
  }, [active]);

  return <>
    <section className="gallery-section section-shell" id="gallery" aria-labelledby="gallery-title">
      <div className="section-heading"><div><p className="eyebrow">THE UZBEK EXPERIENCE</p><h2 id="gallery-title">{t("A little closer", "맛과 정성을,")}<br /><em>{t("to the heart.", "조금 더 가까이.")}</em></h2></div><p>{t("The food, the fire, the people. A glimpse into Uzbek cooking and the chef’s kitchen.", "음식과 불, 그리고 사람. 우즈베키스탄 요리와 셰프의 주방을 만나보세요.")}</p></div>
      <div className="gallery-grid">{photos.map((photo, index) => <button className="gallery-tile" key={photo.src} onClick={() => setActive(index)} aria-label={t(`Enlarge: ${photo.en}`, `사진 크게 보기: ${photo.ko}`)}><Image src={photo.src} alt={photo[language]} fill sizes="(max-width: 760px) 90vw, 40vw" /><span>{photo[language]}<ArrowUpRight size={20} /></span></button>)}</div>
      <p className="photo-credit">{t("Plov reference photograph, not a restaurant menu photo", "플로프는 매장 메뉴 사진이 아닌 음식 참고 사진입니다")} · <a href="https://commons.wikimedia.org/wiki/File:Plov_with_lamb_and_carrots_in_ceramic_bowl.jpg" target="_blank" rel="noopener noreferrer">Postovalov / Wikimedia Commons</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a> · {t("Cropped for display. Chef photographs: @asr.chef.", "화면에 맞게 크롭. 셰프 사진: @asr.chef.")}</p>
    </section>
    <section className="halal-section" id="halal" aria-labelledby="halal-title"><div className="halal-inner section-shell">
      <div><p className="eyebrow">THOUGHTFUL HOSPITALITY</p><h2 id="halal-title">{t("Your trust,", "안심할 수 있도록,")}<br /><em>{t("at our table.", "정확하게 안내합니다.")}</em></h2></div>
      <div className="halal-copy"><p>{t("The restaurant is listed as 우즈벡할랄식당. Formal certification and detailed preparation policies have not been documented here. Please contact the restaurant about your requirements before visiting.", "매장은 ‘우즈벡할랄식당’으로 등록되어 있습니다. 공식 인증 및 구체적인 조리 방침에 대한 확인 자료는 아직 제공되지 않았습니다. 식이 관련 요청 사항은 방문 전에 매장으로 문의해 주세요.")}</p>
      <dl className="halal-facts"><div><dt>{t("Official halal certification", "공식 할랄 인증")}</dt><dd>{t("Documentation pending", "인증 자료 확인 필요")}</dd></div><div><dt>{t("Meat sourcing & preparation", "육류 공급 및 조리 방식")}</dt><dd>{t("Please confirm with the restaurant", "매장에 직접 확인해 주세요")}</dd></div><div><dt>{t("Pork & alcohol policies", "돼지고기 및 주류 방침")}</dt><dd>{t("Not independently verified", "별도 확인이 필요합니다")}</dd></div><div><dt>{t("Allergens & prayer accommodation", "알레르기 및 기도 공간")}</dt><dd>{t("Ask before your visit", "방문 전에 문의해 주세요")}</dd></div></dl>
      <a className="text-link" href={restaurant.phoneHref}>{t("Talk to us about your visit", "방문 전 전화 문의")}<ArrowUpRight size={18} /></a>
      </div></div></section>
    <dialog ref={modal} className="lightbox" aria-label={t("Photo gallery", "사진 갤러리")} onCancel={() => setActive(null)} onClose={() => setActive(null)} onClick={event => { if (event.target === event.currentTarget) setActive(null); }}>
      {active !== null && <><button className="dialog-close" onClick={() => setActive(null)} aria-label={t("Close gallery", "갤러리 닫기")} autoFocus><X size={22} /></button><div className="lightbox-image" onTouchStart={event => { touchX.current = event.changedTouches[0].clientX; }} onTouchEnd={event => { if (touchX.current !== null) { const delta = event.changedTouches[0].clientX - touchX.current; if (Math.abs(delta) > 50) move(delta < 0 ? 1 : -1); touchX.current = null; } }}><Image src={photos[active].src} alt={photos[active][language]} fill sizes="90vw" /></div><div className="lightbox-footer"><button onClick={() => move(-1)} aria-label={t("Previous photo", "이전 사진")}>←</button><p aria-live="polite">{photos[active][language]}<br />{active + 1} / {photos.length}</p><button onClick={() => move(1)} aria-label={t("Next photo", "다음 사진")}>→</button></div></>}
    </dialog>
  </>;
}
