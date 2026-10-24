import type { SVGProps } from "react";
type IconProps = SVGProps<SVGSVGElement> & { size?: number };
function Icon({ size = 22, children, ...props }: IconProps) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{children}</svg>; }
export const ArrowUpRight = (props: IconProps) => <Icon {...props}><path d="M6 18 18 6M6 6h12v12" /></Icon>;
export const ArrowRight = (props: IconProps) => <Icon {...props}><path d="M4 12h16m-6-6 6 6-6 6" /></Icon>;
export const ArrowDown = (props: IconProps) => <Icon {...props}><path d="M12 4v16m-6-6 6 6 6-6" /></Icon>;
export const ChevronDown = (props: IconProps) => <Icon {...props}><path d="m6 9 6 6 6-6" /></Icon>;
export const Check = (props: IconProps) => <Icon {...props}><path d="m5 12 4 4L19 6" /></Icon>;
export const Copy = (props: IconProps) => <Icon {...props}><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M16 8V3H3v13h5" /></Icon>;
export const Instagram = (props: IconProps) => <Icon {...props}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><path d="M17.5 6.5h.01" /></Icon>;
export const MapPin = (props: IconProps) => <Icon {...props}><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></Icon>;
export const Menu = (props: IconProps) => <Icon {...props}><path d="M4 7h16M4 12h16M4 17h16" /></Icon>;
export const Phone = (props: IconProps) => <Icon {...props}><path d="m7 3 3 5-3 3a16 16 0 0 0 6 6l3-3 5 3-1 4C10 22 2 14 3 4l4-1Z" /></Icon>;
export const Search = (props: IconProps) => <Icon {...props}><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></Icon>;
export const X = (props: IconProps) => <Icon {...props}><path d="m6 6 12 12M6 18 18 6" /></Icon>;
export const Clock = (props: IconProps) => <Icon {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon>;
export const Utensils = (props: IconProps) => <Icon {...props}><path d="M5 3v6c0 3 6 3 6 0V3M8 3v18M19 3v18M19 3c-5 3-5 10 0 10" /></Icon>;
export const Camera = (props: IconProps) => <Icon {...props}><path d="M3 6h5l2-3h4l2 3h5v15H3Z" /><circle cx="12" cy="13" r="4" /></Icon>;
