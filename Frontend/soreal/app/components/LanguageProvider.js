"use client";

import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { getLanguage, setLanguage, t } from "@/lib/i18n";

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState("en");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLang(getLanguage());
  }, []);

  useEffect(() => {
    setLanguage(lang);
  }, [lang]);

  const changeLanguage = (newLang) => {
    setLang(newLang);
  };

  const translate = useCallback((key, params = {}) => t(key, lang, params), [lang]);

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
