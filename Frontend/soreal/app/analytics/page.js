"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  fetchAnalyticsSummary,
  fetchAnalyticsPriceTrends,
  fetchAnalyticsRequestVolume,
  fetchAnalyticsConversionFunnel,
  fetchAnalyticsCategoryStats,
  fetchAnalyticsLocationStats,
  fetchAnalyticsUnitStatus,
} from "@/lib/api";
import { useTranslation } from "@/app/components/LanguageProvider";

function StatCard({ title, value, subtitle, trend }) {
  const { t } = useTranslation();
  return (
    <div className="bg-white border rounded-lg p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
          {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
        </div>
        {trend !== undefined && (
          <div className="text-right">
            <p className={`text-sm font-bold ${trend >= 0 ? "text-green-600" : "text-red-600"}`}>
              {trend >= 0 ? "+" : ""}{trend}%
            </p>
            <p className="text-xs text-gray-400">vs last period</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SparklineChart({ data, height = 80, label }) {
  const { t } = useTranslation();
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

function BarChart({ data, label, valueKey = "count", height = 200 }) {
  const { t } = useTranslation();
  if (!data || data.length === 0) return null;

  const max = Math.max(...data.map((d) => d[valueKey])) || 1;

  return (
    <div className="mt-4">
      <p className="text-xs text-gray-500 mb-2">{label}</p>
      <div className="flex items-end justify-between gap-2 h-[180px]">
        {data.map((item) => {
          const pct = ((item[valueKey] / max) * 100).toFixed(0);
          const label =
            item.city || item.property_type || item.date || item.stage || "";
          return (
            <div key={label} className="flex flex-col items-center">
              <div
                className="bg-indigo-600 rounded-t"
                style={{ height: `${pct}%`, width: "32px" }}
              />
              <span className="text-xs text-gray-500 mt-1 truncate w-full text-center">
                {label.length > 12 ? label.slice(0, 12) + "…" : label}
              </span>
              <span className="text-xs font-bold">{item[valueKey]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState(null);
  const [priceTrends, setPriceTrends] = useState([]);
  const [requestVolume, setRequestVolume] = useState([]);
  const [conversionFunnel, setConversionFunnel] = useState([]);
  const [categoryStats, setCategoryStats] = useState([]);
  const [locationStats, setLocationStats] = useState([]);
  const [unitStatus, setUnitStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("6m");

  useEffect(() => {
    loadData();
  }, [period]);

  async function loadData() {
    setLoading(true);
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
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="p-6">{t("loading")}</div>;

  const avgPrice =
    priceTrends.length > 0
      ? priceTrends[priceTrends.length - 1].avg_price
      : 0;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{t("analytics")}</h1>
        <div className="flex gap-2">
          {["1m", "3m", "6m", "1y"].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded text-sm ${
                period === p
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {t(`last${p === "1m" ? "Month" : p === "3m" ? "3Months" : p === "6m" ? "6Months" : "Year"}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title={t("totalProperties")}
          value={summary?.total_properties || 0}
          subtitle={t("availableUnits")}
        />
        <StatCard
          title={t("totalInquiries")}
          value={summary?.total_inquiries || 0}
          trend={5}
        />
        <StatCard
          title={t("totalLeads")}
          value={summary?.total_leads || 0}
          trend={12}
        />
        <StatCard
          title={t("totalApplications")}
          value={summary?.total_applications || 0}
          trend={-3}
        />
      </div>

      {/* Price Trends + Request Volume */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white border rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-bold mb-4">{t("priceTrends")}</h3>
          <div className="text-right text-2xl font-bold text-gray-900 mb-4">
            ${avgPrice.toLocaleString()}
          </div>
          <SparklineChart
            data={priceTrends.map((d, i) => ({ value: d.avg_price, label: d.date }))}
            label={t("avgPriceTrend", {}, {})}
          />
        </div>
        <div className="bg-white border rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-bold mb-4">{t("requestVolume")}</h3>
          <BarChart
            data={requestVolume.map((d, i) => ({ value: d.inquiries + d.leads, label: d.date }))}
            label={t("inquiriesAndLeads", {}, {})}
          />
        </div>
      </div>

      {/* Conversion Funnel + Category Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white border rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-bold mb-4">{t("conversionFunnel")}</h3>
          <div className="space-y-3">
            {conversionFunnel.map((stage, i) => {
              const pct = stage.conversion_rate;
              return (
                <div key={stage.stage}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{stage.stage}</span>
                    <span>{stage.count}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-indigo-600 rounded-full h-2"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500">
                    {pct.toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="bg-white border rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-bold mb-4">{t("categoryStats")}</h3>
          <BarChart
            data={categoryStats.map((d) => ({ value: d.count, label: d.property_type }))}
            label={t("propertiesByType", {}, {})}
          />
        </div>
      </div>

      {/* Location Stats + Unit Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-bold mb-4">{t("locationStats")}</h3>
          <BarChart
            data={locationStats.map((d) => ({ value: d.count, label: d.city }))}
            label={t("propertiesByLocation", {}, {})}
          />
        </div>
        <div className="bg-white border rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-bold mb-4">{t("unitStatus")}</h3>
          <div className="space-y-3">
            {unitStatus?.by_status.map((s) => (
              <div key={s.status}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{t(s.status, {}, {}) || s.status}</span>
                  <span>{s.count}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-indigo-600 rounded-full h-2"
                    style={{ width: `${s.percentage}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500">
                  {s.percentage.toFixed(1)}%
                </span>
              </div>
            ))}
            <div className="mt-3 pt-3 border-t">
              <div className="flex justify-between text-sm font-bold">
                <span>{t("totalUnits", {}, {})}</span>
                <span>{unitStatus?.total_units || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
