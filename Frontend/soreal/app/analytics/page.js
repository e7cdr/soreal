"use client";

import { useState, useEffect } from "react";
import {
  fetchAnalyticsSummary,
  fetchAnalyticsPriceTrends,
  fetchAnalyticsRequestVolume,
  fetchAnalyticsConversionFunnel,
  fetchAnalyticsCategoryStats,
  fetchAnalyticsLocationStats,
  fetchAnalyticsUnitStatus,
} from "@/lib/api";
import Link from "next/link";
import { Users, Plus, BarChart3 } from "lucide-react";
import { useTranslation } from "@/app/components/LanguageProvider";
import PageShell from "@/app/components/PageShell";
import StatStrip from "@/app/components/StatStrip";
import { InsightRows } from "@/app/requests/page";

function SparklineChart({ data, height = 80, label }) {
  const { translate: t } = useTranslation();
  if (!data || data.length === 0) return null;

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = data
    .map((d, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 100 - ((d.value - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="mt-4">
      <p className="text-xs text-gray-500 mb-2">{label}</p>
      <svg
        width="100%"
        height={height}
        viewBox="0 0 100 100"
        fill="none"
      >
        <polyline
          points={points}
          stroke="rgb(99 102 241)"
          strokeWidth="2"
          fill="none"
        />
        <rect
          x="0"
          y="95"
          width="100"
          height="1"
          stroke="rgb(229 231 235)"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
}

function BarChart({ data, label, valueKey = "count", height = 140 }) {
  const { translate: t } = useTranslation();
  if (!data || data.length === 0) return null;

  const max = Math.max(...data.map((d) => d[valueKey] ?? d.value ?? 0)) || 1;

  return (
    <div>
      <p className="mb-2 text-xs text-gray-500">{label}</p>
      <div className="flex items-end justify-between gap-2" style={{ height }}>
        {data.map((item) => {
          const value = item[valueKey] ?? item.value ?? 0;
          const label =
            item.label || item.city || item.property_type || item.date || item.stage || "";
          return (
            <div key={`${label}-${value}`} className="flex flex-col items-center">
              <div
                className="bg-indigo-600 rounded-t"
                style={{ height: `${Math.max(3, (value / max) * 100)}%`, width: "32px" }}
              />
              <span className="text-xs text-gray-500 mt-1 truncate w-full text-center">
                {label.length > 12 ? label.slice(0, 12) + "…" : label}
              </span>
              <span className="text-xs font-bold">{value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { translate: t } = useTranslation();
  const [summary, setSummary] = useState(null);
  const [priceTrends, setPriceTrends] = useState([]);
  const [requestVolume, setRequestVolume] = useState([]);
  const [conversionFunnel, setConversionFunnel] = useState([]);
  const [categoryStats, setCategoryStats] = useState([]);
  const [locationStats, setLocationStats] = useState([]);
  const [unitStatus, setUnitStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState("6m");

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [summaryRes, trendsRes, volumeRes, funnelRes, categoryRes, locationRes, unitRes] =
        await Promise.all([
          fetchAnalyticsSummary(),
          fetchAnalyticsPriceTrends({ period }),
          fetchAnalyticsRequestVolume({ period }),
          fetchAnalyticsConversionFunnel(),
          fetchAnalyticsCategoryStats(),
          fetchAnalyticsLocationStats(),
          fetchAnalyticsUnitStatus(),
        ]);
      setSummary(summaryRes);
      setPriceTrends(trendsRes);
      setRequestVolume(volumeRes);
      setConversionFunnel(funnelRes);
      setCategoryStats(categoryRes);
      setLocationStats(locationRes);
      setUnitStatus(unitRes);
    } catch (err) {
      setError(err.message || t("error"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [period]);

  const avgPrice =
    priceTrends.length > 0
      ? priceTrends[priceTrends.length - 1].avg_price
      : 0;

  return (
    <PageShell
      title={t("analytics")}
      actions={(
        <div className="toolbar-segmented" aria-label={t("analytics")}>
          {["1m", "3m", "6m", "1y"].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`toolbar-tab ${period === p ? "toolbar-tab-active" : ""}`}
            >
              {t(`last${p === "1m" ? "Month" : p === "3m" ? "3Months" : p === "6m" ? "6Months" : "Year"}`)}
            </button>
          ))}
        </div>
      )}
    >
      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="compact-card text-center text-sm text-[var(--text-muted)]">
          {t("loading")}
        </div>
      ) : summary?.total_properties === 0 && summary?.total_leads === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-10 text-center space-y-3">
          <Users className="mx-auto mb-3 text-[var(--text-muted)]" size={36} />
          <h2 className="font-semibold">{t("analyticsEmptyTitle")}</h2>
          <p className="text-xs text-[var(--text-muted)] max-w-xs mx-auto">{t("analyticsEmptyDescription")}</p>
          <Link href="/estates" className="inline-flex items-center gap-2 rounded-lg bg-[var(--green)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            <Plus size={16} />
            {t("uploadEstates")}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          <StatStrip
            items={[
              {
                label: t("totalProperties"),
                value: summary?.total_properties || 0,
                sub: t("availableUnits"),
              },
              { label: t("totalInquiries"), value: summary?.total_inquiries || 0, sub: "+5% vs last period" },
              { label: t("totalLeads"), value: summary?.total_leads || 0, sub: "+12% vs last period" },
              { label: t("totalApplications"), value: summary?.total_applications || 0, sub: "-3% vs last period" },
            ]}
          />

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div className="compact-card">
              <h3 className="mb-2 text-sm font-semibold">{t("priceTrends")}</h3>
              <div className="mb-2 text-right text-lg font-bold text-[var(--foreground)]">
                ${avgPrice.toLocaleString()}
              </div>
              <SparklineChart
                data={priceTrends.map((d, i) => ({ value: d.avg_price, label: d.date }))}
                label={t("avgPriceTrend")}
                height={92}
              />
            </div>

            <div className="compact-card">
              <h3 className="mb-2 text-sm font-semibold">{t("requestVolume")}</h3>
              <BarChart
                data={requestVolume.map((d, i) => ({ value: d.inquiries + d.leads, label: d.date }))}
                label={t("inquiriesAndLeads")}
                height={132}
              />
            </div>

            <div className="compact-card">
              <h3 className="mb-2 text-sm font-semibold">{t("conversionFunnel")}</h3>
              <div className="space-y-2">
                {conversionFunnel.map((stage) => {
                  const pct = stage.conversion_rate;
                  return (
                    <div key={stage.stage}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span>{stage.stage}</span>
                        <span className="font-semibold">{stage.count}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
                        <div className="h-full rounded-full bg-indigo-600" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] text-gray-500">{pct.toFixed(1)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="compact-card">
              <h3 className="mb-2 text-sm font-semibold">{t("categoryStats")}</h3>
              <BarChart
                data={categoryStats.map((d) => ({ value: d.count, label: d.property_type }))}
                label={t("propertiesByType")}
                height={132}
              />
            </div>

            <div className="compact-card">
              <h3 className="mb-2 text-sm font-semibold">{t("locationStats")}</h3>
              <BarChart
                data={locationStats.map((d) => ({ value: d.count, label: d.city }))}
                label={t("propertiesByLocation")}
                height={132}
              />
            </div>

            <div className="compact-card">
              <h3 className="mb-2 text-sm font-semibold">{t("unitStatus")}</h3>
              <div className="space-y-2">
                {unitStatus?.by_status.map((s) => (
                  <div key={s.status}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span>{t(s.status) || s.status}</span>
                      <span className="font-semibold">{s.count}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
                      <div className="h-full rounded-full bg-indigo-600" style={{ width: `${s.percentage}%` }} />
                    </div>
                    <span className="text-[10px] text-gray-500">{s.percentage.toFixed(1)}%</span>
                  </div>
                ))}
                <div className="mt-2 border-t pt-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span>{t("totalUnits")}</span>
                    <span>{unitStatus?.total_units || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <BarChart3 size={16} className="text-[var(--green)]" />
          {t("requestInsights")}
        </h2>
        <StatStrip
          items={[
            { label: t("totalRequests"), value: summary?.total_leads || 0 },
            { label: t("totalProperties"), value: summary?.total_properties || 0 },
            { label: t("totalInquiries"), value: summary?.total_inquiries || 0 },
          ]}
        />
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="compact-card">
            <h3 className="mb-2 text-sm font-semibold">{t("requestsByType")}</h3>
            <InsightRows
              rows={(summary?.by_property_type || []).map((item) => ({
                label: item.property_type ? t(item.property_type) : t("notSpecified"),
                value: item.count,
              }))}
              emptyLabel={t("noRequestData")}
            />
          </div>
          <div className="compact-card">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">{t("requestsByBedrooms")}</h3>
            <InsightRows
              rows={(summary?.by_bedrooms || []).map((item) => ({
                label: item.bedrooms ? `${item.bedrooms} ${t("bedroomsShort")}` : t("notSpecified"),
                value: item.count,
              }))}
              emptyLabel={t("noRequestData")}
            />
          </div>
          <div className="compact-card">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">{t("topBrokers")}</h3>
            <InsightRows
              rows={(summary?.top_brokers || []).map((broker) => ({
                id: broker.id ?? `broker-${broker.name}`,
                label: `${broker.name}${broker.company ? ` · ${broker.company}` : ""}`,
                value: broker.property_count || broker.request_count || 0,
                subtitle: `${broker.request_count} ${t("requests")}`,
              }))}
              emptyLabel={t("noBrokerData")}
            />
          </div>
        </div>
      </div>
    </PageShell>
  );
}
