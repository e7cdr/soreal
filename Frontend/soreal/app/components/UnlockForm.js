import { useState } from "react";
import { useTranslation } from "@/app/components/LanguageProvider";

export default function UnlockForm({ onUnlock }) {
  const { translate: t } = useTranslation();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await onUnlock(password);
    } catch (err) {
      setError(err.message || t("invalidPassword"));
    }
  };

  return (
    <div className="max-w-md mx-auto py-12">
      <h2 className="text-xl font-bold mb-6">{t("accessProtected")}</h2>
      <p className="mb-6">{t("accessPassword")}</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            {t("password")}
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        >
          {t("unlock")}
        </button>
      </form>
    </div>
  );
}
