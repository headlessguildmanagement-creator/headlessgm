import "./globals.css";

export const metadata = {
  title: "HeadlessGM | Customizable Guild Management System",
  description:
    "HeadlessGM is a configurable guild management platform for managing members, events, attendance, teams, rewards, rotations and guild operations across online games.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
