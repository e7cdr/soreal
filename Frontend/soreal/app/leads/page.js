"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  fetchLeads,
  createLead,
} from "@/lib/api";
import { useTranslation } from "@/app/components/LanguageProvider";

export default function LeadsPage() {
  const { t } = useTranslation();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    whatsapp_group: "",
    source: "whatsapp",
    listing_type: "any",
    property_type: "",
    min_bedrooms: "",
    max_bedrooms: "",
    min_price: "",
    max_price: "",
    city: "",
    province: "",
    notes: "",
  });

  useEffect(() => {
    loadLeads();
  }, []);

  async function loadLeads() {
    setLoading(true);
    try {
      const data = await fetchLeads();
      setLeads(data.results || []);
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
      const leadData = {
        ...form,
        min_bedrooms: form.min_bedrooms ? parseInt(form.min_bedrooms) : undefined,
        max_bedrooms: form.max_bedrooms ? parseInt(form.max_bedrooms) : undefined,
        min_price: form.min_price ? parseFloat(form.min_price) : undefined,
        max_price: form.max_price ? parseFloat(form.max_price) : undefined,
      };
      await createLead(leadData);
      setShowForm(false);
      setForm({
        name: "",
        phone: "",
        whatsapp_group: "",
        source: "whatsapp",
        listing_type: "any",
        property_type: "",
        min_bedrooms: "",
        max_bedrooms: "",
        min_price: "",
        max_price: "",
        city: "",
        province: "",
        notes: "",
      });
      await loadLeads();
    } catch (err) {
      setError(err.message || "Failed to create lead.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-6">{t("loading")}</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  const statusBadge = (status) => {
    const colors = {
      new: "bg-blue-100 text-blue-800",
      contacted: "bg-yellow-100 text-yellow-800",
      matched: "bg-green-100 text-green-800",
      closed: "bg-gray-100 text-gray-800",
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status]}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{t("leads", {}, {})}</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
        >
          {showForm ? t("hideForm", {}, {}) : t("addLead", {}, {})}
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-50 p-6 rounded-lg mb-6">
          <h2 className="text-lg font-bold mb-4">{t("addLead")}</h2>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">{t("fullName")}</label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("phone")}</label>
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                required
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">WhatsApp Group</label>
              <input
                type="text"
                name="whatsapp_group"
                value={form.whatsapp_group}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Group name where this was posted"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Source</label>
              <select
                name="source"
                value={form.source}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="manual">Manual Entry</option>
                <option value="referral">Referral</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Listing Type</label>
              <select
                name="listing_type"
                value={form.listing_type}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="any">Any</option>
                <option value="sale">For Sale</option>
                <option value="rent">For Rent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Property Type</label>
              <select
                name="property_type"
                value={form.property_type}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Any</option>
                <option value="house">House</option>
                <option value="apartment">Apartment</option>
                <option value="land">Land</option>
                <option value="commercial">Commercial</option>
                <option value="villa">Villa</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Min Bedrooms</label>
              <input
                type="number"
                name="min_bedrooms"
                value={form.min_bedrooms}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Max Bedrooms</label>
              <input
                type="number"
                name="max_bedrooms"
                value={form.max_bedrooms}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">City</label>
              <input
                type="text"
                name="city"
                value={form.city}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Province</label>
              <input
                type="text"
                name="province"
                value={form.province}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Min Price</label>
              <input
                type="number"
                name="min_price"
                value={form.min_price}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Max Price</label>
              <input
                type="number"
                name="max_price"
                value={form.max_price}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows={2}
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 font-medium"
              >
                {submitting ? t("saving") : t("createLeadBtn", {}, {})}
              </button>
            </div>
          </form>
        </div>
      )}

      {leads.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No leads yet. Add your first lead from a WhatsApp group.
        </div>
      )}

      {leads.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b text-left">
                <th className="p-3">{t("name")}</th>
                <th className="p-3">{t("phone")}</th>
                <th className="p-3">Group</th>
                <th className="p-3">Looking For</th>
                <th className="p-3">{t("status")}</th>
                <th className="p-3">{t("submitted")}</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-b">
                  <td className="p-3">{lead.name}</td>
                  <td className="p-3">{lead.phone}</td>
                  <td className="p-3 text-sm">{lead.whatsapp_group || "—"}</td>
                  <td className="p-3 text-sm">
                    {lead.listing_type} · {lead.property_type || "any"} · {lead.city || "—"}
                  </td>
                  <td className="p-3">{statusBadge(lead.status)}</td>
                  <td className="p-3 text-xs text-gray-500">
                    {new Date(lead.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
