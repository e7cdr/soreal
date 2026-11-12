"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  fetchProject,
  fetchProjectUnits,
  bulkCreateProjectUnits,
} from "@/lib/api";
import { useTranslation } from "@/app/components/LanguageProvider";
import PageShell from "@/app/components/PageShell";
import StatStrip from "@/app/components/StatStrip";
import { X } from "lucide-react";

const STATUS_COLORS = {
  available: "bg-green-100 text-green-700 border-green-200",
  reserved: "bg-yellow-100 text-yellow-700 border-yellow-200",
  sold: "bg-red-100 text-red-700 border-red-200",
  rented: "bg-purple-100 text-purple-700 border-purple-200",
  unavailable: "bg-gray-100 text-gray-700 border-gray-200",
};

export default function ProjectUnitsPage({ params }) {
  const { translate: t } = useTranslation();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const [project, setProject] = useState(null);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  const [bulkForm, setBulkForm] = useState({
    unit_type: "2BR",
    bedrooms: 2,
    bathrooms: 2,
    area_sqm: 80,
    price: 150000,
    currency: "DOP",
    status: "available",
    floor: 1,
    orientation: "",
    count: 5,
    start_number: 101,
  });

  useEffect(() => {
    loadProject();
    loadUnits();
  }, [slug]);

  async function loadProject() {
    try {
      const data = await fetchProject(slug);
      setProject(data);
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadUnits() {
    try {
      const data = await fetchProjectUnits({ project: slug });
      setUnits(data.results || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleBulkChange = (e) => {
    const { name, value, type, checked } = e.target;
    setBulkForm({
      ...bulkForm,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    setBulkSubmitting(true);
    try {
      const unitsData = [];
      const startNum = parseInt(bulkForm.start_number) || 1;
      const count = parseInt(bulkForm.count) || 1;

      for (let i = 0; i < count; i++) {
        unitsData.push({
          unit_number: String(startNum + i).padStart(3, "0"),
          unit_type: bulkForm.unit_type,
          bedrooms: parseInt(bulkForm.bedrooms) || 0,
          bathrooms: parseInt(bulkForm.bathrooms) || 0,
          area_sqm: parseInt(bulkForm.area_sqm) || 0,
          price: parseFloat(bulkForm.price) || 0,
          currency: bulkForm.currency,
          status: bulkForm.status,
          floor: parseInt(bulkForm.floor) || 1,
          orientation: bulkForm.orientation,
        });
      }

      await bulkCreateProjectUnits({
        project: slug,
        units: unitsData,
      });
      setShowBulkForm(false);
      await loadUnits();
    } catch (err) {
      setError(err.message || "Failed to create units.");
    } finally {
      setBulkSubmitting(false);
    }
  };

  if (loading) {
    return (
      <PageShell title={t("unitStatus")}>
        <div className="compact-card text-sm text-[var(--text-muted)]">{t("loading")}</div>
      </PageShell>
    );
  }

  if (!project) {
    return (
      <PageShell title={t("unitStatus")}>
        <div className="compact-card border-red-200 bg-red-50 text-sm text-red-700">
          {error || t("projectNotFound")}
        </div>
        <Link href="/projects" className="toolbar-button mt-3">
          ← {t("backToProjects")}
        </Link>
      </PageShell>
    );
  }

  const statusCounts = units.reduce(
    (acc, u) => {
      acc[u.status] = (acc[u.status] || 0) + 1;
      return acc;
    },
    {}
  );

  // Group units by floor for seat-map display
  const unitsByFloor = units.reduce(
    (acc, u) => {
      const floor = u.floor || 1;
      if (!acc[floor]) acc[floor] = [];
      acc[floor].push(u);
      return acc;
    },
    {}
  );
  const floors = Object.keys(unitsByFloor)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <PageShell
      eyebrow={t("projects")}
      title={project.name}
      description={[project.city, project.province, project.description].filter(Boolean).join(" · ")}
      actions={(
        <>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setShowBulkForm(true);
            }}
            className="toolbar-button toolbar-button-primary"
          >
            {t("bulkCreateUnits")}
          </button>
          <Link href="/projects" className="toolbar-button">
            ← {t("backToProjects")}
          </Link>
        </>
      )}
    >
      {error && !showBulkForm && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      <StatStrip
        items={[
          { label: t("totalUnits"), value: units.length },
          { label: t("availableUnits"), value: statusCounts.available || 0 },
          { label: t("soldUnits"), value: statusCounts.sold || 0 },
          { label: t("reserved"), value: statusCounts.reserved || 0 },
        ]}
      />

      <div className="compact-card mt-3">
        <h2 className="mb-3 text-sm font-semibold">{t("unitStatus")}</h2>
        {floors.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--text-muted)]">{t("noUnits")}</p>
        ) : (
          floors.map((floor) => (
            <div key={floor} className="mb-4 last:mb-0">
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
                {t("floor")} {floor}
              </h4>
              <div className="flex flex-wrap gap-2">
                {unitsByFloor[floor].map((unit) => (
                  <div
                    key={unit.id}
                    className={`flex h-14 w-14 cursor-pointer flex-col items-center justify-center rounded border text-xs font-bold ${STATUS_COLORS[unit.status] || "bg-gray-100 text-gray-700"}`}
                    title={`${unit.unit_number} - ${t(unit.status) || unit.status}`}
                  >
                    <span>{unit.unit_number}</span>
                    <span className="mt-0.5 text-[10px] opacity-75">
                      {unit.bedrooms}BR
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {showBulkForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <form onSubmit={handleBulkSubmit} className="my-4 grid w-full max-w-3xl gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl md:grid-cols-3">
            <div className="flex items-center justify-between gap-3 md:col-span-3">
              <h2 className="text-lg font-bold">{t("bulkCreateUnits")}</h2>
              <button
                type="button"
                onClick={() => {
                  setShowBulkForm(false);
                  setError(null);
                }}
                className="toolbar-button"
              >
                <X size={16} />
                {t("close")}
              </button>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-700 md:col-span-3">
                {error}
              </div>
            )}

            <label className="filter-field">
              <span>{t("unitType")}</span>
              <select name="unit_type" value={bulkForm.unit_type} onChange={handleBulkChange}>
                <option value="Studio">Studio</option>
                <option value="1BR">1BR</option>
                <option value="2BR">2BR</option>
                <option value="3BR">3BR</option>
                <option value="Penthouse">Penthouse</option>
              </select>
            </label>
            <label className="filter-field">
              <span>{t("bedrooms")}</span>
              <input type="number" name="bedrooms" value={bulkForm.bedrooms} onChange={handleBulkChange} />
            </label>
            <label className="filter-field">
              <span>{t("bathrooms")}</span>
              <input type="number" name="bathrooms" value={bulkForm.bathrooms} onChange={handleBulkChange} />
            </label>
            <label className="filter-field">
              <span>{t("areaSqm")}</span>
              <input type="number" name="area_sqm" value={bulkForm.area_sqm} onChange={handleBulkChange} />
            </label>
            <label className="filter-field">
              <span>{t("price")}</span>
              <input type="number" name="price" value={bulkForm.price} onChange={handleBulkChange} />
            </label>
            <label className="filter-field">
              <span>{t("currency")}</span>
              <select name="currency" value={bulkForm.currency} onChange={handleBulkChange}>
                <option value="DOP">DOP</option>
                <option value="USD">USD</option>
              </select>
            </label>
            <label className="filter-field">
              <span>{t("status")}</span>
              <select name="status" value={bulkForm.status} onChange={handleBulkChange}>
                <option value="available">{t("available")}</option>
                <option value="reserved">{t("reserved")}</option>
                <option value="sold">{t("sold")}</option>
              </select>
            </label>
            <label className="filter-field">
              <span>{t("floor")}</span>
              <input type="number" name="floor" value={bulkForm.floor} onChange={handleBulkChange} />
            </label>
            <label className="filter-field">
              <span>{t("orientation")}</span>
              <input type="text" name="orientation" value={bulkForm.orientation} onChange={handleBulkChange} placeholder={t("orientationExample")} />
            </label>
            <label className="filter-field">
              <span>{t("numberOfUnits")}</span>
              <input type="number" name="count" value={bulkForm.count} onChange={handleBulkChange} />
            </label>
            <label className="filter-field">
              <span>{t("startUnitNumber")}</span>
              <input type="number" name="start_number" value={bulkForm.start_number} onChange={handleBulkChange} />
            </label>
            <div className="flex items-end md:col-span-1">
              <button
                type="submit"
                disabled={bulkSubmitting}
                className="toolbar-button toolbar-button-primary w-full disabled:opacity-50"
              >
                {bulkSubmitting ? t("saving") : t("bulkCreateUnits")}
              </button>
            </div>
          </form>
        </div>
      )}
    </PageShell>
  );
}
