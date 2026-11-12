"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Save, UserRoundX } from "lucide-react";
import {
  createBroker,
  createEstateFromLead,
  fetchBrokers,
  fetchLead,
  fetchOwners,
  ignoreLeadUser,
  unignoreLeadUser,
  updateLead,
} from "@/lib/api";
import { useTranslation } from "@/app/components/LanguageProvider";
import PageShell from "@/app/components/PageShell";
import { DOMINICAN_CITIES, DOMINICAN_PROVINCES } from "@/lib/locations";

const EDITABLE_FIELDS = [
  "name",
  "phone",
  "broker",
  "status",
  "listing_type",
  "property_type",
  "min_bedrooms",
  "max_bedrooms",
  "min_bathrooms",
  "max_bathrooms",
  "min_price",
  "max_price",
  "budget_currency",
  "preferred_location",
  "furnishing",
  "city",
  "province",
  "notes",
];

function listingIntentBadge(listingType, t) {
  if (listingType === "sale") return { label: t("selling"), color: "text-orange-700 bg-orange-100" };
  if (listingType === "rent") return { label: t("renting"), color: "text-blue-700 bg-blue-100" };
  return { label: t("looking"), color: "text-amber-700 bg-amber-100" };
}

function toForm(lead) {
  return Object.fromEntries(
    EDITABLE_FIELDS.map((field) => [field, lead[field] ?? ""]),
  );
}

function toPayload(form) {
  const payload = { ...form };
  payload.broker = form.broker === "" ? null : Number(form.broker);
  for (const field of [
    "min_bedrooms",
    "max_bedrooms",
    "min_bathrooms",
    "max_bathrooms",
  ]) {
    payload[field] = form[field] === "" ? null : Number(form[field]);
  }
  for (const field of ["min_price", "max_price"]) {
    payload[field] = form[field] === "" ? null : Number(form[field]);
  }
  return payload;
}

export default function RequestDetailPage() {
  const params = useParams();
  const { translate: t } = useTranslation();
  const [lead, setLead] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [brokerOptions, setBrokerOptions] = useState([]);
  const [brokerSearch, setBrokerSearch] = useState("");
  const [showBrokerForm, setShowBrokerForm] = useState(false);
  const [brokerDraft, setBrokerDraft] = useState({ name: "", phone: "", company: "" });
  const [showEstateForm, setShowEstateForm] = useState(false);
  const [estateForm, setEstateForm] = useState(null);
  const [ownerOptions, setOwnerOptions] = useState([]);

  const loadLead = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchLead(params.id);
      setLead(data);
      setForm(toForm(data));
      setEstateForm({
        title: `${data.property_type || "Property"} in ${data.preferred_location || data.city || data.name || ""}`.trim(),
        description: (data.notes || "").replace(/^WhatsApp request:\s*/, ""),
        property_type: data.property_type || "apartment",
        listing_type: data.listing_type === "rent" ? "rent" : "sale",
        price: data.max_price ?? data.min_price ?? "",
        currency: data.budget_currency || "USD",
        bedrooms: data.min_bedrooms ?? "",
        bathrooms: data.min_bathrooms ?? "",
        address: data.preferred_location || "",
        city: data.city || "",
        province: data.province || "",
        status: "draft",
        broker: data.broker || "",
        owner: "",
      });
    } catch (loadError) {
      setError(loadError.message || t("error"));
    } finally {
      setLoading(false);
    }
  }, [params.id, t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadLead();
  }, [loadLead]);

  useEffect(() => {
    fetchOwners()
      .then((response) => setOwnerOptions(response.results || []))
      .catch((loadError) => setError(loadError.message || t("error")));
  }, [t]);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      fetchBrokers({ q: brokerSearch })
        .then((response) => {
          if (!active) return;
          const results = response.results || [];
          if (lead?.broker && !results.some((item) => item.id === lead.broker)) {
            results.unshift({
              id: lead.broker,
              name: lead.broker_name,
              company: lead.broker_company,
            });
          }
          setBrokerOptions(results);
        })
        .catch((loadError) => {
          if (active) setError(loadError.message || t("error"));
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [brokerSearch, lead?.broker, lead?.broker_name, lead?.broker_company, t]);

  function changeField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function saveRequest(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const updated = await updateLead(lead.id, toPayload(form));
      setLead(updated);
      setForm(toForm(updated));
      setNotice(t("saved"));
    } catch (saveError) {
      setError(saveError.message || t("error"));
    } finally {
      setSaving(false);
    }
  }

  async function setIgnored(ignored) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      if (ignored) {
        await ignoreLeadUser(lead.id);
      } else {
        await unignoreLeadUser(lead.id);
      }
      await loadLead();
    } catch (actionError) {
      setError(actionError.message || t("error"));
    } finally {
      setSaving(false);
    }
  }

  async function saveBroker(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const broker = await createBroker(brokerDraft);
      setForm((current) => ({ ...current, broker: broker.id }));
      setBrokerOptions((current) => [broker, ...current.filter((item) => item.id !== broker.id)]);
      setBrokerSearch(broker.name);
      setBrokerDraft({ name: "", phone: "", company: "" });
      setShowBrokerForm(false);
      setNotice(t("brokerAdded"));
    } catch (saveError) {
      setError(saveError.message || t("error"));
    } finally {
      setSaving(false);
    }
  }

  async function saveEstate() {
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...estateForm,
        broker: estateForm.broker ? Number(estateForm.broker) : null,
        owner: estateForm.owner ? Number(estateForm.owner) : null,
        price: estateForm.price === "" ? null : Number(estateForm.price),
        bedrooms: estateForm.bedrooms === "" ? null : Number(estateForm.bedrooms),
        bathrooms: estateForm.bathrooms === "" ? null : Number(estateForm.bathrooms),
      };
      const estate = await createEstateFromLead(lead.id, payload);
      setLead((current) => ({ ...current, estate_id: estate.id, estate_slug: estate.slug }));
      setShowEstateForm(false);
      setNotice(t("estateCreated"));
    } catch (saveError) {
      setError(saveError.message || t("error"));
    } finally {
      setSaving(false);
    }
  }

  function field(label, name, type = "text", options = null) {
    const sharedClass =
      "w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]";
    return (
      <label className="block text-sm font-medium text-[var(--foreground)]">
        <span className="mb-1.5 block">{label}</span>
        {options ? (
          <select
            name={name}
            value={form[name]}
            onChange={changeField}
            className={sharedClass}
          >
            {options.map(([value, title]) => (
              <option key={value} value={value}>
                {title}
              </option>
            ))}
          </select>
        ) : (
          <input
            name={name}
            type={type}
            min={type === "number" ? "0" : undefined}
            step={type === "number" && name.includes("price") ? "0.01" : "1"}
            value={form[name]}
            onChange={changeField}
            className={sharedClass}
          />
        )}
      </label>
    );
  }

  if (loading) {
    return (
      <PageShell title={t("requestDetails")}>
        <p className="compact-card text-sm text-[var(--text-muted)]">{t("loading")}</p>
      </PageShell>
    );
  }

  if (!lead || !form) {
    return (
      <PageShell title={t("requestDetails")}>
        <p className="compact-card border-red-200 bg-red-50 text-sm text-red-700">
          {error || t("unknownRequest")}
        </p>
        <Link href="/requests" className="toolbar-button mt-3">
          <ArrowLeft size={16} />
          {t("backToRequests")}
        </Link>
      </PageShell>
    );
  }

  return (
    <PageShell
      eyebrow={t("requestDetails")}
      title={lead.name || t("unknownRequester")}
      description={`${lead.whatsapp_group || lead.source} · ${new Date(lead.created_at).toLocaleString()}`}
      actions={(
        <>
          <Link href="/requests" className="toolbar-button">
            <ArrowLeft size={16} />
            {t("backToRequests")}
          </Link>
          {lead.source === "whatsapp" && (
            <button
              type="button"
              disabled={saving}
              onClick={() => setIgnored(lead.status !== "ignored")}
              className="toolbar-button disabled:opacity-50"
            >
              <UserRoundX size={16} />
              {lead.status === "ignored" ? t("unignoreUser") : t("ignoreUser")}
            </button>
          )}
        </>
      )}
    >

      <div className="mb-3 flex items-center gap-2">
        <span className={`rounded-md px-2 py-1 ${listingIntentBadge(lead.listing_type, t).color}`}>
          {listingIntentBadge(lead.listing_type, t).label}
        </span>
        <span className="text-xs text-[var(--text-muted)]">{t("listingIntent")}</span>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {notice && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          {notice}
        </div>
      )}

      <form
        onSubmit={saveRequest}
        className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm md:p-7"
      >
        <div className="grid gap-5 md:grid-cols-2">
          {field(t("requester"), "name")}
          {field(t("phone"), "phone", "tel")}
          <label className="block text-sm font-medium text-[var(--foreground)]">
            <span className="mb-1.5 block">{t("matchBroker")}</span>
            <input
              value={brokerSearch}
              onChange={(event) => setBrokerSearch(event.target.value)}
              placeholder={t("searchBrokers")}
              className="mb-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]"
            />
            <select
              name="broker"
              value={form.broker}
              onChange={changeField}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]"
            >
              <option value="">{t("noBrokerLinked")}</option>
              {brokerOptions.map((broker) => (
                <option key={broker.id} value={broker.id}>
                  {broker.name}{broker.company ? ` · ${broker.company}` : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowBrokerForm((visible) => !visible)}
              className="mt-2 text-sm font-semibold text-[var(--green)] hover:underline"
            >
              {showBrokerForm ? t("cancel") : t("addBroker")}
            </button>
          </label>
          {lead.status === "ignored" ? (
            <p className="text-sm font-medium text-[var(--foreground)]">
              <span className="mb-1.5 block">{t("requestStatus")}</span>
              <span className="inline-block rounded-full bg-[var(--surface-muted)] px-3 py-2">
                {t("leadStatus_ignored")}
              </span>
            </p>
          ) : field(t("requestStatus"), "status", "text", [
            ["new", t("leadStatus_new")],
            ["contacted", t("leadStatus_contacted")],
            ["matched", t("leadStatus_matched")],
            ["completed", t("leadStatus_completed")],
            ["unavailable", t("leadStatus_unavailable")],
            ["closed", t("leadStatus_closed")],
          ])}
          {field(t("listingType"), "listing_type", "text", [
            ["any", t("any")],
            ["rent", t("forRent")],
            ["sale", t("forSale")],
          ])}
          {field(t("propertyType"), "property_type", "text", [
            ["", t("any")],
            ["apartment", t("apartment")],
            ["house", t("house")],
            ["villa", t("villa")],
            ["land", t("land")],
            ["commercial", t("commercial")],
          ])}
          {field(t("minBedrooms"), "min_bedrooms", "number")}
          {field(t("maxBedrooms"), "max_bedrooms", "number")}
          {field(t("minBathrooms"), "min_bathrooms", "number")}
          {field(t("maxBathrooms"), "max_bathrooms", "number")}
          {field(t("minBudget"), "min_price", "number")}
          {field(t("maxBudget"), "max_price", "number")}
          {field(t("currency"), "budget_currency")}
          {field(t("preferredLocation"), "preferred_location")}
          {field(t("furnishing"), "furnishing", "text", [
            ["", t("any")],
            ["furnished", t("furnishing_furnished")],
            ["unfurnished", t("furnishing_unfurnished")],
          ])}
          <label className="block text-sm font-medium text-[var(--foreground)]">
            <span className="mb-1.5 block">{t("city")}</span>
            <select
              name="city"
              value={form.city}
              onChange={changeField}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]"
            >
              <option value="">—</option>
              {form.city && !DOMINICAN_CITIES.includes(form.city) && <option value={form.city}>{form.city}</option>}
              {DOMINICAN_CITIES.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-[var(--foreground)]">
            <span className="mb-1.5 block">{t("province")}</span>
            <select
              name="province"
              value={form.province}
              onChange={changeField}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]"
            >
              <option value="">—</option>
              {form.province && !DOMINICAN_PROVINCES.includes(form.province) && <option value={form.province}>{form.province}</option>}
              {DOMINICAN_PROVINCES.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-[var(--foreground)] md:col-span-2">
            <span className="mb-1.5 block">{t("requestNotes")}</span>
            <textarea
              name="notes"
              rows={5}
              value={form.notes}
              onChange={changeField}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]"
            />
          </label>
        </div>

        {lead.source_sender && (
          <p className="mt-5 text-sm text-[var(--text-muted)]">
            {t("senderName")}: <span className="font-medium text-[var(--foreground)]">{lead.source_sender}</span>
          </p>
        )}

        {lead.attachments?.length > 0 && (
          <div className="mt-5 border-t border-[var(--border)] pt-4">
            <h2 className="mb-2 text-sm font-semibold">{t("media")}</h2>
            <div className="flex flex-wrap gap-3">
              {lead.attachments.map((attachment) => (
                <a
                  key={attachment.url}
                  href={attachment.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-[var(--green)] hover:underline"
                >
                  {attachment.name}
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--green)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            <Save size={17} />
            {saving ? t("saving") : t("saveChanges")}
          </button>
        </div>
      </form>

      {showBrokerForm && (
        <form
          onSubmit={saveBroker}
          className="mt-5 grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 md:grid-cols-4"
        >
          <h2 className="font-semibold md:col-span-4">{t("newBroker")}</h2>
          {["name", "phone", "company"].map((name) => (
            <input
              key={name}
              required={name === "name"}
              value={brokerDraft[name]}
              onChange={(event) => setBrokerDraft({ ...brokerDraft, [name]: event.target.value })}
              placeholder={t(name === "name" ? "brokerName" : name === "phone" ? "phone" : "company")}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
            />
          ))}
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-[var(--green)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {t("saveBroker")}
          </button>
        </form>
      )}

      <section className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm md:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{t("estateFromRequest")}</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{t("estateFromRequestDescription")}</p>
          </div>
          {lead.estate_slug ? (
            <Link href={`/estates/${lead.estate_slug}`} className="font-semibold text-[var(--green)] hover:underline">
              {t("viewCreatedEstate")}
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setShowEstateForm((visible) => !visible)}
              className="rounded-lg bg-[var(--green)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              {showEstateForm ? t("cancel") : t("createEstate")}
            </button>
          )}
        </div>
        {showEstateForm && estateForm && (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {[
              ["title", t("estateTitle"), "text"],
              ["property_type", t("propertyType"), "select"],
              ["listing_type", t("listingType"), "listing"],
              ["price", t("price"), "number"],
              ["currency", t("currency"), "text"],
              ["bedrooms", t("bedrooms"), "number"],
              ["bathrooms", t("bathrooms"), "number"],
              ["address", t("address"), "text"],
              ["city", t("city"), "text"],
              ["province", t("province"), "text"],
              ["owner", t("owner"), "owner"],
            ].map(([name, label, type]) => (
              <label key={name} className="block text-sm font-medium text-[var(--foreground)]">
                <span className="mb-1.5 block">{label}</span>
                {type === "owner" ? (
                  <select
                    value={estateForm[name] || ""}
                    onChange={(event) => setEstateForm({ ...estateForm, [name]: event.target.value })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                  >
                    <option value="">{t("noOwnerLinked")}</option>
                    {ownerOptions.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}
                  </select>
                ) : type === "city" || type === "province" ? (
                  <select
                    value={estateForm[name] || ""}
                    onChange={(event) => setEstateForm({ ...estateForm, [name]: event.target.value })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                  >
                    <option value="">—</option>
                    {estateForm[name] && !(type === "city" ? DOMINICAN_CITIES : DOMINICAN_PROVINCES).includes(estateForm[name]) && <option value={estateForm[name]}>{estateForm[name]}</option>}
                    {(type === "city" ? DOMINICAN_CITIES : DOMINICAN_PROVINCES).map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                ) : type === "select" || type === "listing" ? (
                  <select
                    value={estateForm[name]}
                    onChange={(event) => setEstateForm({ ...estateForm, [name]: event.target.value })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                  >
                    {(type === "select"
                      ? ["apartment", "house", "villa", "land", "commercial"]
                      : ["sale", "rent"]
                    ).map((option) => (
                      <option key={option} value={option}>
                        {t(type === "listing" ? `listing_${option}` : option)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={type}
                    min={type === "number" ? "0" : undefined}
                    step={name === "price" ? "0.01" : "1"}
                    value={estateForm[name]}
                    onChange={(event) => setEstateForm({ ...estateForm, [name]: event.target.value })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                  />
                )}
              </label>
            ))}
            <label className="block text-sm font-medium text-[var(--foreground)] md:col-span-2">
              <span className="mb-1.5 block">{t("description")}</span>
              <textarea
                rows={4}
                value={estateForm.description}
                onChange={(event) => setEstateForm({ ...estateForm, description: event.target.value })}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
              />
            </label>
            <button
              type="button"
              disabled={saving || !estateForm.title}
              onClick={saveEstate}
              className="rounded-lg bg-[var(--green)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 md:col-span-2 md:justify-self-end"
            >
              {saving ? t("saving") : t("createEstateAsDraft")}
            </button>
          </div>
        )}
      </section>
    </PageShell>
  );
}
