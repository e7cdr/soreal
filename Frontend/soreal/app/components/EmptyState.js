import { useTranslation } from "@/app/components/LanguageProvider";

export default function EmptyState({ title, message }) {
  const { translate: t } = useTranslation();
  return (
    <div className="text-center py-12">
      <h3 className="text-lg font-medium">{title || t("noCasesFound")}</h3>
      <p className="mt-2 text-gray-500">{message || t("tryAdjustingFilters")}</p>
    </div>
  );
}
