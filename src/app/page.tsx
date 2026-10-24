import RestaurantSite from "@/components/RestaurantSite";

import { existsSync } from "fs";
import path from "path";
import { menuItems } from "@/data/menu";

export default function Home() {
  // Only request photos that exist, keeping empty slots free of broken images.
  const menuPhotos: Record<string, string> = {};
  for (const item of menuItems) {
    for (const extension of ["jpg", "jpeg", "png", "webp", "avif"]) {
      const photo = `/menu/${item.id}.${extension}`;
      if (existsSync(path.join(process.cwd(), "public", photo))) {
        menuPhotos[item.id] = photo;
        break;
      }
    }
  }
  return <RestaurantSite menuPhotos={menuPhotos} />;
}
