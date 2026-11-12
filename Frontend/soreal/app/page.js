"use client";

import Link from "next/link";
import { useTranslation } from "@/app/components/LanguageProvider";
import {
  ArrowRight,
  Building2,
  ChartNoAxesCombined,
  FilePlus2,
  Heart,
  MapPin,
  Users,
} from "lucide-react";

const sections = [
  {
    href: "/estates",
    label: "estates",
    description: "homeEstatesDescription",
    icon: MapPin,
  },
  {
    href: "/projects",
    label: "projects",
    description: "homeProjectsDescription",
    icon: Building2,
  },
  {
    href: "/favorites",
    label: "favorites",
    description: "homeFavoritesDescription",
    icon: Heart,
  },
  {
    href: "/requests",
    label: "requestQueue",
    description: "homeLeadsDescription",
    icon: Users,
  },
  {
    href: "/analytics",
    label: "analytics",
    description: "homeAnalyticsDescription",
    icon: ChartNoAxesCombined,
  },
  {
    href: "/report",
    label: "submitReport",
    description: "homeReportDescription",
    icon: FilePlus2,
  },
];

export default function Home() {
  const { translate } = useTranslation();

  return (
    <div className="home-page">
      <section className="home-hero">
        <div className="home-hero-art" aria-hidden="true">
          <div className="home-orbit" />
          <div className="home-orbit" />
          <div className="home-orbit" />
          <div className="home-building">
            <Building2 />
          </div>
        </div>

        <div className="home-hero-content">
          <div className="eyebrow">
            <span className="eyebrow-dot" />
            {translate("homeEyebrow")}
          </div>
          <h1>
            {translate("homeHeroLead")}
            <br />
            <span>{translate("homeHeroAccent")}</span>
          </h1>
          <p>
            {translate("homeHeroDescription")}
          </p>
          <div className="home-hero-actions">
            <Link href="/estates" className="home-button">
              {translate("homeExplore")}
              <ArrowRight aria-hidden="true" size={17} />
            </Link>
            <Link href="/projects" className="home-button home-button-secondary">
              {translate("homeBrowseProjects")}
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="workspace-title">
        <div className="home-section-heading">
          <div>
            <h2 id="workspace-title">{translate("homeWorkspace")}</h2>
            <p>{translate("homeWorkspaceSubtitle")}</p>
          </div>
        </div>
        <div className="home-link-grid">
          {sections.map(({ href, label, description, icon: Icon }) => (
            <Link key={href} href={href} className="home-link-card">
              <span className="home-link-icon">
                <Icon aria-hidden="true" size={20} strokeWidth={1.8} />
              </span>
              <span>
                <strong>{translate(label)}</strong>
                <span>{translate(description)}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
