"use client";

import RecordsDirectory from "@/app/components/RecordsDirectory";
import { createBroker, fetchBroker, fetchBrokers, updateBroker } from "@/lib/api";
import { useTranslation } from "@/app/components/LanguageProvider";

export default function BrokersPage() {
  const { translate: t } = useTranslation();
  return <RecordsDirectory title={t("brokers")} singular="broker" loadRecords={fetchBrokers} fetchRecord={fetchBroker} createRecord={createBroker} updateRecord={updateBroker} />;
}
