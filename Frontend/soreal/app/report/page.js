"use client";

import { useState } from "react";
import { submitReport } from "@/lib/api";
import { useTranslation } from "@/app/components/LanguageProvider";

export default function ReportPage() {
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    full_name: "",
    aliases: "",
    id_type: "ID_Card",
    identification: "",
    nationality: "",
    phone: "",
    email: "",
    category: "other",
    incident_date: "",
    incident_location: "",
    description: "",
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await submitReport(form);
      setSubmitted(true);
    } catch (err) {
      setError(err.message || t("error"));
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="p-6 max-w-md mx-auto">
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <h2 className="text-xl font-bold text-green-800">
            {t("reportSubmitted")}
          </h2>
          <p className="mt-2 text-green-700">
            {t("reportSubtitle2")}
          </p>
          <p className="mt-1 text-sm text-green-600">
            {t("submissionIdProvided")}
          </p>
        </div>
        <button
          onClick={() => {
            setSubmitted(false);
            setForm({
              full_name: "",
              aliases: "",
              id_type: "ID_Card",
              identification: "",
              nationality: "",
              phone: "",
              email: "",
              category: "other",
              incident_date: "",
              incident_location: "",
              description: "",
            });
          }}
          className="mt-6 text-blue-600 hover:underline"
        >
          {t("submitAnother")}
        </button>
      </div>
    );
  }

  const idTypeLabel = t(form.id_type, {}, {});
  const categoryLabel = t(form.category, {}, {});

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{t("submitReportTitle")}</h1>
      <p className="mb-6 text-gray-600">
        {t("reportSubtitle")}
      </p>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 bg-gray-50 p-6 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              {t("fullName")} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="full_name"
              value={form.full_name}
              onChange={handleChange}
              required
              className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              {t("aliases")}
            </label>
            <input
              type="text"
              name="aliases"
              value={form.aliases}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder={t("knownAliases")}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t("idType")}</label>
            <select
              name="id_type"
              value={form.id_type}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="ID_Card">{idTypeLabel}</option>
              <option value="Passport">Passport</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              {t("idNumber")} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="identification"
              value={form.identification}
              onChange={handleChange}
              required
              className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder={t("idNumberPlaceholder")}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              {t("nationality")}
            </label>
            <input
              type="text"
              name="nationality"
              value={form.nationality}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              {t("phone")}
            </label>
            <input
              type="tel"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              {t("email")}
            </label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              {t("categoryLabel")}
            </label>
            <select
              name="category"
              value={form.category}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="fraud">{categoryLabel}</option>
              <option value="unpaid_rent">Unpaid Rent</option>
              <option value="property_damage">Property Damage</option>
              <option value="scam">Scam</option>
              <option value="assault">Assault</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            {t("incidentDateLabel")}
          </label>
          <input
            type="date"
            name="incident_date"
            value={form.incident_date}
            onChange={handleChange}
            className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            {t("incidentLocationLabel")}
          </label>
          <input
            type="text"
            name="incident_location"
            value={form.incident_location}
            onChange={handleChange}
            className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder={t("whereDidItHappen")}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            {t("description")} <span className="text-red-500">*</span>
          </label>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            required
            rows={4}
            className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder={t("describeIncident")}
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 font-medium"
        >
          {submitting ? t("submitting") : t("submitReportBtn")}
        </button>
      </form>
    </div>
  );
}
