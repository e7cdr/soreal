"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { submitInquiry, downloadSocialPost } from "@/lib/api";
import dynamic from "next/dynamic";
import { useTranslation } from "@/app/components/LanguageProvider";
import {
  isFavorite,
  addFavorite,
  removeFavorite,
} from "@/lib/favorites";
import { Heart } from "lucide-react";

const PropertyMap = dynamic(
  () => import("@/app/components/PropertyMap").then((mod) => mod.default),
  { ssr: false, loading: () => <div className="w-full h-[400px] bg-gray-200 rounded-lg animate-pulse" /> }
);

export default function EstateDetailClient({ estate }) {
  const { t } = useTranslation();
  const coverImage =
    estate.images?.find((img) => img.is_cover)?.image_url ||
    estate.images?.[0]?.image_url ||
    null;

  const typeLabel = t(estate.property_type, {}, {});
  const listingLabel = t(estate.listing_type, {}, {});

  const [isFav, setIsFav] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    setIsFav(isFavorite(estate.id));
  }, [estate.id]);

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
          <div className="flex items-center gap-2">
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
          </div>
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
          {estate.latitude && estate.longitude && (
            <div className="mt-4">
              <PropertyMap properties={[estate]} center={[estate.latitude, estate.longitude]} zoom={14} />
            </div>
          )}
        </div>

        <div>
          {estate.description && (
            <div className="mb-6">
              <h2 className="text-xl font-bold mb-2">Description</h2>
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
                    <option value="ID_Card">{t("idCard", {}, {})}</option>
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
