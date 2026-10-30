"use client";

import Image from "next/image";
import Link from "next/link";
import { useEntrySession } from "./EntryGate";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, ArrowRight, ArrowDown, Check, ChevronDown, Copy, Instagram, MapPin, Menu, Phone, Search, X, Clock, Utensils, Camera } from "./SiteIcons";
import ReservationForm from "./ReservationForm";
import SilkRoadSections from "./SilkRoadSections";
import { apiFetch, apiUrl, staticSiteOnly } from "@/lib/client/api";
import { restaurant } from "@/data/restaurant";
import { menuItems, type MenuItem, type Category } from "@/data/menu";

import LanguageSwitcher, { useSiteLanguage } from "./SiteLanguage";
import { translate, type Language } from "@/lib/site-language";
import { localizedDish, dishSearchText } from "@/data/menu-translations";
type Props = { menuPhotos?: Record<string, string> };
const publicAsset = (source: string) => {
  const prefix = process.env.NEXT_PUBLIC_BASE_PATH || "";
  return prefix && source.startsWith("/") ? `${prefix}${source}` : source;
};
const imageSource = (source: string) =>
  source.startsWith("/api/") ? apiUrl(source) : publicAsset(source);
const categories: { id: Category; en: string; ko: string }[] = [
  { id: "all", en: "All dishes", ko: "전체 메뉴" },
  { id: "mains", en: "Mains & noodles", ko: "메인 · 면" },
  { id: "grill", en: "From the grill", ko: "그릴" },
  { id: "soups", en: "Soups", ko: "수프" },
  { id: "bakery", en: "Bread & bites", ko: "빵 · 사이드" },
  { id: "salads", en: "Salads", ko: "샐러드" },
  { id: "drinks", en: "Drinks", ko: "음료" },
];

function Ornament({ className = "" }: { className?: string }) {
  return <svg className={className} viewBox="0 0 80 80" fill="none" aria-hidden="true"><path d="m40 2 11 19 22-2-2 22 7 17-21 3-17 17-11-19-22 2 2-22L2 22l21-3L40 2Z" stroke="currentColor" strokeWidth="1.3"/><path d="m40 12 9 16 18 3-11 14 2 18-18-6-18 6 2-18-11-14 18-3 9-16Z" stroke="currentColor" strokeWidth="1.3"/><circle cx="40" cy="40" r="11" stroke="currentColor" strokeWidth="1.3"/></svg>;
}

function DishPhoto({ item, path, language }: { item: MenuItem; path?: string; language: Language }) {
  const [failed, setFailed] = useState(false);
  const category = categories.find(candidate => candidate.id === item.category);
  useEffect(() => setFailed(false), [path]);
  return <div className={`dish-photo dish-photo--${item.category}`}>
    {path && !failed ? <Image src={imageSource(path)} alt={localizedDish(item, language).name} fill sizes="(max-width: 640px) 90vw, (max-width: 1000px) 45vw, 30vw" onError={() => setFailed(true)} /> : <>
      <div className="plate-art" aria-hidden="true"><span /><Utensils size={34} /></div>
      <span className="photo-soon"><Camera size={13} />{translate(language, "A photo is on its way", "사진 준비 중")}</span>
    </>}
    <span className="dish-category">{category ? translate(language, category.en, category.ko) : ""}</span>
  </div>;
}

export default function RestaurantSite({ menuPhotos = {} }: Props) {
  const {session}=useEntrySession();
  const { language, t } = useSiteLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("");
  const [category, setCategory] = useState<Category>("all");
  const [menu, setMenu] = useState<MenuItem[]>(menuItems);
  const [photoMessage, setPhotoMessage] = useState<Record<string,string>>({});
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [selectedDish, setSelectedDish] = useState<MenuItem | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [heroFailed, setHeroFailed] = useState(false);
  const [chefFailed, setChefFailed] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const mobileToggleRef = useRef<HTMLButtonElement>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => { if (copyTimer.current) clearTimeout(copyTimer.current); };
  }, []);
  useEffect(() => {
    if (staticSiteOnly) return;
    let alive = true;
    const refresh = async () => {
      try {
        const response = await apiFetch("/api/menu", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (alive && Array.isArray(data.items)) {
          const visible = data.items.map((item: MenuItem) => ({
            ...item,
            price: item.price ?? undefined,
            image: item.image.startsWith("/api/menu/images/") ? item.image : (menuPhotos[item.id] || item.image),
          }));
          setMenu(visible);
          setSelectedDish(current => current ? visible.find((item: MenuItem) => item.id === current.id) || null : null);
        }
      } catch { /* Keep the last menu already rendered. */ }
    };
    void refresh();
    const timer = setInterval(() => { if (!document.hidden) void refresh(); }, 5000);
    return () => { alive = false; clearInterval(timer); };
  }, [menuPhotos]);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) setActiveSection(entry.target.id); });
    }, { rootMargin: "-15% 0px -60% 0px" });
    document.querySelectorAll("main section[id]").forEach(section => observer.observe(section));
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!mobileOpen) return;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setMobileOpen(false); mobileToggleRef.current?.focus(); } };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [mobileOpen]);
  useEffect(() => {
    if (selectedDish && dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal();
    if (!selectedDish) dialogRef.current?.close();
  }, [selectedDish]);

  const filteredMenu = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return menu.filter(item => (category === "all" || item.category === category) && dishSearchText(item).includes(normalized));
  }, [category, query, menu]);
  const featuredIds = ["plov", "lamb-shashlik", "manti", "samsa", "chuchvara", "shakarop"];
  const visibleMenu = expanded || query.trim() || category !== "all" ? filteredMenu : featuredIds.flatMap(id => menu.filter(item => item.id === id));
  const nav = [ { id: "menu", label: t("The menu", "메뉴") }, { id: "story", label: t("Our story", "우리의 이야기") }, { id: "gallery", label: t("The experience", "갤러리") }, { id: "halal", label: t("Halal", "할랄 안내") }, { id: "visit", label: t("Find us", "오시는 길") } ];

  async function copyAddress() {
    setCopyError(false);
    try {
      await navigator.clipboard.writeText(restaurant.address);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 3000);
    } catch { setCopyError(true); }
  }
  async function updateDishPhoto(item: MenuItem, file?: File) {
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) {
      setPhotoMessage(old => ({...old,[item.id]:t("Photo must be 100 MB or smaller.","사진은 100MB 이하여야 합니다.")}));
      return;
    }
    const form = new FormData();
    form.set("item", JSON.stringify({id:item.id,name:item.name,ko:item.ko,category:item.category,description:item.description,descriptionKo:item.descriptionKo,price:item.price ?? null,active:true}));
    form.set("image",file,file.name);
    setPhotoMessage(old => ({...old,[item.id]:t("Saving photo…","사진 저장 중…")}));
    try {
      const response = await apiFetch(`/api/admin/menu/${encodeURIComponent(item.id)}`,{method:"PATCH",body:form});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error === "INVALID_IMAGE" ? t("Choose a JPEG, PNG or WebP photo.","JPEG, PNG or WebP photo.") : data.error === "IMAGE_TOO_LARGE" ? t("Photo must be at most 100 MB and 100 megapixels.","Photo must be at most 100 MB and 100 megapixels.") : t("The photo could not be saved.","The photo could not be saved."));
      setMenu(old => old.map(entry => entry.id === item.id ? {...entry,...data.item} : entry));
      setSelectedDish(current => current?.id === item.id ? {...current,...data.item} : current);
      setPhotoMessage(old => ({...old,[item.id]:t("Photo saved","사진 저장 완료")}));
    } catch (error) {
      setPhotoMessage(old => ({...old,[item.id]:(error as Error).message}));
    }
  }

  return <>
    <a href="#main" className="skip-link">{t("Skip to content", "본문으로 이동")}</a>
    <div className="announcement"><span>{t("Uzbek soul. Cheongju home.", "우즈베키스탄의 맛, 청주에서.")}</span><span className="announcement-right">우즈벡할랄식당 <span>✦</span> CHEONGJU, KR</span></div>
    <header className="site-header">
      <div className="header-inner">
        <a className="wordmark" href="#home" aria-label={t("BARAKA home", "BARAKA 홈")}><Ornament /><span>BARAKA<small>UZBEK KITCHEN</small></span></a>
        <nav className="desktop-nav" aria-label={t("Main navigation", "주 메뉴")}>{nav.map(item => <a key={item.id} href={`#${item.id}`} className={activeSection === item.id ? "active" : ""}>{item.label}</a>)}</nav>
        <div className="header-actions">
          <LanguageSwitcher />
          <a href="#reserve" className="button button-green header-book">{t("A seat at our table", "예약 문의")}<ArrowUpRight size={16} /></a>
          <button ref={mobileToggleRef} className="mobile-toggle" aria-expanded={mobileOpen} aria-controls="mobile-navigation" aria-label={mobileOpen ? t("Close menu", "메뉴 닫기") : t("Open menu", "메뉴 열기")} onClick={() => setMobileOpen(!mobileOpen)}>{mobileOpen ? <X /> : <Menu />}</button>
        </div>
      </div>
      {mobileOpen && <nav id="mobile-navigation" className="mobile-nav" aria-label={t("Mobile navigation", "모바일 메뉴")}>{nav.map(item => <a key={item.id} href={`#${item.id}`} onClick={() => setMobileOpen(false)}>{item.label}<ArrowUpRight size={20} /></a>)}<a href="#reserve" onClick={() => setMobileOpen(false)}>{t("Reserve a table", "예약 문의")}<ArrowUpRight size={20} /></a></nav>}
    </header>

    <main id="main">
      <section className="hero section-shell" id="home" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow"><span className="tiny-star">✦</span> {t("A little Uzbekistan in Cheongju", "청주에서 만나는 작은 우즈베키스탄")}</p>
          <h1 id="hero-title">{t("A taste of Uzbekistan,", "우즈베키스탄의 맛,")}<br /><em>{t("in the heart of Korea.", "한국에서 만나다.")}</em></h1>
          <p className="hero-description">{t("A journey of flavour. A tradition of hospitality. Discover the warmth of Uzbek cooking, brought to your table in Cheongju.", "정성과 전통이 담긴 우즈베키스탄 요리. 실크로드의 풍성한 맛과 따뜻한 환대를 청주에서 만나보세요.")}</p>
          <div className="hero-buttons"><a className="button button-green" href="#menu">{t("Explore the menu", "메뉴 둘러보기")}<ArrowUpRight size={19} /></a>{session?.kind === "guest" && <Link className="button button-green" href="/order">{t("Order now", "주문하기")}<ArrowUpRight size={19} /></Link>}<a className="text-link" href="#reserve">{t("Reserve a table", "예약 문의")}<ArrowRight size={18} /></a></div>
          <div className="hero-foot"><span className="hero-location"><MapPin size={18} /><span>{t("CHEONGJU, SOUTH KOREA", "대한민국 청주")}<small>복대동 · 산업단지 입구</small></span></span><a href="#menu" className="scroll-cue" aria-label={t("Scroll to the menu", "메뉴로 이동")}><ArrowDown size={20} /></a></div>
        </div>
        <div className="hero-visual">
          <Ornament className="hero-ornament" />
          <div className="hero-image">{!heroFailed ? <Image src={publicAsset("/images/plov-editorial.jpg")} alt={t("Editorial photograph of Central Asian plov with lamb, rice and carrots", "양고기와 당근을 넣은 중앙아시아 플로프 참고 사진")} fill priority sizes="(max-width: 760px) 92vw, 47vw" onError={() => setHeroFailed(true)} /> : <div className="image-fallback"><Ornament /><span>BARAKA</span></div>}<div className="hero-image-shade" /><a className="hero-caption" href="#gallery"><span>{t("THE TASTE OF THE SILK ROAD · EDITORIAL IMAGE", "실크로드의 맛 · 음식 참고 사진")}<strong>{t("Osh. A tradition worth sharing.", "함께 나누는 전통, 플로프.")}</strong></span><ArrowUpRight size={25} /></a></div>
          <div className="hero-seal"><span>{t("UZBEK ROOTS", "우즈베키스탄의 뿌리")}</span><Ornament /><span>{t("WARM HEARTS", "따뜻한 마음")}</span></div>
          <div className="hero-side-note">{t("GOOD FOOD. GOOD COMPANY.", "좋은 음식. 좋은 사람들.")}</div>
        </div>
      </section>

      <div className="culture-strip" aria-label={t("Uzbek kitchen, made for sharing, everyone welcome", "우즈베키스탄 요리, 함께 나누는 식탁, 모두를 환영합니다")}><div><span>{t("Uzbek kitchen", "우즈베키스탄의 맛")}</span><Ornament /><span>{t("Made for sharing", "함께 나누는 식탁")}</span><Ornament /><span>{t("Everyone welcome", "누구나 환영합니다")}</span><Ornament /><span>{t("Pull up a chair", "편하게 들러주세요")}</span></div></div>

      <section className="menu-section section-shell" id="menu" aria-labelledby="menu-title">
        <div className="section-heading"><div><p className="eyebrow">01 / {t("GOOD FOOD STARTS HERE", "맛있는 만남의 시작")}</p><h2 id="menu-title">{t("Our table.", "정성을 담은")} <em>{t("Your discovery.", "한 접시.")}</em></h2></div><p>{t("From a comforting bowl to something straight off the grill. Come hungry. Leave happy.", "따뜻한 한 그릇부터 노릇하게 구운 요리까지. 맛있는 한 끼를 만나보세요.")}</p></div>
        <div className="menu-toolbar"><div className="category-tabs" role="group" aria-label={t("Menu categories", "메뉴 종류")}>{categories.filter(cat => cat.id === "all" || menu.some(item => item.category === cat.id)).map(cat => <button key={cat.id} onClick={() => { setCategory(cat.id); setExpanded(false); }} aria-pressed={category === cat.id} className={category === cat.id ? "selected" : ""}>{t(cat.en, cat.ko)}</button>)}</div><label className="menu-search"><Search size={17} /><span className="sr-only">{t("Search dishes", "메뉴 검색")}</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={t("Find a dish…", "메뉴 검색…")} /></label></div>
        <div className="menu-meta"><p>{t("Menu items and listed prices are managed by the restaurant. Please confirm today’s availability before visiting.", "메뉴와 표시 가격은 매장에서 관리합니다. 방문 전 오늘 판매 여부를 확인해 주세요.")}</p><span aria-live="polite">{filteredMenu.length} {t("dishes", "메뉴")}</span></div>
        <div className="menu-grid">{visibleMenu.map(item => <div className={`menu-card-wrap ${session?.kind === "owner" ? "menu-card-owner" : ""}`} key={item.id}>
          <button className="dish-card" onClick={() => setSelectedDish(item)} aria-label={`${t("View", "자세히 보기:")} ${localizedDish(item, language).name}`}>
            <DishPhoto item={item} path={item.image || menuPhotos[item.id]} language={language} />
            <div className="dish-info"><div className="dish-number">{String(menu.indexOf(item) + 1).padStart(2, "0")} / <span>{language === "ko" ? item.name : item.ko}</span></div><div className="dish-title"><h3>{localizedDish(item, language).name}</h3><ArrowUpRight size={23} /></div><p>{localizedDish(item, language).description}</p><span className="dish-price">{item.price != null ? `₩${item.price.toLocaleString("ko-KR")}` : t("Ask us for today’s price", "가격 문의")}<small>{item.price != null ? t("menu price", "표시 가격") : ""}</small></span></div>
          </button>
          {session?.kind === "owner" && <>
            <a className="owner-dish-edit" href={`/admin/menu?item=${encodeURIComponent(item.id)}`}>{t("Edit dish","메뉴 수정")}</a>
            <label className="owner-photo-edit">{t("Change photo","사진 변경")}<input type="file" accept="image/jpeg,image/png,image/webp" aria-label={`${t("Change photo for","사진 변경:")} ${item.name}`} onChange={event => {void updateDishPhoto(item,event.target.files?.[0]);event.currentTarget.value="";}} /></label>
            {photoMessage[item.id] && <span className="owner-photo-status" role="status">{photoMessage[item.id]}</span>}
          </>}
        </div>)}</div>
        {filteredMenu.length === 0 && <div className="empty-menu"><Search size={32} /><h3>{t("No dishes found", "검색 결과가 없습니다")}</h3><p>{t("Try another name or explore the whole menu.", "다른 이름을 검색하거나 전체 메뉴를 확인해 보세요.")}</p><button className="button button-outline" onClick={() => { setQuery(""); setCategory("all"); }}>{t("See all dishes", "전체 메뉴 보기")}</button></div>}
        {category === "all" && !query.trim() && filteredMenu.length > 6 && <div className="menu-more"><button className="button button-outline" onClick={() => setExpanded(!expanded)}>{expanded ? t("Show fewer dishes", "간단히 보기") : t("Explore all {count} dishes", "전체 {count}개 메뉴 보기").replace("{count}", String(menu.length))}<ChevronDown size={18} className={expanded ? "rotate" : ""} /></button></div>}
        <p className="allergy-note">{t("Something we should know? Please tell us about allergies or dietary needs before ordering.", "알레르기나 식이 제한이 있으신가요? 주문 전에 직원에게 꼭 알려주세요.")}</p>
      </section>

      <section className="story-section" id="story" aria-labelledby="story-title"><div className="story-inner section-shell"><div className="story-art" aria-hidden="true"><div className="story-arch"><Ornament /><span>BARAKA</span><small>O‘ZBEK TAOMLARI</small></div><span className="story-art-caption">{t("A LITTLE TASTE OF HOME", "고향의 맛 한 조각")}</span></div><div className="story-copy"><p className="eyebrow">02 / {t("A PLACE TO COME TOGETHER", "함께하는 공간")}</p><h2 id="story-title">{t("From Uzbekistan,", "우즈베키스탄에서,")}<br /><em>{t("with warmth.", "당신의 식탁까지.")}</em></h2><p>{t("Some of the best moments happen around a table. Bread is passed, stories are shared, and there is always room for one more.", "좋은 순간은 식탁에서 시작됩니다. 빵을 나누고, 이야기를 나누고, 서로를 위한 자리를 내어주는 곳.")}</p><p>{t("That is the feeling we want you to find at BARAKA. Uzbek flavours, a generous spirit, and a little corner of Cheongju to make yourself at home.", "BARAKA에서 그런 편안함을 느끼셨으면 합니다. 우즈베키스탄의 맛과 넉넉한 마음이 있는 청주의 작은 공간입니다.")}</p><a href="#reserve" className="text-link">{t("Let’s make a plan", "만날 날을 정해볼까요")}<ArrowUpRight size={20} /></a></div></div></section>

      <section className="chef-section section-shell" id="chef" aria-labelledby="chef-title"><div className="chef-photo-wrap"><div className="chef-photo">{!chefFailed ? <Image src={publicAsset("/images/chef.jpg")} alt={t("Chef Asr working in his kitchen", "주방에서 요리하는 셰프 Asr")} fill sizes="(max-width: 760px) 90vw, 45vw" onError={() => setChefFailed(true)} /> : <div className="image-fallback"><Utensils size={64} /><span>Chef Asr</span></div>}</div><a href="https://www.instagram.com/p/DbXglYOTsDc/" target="_blank" rel="noopener noreferrer" className="chef-photo-credit"><Instagram size={15} />{t("A moment in the kitchen", "주방에서의 한 순간")}<ArrowUpRight size={16} /></a><div className="chef-photo-tag">{t("THE HANDS.", "손길.")}<br />{t("THE HEART.", "마음.")}<br /><em>{t("THE CHEF.", "셰프.")}</em></div></div><div className="chef-copy"><p className="eyebrow">03 / {t("MEET THE PERSON BEHIND THE PLATE", "요리 뒤에 있는 사람")}</p><h2 id="chef-title">{t("Good food has", "좋은 음식에는")}<br /><em>{t("a human touch.", "사람의 온기가.")}</em></h2><div className="chef-name"><h3>{restaurant.chefName}</h3><span>{t("CHEF DE CUISINE", "총괄 셰프")}</span></div><p>{t("Meet Chef Asr. His kitchen brings together Uzbek and European cooking, with a love for the craft that shows up in every step.", "셰프 Asr를 소개합니다. 우즈베키스탄과 유럽 요리를 선보이며, 요리의 매 순간에 정성을 담습니다.")}</p><p>{t("Get to know the person behind your next meal: the preparation, the fire, and the everyday life of a chef in Korea.", "요리 준비부터 불 앞에서의 순간까지. 한국에서 요리하는 셰프의 일상을 만나보세요.")}</p><a className="button button-outline" href={restaurant.instagram} target="_blank" rel="noopener noreferrer"><Instagram size={18} />@asr.chef<ArrowUpRight size={18} /></a><div className="chef-signature">Asr<span>{t("From my kitchen, with heart.", "제 주방에서, 마음을 담아.")}</span></div></div></section>

      <SilkRoadSections language={language} />

      <section className="visit-section" id="visit" aria-labelledby="visit-title"><div className="section-shell visit-inner"><div className="visit-copy"><p className="eyebrow">04 / {t("YOUR NEXT GOOD MEAL", "다음 맛있는 만남")}</p><h2 id="visit-title">{t("Follow the", "맛있는 향기를")}<br /><em>{t("good flavours.", "따라오세요.")}</em></h2><p>{t("Find us in Bokdae-dong, by the Cheongju industrial complex entrance. We’ll save you a warm welcome.", "청주 산업단지 입구, 복대동에서 만나요. 따뜻한 마음으로 맞이하겠습니다.")}</p><div className="visit-detail"><MapPin size={21} /><div><h3>{t("Come find us", "오시는 길")}</h3><p lang="ko">{restaurant.address}</p><small>{restaurant.addressEnglish}</small><button className="copy-address" onClick={copyAddress}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? t("Address copied", "주소 복사 완료") : t("Copy Korean address", "주소 복사")}</button><span className="sr-only" role="status">{copied ? t("Address copied", "주소 복사 완료") : ""}</span>{copyError && <p className="copy-error" role="status">{t("Please select and copy the address above.", "위의 주소를 선택해 직접 복사해 주세요.")}</p>}</div></div><div className="visit-detail"><Phone size={20} /><div><h3>{t("A quick hello", "전화 문의")}</h3><a className="phone-link" href={restaurant.phoneHref}>{restaurant.phone}</a><small>{t("For tables, takeaway, and today’s menu", "예약 · 포장 · 오늘의 메뉴 문의")}</small></div></div><div className="visit-detail"><Clock size={20} /><div><h3>{t("Before you set off", "방문 전 확인")}</h3><p>{t(restaurant.openingHoursEnglish, restaurant.openingHoursKorean)}</p></div></div></div><div className="location-card"><div className="location-art"><div className="map-grid" aria-hidden="true" /><Ornament className="location-ornament" /><div className="location-postcard"><span>36.6334° N · 127.4476° E</span><div className="map-pin-circle"><MapPin size={38} /></div><h3>CHEONGJU</h3><p>충청북도 청주시</p><span className="location-district">BOKDAE-DONG · 복대동</span></div><span className="location-art-label">{t("Your little corner of Uzbekistan", "청주 속 작은 우즈베키스탄")}</span></div><div className="location-card-footer"><div><h3>우즈벡할랄식당</h3><p>신율로 178 · 산업단지 입구</p></div><span className="naver-badge" aria-hidden="true">N</span></div><a href={restaurant.naverMap} className="button button-green" target="_blank" rel="noopener noreferrer">{t("Get directions on Naver", "네이버 지도로 길 찾기")}<ArrowUpRight size={19} /></a></div></div></section>

      <section className="reservation-section section-shell" id="reserve" aria-label={t("Reservation requests", "예약 문의")}><p className="eyebrow">05 / {t("THERE’S A PLACE FOR YOU", "당신을 위한 자리")}</p><ReservationForm language={language} phone={restaurant.phone} instagramUrl={restaurant.instagram} /></section>
    </main>

    <footer className="site-footer"><div className="section-shell"><div className="footer-top"><a href="#home" className="wordmark"><Ornament /><span>BARAKA<small>UZBEK KITCHEN · CHEONGJU</small></span></a><p>{t("Come for the food.", "맛있는 음식을 찾아,")}<br /><em>{t("Stay for the feeling.", "따뜻한 마음을 만나.")}</em></p><a className="footer-instagram" href={restaurant.instagram} target="_blank" rel="noopener noreferrer" aria-label={t("Chef Asr on Instagram", "셰프 Asr 인스타그램")}><Instagram size={25} /><ArrowUpRight size={17} /></a></div><div className="footer-bottom"><span>© {new Date().getFullYear()} BARAKA. {t("Made with heart.", "마음을 담아.")}</span><a href={restaurant.phoneHref}>{restaurant.phone}</a><a href={restaurant.naverPlace} target="_blank" rel="noopener noreferrer">우즈벡할랄식당 <ArrowUpRight size={13} /></a><a href="#home">{t("Back to the top", "맨 위로")} ↑</a></div></div></footer>
    <div className="mobile-bottom-bar"><a href={restaurant.phoneHref}><Phone size={17} />{t("Call us", "전화")}</a><a href={restaurant.naverMap} target="_blank" rel="noopener noreferrer"><MapPin size={17} />{t("Directions", "길 찾기")}</a><a href="#reserve">{t("Reserve", "예약 문의")}<ArrowUpRight size={17} /></a></div>

    <dialog ref={dialogRef} className="dish-dialog" aria-labelledby="dish-dialog-title" onCancel={() => setSelectedDish(null)} onClose={() => setSelectedDish(null)} onClick={event => { if (event.target === event.currentTarget) setSelectedDish(null); }}>
      {selectedDish && <div className="dish-dialog-inner"><button className="dialog-close" onClick={() => setSelectedDish(null)} aria-label={t("Close dish details", "메뉴 상세 닫기")} autoFocus><X size={22} /></button><DishPhoto item={selectedDish} path={selectedDish.image || menuPhotos[selectedDish.id]} language={language} /><div className="dish-dialog-copy"><p className="eyebrow">{language === "ko" ? selectedDish.name : selectedDish.ko}</p><h2 id="dish-dialog-title">{localizedDish(selectedDish, language).name}</h2><p>{localizedDish(selectedDish, language).description}</p>{selectedDish.price != null && <strong className="dialog-price">₩{selectedDish.price.toLocaleString("ko-KR")}</strong>}<p className="dialog-note">{t("Listed prices are managed by the restaurant. Call to confirm today’s availability, ingredients, and dietary needs.", "표시 가격은 매장에서 관리합니다. 오늘 판매 여부, 재료 및 알레르기 정보는 전화로 확인해 주세요.")}</p><a className="button button-green" href={restaurant.phoneHref}><Phone size={18} />{t("Ask us about this dish", "메뉴 전화 문의")}<ArrowUpRight size={18} /></a></div></div>}
    </dialog>
  </>;
}
