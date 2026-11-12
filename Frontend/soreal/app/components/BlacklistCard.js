import Link from "next/link";
import { useTranslation } from "@/app/components/LanguageProvider";

export default function BlacklistCard({ case: caseData }) {
  const { translate: t } = useTranslation();
  const statusLabel = t(caseData.status);
  const categoryLabel = t(caseData.category);
  const idTypeLabel = t(caseData.id_type);

  return (
    <article className="compact-card transition hover:shadow-md">
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <h3 className="text-base font-bold">
          {caseData.full_name || t("name")}
        </h3>
        <span className="rounded bg-[var(--surface-muted)] px-2 py-0.5 font-mono text-[10px]">
          {caseData.case_id}
        </span>
      </div>
      <p className="mb-1 text-xs text-[var(--text-muted)]">
        {idTypeLabel} · {statusLabel}
      </p>
      {caseData.incident_location && (
        <p className="mb-1 text-xs text-[var(--text-muted)]">
          {caseData.incident_location}
        </p>
      )}
      {caseData.incident_date && (
        <p className="mb-1 text-xs text-[var(--text-muted)]">
          {new Date(caseData.incident_date).toLocaleDateString()}
        </p>
      )}
      <Link
        href={`/blacklist/${caseData.case_id}`}
        className="text-xs font-semibold text-[var(--green)] hover:underline"
      >
        {t("viewDetails")} →
      </Link>
    </article>
  );
}
