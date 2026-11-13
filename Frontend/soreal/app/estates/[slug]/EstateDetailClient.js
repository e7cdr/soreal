"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  ArrowUpRight,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Heart,
  Images,
  MapPin,
  Pencil,
  Share2,
} from "lucide-react";
import {
  downloadEstatePdf,
  downloadSocialPost,
  fetchBrokers,
  fetchOwners,
  updateEstate,
} from "@/lib/api";
import { useTranslation } from "@/app/components/LanguageProvider";
import PageShell from "@/app/components/PageShell";
import ToolbarMenu from "@/app/components/ToolbarMenu";
import {
  isFavorite,
  addFavorite,
  removeFavorite,
} from "@/lib/favorites";
import { renderTemplate } from "@/lib/storytelling-templates";
import { buildEstateCopyText } from "@/lib/estate-copy";
import { copyToClipboard } from "@/lib/clipboard";
import { saveBlob } from "@/lib/download";
import EstateGallery from "./EstateGallery";
import EstateContactCard from "./EstateContactCard";
import EstateInquiryForm from "./EstateInquiryForm";
import EstateEditForm from "./EstateEditForm";

const PropertyMap = dynamic(
  () => import("@/app/components/PropertyMap").then((mod) => mod.default),
  { ssr: false, loading: () => <div className="estate-map-loading" /> },
);

function buildDraft(estate) {
  return {
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
    latitude: estate.latitude ?? "",
    longitude: estate.longitude ?? "",
    broker: estate.broker || "",
    owner: estate.owner || "",
    persona_name: estate.persona_name || "",
    persona_demographics: estate.persona_demographics || "",
    persona_motivations: estate.persona_motivations || "",
    persona_objections: estate.persona_objections || "",
    persona_marketing_angle: estate.persona_marketing_angle || "",
  };
}

function siteOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

function isLocalOrigin(origin) {
  try {
    const host = new URL(origin).hostname;
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host === "0.0.0.0" ||
      host.startsWith("192.168.") ||
      host.startsWith("10.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    );
  } catch {
    return false;
  }
}

export default function EstateDetailClient({ estate }) {
  const { translate: t, lang } = useTranslation();

  const [isFav, setIsFav] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const [draft, setDraft] = useState(null);
  const [brokers, setBrokers] = useState([]);
  const [owners, setOwners] = useState([]);
  const [savingEstate, setSavingEstate] = useState(false);
  const [showStoryHelper, setShowStoryHelper] = useState(false);

  const editRef = useRef(null);
  const loadedRef = useRef({ brokers: false, owners: false });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsFav(isFavorite(estate.id));
    setCanManage(Boolean(localStorage.getItem("auth_token")));
  }, [estate.id]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const ensureEditData = useCallback(() => {
    setDraft((current) => current ?? buildDraft(estate));

    if (!loadedRef.current.brokers) {
      loadedRef.current.brokers = true;
      fetchBrokers()
        .then((response) => setBrokers(response.results || []))
        .catch((loadError) => {
          loadedRef.current.brokers = false;
          setError(loadError.message || t("error"));
        });
    }
    if (!loadedRef.current.owners) {
      loadedRef.current.owners = true;
      fetchOwners()
        .then((response) => setOwners(response.results || []))
        .catch((loadError) => {
          loadedRef.current.owners = false;
          setError(loadError.message || t("error"));
        });
    }
  }, [estate, t]);

  function openEdit() {
    ensureEditData();
    const node = editRef.current;
    if (node) {
      node.open = true;
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function closeEdit() {
    if (editRef.current) editRef.current.open = false;
  }

  function handleEditToggle(event) {
    if (event.currentTarget.open) ensureEditData();
  }

  function applyStoryTemplate(template) {
    setDraft((current) => ({
      ...current,
      description: renderTemplate(template, current),
    }));
    setShowStoryHelper(false);
  }

  async function saveEstate(event) {
    event.preventDefault();
    setSavingEstate(true);
    setError(null);
    try {
      await updateEstate(estate.slug, {
        ...draft,
        price: draft.price === "" ? null : Number(draft.price),
        bedrooms: draft.bedrooms === "" ? null : Number(draft.bedrooms),
        bathrooms: draft.bathrooms === "" ? null : Number(draft.bathrooms),
        area_sqm: draft.area_sqm === "" ? null : Number(draft.area_sqm),
        latitude: draft.latitude === "" ? null : Number(draft.latitude),
        longitude: draft.longitude === "" ? null : Number(draft.longitude),
        broker: draft.broker ? Number(draft.broker) : null,
        owner: draft.owner ? Number(draft.owner) : null,
      });
      window.location.reload();
    } catch (saveError) {
      setError(saveError.message || t("error"));
    } finally {
      setSavingEstate(false);
    }
  }

  function toggleFavorite() {
    if (isFav) {
      removeFavorite(estate.id);
      setIsFav(false);
    } else {
      addFavorite(estate.id);
      setIsFav(true);
    }
  }

  async function handleDownloadPost() {
    setDownloading(true);
    try {
      const response = await downloadSocialPost(estate.slug);
      const blob = await response.blob();
      saveBlob(blob, `${estate.slug}_social_post.zip`);
    } catch (downloadError) {
      setError(downloadError.message || t("error"));
    } finally {
      setDownloading(false);
    }
  }

  async function handleDownloadPdf(layout) {
    setDownloadingPdf(true);
    try {
      const response = await downloadEstatePdf(estate.slug, { layout, lang });
      const blob = await response.blob();
      saveBlob(blob, `${estate.slug}_${layout}.pdf`);
    } catch (downloadError) {
      setError(downloadError.message || t("error"));
    } finally {
      setDownloadingPdf(false);
    }
  }

  function shareOnFacebook() {
    setNotice(null);
    const origin = siteOrigin();
    const shareUrl = `${origin}/estates/${estate.slug}`;
    const sharerUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
      shareUrl,
    )}&display=popup`;

    const popup = window.open(
      sharerUrl,
      "soreal-facebook-share",
      "width=640,height=640,menubar=no,toolbar=no,resizable=yes,scrollbars=yes",
    );

    if (!popup) {
      copyToClipboard(shareUrl);
      setNotice({ tone: "warning", message: t("sharePopupBlocked") });
      return;
    }

    if (isLocalOrigin(origin)) {
      setNotice({ tone: "warning", message: t("shareLocalhostHint") });
    }
  }

  async function copyEstateInfo() {
    const copied = await copyToClipboard(buildEstateCopyText(estate));
    setNotice(
      copied
        ? { tone: "success", message: t("estateCopied") }
        : { tone: "warning", message: t("copyFailed") },
    );
  }

  const hasCoordinates =
    estate.latitude !== null &&
    estate.latitude !== undefined &&
    estate.longitude !== null &&
    estate.longitude !== undefined;
  const locationLabel = [estate.city, estate.province].filter(Boolean).join(", ");
  const descriptionHasHtml = /<\/?[a-z][^>]*>/i.test(estate.description || "");

  return (
    <PageShell
      eyebrow={
        <Link href="/estates" className="estate-back-link">
          <ArrowLeft size={12} aria-hidden="true" />
          {t("backToEstates")}
        </Link>
      }
      title={estate.title}
      description={
        <span className="estate-head-meta">
          {locationLabel && (
            <span>
              <MapPin size={12} aria-hidden="true" />
              {locationLabel}
            </span>
          )}
          {estate.custom_id && (
            <span className="estate-head-id">
              {t("customId")}: {estate.custom_id}
            </span>
          )}
        </span>
      }
      actions={
        <>
          <span className={`estate-status-badge estate-status-${estate.status || "draft"}`}>
            {t(estate.status || "draft")}
          </span>

          <button
            type="button"
            className="toolbar-button"
            onClick={toggleFavorite}
            aria-pressed={isFav}
            aria-label={isFav ? t("removeFavorite") : t("addToFavorites")}
            title={isFav ? t("removeFavorite") : t("addToFavorites")}
          >
            <Heart
              size={16}
              className={isFav ? "estate-heart-active" : undefined}
              aria-hidden="true"
            />
          </button>

          {canManage && (
            <button
              type="button"
              className="toolbar-button"
              onClick={openEdit}
              aria-label={t("editEstate")}
              title={t("editEstate")}
            >
              <Pencil size={16} aria-hidden="true" />
            </button>
          )}

          <button
            type="button"
            className="toolbar-button"
            onClick={shareOnFacebook}
            aria-label={t("shareFacebook")}
            title={t("shareFacebook")}
          >
            <Share2 size={16} aria-hidden="true" />
          </button>

          <button
            type="button"
            className="toolbar-button"
            onClick={copyEstateInfo}
            aria-label={t("copyEstateInfo")}
            title={t("copyEstateInfo")}
          >
            <Copy size={16} aria-hidden="true" />
          </button>

          <ToolbarMenu label={t("moreActions")}>
            <button
              type="button"
              className="toolbar-menu-item"
              onClick={handleDownloadPost}
              disabled={downloading}
            >
              <Download size={14} aria-hidden="true" />
              {downloading ? t("loading") : t("downloadSocialPost")}
            </button>
            <button
              type="button"
              className="toolbar-menu-item"
              onClick={() => handleDownloadPdf("factsheet")}
              disabled={downloadingPdf}
            >
              <FileText size={14} aria-hidden="true" />
              {downloadingPdf ? t("loading") : t("downloadFactSheet")}
            </button>
            <button
              type="button"
              className="toolbar-menu-item"
              onClick={() => handleDownloadPdf("brochure")}
              disabled={downloadingPdf}
            >
              <Images size={14} aria-hidden="true" />
              {downloadingPdf ? t("loading") : t("downloadBrochure")}
            </button>
            {estate.source_url && (
              <a
                className="toolbar-menu-item"
                href={estate.source_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink size={14} aria-hidden="true" />
                {t("viewOriginal")}
              </a>
            )}
          </ToolbarMenu>
        </>
      }
      bodyClassName="estate-page-body"
    >
      {error && (
        <p role="alert" className="estate-form-error">
          {error}
        </p>
      )}

      {notice && (
        <p role="status" className={`estate-notice estate-notice-${notice.tone}`}>
          {notice.message}
        </p>
      )}

      <div className="estate-layout">
        <div className="estate-gallery-col">
          <EstateGallery images={estate.images} title={estate.title} t={t} />
        </div>

        <aside className="estate-side">
          <EstateContactCard
            estate={estate}
            t={t}
            inquiryOpen={inquiryOpen}
            onToggleInquiry={() => setInquiryOpen((previous) => !previous)}
          />
          {inquiryOpen && (
            <EstateInquiryForm estateId={estate.id} title={estate.title} t={t} />
          )}
        </aside>

        <div className="estate-main">
          {(hasCoordinates || estate.city) && (
            <section className="estate-map-card">
              <PropertyMap
                properties={[estate]}
                center={hasCoordinates ? [estate.latitude, estate.longitude] : undefined}
                zoom={14}
                height={240}
              />
              {hasCoordinates && (
                <a
                  className="estate-map-link"
                  href={`https://www.google.com/maps/search/?api=1&query=${estate.latitude},${estate.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MapPin size={13} aria-hidden="true" />
                  {t("openInGoogleMaps")}
                  <ArrowUpRight size={12} aria-hidden="true" />
                </a>
              )}
            </section>
          )}

          {estate.source_lead_details && (
            <details className="estate-collapsible">
              <summary>
                <span className="estate-source-badge">{t("sourceRequest")}</span>
                <span className="estate-summary-text">
                  {estate.source_lead_details.broker_name ||
                    estate.source_lead_details.name ||
                    t("unknownRequester")}
                </span>
              </summary>
              <div className="estate-collapsible-body">
                <div className="estate-source-body">
                  {estate.source_lead_details.broker_name ? (
                    <p className="estate-source-name">{estate.source_lead_details.broker_name}</p>
                  ) : (
                    <p className="estate-source-name">
                      {estate.source_lead_details.name || t("unknownRequester")}
                    </p>
                  )}
                  {estate.source_lead_details.broker_name && estate.source_lead_details.name && (
                    <p className="estate-muted">{estate.source_lead_details.name}</p>
                  )}
                  {estate.source_lead_details.phone && (
                    <p className="estate-muted">{estate.source_lead_details.phone}</p>
                  )}
                  {estate.source_lead_details.whatsapp_group && (
                    <p className="estate-muted">{estate.source_lead_details.whatsapp_group}</p>
                  )}
                  <p className="estate-muted">{t("sourceRequestDescription")}</p>
                  <Link
                    href={`/requests/${estate.source_lead_details.id}`}
                    className="estate-link-button"
                  >
                    {t("viewRequest")}
                  </Link>
                </div>
              </div>
            </details>
          )}

          <section className="estate-card estate-description-card">
            <div className="estate-section-head">
              <FileText size={14} aria-hidden="true" />
              <h2 className="estate-section-title">{t("aboutProperty")}</h2>
            </div>
            {estate.description ? (
              <>
                <div
                  className={`estate-description ${
                    descriptionHasHtml ? "estate-rich-text" : "estate-description-text"
                  } ${descriptionExpanded ? "" : "estate-description-clamped"}`.trim()}
                >
                  {descriptionHasHtml ? (
                    <div dangerouslySetInnerHTML={{ __html: estate.description }} />
                  ) : (
                    <p>{estate.description}</p>
                  )}
                </div>
                <button
                  type="button"
                  className="estate-link-button"
                  onClick={() => setDescriptionExpanded((previous) => !previous)}
                  aria-expanded={descriptionExpanded}
                >
                  {descriptionExpanded ? t("showLess") : t("showMore")}
                </button>
              </>
            ) : (
              <p className="estate-muted">{t("noDescription")}</p>
            )}
          </section>

          {canManage && (
            <details
              ref={editRef}
              className="estate-collapsible estate-edit-section"
              onToggle={handleEditToggle}
            >
              <summary>
                <Pencil size={14} aria-hidden="true" />
                {t("editEstate")}
              </summary>
              <div className="estate-collapsible-body">
                {draft ? (
                  <EstateEditForm
                    t={t}
                    draft={draft}
                    setDraft={setDraft}
                    brokers={brokers}
                    owners={owners}
                    saving={savingEstate}
                    error={null}
                    onSubmit={saveEstate}
                    onCancel={closeEdit}
                    showStoryHelper={showStoryHelper}
                    setShowStoryHelper={setShowStoryHelper}
                    applyStoryTemplate={applyStoryTemplate}
                  />
                ) : (
                  <p className="estate-muted">{t("loading")}</p>
                )}
              </div>
            </details>
          )}
        </div>
      </div>
    </PageShell>
  );
}
