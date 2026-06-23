import type { Metadata } from "next";
import { Geist, Geist_Mono, Crimson_Pro } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const crimson = Crimson_Pro({
  variable: "--font-crimson",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Tsundoku · books your shelf implies you'd love",
  description:
    "Photograph your bookshelf. Get safe next reads — or a shadow library of books your taste implies you'd love but you'd never find on your own.",
  appleWebApp: {
    capable: true,
    title: "Tsundoku",
    statusBarStyle: "black-translucent",
  },
};

export const viewport = {
  themeColor: "#fdfaf3",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${crimson.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
