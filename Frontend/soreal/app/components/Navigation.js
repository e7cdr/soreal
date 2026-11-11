"use client";

import Link from "next/link";
import { useTranslation } from "@/app/components/LanguageProvider";

export default function Navigation() {
  const { lang, changeLanguage, t } = useTranslation();

  return (
    <nav className="bg-white border-b p-4">
      <ul className="flex flex-wrap gap-4 items-center">
        <li>
          <Link href="/" className="hover:text-blue-600">
            {t("home")}
          </Link>
        </li>
        <li>
          <Link href="/about" className="hover:text-blue-600">
            {t("about")}
          </Link>
        </li>
        <li>
          <Link href="/estates" className="hover:text-blue-600">
            {t("estates")}
          </Link>
        </li>
        <li>
          <Link href="/favorites" className="hover:text-blue-600">
            {t("favorites")}
          </Link>
        </li>
        <li>
          <Link href="/blacklist" className="hover:text-blue-600">
            {t("blacklist")}
          </Link>
        </li>
        <li>
          <Link href="/report" className="hover:text-blue-600">
            {t("submitReport")}
          </Link>
        </li>
        <li>
          <Link href="/leads" className="hover:text-blue-600">
            {t("leads")}
          </Link>
        </li>
        <li>
          <Link href="/lead-matches" className="hover:text-blue-600">
            {t("leadMatches")}
          </Link>
        </li>
        <li>
          <Link href="/projects" className="hover:text-blue-600">
            {t("projects")}
          </Link>
        </li>
        <li>
          <Link href="/analytics" className="hover:text-blue-600">
            {t("analytics")}
          </Link>
        </li>
        <li>
          <Link href="/whatsapp-import" className="hover:text-blue-600">
            {t("whatsappImport")}
          </Link>
        </li>
        <li className="flex items-center gap-2">
          <button
            onClick={() => changeLanguage(lang === "en" ? "es" : "en")}
            className={`text-sm font-medium rounded px-2 py-1 border ${
              lang === "en" ? "bg-blue-100 text-blue-700 border-blue-300" : "bg-gray-100 text-gray-700 border-gray-300"
            }`}
          >
            {lang === "en" ? "ES" : "EN"}
          </button>
        </li>
        {typeof window !== "undefined" && localStorage.getItem("auth_token") ? (
          <>
            <li>
              <Link
                href="/blacklist/moderate"
                className="hover:text-blue-600"
              >
                {t("moderation")}
              </Link>
            </li>
            <li>
              <button
                onClick={() => {
                  localStorage.removeItem("auth_token");
                  localStorage.removeItem("auth_user");
                  window.location.href = "/login";
                }}
                className="text-red-600 hover:underline text-sm"
              >
                {t("logout", { username: "Staff" })}
              </button>
            </li>
          </>
        ) : (
          <li>
            <Link href="/login" className="hover:text-blue-600">
              {t("staffLogin")}
            </Link>
          </li>
        )}
        <li>
          <Link href="/account" className="hover:text-blue-600">
            {t("account")}
          </Link>
        </li>
      </ul>
    </nav>
  );
}
