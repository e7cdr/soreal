"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "@/app/components/LanguageProvider";
import PageShell from "@/app/components/PageShell";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export default function LoginPage() {
  const { translate: t } = useTranslation();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE_URL}/api/blacklist/auth/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.detail || t("error"));
      }

      const data = await resp.json();
      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("auth_user", JSON.stringify(data.user));
      const requestedPath = new URLSearchParams(window.location.search).get("next");
      let nextPath = "/blacklist/moderate";
      if (requestedPath?.startsWith("/") && !requestedPath.startsWith("//")) {
        const destination = new URL(requestedPath, window.location.origin);
        if (destination.origin === window.location.origin) {
          nextPath = `${destination.pathname}${destination.search}${destination.hash}`;
        }
      }
      router.push(nextPath);
    } catch (err) {
      setError(err.message || t("error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell title={t("staffLogin")}>
      <div className="mx-auto max-w-md">
        <div className="compact-card">
          <p className="mb-3 text-center text-sm text-[var(--text-muted)]">
            {t("accessPassword")}
          </p>

          {error && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid gap-3">
            <label className="filter-field">
              <span>Username</span>
              <input
                type="text"
                name="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </label>
            <label className="filter-field">
              <span>Password</span>
              <input
                type="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="toolbar-button toolbar-button-primary disabled:opacity-50"
            >
              {loading ? t("submitting") : t("unlock")}
            </button>
          </form>

        </div>
      </div>
    </PageShell>
  );
}
