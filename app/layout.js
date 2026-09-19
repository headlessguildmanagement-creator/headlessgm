import "./globals.css";

const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || "headlessgm-nu.vercel.app"
const normalizedSiteUrl = /^https?:\/\//i.test(rawSiteUrl) ? rawSiteUrl : `https://${rawSiteUrl}`

export const metadata = {
  metadataBase: new URL(normalizedSiteUrl),
  title: {
    default: "HeadlessGM | Guild Operations",
    template: "%s | HeadlessGM",
  },
  description: "Run roster, attendance, lineups, auctions, recruitment, Discord operations and guild history from one configurable workspace.",
  keywords: ["guild management", "guild operations", "Discord guild bot", "raid lineup", "auction rotation", "guild roster"],
  openGraph: {
    title: "HeadlessGM | Headless Guild Management",
    description: "One operating system for roster, events, attendance, lineups, auctions, recruitment, Discord and history.",
    type: "website",
    siteName: "HeadlessGM",
  },
  twitter: {
    card: "summary_large_image",
    title: "HeadlessGM | Headless Guild Management",
    description: "Guild operations without the spreadsheet mess.",
  },
};

const themeBoot = `(() => { try { const pref = localStorage.getItem('hgm-theme') || 'system'; const dark = pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches); document.documentElement.dataset.theme = dark ? 'dark' : 'light'; document.documentElement.dataset.themePreference = pref; } catch (_) {} })();`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeBoot }} /></head>
      <body>{children}</body>
    </html>
  );
}
