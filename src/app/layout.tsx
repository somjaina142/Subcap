import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SubCap — Pro Subtitles in Seconds",
  description:
    "Upload any video, get styled subtitles automatically. Transcribe, style, preview, and export SRT/VTT/ASS. Built for creators who care about every frame.",
  icons: {
    icon: "/subcap-favicon-black.png",
    shortcut: "/subcap-favicon-black.png",
    apple: "/subcap-favicon-black.png",
  },
  openGraph: {
    title: "SubCap — Pro Subtitles in Seconds",
    description:
      "Upload any video, get styled subtitles automatically. Transcribe, style, preview, and export.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SubCap — Pro Subtitles in Seconds",
    description:
      "Upload any video, get styled subtitles automatically. Transcribe, style, preview, and export.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
