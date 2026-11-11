import { fetchBlacklistPerson } from "@/lib/api";
import { useTranslation } from "@/app/components/LanguageProvider";

export default async function BlacklistDetailPage({ params }) {
  const { t } = useTranslation();
  const caseId = Array.isArray(params.caseId) ? params.caseId[0] : params.caseId;
  let caseData;

  try {
    caseData = await fetchBlacklistPerson(caseId);
  } catch {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">{t("notFound")}</h1>
        <p className="mt-2 text-gray-600">
          {t("notFoundMessage")}
        </p>
      </div>
    );
  }

  const statusLabel = t(caseData.status, {}, {});
  const categoryLabel = t(caseData.category, {}, {});
  const riskLabel = t(caseData.risk_level, {}, {});
  const idTypeLabel = t(caseData.id_type, {}, {});

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex justify-between items-start mb-4">
        <h1 className="text-2xl font-bold">
          {caseData.full_name || t("name")}
        </h1>
        <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
          {caseData.case_id}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-50 p-4 rounded">
          <div className="text-gray-500 text-sm">{t("status")}</div>
          <div className="font-medium">{statusLabel}</div>
        </div>
        <div className="bg-gray-50 p-4 rounded">
          <div className="text-gray-500 text-sm">{t("category")}</div>
          <div className="font-medium">{categoryLabel}</div>
        </div>
        <div className="bg-gray-50 p-4 rounded">
          <div className="text-gray-500 text-sm">{t("riskLevel")}</div>
          <div className="font-medium">{riskLabel}</div>
        </div>
        <div className="bg-gray-50 p-4 rounded">
          <div className="text-gray-500 text-sm">{t("idType")}</div>
          <div className="font-medium">{idTypeLabel}</div>
        </div>
        <div className="bg-gray-50 p-4 rounded">
          <div className="text-gray-500 text-sm">{t("idNumber")}</div>
          <div className="font-medium">{caseData.masked_id || "—"}</div>
        </div>
        <div className="bg-gray-50 p-4 rounded">
          <div className="text-gray-500 text-sm">{t("nationality")}</div>
          <div className="font-medium">{caseData.nationality || "—"}</div>
        </div>
      </div>

      {caseData.incident_location && (
        <div className="mb-6">
          <h2 className="text-lg font-bold mb-2">{t("incidentLocation")}</h2>
          <p className="text-gray-700">{caseData.incident_location}</p>
        </div>
      )}

      {caseData.incident_date && (
        <div className="mb-6">
          <h2 className="text-lg font-bold mb-2">{t("incidentDate")}</h2>
          <p className="text-gray-700">
            {new Date(caseData.incident_date).toLocaleDateString()}
          </p>
        </div>
      )}

      {caseData.description && (
        <div className="mb-6">
          <h2 className="text-lg font-bold mb-2">{t("description")}</h2>
          <div
            className="prose prose-sm max-w-none text-gray-700"
            dangerouslySetInnerHTML={{ __html: caseData.description }}
          />
        </div>
      )}

      {caseData.images?.length && (
        <div className="mb-6">
          <h2 className="text-lg font-bold mb-2">{t("images")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {caseData.images.map((img, i) => (
              <div key={i} className="border rounded overflow-hidden">
                <img
                  src={img.image_url}
                  alt={img.caption || "Case image"}
                  className="w-full h-48 object-cover"
                />
                {img.caption && (
                  <p className="p-2 text-sm text-gray-600">{img.caption}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-8">
        {t("caseAdded")}:{" "}
        {new Date(caseData.created_at).toLocaleDateString()}
      </p>
    </div>
  );
}
