"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Plus,
  Trash2,
  Edit3,
  Send,
  Check,
  RefreshCw,
  Calendar as CalendarIcon,
  Camera,
  Share2,
  Smartphone,
  Filter,
  X,
} from "lucide-react";
import { useTranslation } from "@/app/components/LanguageProvider";
import PageShell from "@/app/components/PageShell";
import {
  fetchMarketingPosts,
  createMarketingPost,
  updateMarketingPost,
  deleteMarketingPost,
} from "@/lib/api";
import ToolbarMenu from "@/app/components/ToolbarMenu";

const PLATFORM_ICONS = {
  instagram: Camera,
  facebook: Share2,
  whatsapp: Smartphone,
};

const PLATFORM_LABELS = {
  instagram: "Instagram",
  facebook: "Facebook",
  whatsapp: "WhatsApp Status",
};

const STATUS_LABELS = {
  draft: "Draft",
  scheduled: "Scheduled",
  posted: "Posted",
};

const STATUS_COLORS = {
  draft: "bg-[var(--surface-muted)] text-[var(--text-muted)]",
  scheduled: "bg-blue-100 text-blue-700",
  posted: "bg-emerald-100 text-emerald-700",
};

export default function MarketingCalendarPage() {
  const { translate: t } = useTranslation();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openForm, setOpenForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    title: "",
    caption: "",
    platform: "instagram",
    status: "draft",
    scheduled_for: "",
    estate: "",
    media_url: "",
  });
  const [platformFilter, setPlatformFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (platformFilter) params.platform = platformFilter;
      if (statusFilter) params.status = statusFilter;
      const data = await fetchMarketingPosts(params);
      const results = data.results || data || [];
      setPosts(results);
    } catch (err) {
      setError(err.message || t("error"));
    } finally {
      setLoading(false);
    }
  }, [platformFilter, statusFilter, t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPosts();
  }, [fetchPosts]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        estate: form.estate || null,
        media_url: form.media_url || null,
        scheduled_for: form.scheduled_for || null,
      };
      if (editingId) {
        await updateMarketingPost(editingId, payload);
      } else {
        await createMarketingPost(payload);
      }
      setOpenForm(false);
      setEditingId(null);
      setForm({
        title: "",
        caption: "",
        platform: "instagram",
        status: "draft",
        scheduled_for: "",
        estate: "",
        media_url: "",
      });
      await fetchPosts();
    } catch (err) {
      setError(err.message || t("error"));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (post) => {
    setEditingId(post.id);
    setForm({
      title: post.title || "",
      caption: post.caption || "",
      platform: post.platform,
      status: post.status,
      scheduled_for: post.scheduled_for ? post.scheduled_for.slice(0, 16) : "",
      estate: post.estate || "",
      media_url: post.media_url || "",
    });
    setOpenForm(true);
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await deleteMarketingPost(id);
      await fetchPosts();
    } catch (err) {
      setError(err.message || t("error"));
    } finally {
      setDeletingId(null);
    }
  };

  const handlePostNow = async (id) => {
    try {
      await updateMarketingPost(id, { status: "posted" });
      await fetchPosts();
    } catch (err) {
      setError(err.message || t("error"));
    }
  };

  const filteredPosts = posts.filter(
    (p) =>
      (!platformFilter || p.platform === platformFilter) &&
      (!statusFilter || p.status === statusFilter)
  );

  const formatDate = (iso) => {
    if (!iso) return "-";
    return new Date(iso).toLocaleString();
  };

  const getListContent = () => {
    if (loading) {
      return (
        <div className="h-64 flex items-center justify-center text-[var(--text-muted)]">
          {t("loadingPosts")}
        </div>
      );
    }
    if (filteredPosts.length === 0) {
      return (
        <div className="h-64 flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-center text-sm text-[var(--text-muted)]">
          <Plus size={24} className="mb-2 text-[var(--text-muted-light)]" />
          <p>{t("noPostsYet")}</p>
        </div>
      );
    }
    return (
      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {filteredPosts.map((post) => (
          <div
            key={post.id}
            className="flex items-start justify-between gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--surface-surface)] hover:bg-[var(--surface-hover)] cursor-pointer transition"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded ${STATUS_COLORS[post.status]}`}
                >
                  {STATUS_LABELS[post.status] || post.status}
                </span>
                {post.platform && (
                  <span className="text-xs text-[var(--text-muted)]">
                    {PLATFORM_LABELS[post.platform] || post.platform}
                  </span>
                )}
              </div>
              <h3 className="text-sm font-semibold text-[var(--foreground)] truncate">
                {post.title || t("untitledPost")}
              </h3>
              {post.caption && (
                <p className="text-xs text-[var(--text-muted)] line-clamp-2 mt-1">
                  {post.caption}
                </p>
              )}
              {post.estate_title && (
                <p className="text-xs text-[var(--green)] mt-1 truncate">
                  🏠 {post.estate_title}
                </p>
              )}
              <p className="text-xs text-[var(--text-muted)] mt-2">
                {formatDate(post.scheduled_for || post.created_at)}
              </p>
            </div>
            <div className="flex items-center gap-1 ml-2">
              {post.status !== "posted" && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePostNow(post.id);
                  }}
                  className="p-1.5 bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-100"
                  title={t("postNow")}
                >
                  <Send size={14} />
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEdit(post);
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
                  handleDelete(post.id);
                }}
                className="p-1.5 text-[var(--text-muted)] hover:text-red-600"
                title={t("delete")}
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
      eyebrow={t("marketingCalendar")}
      title={t("socialContentCalendar")}
      description={t("marketingCalendarDescription")}
      actions={
        <>
          <Link href="/estates" className="toolbar-button">
            <CalendarIcon size={16} />
            {t("viewEstates")}
          </Link>
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setForm({
                title: "",
                caption: "",
                platform: "instagram",
                status: "draft",
                scheduled_for: "",
                estate: "",
                media_url: "",
              });
              setOpenForm(true);
            }}
            className="toolbar-button toolbar-button-primary"
          >
            <Plus size={16} />
            {t("newPost")}
          </button>
          <ToolbarMenu label={t("filters")}>
            <button
              type="button"
              onClick={() => setPlatformFilter("")}
              className={`toolbar-menu-item ${!platformFilter ? "toolbar-tab-active" : ""}`}
            >
              {t("allPlatforms")}
            </button>
            {Object.entries(PLATFORM_LABELS).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setPlatformFilter(key)}
                className={`toolbar-menu-item ${platformFilter === key ? "toolbar-tab-active" : ""}`}
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
              {t("allStatuses")}
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
              <h2 className="text-lg font-semibold">{t("upcomingPosts")}</h2>
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <button
                  type="button"
                  onClick={fetchPosts}
                  className="text-xs text-[var(--text-muted)] hover:underline"
                >
                  {t("refresh")}
                </button>
              )}
            </div>
            {getListContent()}
          </div>
        </div>

        <div className="col-span-1 md:col-span-1 lg:col-span-1">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold">{t("quickStats")}</h2>
            <div className="grid gap-2">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--surface-muted)]">
                <Calendar size={16} className="text-[var(--text-muted)]" />
                <span className="text-sm font-semibold">{posts.length}</span>
                <span className="text-xs text-[var(--text-muted)]">{t("totalPosts")}</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--surface-muted)]">
                <Check size={16} className="text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-700">
                  {posts.filter((p) => p.status === "posted").length}
                </span>
                <span className="text-xs text-[var(--text-muted)]">{t("posted")}</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--surface-muted)]">
                <CalendarIcon size={16} className="text-blue-600" />
                <span className="text-sm font-semibold text-blue-700">
                  {posts.filter((p) => p.status === "scheduled").length}
                </span>
                <span className="text-xs text-[var(--text-muted)]">{t("scheduled")}</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--surface-muted)]">
                <Edit3 size={16} className="text-[var(--text-muted)]" />
                <span className="text-sm font-semibold">
                  {posts.filter((p) => p.status === "draft").length}
                </span>
                <span className="text-xs text-[var(--text-muted)]">{t("drafts")}</span>
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
                {editingId ? t("editPost") : t("newPost")}
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
                {t("title")}
              </span>
              <input
                type="text"
                name="title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder={t("postTitlePlaceholder")}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]"
              />
            </label>

            <label className="sm:col-span-2">
              <span className="block text-sm font-medium text-[var(--foreground)] mb-1">
                {t("caption")}
              </span>
              <textarea
                name="caption"
                rows={4}
                value={form.caption}
                onChange={(e) => setForm({ ...form, caption: e.target.value })}
                placeholder={t("captionPlaceholder")}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]"
              />
            </label>

            <label className="sm:col-span-2">
              <span className="block text-sm font-medium text-[var(--foreground)] mb-1">
                {t("platform")}
              </span>
              <select
                name="platform"
                value={form.platform}
                onChange={(e) => setForm({ ...form, platform: e.target.value })}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]"
              >
                {Object.entries(PLATFORM_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="sm:col-span-2">
              <span className="block text-sm font-medium text-[var(--foreground)] mb-1">
                {t("status")}
              </span>
              <select
                name="status"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]"
              >
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="sm:col-span-2">
              <span className="block text-sm font-medium text-[var(--foreground)] mb-1">
                {t("scheduledFor")}
              </span>
              <input
                type="datetime-local"
                name="scheduled_for"
                value={form.scheduled_for}
                onChange={(e) => setForm({ ...form, scheduled_for: e.target.value })}
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
                onChange={(e) => setForm({ ...form, estate: e.target.value })}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]"
              >
                <option value="">{t("noEstate")}</option>
              </select>
            </label>

            <label className="sm:col-span-2">
              <span className="block text-sm font-medium text-[var(--foreground)] mb-1">
                {t("mediaUrl")}
              </span>
              <input
                type="url"
                name="media_url"
                value={form.media_url}
                onChange={(e) => setForm({ ...form, media_url: e.target.value })}
                placeholder={t("mediaUrlPlaceholder")}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]"
              />
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
                {saving ? t("saving") : t("savePost")}
              </button>
            </div>
          </form>
        </div>
      )}
    </PageShell>
  );
}
