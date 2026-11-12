"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchEstate } from "@/lib/api";
import { useTranslation } from "@/app/components/LanguageProvider";
import EstateDetailClient from "./EstateDetailClient";

export default function EstateDetailLoader({ slug }) {
  const { translate: t } = useTranslation();
  const [estate, setEstate] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetchEstate(slug)
      .then((data) => {
        if (active) setEstate(data);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || t("error"));
      });
    return () => {
      active = false;
    };
  }, [slug, t]);

  if (error) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>
        <Link href="/estates" className="mt-4 inline-block font-semibold text-[var(--green)] hover:underline">
          {t("backToEstates")}
        </Link>
      </main>
    );
  }

  if (!estate) {
    return <main className="p-6 text-sm text-[var(--text-muted)]">{t("loading")}</main>;
  }

  return <EstateDetailClient estate={estate} />;
}
