"use client";

import "./globals.css";
import Navigation from "./components/Navigation";
import { LanguageProvider } from "./components/LanguageProvider";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider>
          <Navigation />
          <main>{children}</main>
        </LanguageProvider>
      </body>
    </html>
  );
}
