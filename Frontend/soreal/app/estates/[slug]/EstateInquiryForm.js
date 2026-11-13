"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { submitInquiry } from "@/lib/api";

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  id_type: "ID_Card",
  identification: "",
  message: "",
};

export default function EstateInquiryForm({ estateId, title, t }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  function handleChange(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await submitInquiry(estateId, form);
      setSubmitted(true);
    } catch (submitError) {
      setError(submitError.message || t("error"));
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="estate-inquiry-card estate-inquiry-success">
        <CheckCircle2 size={18} aria-hidden="true" />
        <div>
          <strong>{t("inquirySent")}</strong>
          <p>{t("inquirySubtitle", { title })}</p>
        </div>
      </div>
    );
  }

  return (
    <form className="estate-inquiry-card" onSubmit={handleSubmit}>
      <h2 className="estate-section-title">{t("sendInquiry")}</h2>

      {error && (
        <p role="alert" className="estate-form-error">
          {error}
        </p>
      )}

      <div className="estate-form-grid">
        <label className="estate-field estate-field-full">
          <span>
            {t("fullName")} <span className="estate-required">*</span>
          </span>
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            required
          />
        </label>

        <label className="estate-field estate-field-full">
          <span>
            {t("email")} <span className="estate-required">*</span>
          </span>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            required
          />
        </label>

        <label className="estate-field">
          <span>{t("phone")}</span>
          <input type="tel" name="phone" value={form.phone} onChange={handleChange} />
        </label>

        <label className="estate-field">
          <span>{t("idType")}</span>
          <select name="id_type" value={form.id_type} onChange={handleChange}>
            <option value="ID_Card">{t("idCard")}</option>
            <option value="Passport">Passport</option>
          </select>
        </label>

        <label className="estate-field estate-field-full">
          <span>{t("idNumber")}</span>
          <input
            type="text"
            name="identification"
            value={form.identification}
            onChange={handleChange}
            placeholder={t("idNumberPlaceholder")}
          />
        </label>

        <label className="estate-field estate-field-full">
          <span>{t("message")}</span>
          <textarea
            name="message"
            value={form.message}
            onChange={handleChange}
            rows={3}
            placeholder={t("anyQuestions")}
          />
        </label>
      </div>

      <button type="submit" className="estate-submit-button" disabled={submitting}>
        {submitting ? t("sending") : t("send")}
      </button>
    </form>
  );
}
