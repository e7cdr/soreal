"use client";

import { Bath, BedDouble, MessageCircle, Ruler } from "lucide-react";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

function formatPrice(estate) {
  if (estate.price === null || estate.price === undefined || estate.price === "") {
    return null;
  }
  const amount = Number(estate.price);
  if (Number.isNaN(amount)) return null;
  return `${estate.currency || ""} ${amount.toLocaleString()}`.trim();
}

export default function EstateContactCard({ estate, t, inquiryOpen, onToggleInquiry }) {
  const price = formatPrice(estate);
  const message = t("whatsappContactEstate", { title: estate.title });

  const contacts = [];
  if (estate.broker_phone) {
    contacts.push({
      key: "broker",
      label: t("contactBroker"),
      name: estate.broker_name,
      phone: estate.broker_phone,
    });
  }
  // The API only returns owner_phone to staff requests.
  if (estate.owner_phone) {
    contacts.push({
      key: "owner",
      label: t("contactOwner"),
      name: estate.owner_name,
      phone: estate.owner_phone,
    });
  }

  return (
    <div className="estate-contact-card">
      <div className="estate-contact-price">
        <strong>{price || t("priceOnRequest")}</strong>
        <span className="estate-contact-type">
          {t(estate.listing_type)} · {t(estate.property_type)}
        </span>
      </div>

      <div className="estate-spec-row">
        {estate.bedrooms !== null && estate.bedrooms !== undefined && (
          <span>
            <BedDouble size={14} aria-hidden="true" />
            {estate.bedrooms} {t("beds")}
          </span>
        )}
        {estate.bathrooms !== null && estate.bathrooms !== undefined && (
          <span>
            <Bath size={14} aria-hidden="true" />
            {estate.bathrooms} {t("baths")}
          </span>
        )}
        {estate.area_sqm !== null && estate.area_sqm !== undefined && (
          <span>
            <Ruler size={14} aria-hidden="true" />
            {estate.area_sqm} {t("sqm")}
          </span>
        )}
      </div>

      <div className="estate-contact-actions">
        {contacts.length > 0 ? (
          contacts.map((contact) => (
            <a
              key={contact.key}
              className="estate-contact-button"
              href={buildWhatsAppUrl(contact.phone, message) || "#"}
              target="_blank"
              rel="noopener noreferrer"
              title={`${contact.label}${contact.name ? ` — ${contact.name}` : ""}`}
            >
              <MessageCircle size={17} aria-hidden="true" />
              <span>
                <strong>{contact.label}</strong>
                {contact.name && <small>{contact.name}</small>}
              </span>
            </a>
          ))
        ) : (
          <p className="estate-contact-empty">{t("noContactPhone")}</p>
        )}

        <button
          type="button"
          className="estate-inquiry-toggle"
          onClick={onToggleInquiry}
          aria-expanded={inquiryOpen}
        >
          {inquiryOpen ? t("hideInquiry") : t("sendInquiry")}
        </button>
      </div>
    </div>
  );
}
