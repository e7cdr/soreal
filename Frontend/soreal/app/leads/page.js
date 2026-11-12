"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  fetchLeads,
  createLead,
} from "@/lib/api";
import { useTranslation } from "@/app/components/LanguageProvider";
import PageShell from "@/app/components/PageShell";

export default function LeadsPage() {
  const { translate: t } = useTranslation();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(true);
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

  if (loading) {
    return (
      <PageShell title={t("addLead")}>
        <div className="compact-card text-sm text-[var(--text-muted)]">{t("loading")}</div>
      </PageShell>
    );
  }

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
    <PageShell
      title={t("addLead")}
      description={t("addLeadDescription")}
      actions={(
        <>
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="toolbar-button toolbar-button-primary"
          >
            {showForm ? t("hideForm") : t("addLead")}
          </button>
          <Link href="/requests" className="toolbar-button">
            ← {t("backToRequests")}
          </Link>
        </>
      )}
    >
      {error && !showForm && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      {showForm && (
        <div className="compact-card mb-3">
          {error && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-700">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
                {submitting ? t("saving") : t("createLeadBtn")}
              </button>
            </div>
          </form>
        </div>
      )}

      {leads.length === 0 && (
        <div className="compact-card py-10 text-center text-sm text-[var(--text-muted)]">
          {t("noLeads")}
        </div>
      )}

      {leads.length > 0 && (
        <div className="table-scroll">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead className="bg-[var(--surface-muted)] text-xs uppercase text-[var(--text-muted)]">
              <tr>
                <th className="px-3 py-2">{t("name")}</th>
                <th className="px-3 py-2">{t("phone")}</th>
                <th className="px-3 py-2">Group</th>
                <th className="px-3 py-2">Looking For</th>
                <th className="px-3 py-2">{t("status")}</th>
                <th className="px-3 py-2">{t("media")}</th>
                <th className="px-3 py-2">{t("submitted")}</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2">
                    <Link
                      href={`/requests/${lead.id}`}
                      className="font-medium text-[var(--green)] hover:underline"
                    >
                      {lead.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{lead.phone}</td>
                  <td className="px-3 py-2 text-xs">{lead.whatsapp_group || "—"}</td>
                  <td className="px-3 py-2 text-xs">
                    {lead.listing_type} · {lead.property_type || "any"}
                    {lead.min_bedrooms != null && ` · ${lead.min_bedrooms} bd`}
                    {lead.min_bathrooms != null && ` · ${lead.min_bathrooms} ba`}
                    {(lead.min_price != null || lead.max_price != null) &&
                      ` · ${
                        lead.min_price === lead.max_price
                          ? lead.min_price
                          : `${lead.min_price ?? "0"}-${lead.max_price ?? "∞"}`
                      } ${lead.budget_currency || ""}`}
                    {(lead.preferred_location || lead.city) &&
                      ` · ${lead.preferred_location || lead.city}`}
                    {lead.furnishing && ` · ${lead.furnishing}`}
                    {lead.notes && (
                      <details className="mt-1 max-w-md">
                        <summary className="cursor-pointer text-[var(--green)]">
                          Original request
                        </summary>
                        <p className="mt-1 whitespace-pre-wrap text-xs text-[var(--text-muted)]">
                          {lead.notes.replace(/^WhatsApp request:\s*/, "")}
                        </p>
                      </details>
                    )}
                  </td>
                  <td className="px-3 py-2">{statusBadge(lead.status)}</td>
                  <td className="px-3 py-2">
                    {lead.attachments?.map((attachment) => (
                      <a
                        key={attachment.url}
                        href={attachment.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mr-2 text-[var(--green)] hover:underline"
                      >
                        {attachment.name}
                      </a>
                    ))}
                    {!lead.attachments?.length && "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-[var(--text-muted)]">
                    {new Date(lead.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}
