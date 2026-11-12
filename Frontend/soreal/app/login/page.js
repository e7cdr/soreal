"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/app/components/LanguageProvider";
import PageShell from "@/app/components/PageShell";
import { apiFetch } from "@/lib/api";

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
      const data = await apiFetch("/api/blacklist/auth/login/", {
        method: "POST",
        body: JSON.stringify({ username, password }),
        skipAuth: true,
        redirectOnAuthError: false,
      });
      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("auth_user", JSON.stringify(data.user));
      const requestedPath = new URLSearchParams(window.location.search).get("next");
      let nextPath = "/blacklist/moderate";
      if (requestedPath?.startsWith("/") && !requestedPath.startsWith("//")) {
        const destination = new URL(requestedPath, window.location.origin);
        if (
          destination.origin === window.location.origin &&
          destination.pathname !== "/login"
        ) {
          nextPath = `${destination.pathname}${destination.search}${destination.hash}`;
        }
      }
      router.replace(nextPath);
      router.refresh();
    } catch (err) {
      const message = err.message || "";
      setError(
        message.includes("Unable to log in with provided credentials") ||
          message.includes("Invalid username or password")
          ? t("invalidLoginCredentials")
          : message || t("error"),
      );
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
