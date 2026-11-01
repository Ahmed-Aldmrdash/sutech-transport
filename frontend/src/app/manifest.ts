import type { MetadataRoute } from "next";
import { DEFAULT_LOCALE } from "@/i18n/routing";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "مواصلات SUtech · SUtech Transportation",
    short_name: "SUtech Transport",
    description: "SUtech university transport: booking, payment, live bus tracking and trips.",
    lang: DEFAULT_LOCALE,
    dir: "rtl",
    start_url: `/${DEFAULT_LOCALE}`,
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f7f7",
    theme_color: "#58286e",
    categories: ["education", "travel"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
