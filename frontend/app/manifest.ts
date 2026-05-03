import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AI Teams",
    short_name: "AI Teams",
    description: "Kanban board for tmux AI agent teams",
    start_url: "/chat",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#3390ec",
    orientation: "portrait",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.png",     sizes: "1024x1024", type: "image/png" },
    ],
  };
}
