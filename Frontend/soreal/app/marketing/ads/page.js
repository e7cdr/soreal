"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Plus,
  Trash2,
  Edit3,
  Play,
  Check,
  RefreshCw,
  X,
  DollarSign,
  Target,
  MessageCircle,
  Users as UsersIcon,
} from "lucide-react";
import { useTranslation } from "@/app/components/LanguageProvider";
import PageShell from "@/app/components/PageShell";
import {
  fetchAdCampaigns,
  createAdCampaign,
  updateAdCampaign,
  deleteAdCampaign,
} from "@/lib/api";
import ToolbarMenu from "@/app/components/ToolbarMenu";

const OBJECTIVE_LABELS = {
  traffic: "Traffic",
  messages: "Messages",
  leads: "Leads",
};

const OBJECTIVE_ICONS = {
  traffic: Target,
  messages: MessageCircle,
  leads: UsersIcon,
};

const STATUS_LABELS = {
  planned: "Planned",
  running: "Running",
  completed: "Completed",
};

const STATUS_COLORS = {
  planned: "bg-[var(--surface-muted)] text-[var(--text-muted)]",
  running: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
};

export default function AdCampaignsPage() {
  const { translate: t } = useTranslation();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openForm, setOpenForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    name: "",
    objective: "traffic",
    daily_budget: "",
    currency: "USD",
    target_location: "",
    target_age_min: "",
    target_age_max: "",
    target_interests: "",
    estate: "",
    ad_copy: "",
    image_url: "",
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
    status: "planned",
  });
  const [objectiveFilter, setObjectiveFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (objectiveFilter) params.objective = objectiveFilter;
      if (statusFilter) params.status = statusFilter;
      const data = await fetchAdCampaigns(params);
      const results = data.results || data || [];
      setCampaigns(results);
    } catch (err) {
      setError(err.message || t("error"));
    } finally {
      setLoading(false);
    }
  }, [objectiveFilter, statusFilter, t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCampaigns();
  }, [fetchCampaigns]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        estate: form.estate || null,
        daily_budget: form.daily_budget === "" ? null : Number(form.daily_budget),
        target_age_min: form.target_age_min === "" ? null : Number(form.target_age_min),
        target_age_max: form.target_age_max === "" ? null : Number(form.target_age_max),
      };
      if (editingId) {
        await updateAdCampaign(editingId, payload);
      } else {
        await createAdCampaign(payload);
      }
      setOpenForm(false);
      setEditingId(null);
      setForm({
        name: "",
        objective: "traffic",
        daily_budget: "",
        currency: "USD",
        target_location: "",
        target_age_min: "",
        target_age_max: "",
        target_interests: "",
        estate: "",
        ad_copy: "",
        image_url: "",
        utm_source: "",
        utm_medium: "",
        utm_campaign: "",
        status: "planned",
      });
      await fetchCampaigns();
    } catch (err) {
      setError(err.message || t("error"));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (campaign) => {
    setEditingId(campaign.id);
    setForm({
      name: campaign.name || "",
      objective: campaign.objective || "traffic",
      daily_budget: campaign.daily_budget ?? "",
      currency: campaign.currency || "USD",
      target_location: campaign.target_location || "",
      target_age_min: campaign.target_age_min ?? "",
      target_age_max: campaign.target_age_max ?? "",
      target_interests: campaign.target_interests || "",
      estate: campaign.estate || "",
      ad_copy: campaign.ad_copy || "",
      image_url: campaign.image_url || "",
      utm_source: campaign.utm_source || "",
      utm_medium: campaign.utm_medium || "",
      utm_campaign: campaign.utm_campaign || "",
      status: campaign.status || "planned",
    });
    setOpenForm(true);
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await deleteAdCampaign(id);
      await fetchCampaigns();
    } catch (err) {
      setError(err.message || t("error"));
    } finally {
      setDeletingId(null);
    }
  };

  const handleRun = async (id) => {
    try {
      await updateAdCampaign(id, { status: "running" });
      await fetchCampaigns();
    } catch (err) {
      setError(err.message || t("error"));
    }
  };

  const handleComplete = async (id) => {
    try {
      await updateAdCampaign(id, { status: "completed" });
      await fetchCampaigns();
    } catch (err) {
      setError(err.message || t("error"));
    }
  };

  const filteredCampaigns = campaigns.filter(
    (c) =>
      (!objectiveFilter || c.objective === objectiveFilter) &&
      (!statusFilter || c.status === statusFilter)
  );

  const formatCurrency = (value, currency) => {
    if (value == null) return "-";
    return `${currency || "USD"} ${Number(value).toLocaleString()}`;
  };

  const getCampaignListContent = () => {
    if (loading) {
      return (
        <div className="h-64 flex items-center justify-center text-[var(--text-muted)]">
          {t("loadingCampaigns")}
        </div>
      );
    }
    if (filteredCampaigns.length === 0) {
      return (
        <div className="h-64 flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-center text-sm text-[var(--text-muted)]">
          <Plus size={24} className="mb-2 text-[var(--text-muted-light)]" />
          <p>{t("noCampaignsYet")}</p>
        </div>
      );
    }
    return (
      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {filteredCampaigns.map((campaign) => (
          <div
            key={campaign.id}
            className="flex items-start justify-between gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--surface-surface)] hover:bg-[var(--surface-hover)] cursor-pointer transition"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded ${STATUS_COLORS[campaign.status]}`}
                >
                  {STATUS_LABELS[campaign.status] || campaign.status}
                </span>
                {campaign.objective && (
                  <span className="text-xs text-[var(--text-muted)]">
                    {OBJECTIVE_LABELS[campaign.objective] || campaign.objective}
                  </span>
                )}
              </div>
              <h3 className="text-sm font-semibold text-[var(--foreground)] truncate">
                {campaign.name || t("untitledCampaign")}
              </h3>
              {campaign.ad_copy && (
                <p className="text-xs text-[var(--text-muted)] line-clamp-2 mt-1">
                  {campaign.ad_copy}
                </p>
              )}
              {campaign.estate_title && (
                <p className="text-xs text-[var(--green)] mt-1 truncate">
                  🏠 {campaign.estate_title}
                </p>
              )}
              <div className="mt-2 flex items-center gap-3 text-xs text-[var(--text-muted)]">
                <span>
                  {formatCurrency(campaign.daily_budget, campaign.currency)} / {t("daily")}
                </span>
                {campaign.target_location && (
                  <span>· {campaign.target_location}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 ml-2">
              {campaign.status === "planned" && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRun(campaign.id);
                  }}
                  className="p-1.5 bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-100"
                  title={t("runCampaign")}
                >
                  <Play size={14} />
                </button>
              )}
              {campaign.status === "running" && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleComplete(campaign.id);
                  }}
                  className="p-1.5 bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-100"
                  title={t("completeCampaign")}
                >
                  <Check size={14} />
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEdit(campaign);
                }}
                className="p-1.5 text-[var(--text-muted)] hover:text-[var(--green)]"
                title={t("edit")}
              >
                <Edit3 size={14} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(campaign.id);
                }}
                className="p-1.5 text-[var(--text-muted)] hover:text-red-600"
                title={t("deleteCampaign")}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <PageShell
      eyebrow={t("adCampaigns")}
      title={t("adCampaigns")}
      description={t("adCampaignsDescription")}
      actions={
        <>
          <Link href="/estates" className="toolbar-button">
            <Calendar size={16} />
            {t("viewEstates")}
          </Link>
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setForm({
                name: "",
                objective: "traffic",
                daily_budget: "",
                currency: "USD",
                target_location: "",
                target_age_min: "",
                target_age_max: "",
                target_interests: "",
                estate: "",
                ad_copy: "",
                image_url: "",
                utm_source: "",
                utm_medium: "",
                utm_campaign: "",
                status: "planned",
              });
              setOpenForm(true);
            }}
            className="toolbar-button toolbar-button-primary"
          >
            <Plus size={16} />
            {t("newCampaign")}
          </button>
          <ToolbarMenu label={t("filters")}>
            <button
              type="button"
              onClick={() => setObjectiveFilter("")}
              className={`toolbar-menu-item ${!objectiveFilter ? "toolbar-tab-active" : ""}`}
            >
              {t("allObjectives")}
            </button>
            {Object.entries(OBJECTIVE_LABELS).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setObjectiveFilter(key)}
                className={`toolbar-menu-item ${objectiveFilter === key ? "toolbar-tab-active" : ""}`}
              >
                {label}
              </button>
            ))}
            <div className="toolbar-divider" />
            <button
              type="button"
              onClick={() => setStatusFilter("")}
              className={`toolbar-menu-item ${!statusFilter ? "toolbar-tab-active" : ""}`}
            >
              {t("allCampaignStatuses")}
            </button>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className={`toolbar-menu-item ${statusFilter === key ? "toolbar-tab-active" : ""}`}
              >
                {label}
              </button>
            ))}
          </ToolbarMenu>
        </>
      }
    >
      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <div className="col-span-1 md:col-span-2 lg:col-span-2">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{t("upcomingCampaigns")}</h2>
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <button
                  type="button"
                  onClick={fetchCampaigns}
                  className="text-xs text-[var(--text-muted)] hover:underline"
                >
                  {t("refresh")}
                </button>
              )}
            </div>
            {getCampaignListContent()}
          </div>
        </div>

        <div className="col-span-1 md:col-span-1 lg:col-span-1">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold">{t("quickStats")}</h2>
            <div className="grid gap-2">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--surface-muted)]">
                <DollarSign size={16} className="text-[var(--text-muted)]" />
                <span className="text-sm font-semibold">{campaigns.length}</span>
                <span className="text-xs text-[var(--text-muted)]">{t("totalCampaigns")}</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--surface-muted)]">
                <Play size={16} className="text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-700">
                  {campaigns.filter((c) => c.status === "running").length}
                </span>
                <span className="text-xs text-[var(--text-muted)]">{t("running")}</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--surface-muted)]">
                <Target size={16} className="text-blue-600" />
                <span className="text-sm font-semibold text-blue-700">
                  {campaigns.filter((c) => c.objective === "traffic").length}
                </span>
                <span className="text-xs text-[var(--text-muted)]">{t("traffic")}</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--surface-muted)]">
                <Check size={16} className="text-[var(--text-muted)]" />
                <span className="text-sm font-semibold">
                  {campaigns.filter((c) => c.status === "completed").length}
                </span>
                <span className="text-xs text-[var(--text-muted)]">{t("completed")}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {openForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <form
            onSubmit={handleSubmit}
            className="my-4 grid w-full max-w-2xl gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl sm:grid-cols-2"
          >
            <div className="flex items-center justify-between gap-3 sm:col-span-2">
              <h2 className="text-lg font-semibold">
                {editingId ? t("editCampaign") : t("newCampaign")}
              </h2>
              <button
                type="button"
                onClick={() => setOpenForm(false)}
                className="toolbar-button"
              >
                <X size={16} />
                {t("close")}
              </button>
            </div>

            <label className="sm:col-span-2">
              <span className="block text-sm font-medium text-[var(--foreground)] mb-1">
                {t("campaignName")}
              </span>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder={t("campaignNamePlaceholder")}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]"
              />
            </label>

            <label className="sm:col-span-2">
              <span className="block text-sm font-medium text-[var(--foreground)] mb-1">
                {t("objective")}
              </span>
              <select
                name="objective"
                value={form.objective}
                onChange={(event) => setForm({ ...form, objective: event.target.value })}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]"
              >
                {Object.entries(OBJECTIVE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-1">
                <span className="block text-sm font-medium text-[var(--foreground)] mb-1">
                  {t("dailyBudget")}
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  name="daily_budget"
                  value={form.daily_budget}
                  onChange={(event) => setForm({ ...form, daily_budget: event.target.value })}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]"
                />
              </label>
              <label className="sm:col-span-1">
                <span className="block text-sm font-medium text-[var(--foreground)] mb-1">
                  {t("currency")}
                </span>
                <select
                  name="currency"
                  value={form.currency}
                  onChange={(event) => setForm({ ...form, currency: event.target.value })}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]"
                >
                  <option value="USD">USD</option>
                  <option value="DOP">DOP</option>
                  <option value="EUR">EUR</option>
                </select>
              </label>
            </div>

            <label className="sm:col-span-2">
              <span className="block text-sm font-medium text-[var(--foreground)] mb-1">
                {t("targetLocation")}
              </span>
              <input
                type="text"
                name="target_location"
                value={form.target_location}
                onChange={(event) => setForm({ ...form, target_location: event.target.value })}
                placeholder={t("targetLocationPlaceholder")}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="sm:col-span-1">
                <span className="block text-sm font-medium text-[var(--foreground)] mb-1">
                  {t("targetAgeMin")}
                </span>
                <input
                  type="number"
                  min="0"
                  name="target_age_min"
                  value={form.target_age_min}
                  onChange={(event) => setForm({ ...form, target_age_min: event.target.value })}
                  placeholder="18"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]"
                />
              </label>
              <label className="sm:col-span-1">
                <span className="block text-sm font-medium text-[var(--foreground)] mb-1">
                  {t("targetAgeMax")}
                </span>
                <input
                  type="number"
                  min="0"
                  name="target_age_max"
                  value={form.target_age_max}
                  onChange={(event) => setForm({ ...form, target_age_max: event.target.value })}
                  placeholder="65"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]"
                />
              </label>
            </div>

            <label className="sm:col-span-2">
              <span className="block text-sm font-medium text-[var(--foreground)] mb-1">
                {t("targetInterests")}
              </span>
              <input
                type="text"
                name="target_interests"
                value={form.target_interests}
                onChange={(event) => setForm({ ...form, target_interests: event.target.value })}
                placeholder={t("targetInterestsPlaceholder")}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]"
              />
            </label>

            <label className="sm:col-span-2">
              <span className="block text-sm font-medium text-[var(--foreground)] mb-1">
                {t("estate")}
              </span>
              <select
                name="estate"
                value={form.estate}
                onChange={(event) => setForm({ ...form, estate: event.target.value })}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]"
              >
                <option value="">{t("noEstate")}</option>
              </select>
            </label>

            <label className="sm:col-span-2">
              <span className="block text-sm font-medium text-[var(--foreground)] mb-1">
                {t("adCopy")}
              </span>
              <textarea
                name="ad_copy"
                rows={4}
                value={form.ad_copy}
                onChange={(event) => setForm({ ...form, ad_copy: event.target.value })}
                placeholder={t("adCopyPlaceholder")}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]"
              />
            </label>

            <label className="sm:col-span-2">
              <span className="block text-sm font-medium text-[var(--foreground)] mb-1">
                {t("imageUrl")}
              </span>
              <input
                type="url"
                name="image_url"
                value={form.image_url}
                onChange={(event) => setForm({ ...form, image_url: event.target.value })}
                placeholder={t("imageUrlPlaceholder")}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="sm:col-span-1">
                <span className="block text-sm font-medium text-[var(--foreground)] mb-1">
                  {t("utmSource")}
                </span>
                <input
                  type="text"
                  name="utm_source"
                  value={form.utm_source}
                  onChange={(event) => setForm({ ...form, utm_source: event.target.value })}
                  placeholder="facebook"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]"
                />
              </label>
              <label className="sm:col-span-1">
                <span className="block text-sm font-medium text-[var(--foreground)] mb-1">
                  {t("utmMedium")}
                </span>
                <input
                  type="text"
                  name="utm_medium"
                  value={form.utm_medium}
                  onChange={(event) => setForm({ ...form, utm_medium: event.target.value })}
                  placeholder="cpc"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]"
                />
              </label>
              <label className="sm:col-span-1">
                <span className="block text-sm font-medium text-[var(--foreground)] mb-1">
                  {t("utmCampaign")}
                </span>
                <input
                  type="text"
                  name="utm_campaign"
                  value={form.utm_campaign}
                  onChange={(event) => setForm({ ...form, utm_campaign: event.target.value })}
                  placeholder="spring_sale"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]"
                />
              </label>
            </div>

            <label className="sm:col-span-2">
              <span className="block text-sm font-medium text-[var(--foreground)] mb-1">
                {t("status")}
              </span>
              <select
                name="status"
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value })}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]"
              >
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <div className="sm:col-span-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpenForm(false)}
                className="toolbar-button"
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="toolbar-button toolbar-button-primary disabled:opacity-50"
              >
                {saving ? t("saving") : t("saveCampaign")}
              </button>
            </div>
          </form>
        </div>
      )}
    </PageShell>
  );
}
