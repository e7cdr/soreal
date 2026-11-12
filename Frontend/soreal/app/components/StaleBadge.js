"use client";

import { useTranslation } from "@/app/components/LanguageProvider";
import { Clock } from "lucide-react";
import { daysOld, isStale } from "@/lib/dates";

export default function StaleBadge({ createdAt, threshold = 15, size = "xs" }) {
  const { translate: t } = useTranslation();
  const days = daysOld(createdAt);
  if (!isStale(createdAt, threshold)) return null;

  const label = days === null ? t("staleUnknown") : t("staleAge", { days });
  return (
    <span
      title={t("staleTooltip", { days: days ?? 0, threshold })}
      className={`inline-flex items-center gap-1 rounded bg-amber-100 text-amber-800 text-${size} font-medium px-2 py-0.5 border border-amber-200`}
    >
      <Clock size={12} />
      {label}
    </span>
  );
}
