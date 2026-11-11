import Link from "next/link";
import { useTranslation } from "@/app/components/LanguageProvider";

export default function BlacklistCard({ case: caseData }) {
  const { t } = useTranslation();
  const statusLabel = t(caseData.status, {}, {});
  const categoryLabel = t(caseData.category, {}, {});
  const idTypeLabel = t(caseData.id_type, {}, {});

  return (
    <article className="border rounded-lg p-4 hover:shadow-md transition">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-bold text-lg">
          {caseData.full_name || t("name")}
        </h3>
        <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
          {caseData.case_id}
        </span>
      </div>
      <p className="text-gray-600 text-sm mb-2">
        {idTypeLabel} · {statusLabel}
      </p>
      {caseData.incident_location && (
        <p className="text-gray-600 text-sm mb-2">
          {caseData.incident_location}
        </p>
      )}
      {caseData.incident_date && (
        <p className="text-gray-600 text-sm mb-2">
          {new Date(caseData.incident_date).toLocaleDateString()}
        </p>
      )}
      <Link
        href={`/blacklist/${caseData.case_id}`}
        className="text-blue-600 hover:underline text-sm font-medium"
      >
        {t("viewDetails")} →
      </Link>
    </article>
  );
}
