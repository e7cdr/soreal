"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  fetchProject,
  fetchProjectUnits,
  bulkCreateProjectUnits,
} from "@/lib/api";
import { useTranslation } from "@/app/components/LanguageProvider";

const STATUS_COLORS = {
  available: "bg-green-100 text-green-700 border-green-200",
  reserved: "bg-yellow-100 text-yellow-700 border-yellow-200",
  sold: "bg-red-100 text-red-700 border-red-200",
  rented: "bg-purple-100 text-purple-700 border-purple-200",
  unavailable: "bg-gray-100 text-gray-700 border-gray-200",
};

export default function ProjectUnitsPage({ params }) {
  const { t } = useTranslation();
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

  if (loading) return <div className="p-6">{t("loading")}</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!project) return <div className="p-6">Project not found.</div>;

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
    <div className="p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <p className="text-gray-600">{project.description || ""}</p>
          <p className="text-sm text-gray-500">
            {project.city}, {project.province}
          </p>
        </div>
        <Link
          href="/projects"
          className="text-indigo-600 hover:underline text-sm"
        >
          ← {t("backToProjects", {}, {})}
        </Link>
      </div>

      {/* Project Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border rounded-lg p-4 text-center">
          <div className="text-xs text-gray-500">{t("totalUnits")}</div>
          <div className="text-xl font-bold">{units.length}</div>
        </div>
        <div className="bg-white border rounded-lg p-4 text-center">
          <div className="text-xs text-green-600">{t("availableUnits")}</div>
          <div className="text-xl font-bold text-green-700">
            {statusCounts.available || 0}
          </div>
        </div>
        <div className="bg-white border rounded-lg p-4 text-center">
          <div className="text-xs text-red-600">{t("soldUnits")}</div>
          <div className="text-xl font-bold text-red-700">
            {statusCounts.sold || 0}
          </div>
        </div>
        <div className="bg-white border rounded-lg p-4 text-center">
          <div className="text-xs text-blue-600">{t("reserved", {}, {})}</div>
          <div className="text-xl font-bold text-blue-700">
            {statusCounts.reserved || 0}
          </div>
        </div>
      </div>

      {/* Seat Map */}
      <div className="bg-white border rounded-lg p-6 shadow-sm mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">{t("unitStatus", {}, {})}</h3>
          <button
            onClick={() => setShowBulkForm(!showBulkForm)}
            className="px-3 py-1 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700"
          >
            {t("bulkCreateUnits")}
          </button>
        </div>

        {floors.map((floor) => (
          <div key={floor} className="mb-6">
            <h4 className="text-sm font-bold text-gray-600 mb-3">
              Floor {floor}
            </h4>
            <div className="flex flex-wrap justify-center gap-2">
              {unitsByFloor[floor].map((unit) => (
                <div
                  key={unit.id}
                  className={`w-16 h-16 rounded flex flex-col items-center justify-center text-xs font-bold cursor-pointer border ${STATUS_COLORS[unit.status] || "bg-gray-100 text-gray-700"}`}
                  title={`${unit.unit_number} - ${t(unit.status, {}, {}) || unit.status}`}
                >
                  <span>{unit.unit_number}</span>
                  <span className="mt-0.5 text-[10px] opacity-75">
                    {unit.bedrooms}BR
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Bulk Create Form */}
      {showBulkForm && (
        <div className="bg-gray-50 p-6 rounded-lg">
          <h3 className="text-lg font-bold mb-4">{t("bulkCreateUnits")}</h3>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleBulkSubmit} className="space-y-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                {t("unitType")}
              </label>
              <select
                name="unit_type"
                value={bulkForm.unit_type}
                onChange={handleBulkChange}
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="Studio">Studio</option>
                <option value="1BR">1BR</option>
                <option value="2BR">2BR</option>
                <option value="3BR">3BR</option>
                <option value="Penthouse">Penthouse</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                {t("bedrooms")}
              </label>
              <input
                type="number"
                name="bedrooms"
                value={bulkForm.bedrooms}
                onChange={handleBulkChange}
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                {t("bathrooms")}
              </label>
              <input
                type="number"
                name="bathrooms"
                value={bulkForm.bathrooms}
                onChange={handleBulkChange}
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                {t("areaSqm")}
              </label>
              <input
                type="number"
                name="area_sqm"
                value={bulkForm.area_sqm}
                onChange={handleBulkChange}
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("price")}</label>
              <input
                type="number"
                name="price"
                value={bulkForm.price}
                onChange={handleBulkChange}
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Currency</label>
              <select
                name="currency"
                value={bulkForm.currency}
                onChange={handleBulkChange}
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="DOP">DOP</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("status")}</label>
              <select
                name="status"
                value={bulkForm.status}
                onChange={handleBulkChange}
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="available">{t("available")}</option>
                <option value="reserved">{t("reserved", {}, {})}</option>
                <option value="sold">{t("sold")}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("floor")}</label>
              <input
                type="number"
                name="floor"
                value={bulkForm.floor}
                onChange={handleBulkChange}
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("orientation")}</label>
              <input
                type="text"
                name="orientation"
                value={bulkForm.orientation}
                onChange={handleBulkChange}
                placeholder="North, South, etc."
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Number of Units
              </label>
              <input
                type="number"
                name="count"
                value={bulkForm.count}
                onChange={handleBulkChange}
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Start Unit Number
              </label>
              <input
                type="number"
                name="start_number"
                value={bulkForm.start_number}
                onChange={handleBulkChange}
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div className="md:col-span-3">
              <button
                type="submit"
                disabled={bulkSubmitting}
                className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 disabled:bg-indigo-300 font-medium"
              >
                {bulkSubmitting ? t("saving") : t("bulkCreateUnits")}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
