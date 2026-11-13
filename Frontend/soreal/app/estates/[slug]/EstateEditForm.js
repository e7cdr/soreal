"use client";

import {
  STORYTELLING_TEMPLATES,
  STORY_ANGLES,
} from "@/lib/storytelling-templates";
import { DOMINICAN_CITIES, DOMINICAN_PROVINCES } from "@/lib/locations";

function fieldOptions(field, type, brokers, owners, t) {
  switch (type) {
    case "propertyType":
      return ["apartment", "house", "villa", "land", "commercial"].map((value) => ({
        value,
        label: t(value),
      }));
    case "listingType":
      return ["sale", "rent"].map((value) => ({
        value,
        label: t(`listing_${value}`),
      }));
    case "status":
      return ["draft", "available", "reserved", "sold", "rented", "inactive"].map(
        (value) => ({ value, label: t(value) }),
      );
    case "province":
      return DOMINICAN_PROVINCES.map((value) => ({ value, label: value }));
    case "city":
      return DOMINICAN_CITIES.map((value) => ({ value, label: value }));
    case "broker":
      return brokers.map((item) => ({ value: item.id, label: item.name }));
    case "owner":
      return owners.map((item) => ({ value: item.id, label: item.name }));
    default:
      return null;
  }
}

export default function EstateEditForm({
  t,
  draft,
  setDraft,
  brokers,
  owners,
  saving,
  error,
  onSubmit,
  onCancel,
  showStoryHelper,
  setShowStoryHelper,
  applyStoryTemplate,
}) {
  const fields = [
    ["title", t("estateTitle"), "text"],
    ["property_type", t("propertyType"), "propertyType"],
    ["listing_type", t("listingType"), "listingType"],
    ["status", t("status"), "status"],
    ["price", t("price"), "number"],
    ["currency", t("currency"), "text"],
    ["bedrooms", t("bedrooms"), "number"],
    ["bathrooms", t("bathrooms"), "number"],
    ["area_sqm", t("areaSqm"), "number"],
    ["address", t("address"), "text"],
    ["province", t("province"), "province"],
    ["city", t("city"), "city"],
    ["latitude", t("latitude"), "latitude"],
    ["longitude", t("longitude"), "longitude"],
    ["persona_name", t("personaName"), "text"],
    ["persona_demographics", t("personaDemographics"), "text"],
    ["persona_motivations", t("personaMotivations"), "textarea"],
    ["persona_objections", t("personaObjections"), "textarea"],
    ["persona_marketing_angle", t("personaMarketingAngle"), "textarea"],
    ["broker", t("brokerName"), "broker"],
    ["owner", t("owner"), "owner"],
  ];

  function update(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  return (
    <form className="estate-edit-form" onSubmit={onSubmit}>
      {error && (
        <p role="alert" className="estate-form-error">
          {error}
        </p>
      )}

      <div className="estate-form-grid">
        {fields.map(([field, label, type]) => {
          const options = fieldOptions(field, type, brokers, owners, t);
          const value = draft[field] ?? "";

          return (
            <label key={field} className="estate-field">
              <span>{label}</span>
              {options ? (
                <select value={value} onChange={(event) => update(field, event.target.value)}>
                  {["broker", "owner", "province", "city"].includes(type) && (
                    <option value="">
                      {type === "broker"
                        ? t("noBrokerLinked")
                        : type === "owner"
                          ? t("noOwnerLinked")
                          : "—"}
                    </option>
                  )}
                  {value && !options.some((option) => String(option.value) === String(value)) && (
                    <option value={value}>{value}</option>
                  )}
                  {options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : type === "latitude" || type === "longitude" ? (
                <input
                  type="number"
                  step="any"
                  value={value}
                  onChange={(event) => update(field, event.target.value)}
                />
              ) : type === "textarea" ? (
                <textarea
                  rows={2}
                  value={value}
                  onChange={(event) => update(field, event.target.value)}
                />
              ) : (
                <input
                  type={type}
                  min={type === "number" ? "0" : undefined}
                  step={field === "price" ? "0.01" : "1"}
                  value={value}
                  onChange={(event) => update(field, event.target.value)}
                />
              )}
            </label>
          );
        })}
      </div>

      {draft.persona_name && (
        <div className="estate-story-helper">
          <div className="estate-story-helper-head">
            <span>{t("storytellingHelper")}</span>
            <button
              type="button"
              className="estate-link-button"
              onClick={() => setShowStoryHelper((previous) => !previous)}
            >
              {showStoryHelper ? t("hideHelper") : t("showHelper")}
            </button>
          </div>

          {showStoryHelper && (
            <div className="estate-story-helper-body">
              <p className="estate-muted">
                {t("personaSelected", { name: draft.persona_name })}
              </p>

              {Object.entries(STORYTELLING_TEMPLATES).map(([key, template]) => (
                <button
                  key={key}
                  type="button"
                  className="estate-story-template"
                  onClick={() => applyStoryTemplate(template)}
                >
                  <strong>{template.name}</strong>
                  <small>
                    {t("storyAngle")}: {template.useCases.join(", ")}
                  </small>
                </button>
              ))}

              <div className="estate-story-angles">
                <span>{t("storyAngles")}</span>
                {Object.entries(STORY_ANGLES).map(([key, description]) => (
                  <p key={key}>
                    <strong>{key}:</strong> {description}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <label className="estate-field estate-field-full">
        <span>{t("description")}</span>
        <textarea
          rows={4}
          value={draft.description ?? ""}
          onChange={(event) => update("description", event.target.value)}
        />
      </label>

      <div className="estate-form-actions">
        <button type="submit" className="estate-submit-button" disabled={saving}>
          {saving ? t("saving") : t("saveChanges")}
        </button>
        <button type="button" className="estate-inquiry-toggle" onClick={onCancel}>
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}
