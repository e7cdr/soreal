import { useTranslation } from "@/app/components/LanguageProvider";

export default function Pagination({ page, totalPages, onPageChange }) {
  const { translate: t } = useTranslation();
  if (totalPages <= 1) return null;

  return (
    <div className="flex w-full items-center justify-between gap-2">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="toolbar-button disabled:opacity-40"
      >
        {t("previous")}
      </button>
      <span className="text-sm text-[var(--text-muted)]">
        {t("pageOf", { page, pageCount: totalPages })}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="toolbar-button disabled:opacity-40"
      >
        {t("next")}
      </button>
    </div>
  );
}
