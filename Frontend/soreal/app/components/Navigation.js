"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Building2,
  ChartNoAxesCombined,
  ChevronDown,
  CircleHelp,
  FilePlus2,
  Heart,
  Home,
  LogIn,
  LogOut,
  ListChecks,
  Menu,
  Moon,
  Sun,
  Users,
  X,
} from "lucide-react";
import { useTheme } from "@/app/components/ThemeProvider";
import { useTranslation } from "@/app/components/LanguageProvider";
import { fetchPendingMatchCount } from "@/lib/api";

const primaryLinks = [
  { href: "/", label: "home", icon: Home },
  { href: "/estates", label: "estates", icon: Building2 },
  { href: "/projects", label: "projects", icon: Building2 },
  { href: "/blacklist", label: "blacklist", icon: Users },
  { href: "/analytics", label: "analytics", icon: ChartNoAxesCombined },
];

export default function Navigation() {
  const pathname = usePathname();
  const { lang, changeLanguage, translate } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const [hasAuth, setHasAuth] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingMatches, setPendingMatches] = useState(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasAuth(Boolean(localStorage.getItem("auth_token")));
  }, [pathname]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    let active = true;
    fetchPendingMatchCount()
      .then((count) => {
        if (active) setPendingMatches(count);
      })
      .catch(() => {
        // Ignore errors; badge stays at 0
      });
    return () => {
      active = false;
    };
  }, []);

  const moreLinks = [
    { href: "/favorites", label: "favorites", icon: Heart },
    { href: "/report", label: "submitReport", icon: FilePlus2 },
    { href: "/requests", label: "requestQueue", icon: ListChecks },
    { href: "/brokers", label: "brokers", icon: Users },
    { href: "/owners", label: "owners", icon: Users },
    { href: "/data-quality", label: "dataQuality", icon: ChartNoAxesCombined },
    { href: "/scan-inbox", label: "scanInbox", icon: FilePlus2 },
    {
      href: "/lead-matches",
      label: "leadMatches",
      icon: ChartNoAxesCombined,
      badge: pendingMatches,
    },
    { href: "/whatsapp-import", label: "whatsappImport", icon: FilePlus2 },
    { href: "/about", label: "about", icon: CircleHelp },
    { href: "/account", label: "account", icon: Users },
  ];

  const isActive = (href) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const renderLink = ({ href, label, icon: Icon, badge }) => (
    <Link
      key={href}
      href={href}
      aria-current={isActive(href) ? "page" : undefined}
      className={`nav-link${isActive(href) ? " nav-link-active" : ""}`}
    >
      <Icon aria-hidden="true" size={17} strokeWidth={1.8} />
      <span>{translate(label)}</span>
      {badge > 0 && (
        <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-red-600 text-white text-[10px] font-bold">
          {badge}
        </span>
      )}
    </Link>
  );

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    window.location.href = "/login";
  };

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Link href="/" className="brand" aria-label="SOREAL home">
          <span className="brand-mark">
            <Building2 aria-hidden="true" size={21} strokeWidth={2.2} />
          </span>
          <span className="brand-name">soreal</span>
          <span className="brand-caption">PROPERTY, MADE CLEAR</span>
        </Link>

        <button
          type="button"
          className="mobile-menu-toggle"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Close navigation" : "Open navigation"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>

        <div className={`header-content${menuOpen ? " header-content-open" : ""}`}>
          <nav className="primary-nav" aria-label="Main navigation">
            {primaryLinks.map(renderLink)}
            <details className="more-menu">
              <summary
                className={`nav-link${moreLinks.some(({ href }) => isActive(href)) ? " nav-link-active" : ""}`}
              >
                <span>{lang === "es" ? "Más" : "More"}</span>
                <ChevronDown aria-hidden="true" size={15} />
              </summary>
              <div className="more-menu-panel">
                {moreLinks.map(renderLink)}
                {hasAuth ? (
                  <>
                    {renderLink({
                      href: "/blacklist/moderate",
                      label: "moderation",
                      icon: Users,
                    })}
                    <button
                      type="button"
                      className="nav-link nav-logout"
                      onClick={handleLogout}
                    >
                      <LogOut aria-hidden="true" size={17} />
                      <span>{translate("logout", { username: "Staff" })}</span>
                    </button>
                  </>
                ) : (
                  renderLink({
                    href: "/login",
                    label: "staffLogin",
                    icon: LogIn,
                  })
                )}
              </div>
            </details>
          </nav>

          <div className="header-actions">
            {!hasAuth && (
              <Link
                href="/login"
                className="header-icon-button staff-login"
                title={translate("staffLogin")}
                aria-label={translate("staffLogin")}
              >
                <LogIn size={18} />
              </Link>
            )}
            <button
              type="button"
              onClick={() => changeLanguage(lang === "en" ? "es" : "en")}
              className="header-icon-button language-toggle"
              aria-label={lang === "en" ? "Cambiar a español" : "Switch to English"}
              title={lang === "en" ? "Switch to Spanish" : "Switch to English"}
            >
              {lang === "en" ? "ES" : "EN"}
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="header-icon-button"
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              title={theme === "dark" ? "Light mode" : "Dark mode"}
            >
              {theme === "dark" ? (
                <Sun aria-hidden="true" size={18} />
              ) : (
                <Moon aria-hidden="true" size={18} />
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
