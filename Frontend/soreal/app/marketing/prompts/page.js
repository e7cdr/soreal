"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Copy,
  FileText,
  FormatList,
  Globe,
  HelpCircle,
  LayoutList,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useTranslation } from "@/app/components/LanguageProvider";
import PageShell from "@/app/components/PageShell";
import {
  PROMPT_CATEGORIES,
  PROMPTS,
  getCategories,
  getPromptById,
  getPromptByCategory,
  renderPrompt,
} from "@/lib/prompts";

export default function PromptLibraryPage() {
  const { translate: t } = useTranslation();
  const [categoryFilter, setCategoryFilter] = useState("");
  const [selectedPromptId, setSelectedPromptId] = useState(null);
  const [promptLanguage, setPromptLanguage] = useState("en");
  const [variables, setVariables] = useState({});
  const [generatedContent, setGeneratedContent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [copyTimeout, setCopyTimeout] = useState(null);

  const categories = getCategories();

  const filteredPrompts = Object.values(PROMPTS).filter(
    (p) =>
      (!categoryFilter || p.category === categoryFilter) &&
      (!searchQuery ||
        p.name_en.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.name_es.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.prompt_en || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.prompt_es || "").toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const selectedPrompt = selectedPromptId ? getPromptById(selectedPromptId) : null;

  const handleSelectPrompt = (id) => {
    setSelectedPromptId(id);
    const prompt = getPromptById(id);
    if (prompt) {
      const initVars = {};
      prompt.variables.forEach((v) => {
        initVars[v] = "";
      });
      setVariables(initVars);
      setGeneratedContent("");
    }
  };

  const handleVariableChange = (key, value) => {
    setVariables({ ...variables, [key]: value });
    if (selectedPrompt) {
      setGeneratedContent(renderPrompt(selectedPrompt, variables, promptLanguage));
    }
  };

  const handleGenerate = () => {
    if (selectedPrompt) {
      setGeneratedContent(renderPrompt(selectedPrompt, variables, promptLanguage));
    }
  };

  const handleCopy = () => {
    if (!generatedContent) return;
    navigator.clipboard.writeText(generatedContent);
    setCopyTimeout("copied");
    setTimeout(() => setCopyTimeout(null), 2000);
  };

  const handleInsert = () => {
    if (!generatedContent) return;
    navigator.clipboard.writeText(generatedContent);
    setCopyTimeout("inserted");
    setTimeout(() => setCopyTimeout(null), 2000);
  };

  return (
    <PageShell
      eyebrow={t("aiPrompts")}
      title={t("aiPrompts")}
      description={t("aiPromptsDescription")}
      actions={
        <>
          <Link href="/marketing/calendar" className="toolbar-button">
            <LayoutList size={16} />
            {t("marketingCalendar")}
          </Link>
          <Link href="/marketing/ads" className="toolbar-button">
            <FileText size={16} />
            {t("adCampaigns")}
          </Link>
        </>
      }
    >
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
        {/* Category sidebar */}
        <div className="col-span-1 md:col-span-1 lg:col-span-1">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm sticky top-24">
            <div className="flex items-center gap-2 mb-4">
              <Search size={16} className="text-[var(--text-muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t("search")}
                className="w-full bg-transparent text-sm text-[var(--foreground)] placeholder-[var(--text-muted)] focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setCategoryFilter("")}
                className={`w-full text-left text-sm px-3 py-2 rounded-lg transition ${
                  !categoryFilter
                    ? "bg-[var(--surface-muted)] text-[var(--foreground)]"
                    : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
                }`}
              >
                {t("allCategories")}
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setCategoryFilter(cat.key)}
                  className={`w-full text-left text-sm px-3 py-2 rounded-lg transition ${
                    categoryFilter === cat.key
                      ? "bg-[var(--surface-muted)] text-[var(--foreground)]"
                      : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Prompt list */}
        <div className="col-span-1 md:col-span-1 lg:col-span-1">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
            <h3 className="text-sm font-semibold mb-3">{t("selectPrompt")}</h3>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {filteredPrompts.length === 0 ? (
                <div className="text-center py-8 text-[var(--text-muted)] text-sm">
                  {t("noPromptsFound")}
                </div>
              ) : (
                filteredPrompts.map((prompt) => (
                  <button
                    key={prompt.category + "_" + prompt.name_en}
                    type="button"
                    onClick={() => handleSelectPrompt(prompt.category + "_" + prompt.name_en)}
                    className={`w-full text-left text-sm px-3 py-2 rounded-lg transition border border-transparent ${
                      selectedPromptId === prompt.category + "_" + prompt.name_en
                        ? "bg-[var(--surface-muted)] border-[var(--border)] text-[var(--foreground)]"
                        : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-medium truncate">
                        {promptLanguage === "es" ? prompt.name_es : prompt.name_en}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {prompt.category}
                      </span>
                    </div>
                    <p className="text-[10px] text-[var(--text-muted-light)] mt-0.5 truncate max-w-[200px]">
                      {(promptLanguage === "es" ? prompt.prompt_es : prompt.prompt_en) || ""}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Prompt detail / generator */}
        <div className="col-span-1 md:col-span-2 lg:col-span-2">
          {!selectedPrompt ? (
            <div className="h-full flex flex-col items-center justify-center text-[var(--text-muted)]">
              <HelpCircle size={48} className="mb-4 opacity-50" />
              <p>{t("selectPromptToBegin")}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">{selectedPrompt.name_en}</h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    {promptLanguage === "es" ? selectedPrompt.prompt_es : selectedPrompt.prompt_en}
                  </p>
                </div>
                <div className="flex gap-2">
                  <select
                    value={promptLanguage}
                    onChange={(event) => {
                      setPromptLanguage(event.target.value);
                      if (selectedPrompt) {
                        setGeneratedContent(renderPrompt(selectedPrompt, variables, event.target.value));
                      }
                    }}
                    className="text-xs rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1"
                  >
                    <option value="en">{t("languageEnglish")}</option>
                    <option value="es">{t("languageSpanish")}</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleGenerate}
                    className="text-xs bg-[var(--green)] text-white px-2 py-1 rounded hover:opacity-90"
                    title={t("generateContent")}
                  >
                    {t("generateContent")}
                  </button>
                </div>
              </div>

              {/* Variables */}
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                <h4 className="text-xs font-semibold mb-3">{t("promptVariables")}</h4>
                <div className="space-y-2">
                  {selectedPrompt.variables.map((varName) => (
                    <div key={varName} className="flex items-center gap-2">
                      <label className="text-xs font-medium text-[var(--text-muted)] w-1/3">
                        {varName}
                      </label>
                      <input
                        type="text"
                        value={variables[varName] || ""}
                        onChange={(event) => handleVariableChange(varName, event.target.value)}
                        placeholder={t("fillVariables")}
                        className="w-2/3 text-xs rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[var(--foreground)] focus:outline-none"
                      />
                    </div>
                  ))}
                  {selectedPrompt.variables.length === 0 && (
                    <p className="text-xs text-[var(--text-muted)]">
                      {t("noVariables")}
                    </p>
                  )}
                </div>
              </div>

              {/* Generated content */}
              <div className="flex flex-col gap-2">
                <h4 className="text-xs font-semibold">{t("generatedContent")}</h4>
                <div className="flex items-center justify-between">
                  <textarea
                    value={generatedContent}
                    readOnly
                    rows={8}
                    className="w-full rounded border border-[var(--border)] bg-[var(--surface)] p-3 text-sm text-[var(--foreground)] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCopy}
                    disabled={!generatedContent}
                    className={`text-xs rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[var(--foreground)] hover:opacity-90 ${
                      !generatedContent ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                    title={copyTimeout === "copied" ? t("copied") : t("copyToClipboard")}
                  >
                    {copyTimeout === "copied" ? t("copied") : <Copy size={14} />}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleInsert}
                disabled={!generatedContent}
                className={`w-full text-xs font-semibold py-2 rounded border ${
                  !generatedContent
                    ? "border-transparent text-[var(--text-muted-light)]"
                    : "bg-[var(--green)] text-white border-[var(--green)] hover:opacity-90"
                }`}
              >
                {copyTimeout === "inserted" ? t("inserted") : t("insertIntoPost")}
              </button>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
