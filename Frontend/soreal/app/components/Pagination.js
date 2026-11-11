import { useTranslation } from "@/app/components/LanguageProvider";

export default function Pagination({ page, totalPages, onPageChange }) {
  const { t } = useTranslation();
  if (totalPages <= 1) return null;

  return (
    <div className="flex justify-center gap-2 mt-6">
      {page > 1 && (
        <button
          onClick={() => onPageChange(page - 1)}
          className="px-4 py-2 border rounded hover:bg-gray-100"
        >
          Prev
        </button>
      )}
      <span className="px-4 py-2 border rounded">
        Page {page} of {totalPages}
      </span>
      {page < totalPages && (
        <button
          onClick={() => onPageChange(page + 1)}
          className="px-4 py-2 border rounded hover:bg-gray-100"
        >
          Next
        </button>
      )}
    </div>
  );
}
