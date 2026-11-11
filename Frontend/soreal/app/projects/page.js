"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  fetchProjects,
  createProject,
  fetchProjectUnits,
} from "@/lib/api";
import { useTranslation } from "@/app/components/LanguageProvider";

export default function ProjectsPage() {
  const { t } = useTranslation();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
  }, []);

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
      await createProject(form);
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

  if (loading) return <div className="p-6">{t("loading")}</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{t("projects")}</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm"
        >
          {showForm ? t("hideForm", {}, {}) : t("createProject", {}, {})}
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-50 p-6 rounded-lg mb-6">
          <h2 className="text-lg font-bold mb-4">{t("createProject", {}, {})}</h2>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                {t("projectName")}
              </label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Slug</label>
              <input
                type="text"
                name="slug"
                value={form.slug}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">
                {t("projectDescription")}
              </label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={2}
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("developer")}</label>
              <input
                type="text"
                name="developer"
                value={form.developer}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Address</label>
              <input
                type="text"
                name="address"
                value={form.address}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">City</label>
              <input
                type="text"
                name="city"
                value={form.city}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Province</label>
              <input
                type="text"
                name="province"
                value={form.province}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="planning">{t("planning")}</option>
                <option value="under_construction">{t("underConstruction")}</option>
                <option value="ready">{t("readyForDelivery")}</option>
                <option value="sold_out">{t("soldOut")}</option>
                <option value="cancelled">{t("cancelled", {}, {})}</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:bg-indigo-300 font-medium"
              >
                {submitting ? t("saving") : t("createProject", {}, {})}
              </button>
            </div>
          </form>
        </div>
      )}

      {projects.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No projects yet. Create your first project to start adding units.
        </div>
      )}

      {projects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div
              key={project.id}
              className="border rounded-lg p-4 hover:shadow-md transition"
            >
              <Link
                href={`/projects/${project.slug}/units`}
                className="block"
              >
                <h3 className="font-bold text-lg">{project.name}</h3>
                <p className="text-sm text-gray-600 mb-2">
                  {project.developer || "No developer specified"}
                </p>
                <p className="text-xs text-gray-500 mb-2">
                  {project.city}, {project.province}
                </p>
                <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${statusColor(project.status)}`}>
                  {project.status}
                </span>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="bg-gray-50 p-2 rounded text-center">
                    <div className="text-xs text-gray-500">Units</div>
                    <div className="text-sm font-bold">
                      {project.unit_count || 0}
                    </div>
                  </div>
                  <div className="bg-green-50 p-2 rounded text-center">
                    <div className="text-xs text-green-600">Available</div>
                    <div className="text-sm font-bold">
                      {project.available_count || 0}
                    </div>
                  </div>
                  <div className="bg-red-50 p-2 rounded text-center">
                    <div className="text-xs text-red-600">Sold</div>
                    <div className="text-sm font-bold">
                      {project.sold_count || 0}
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
