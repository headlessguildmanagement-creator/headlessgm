import "./globals.css";

export const metadata = {
  title: "HeadlessGM | Guild Operations",
  description: "HeadlessGM is a configurable guild management platform for members, events, attendance, lineups, rewards, rotations and Discord operations.",
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
