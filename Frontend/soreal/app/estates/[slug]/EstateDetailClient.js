"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import {
  submitInquiry,
  downloadSocialPost,
  fetchBrokers,
  fetchOwners,
  updateEstate,
} from "@/lib/api";
import dynamic from "next/dynamic";
import { useTranslation } from "@/app/components/LanguageProvider";
import {
  isFavorite,
  addFavorite,
  removeFavorite,
} from "@/lib/favorites";
import { Heart } from "lucide-react";
import { DOMINICAN_CITIES, DOMINICAN_PROVINCES } from "@/lib/locations";

const PropertyMap = dynamic(
  () => import("@/app/components/PropertyMap").then((mod) => mod.default),
  { ssr: false, loading: () => <div className="w-full h-[400px] bg-gray-200 rounded-lg animate-pulse" /> }
);

function normalizePhoneForWhatsApp(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  // Dominican Republic country code: 1 (809, 829, 849)
  if (!digits.startsWith("1")) {
    return `1${digits}`;
  }
  return digits;
}

function buildWhatsAppUrl(phone, text) {
  const normalized = normalizePhoneForWhatsApp(phone);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`;
}

export default function EstateDetailClient({ estate }) {
  const { translate: t } = useTranslation();
  const coverImage =
    estate.images?.find((img) => img.is_cover)?.image_url ||
    estate.images?.[0]?.image_url ||
    null;

  const typeLabel = t(estate.property_type);
  const listingLabel = t(estate.listing_type);

  const [isFav, setIsFav] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [editing, setEditing] = useState(false);
  const [savingEstate, setSavingEstate] = useState(false);
  const [estateDraft, setEstateDraft] = useState(null);
  const [brokers, setBrokers] = useState([]);
  const [owners, setOwners] = useState([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsFav(isFavorite(estate.id));
    setCanManage(Boolean(localStorage.getItem("auth_token")));
  }, [estate.id]);

  function startEditing() {
    setEstateDraft({
      title: estate.title || "",
      description: estate.description || "",
      property_type: estate.property_type || "apartment",
      listing_type: estate.listing_type || "sale",
      price: estate.price ?? "",
      currency: estate.currency || "DOP",
      bedrooms: estate.bedrooms ?? "",
      bathrooms: estate.bathrooms ?? "",
      area_sqm: estate.area_sqm ?? "",
      address: estate.address || "",
      city: estate.city || "",
      province: estate.province || "",
      status: estate.status || "draft",
      broker: estate.broker || "",
      owner: estate.owner || "",
    });
    setError(null);
    setEditing(true);
    fetchBrokers().then((response) => setBrokers(response.results || [])).catch((loadError) => setError(loadError.message));
    fetchOwners().then((response) => setOwners(response.results || [])).catch((loadError) => setError(loadError.message));
  }

  async function saveEstateChanges(event) {
    event.preventDefault();
    setSavingEstate(true);
    setError(null);
    try {
      await updateEstate(estate.slug, {
        ...estateDraft,
        price: estateDraft.price === "" ? null : Number(estateDraft.price),
        bedrooms: estateDraft.bedrooms === "" ? null : Number(estateDraft.bedrooms),
        bathrooms: estateDraft.bathrooms === "" ? null : Number(estateDraft.bathrooms),
        area_sqm: estateDraft.area_sqm === "" ? null : Number(estateDraft.area_sqm),
        broker: estateDraft.broker ? Number(estateDraft.broker) : null,
        owner: estateDraft.owner ? Number(estateDraft.owner) : null,
      });
      window.location.reload();
    } catch (saveError) {
      setError(saveError.message || t("error"));
    } finally {
      setSavingEstate(false);
    }
  }

  const toggleFavorite = () => {
    if (isFav) {
      removeFavorite(estate.id);
      setIsFav(false);
    } else {
      addFavorite(estate.id);
      setIsFav(true);
    }
  };

  const handleDownloadPost = async () => {
    setDownloading(true);
    try {
      const response = await downloadSocialPost(estate.slug);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${estate.slug}_social_post.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || "Failed to download social post");
    } finally {
      setDownloading(false);
    }
  };

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    id_type: "ID_Card",
    identification: "",
    message: "",
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await submitInquiry(estate.id, form);
      setSubmitted(true);
    } catch (err) {
      setError(err.message || "Failed to submit inquiry.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="p-6 max-w-md mx-auto">
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <h2 className="text-xl font-bold text-green-800">
            {t("inquirySent")}
          </h2>
          <p className="mt-2 text-green-700">
            {t("inquirySubtitle", { title: estate.title })}
          </p>
        </div>
        <Link
          href={`/estates/${estate.slug}`}
          className="mt-6 text-blue-600 hover:underline"
        >
          {t("backToListing")}
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <h1 className="text-3xl font-bold">{estate.title}</h1>
          {estate.custom_id && (
            <p className="text-sm font-semibold tracking-wide text-[var(--text-muted)]">
              {t("customId")}: {estate.custom_id}
            </p>
          )}
          <div className="flex items-center gap-2">
            {canManage && (
              <button
                type="button"
                onClick={editing ? () => setEditing(false) : startEditing}
                className="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--foreground)]"
              >
                {editing ? t("cancel") : t("editEstate")}
              </button>
            )}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleFavorite();
              }}
              className="p-2 bg-gray-100 rounded hover:bg-gray-200"
            >
              {isFav ? (
                <Heart className="w-6 h-6 text-red-500 fill-red-500" />
              ) : (
                <Heart className="w-6 h-6 text-gray-400 hover:text-red-500" />
              )}
            </button>
            <button
              onClick={handleDownloadPost}
              disabled={downloading}
              className="p-2 bg-blue-100 rounded hover:bg-blue-200"
              title="Download Social Media Post"
            >
              <span className="text-blue-600">📱</span>
            </button>
            {estate.phone && (
              <a
                href={buildWhatsAppUrl(estate.phone, t("whatsappContactEstate", { title: estate.title })) || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-green-100 rounded hover:bg-green-200"
                title={t("whatsappContact")}
              >
                <span className="text-green-600">📱</span>
              </a>
            )}
            <button
              type="button"
              onClick={() => {
                window.open(
                  `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
                    typeof window !== "undefined" ? window.location.href : ""
                  )}`,
                  "_blank",
                  "width=600,height=400"
                );
              }}
              className="p-2 bg-blue-100 rounded hover:bg-blue-200"
              title={t("shareFacebook")}
            >
              <span className="text-blue-600">👍</span>
            </button>
          </div>
          {editing && estateDraft && (
            <form onSubmit={saveEstateChanges} className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <h2 className="font-semibold">{t("editEstate")}</h2>
              {[
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
                ["broker", t("brokerName"), "broker"],
                ["owner", t("owner"), "owner"],
              ].map(([field, label, type]) => {
                const options = type === "propertyType"
                  ? ["apartment", "house", "villa", "land", "commercial"].map((value) => ({ value, label: t(value) }))
                  : type === "listingType"
                    ? ["sale", "rent"].map((value) => ({ value, label: t(`listing_${value}`) }))
                    : type === "status"
                      ? ["draft", "available", "reserved", "sold", "rented", "inactive"].map((value) => ({ value, label: t(value) }))
                      : type === "province"
                        ? DOMINICAN_PROVINCES.map((value) => ({ value, label: value }))
                        : type === "city"
                          ? DOMINICAN_CITIES.map((value) => ({ value, label: value }))
                          : type === "broker"
                            ? brokers.map((item) => ({ value: item.id, label: item.name }))
                            : type === "owner"
                              ? owners.map((item) => ({ value: item.id, label: item.name }))
                              : null;
                return (
                  <label key={field} className="block text-sm">
                    <span className="mb-1 block font-medium">{label}</span>
                    {options ? (
                      <select value={estateDraft[field] ?? ""} onChange={(event) => setEstateDraft({ ...estateDraft, [field]: event.target.value })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]">
                        {["broker", "owner", "province", "city"].includes(type) && <option value="">{type === "broker" ? t("noBrokerLinked") : type === "owner" ? t("noOwnerLinked") : "—"}</option>}
                        {estateDraft[field] && !options.some((option) => String(option.value) === String(estateDraft[field])) && <option value={estateDraft[field]}>{estateDraft[field]}</option>}
                        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    ) : (
                      <input type={type} min={type === "number" ? "0" : undefined} step={field === "price" ? "0.01" : "1"} value={estateDraft[field]} onChange={(event) => setEstateDraft({ ...estateDraft, [field]: event.target.value })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]" />
                    )}
                  </label>
                );
              })}
              <label className="block text-sm"><span className="mb-1 block font-medium">{t("description")}</span><textarea rows={4} value={estateDraft.description} onChange={(event) => setEstateDraft({ ...estateDraft, description: event.target.value })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]" /></label>
              <button disabled={savingEstate} className="rounded-lg bg-[var(--green)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{savingEstate ? t("saving") : t("saveChanges")}</button>
            </form>
          )}
          {coverImage ? (
            <img
              src={coverImage}
              alt={estate.title}
              className="w-full h-64 object-cover rounded-lg"
            />
          ) : (
            <div className="w-full h-64 border rounded-lg flex items-center justify-center">
              No image available
            </div>
          )}
          {estate.images?.slice(1).map((img, i) => (
            <img
              key={i}
              src={img.image_url}
              alt={img.caption || "Image"}
              className="mt-2 w-32 h-32 object-cover rounded"
              loading="lazy"
              decoding="async"
            />
          ))}
          <div className="space-y-2">
            <p className="text-gray-600">
              {estate.city}, {estate.province}
            </p>
            <p className="text-gray-600">
              {typeLabel} · {listingLabel}
            </p>
            {estate.bedrooms && (
              <p className="text-gray-600">
                {estate.bedrooms} {t("beds")}
              </p>
            )}
            {estate.bathrooms && (
              <p className="text-gray-600">
                {estate.bathrooms} {t("baths")}
              </p>
            )}
            {estate.area_sqm && (
              <p className="text-gray-600">{estate.area_sqm} {t("sqm")}</p>
            )}
            {estate.price && (
              <p className="text-2xl font-bold">
                {estate.currency} {estate.price.toLocaleString()}
              </p>
            )}
          </div>
          {(estate.latitude != null && estate.longitude != null || estate.city) && (
            <div className="mt-4">
              <PropertyMap
                properties={[estate]}
                center={estate.latitude != null && estate.longitude != null ? [estate.latitude, estate.longitude] : undefined}
                zoom={14}
              />
            </div>
          )}
        </div>

        {estate.source_lead_details && (
          <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2 py-0.5 rounded">
                {t("sourceRequest")}
              </span>
              <Link
                href={`/requests/${estate.source_lead_details.id}`}
                className="text-xs font-medium text-[var(--text-muted)] hover:underline"
              >
                {t("viewRequest")}
              </Link>
            </div>
            <div className="space-y-1 text-sm">
              {estate.source_lead_details.broker_name ? (
                <p className="font-semibold">{estate.source_lead_details.broker_name}</p>
              ) : (
                <p className="font-semibold">{estate.source_lead_details.name || t("unknownRequester")}</p>
              )}
              {estate.source_lead_details.broker_name && estate.source_lead_details.name && (
                <p className="text-[var(--text-muted)]">{estate.source_lead_details.name}</p>
              )}
              {estate.source_lead_details.phone && (
                <p className="text-[var(--text-muted)]">
                  {estate.source_lead_details.phone}
                </p>
              )}
              {estate.source_lead_details.whatsapp_group && (
                <p className="text-[var(--text-muted)]">
                  {estate.source_lead_details.whatsapp_group}
                </p>
              )}
              <p className="text-xs text-[var(--text-muted)]">
                {t("sourceRequestDescription")}
              </p>
            </div>
          </div>
        )}

        <div>
          {estate.description && (
            <div className="mb-6">
              <h2 className="text-xl font-bold mb-2">{t("description")}</h2>
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: estate.description }}
              />
            </div>
          )}

          {!submitted && (
            <div className="bg-gray-50 p-6 rounded-lg">
              <h2 className="text-xl font-bold mb-4">
                {t("sendInquiry")}
              </h2>
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {t("fullName")} <span className="text-red-500">*</span>
                  </label>
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
                  <label className="block text-sm font-medium mb-1">
                    {t("email")} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    required
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
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {t("idType")}
                  </label>
                  <select
                    name="id_type"
                    value={form.id_type}
                    onChange={handleChange}
                    className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="ID_Card">{t("idCard")}</option>
                    <option value="Passport">Passport</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {t("idNumber")}
                  </label>
                  <input
                    type="text"
                    name="identification"
                    value={form.identification}
                    onChange={handleChange}
                    className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder={t("idNumberPlaceholder")}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {t("message")}
                  </label>
                  <textarea
                    name="message"
                    value={form.message}
                    onChange={handleChange}
                    rows={3}
                    className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder={t("anyQuestions")}
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 font-medium"
                >
                  {submitting ? t("sending") : t("send")}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
