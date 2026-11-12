"use client";

import RecordsDirectory from "@/app/components/RecordsDirectory";
import { createOwner, fetchOwner, fetchOwners, updateOwner } from "@/lib/api";
import { useTranslation } from "@/app/components/LanguageProvider";

export default function OwnersPage() {
  const { translate: t } = useTranslation();
  return <RecordsDirectory title={t("owners")} singular="owner" includeIdentification loadRecords={fetchOwners} fetchRecord={fetchOwner} createRecord={createOwner} updateRecord={updateOwner} />;
}
