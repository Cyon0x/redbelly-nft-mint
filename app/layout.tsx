import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { Providers } from "./providers";
import { collection } from "@/lib/collection";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  icons: {
    icon: "/images/logo/redbelly-logo.png",
    shortcut: "/images/logo/redbelly-logo.png",
    apple: "/images/logo/redbelly-logo.png",
  },
  title: {
    default: `${collection.name} — Mint on Redbelly Network`,
    template: `%s — ${collection.name}`,
  },
  description: collection.description,
  openGraph: {
    title: `${collection.name} — Mint on Redbelly Network`,
    description: collection.description,
    url: siteUrl,
    siteName: collection.name,
    type: "website",
    images: ["/images/logo/redbelly-logo-wide.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: `${collection.name} — Mint on Redbelly Network`,
    description: collection.description,
    images: ["/images/logo/redbelly-logo-wide.png"],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#140406" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply the saved theme before paint so there is no light/dark flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('rb-theme');
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  var theme = stored || (prefersDark ? 'dark' : 'light');
                  document.documentElement.setAttribute('data-theme', theme);
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={`${inter.variable} ${spaceGrotesk.variable}`}>
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
