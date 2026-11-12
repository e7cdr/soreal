"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  fetchProjects,
  createProject,
  fetchBrokers,
  fetchOwners,
  fetchProject,
  updateProject,
} from "@/lib/api";
import { useTranslation } from "@/app/components/LanguageProvider";
import PageShell from "@/app/components/PageShell";
import { X } from "lucide-react";
import { DOMINICAN_CITIES, DOMINICAN_PROVINCES } from "@/lib/locations";

export default function ProjectsPage() {
  const { translate: t } = useTranslation();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [brokers, setBrokers] = useState([]);
  const [owners, setOwners] = useState([]);
  const [editingSlug, setEditingSlug] = useState("");

  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    developer: "",
    address: "",
    city: "",
    province: "",
    status: "planning",
  });

  useEffect(() => {
    loadProjects();
    fetchBrokers().then((data) => setBrokers(data.results || [])).catch((loadError) => setError(loadError.message));
    fetchOwners().then((data) => setOwners(data.results || [])).catch((loadError) => setError(loadError.message));
  }, []);

  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("record");
    if (!slug) return;
    fetchProject(slug)
      .then((project) => {
        setEditingSlug(project.slug);
        setForm({
          name: project.name || "",
          slug: project.slug || "",
          description: project.description || "",
          developer: project.developer || "",
          address: project.address || "",
          city: project.city || "",
          province: project.province || "",
          status: project.status || "planning",
          broker: project.broker || "",
          owner: project.owner || "",
        });
        setShowForm(true);
      })
      .catch((loadError) => setError(loadError.message || t("error")));
  }, [t]);

  async function loadProjects() {
    setLoading(true);
    try {
      const data = await fetchProjects();
      setProjects(data.results || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        broker: form.broker ? Number(form.broker) : null,
        owner: form.owner ? Number(form.owner) : null,
      };
      if (editingSlug) await updateProject(editingSlug, payload);
      else await createProject(payload);
      setEditingSlug("");
      setShowForm(false);
      setForm({
        name: "",
        slug: "",
        description: "",
        developer: "",
        address: "",
        city: "",
        province: "",
        status: "planning",
      });
      await loadProjects();
    } catch (err) {
      setError(err.message || "Failed to create project.");
    } finally {
      setSubmitting(false);
    }
  };

  function editProject(project) {
    setEditingSlug(project.slug);
    setForm({
      name: project.name || "",
      slug: project.slug || "",
      description: project.description || "",
      developer: project.developer || "",
      address: project.address || "",
      city: project.city || "",
      province: project.province || "",
      status: project.status || "planning",
      broker: project.broker || "",
      owner: project.owner || "",
    });
    setShowForm(true);
  }

  const statusColor = (status) => {
    const colors = {
      planning: "bg-yellow-100 text-yellow-800",
      under_construction: "bg-blue-100 text-blue-800",
      ready: "bg-green-100 text-green-800",
      sold_out: "bg-red-100 text-red-800",
      cancelled: "bg-gray-100 text-gray-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  if (loading) {
    return (
      <PageShell title={t("projects")}>
        <div className="compact-card text-sm text-[var(--text-muted)]">{t("loading")}</div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={t("projects")}
      actions={(
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="toolbar-button toolbar-button-primary"
        >
          {showForm ? t("hideForm") : t("createProject")}
        </button>
      )}
    >
      {error && !showForm && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      {projects.length === 0 && (
        <div className="compact-card py-10 text-center text-sm text-[var(--text-muted)]">
          {t("noProjects")}
        </div>
      )}

      {projects.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <div key={project.id} className="compact-card transition hover:shadow-md">
              <button type="button" onClick={() => editProject(project)} className="mb-2 text-sm font-semibold text-[var(--green)] hover:underline">
                {t("editProject")}
              </button>
              <Link href={`/projects/${project.slug}/units`} className="block">
                <h3 className="text-lg font-bold">{project.name}</h3>
                <p className="mb-2 text-sm text-gray-600">
                  {project.developer || "—"}
                </p>
                <p className="mb-2 text-xs text-gray-500">
                  {project.city}, {project.province}
                </p>
                <span className={`inline-block rounded px-2 py-1 text-xs font-bold ${statusColor(project.status)}`}>
                  {project.status}
                </span>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded bg-gray-50 p-2 text-center">
                    <div className="text-xs text-gray-500">Units</div>
                    <div className="text-sm font-bold">{project.unit_count || 0}</div>
                  </div>
                  <div className="rounded bg-green-50 p-2 text-center">
                    <div className="text-xs text-green-600">Available</div>
                    <div className="text-sm font-bold">{project.available_count || 0}</div>
                  </div>
                  <div className="rounded bg-red-50 p-2 text-center">
                    <div className="text-xs text-red-600">Sold</div>
                    <div className="text-sm font-bold">{project.sold_count || 0}</div>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <div className="my-4 w-full max-w-3xl rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">
                {editingSlug ? t("editProject") : t("createProject")}
              </h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="toolbar-button"
                aria-label={t("close")}
              >
                <X size={16} />
                {t("close")}
              </button>
            </div>

            {error && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="filter-field">
                <span>{t("projectName")}</span>
                <input type="text" name="name" value={form.name} onChange={handleChange} required />
              </label>
              <label className="filter-field">
                <span>{t("brokerName")}</span>
                <select name="broker" value={form.broker || ""} onChange={handleChange}>
                  <option value="">{t("noBrokerLinked")}</option>
                  {brokers.map((broker) => <option key={broker.id} value={broker.id}>{broker.name}</option>)}
                </select>
              </label>
              <label className="filter-field">
                <span>{t("owner")}</span>
                <select name="owner" value={form.owner || ""} onChange={handleChange}>
                  <option value="">{t("noOwnerLinked")}</option>
                  {owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}
                </select>
              </label>
              <label className="filter-field">
                <span>Slug</span>
                <input type="text" name="slug" value={form.slug} onChange={handleChange} />
              </label>
              <label className="filter-field md:col-span-2">
                <span>{t("projectDescription")}</span>
                <textarea name="description" value={form.description} onChange={handleChange} rows={2} />
              </label>
              <label className="filter-field">
                <span>{t("developer")}</span>
                <input type="text" name="developer" value={form.developer} onChange={handleChange} />
              </label>
              <label className="filter-field">
                <span>Address</span>
                <input type="text" name="address" value={form.address} onChange={handleChange} />
              </label>
              <label className="filter-field">
                <span>City</span>
                <select name="city" value={form.city} onChange={handleChange}>
                  <option value="">—</option>
                  {form.city && !DOMINICAN_CITIES.includes(form.city) && <option value={form.city}>{form.city}</option>}
                  {DOMINICAN_CITIES.map((city) => <option key={city} value={city}>{city}</option>)}
                </select>
              </label>
              <label className="filter-field">
                <span>Province</span>
                <select name="province" value={form.province} onChange={handleChange}>
                  <option value="">—</option>
                  {form.province && !DOMINICAN_PROVINCES.includes(form.province) && <option value={form.province}>{form.province}</option>}
                  {DOMINICAN_PROVINCES.map((province) => <option key={province} value={province}>{province}</option>)}
                </select>
              </label>
              <label className="filter-field">
                <span>Status</span>
                <select name="status" value={form.status} onChange={handleChange}>
                  <option value="planning">{t("planning")}</option>
                  <option value="under_construction">{t("underConstruction")}</option>
                  <option value="ready">{t("readyForDelivery")}</option>
                  <option value="sold_out">{t("soldOut")}</option>
                  <option value="cancelled">{t("cancelled")}</option>
                </select>
              </label>
              <div className="flex justify-end gap-2 md:col-span-2">
                <button type="submit" disabled={submitting} className="toolbar-button toolbar-button-primary disabled:opacity-50">
                  {submitting ? t("saving") : editingSlug ? t("saveChanges") : t("createProject")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageShell>
  );
}
