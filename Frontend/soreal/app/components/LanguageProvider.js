"use client";

import { useState, useEffect, createContext, useContext } from "react";
import { getLanguage, setLanguage, t } from "@/lib/i18n";

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => getLanguage());

  useEffect(() => {
    setLanguage(lang);
  }, [lang]);

  const changeLanguage = (newLang) => {
    setLang(newLang);
  };

  const translate = (key, params = {}) => t(key, lang, params);

  return (
    <LanguageContext.Provider value={{ lang, changeLanguage, translate, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useTranslation must be used within a LanguageProvider");
  }
  return context;
}
