import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tsundoku",
    short_name: "Tsundoku",
    description:
      "Photograph your bookshelf, get recommendations from books you actually own.",
    start_url: "/",
    display: "standalone",
    background_color: "#fdfaf3",
    theme_color: "#7c3a1e",
    icons: [
      {
        src: "/icon",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
