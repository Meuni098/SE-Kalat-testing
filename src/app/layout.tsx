import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BULSU-MAIN CAMPUS — Asset Management Office",
  description:
    "Institutional Property, Plant & Equipment (PPE) and Semi-Expendable Supplies Lifecycle System for Bulacan State University.",
  manifest: "/manifest.json",
  icons: {
    icon: "/branding/bulsu-main-campus.png",
    apple: "/branding/bulsu-main-campus.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#3B0A0F",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-cream text-[#3B0A0F] antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
