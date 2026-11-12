const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

function getHeaders() {
  const headers = {};

  if (typeof window !== "undefined") {
    const authToken = localStorage.getItem("auth_token");
    const blacklistToken = localStorage.getItem("blacklist_access_token");
    if (authToken) {
      headers.Authorization = `Token ${authToken}`;
    }
    if (blacklistToken) {
      headers["X-Blacklist-Token"] = blacklistToken;
    }
  }

  return headers;
}

export async function apiFetch(path, options = {}) {
  const headers = {
    ...getHeaders(),
    ...options.headers,
  };
  if (
    !(typeof FormData !== "undefined" && options.body instanceof FormData) &&
    !Object.keys(headers).some((name) => name.toLowerCase() === "content-type")
  ) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const missingCredentials =
      response.status === 403 &&
      error.detail === "Authentication credentials were not provided.";
    if (
      (response.status === 401 || missingCredentials) &&
      typeof window !== "undefined"
    ) {
      const returnTo = `${window.location.pathname}${window.location.search}`;
      window.location.assign(`/login?next=${encodeURIComponent(returnTo)}`);
    }
    throw new Error(error.detail || `API error: ${response.status}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

export async function fetchBlacklist(params = {}) {
  const searchParams = new URLSearchParams();
  if (params.q) searchParams.append("q", params.q);
  if (params.status) searchParams.append("status", params.status);
  if (params.category) searchParams.append("category", params.category);
  if (params.date_from) searchParams.append("date_from", params.date_from);
  if (params.date_to) searchParams.append("date_to", params.date_to);
  if (params.page) searchParams.append("page", params.page);
  if (params.ordering) searchParams.append("ordering", params.ordering);

  return apiFetch(`/api/blacklist/persons/?${searchParams.toString()}`);
}

export async function fetchBlacklistStats() {
  return apiFetch("/api/blacklist/persons/stats/");
}

export async function fetchBlacklistPerson(caseId) {
  return apiFetch(`/api/blacklist/persons/${caseId}/`);
}

export async function unlockBlacklist(password) {
  return apiFetch("/api/blacklist/persons/access/", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export async function setAccessToken(token) {
  if (typeof window !== "undefined") {
    localStorage.setItem("blacklist_access_token", token);
  }
}

export async function clearAccessToken() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("blacklist_access_token");
  }
}

export async function submitReport(data) {
  return apiFetch("/api/blacklist/submissions/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function exportBlacklistCSV() {
  const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
  const token = localStorage.getItem("auth_token");
  const response = await fetch(
    `${API_BASE_URL}/api/blacklist/persons/export_csv/`,
    {
      headers: {
        Authorization: `Token ${token}`,
      },
    }
  );
  if (!response.ok) {
    throw new Error("Failed to export CSV");
  }
  return response;
}

export async function submitInquiry(propertyId, data) {
  return apiFetch(`/api/estates/inquiries/`, {
    method: "POST",
    body: JSON.stringify({ property: propertyId, ...data }),
  });
}

// Inquiry screening and applications (staff)
export async function fetchInquiries(params = {}) {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.append("page", params.page);
  if (params.ordering) searchParams.append("ordering", params.ordering);
  return apiFetch(`/api/estates/inquiries/?${searchParams.toString()}`);
}

export async function screenInquiry(inquiryId) {
  return apiFetch(`/api/estates/inquiries/${inquiryId}/screen/`, {
    method: "POST",
  });
}

export async function createApplication(inquiryId) {
  return apiFetch(`/api/estates/inquiries/${inquiryId}/create_application/`, {
    method: "POST",
  });
}

export async function fetchApplications(params = {}) {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.append("page", params.page);
  if (params.ordering) searchParams.append("ordering", params.ordering);
  return apiFetch(`/api/estates/applications/?${searchParams.toString()}`);
}

export async function decideApplication(appId, decision, notes = "") {
  return apiFetch(`/api/estates/applications/${appId}/decide/`, {
    method: "POST",
    body: JSON.stringify({ decision, decision_notes: notes }),
  });
}

// Saved searches
export async function fetchSavedSearches(params = {}) {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.append("page", params.page);
  return apiFetch(`/api/estates/saved-searches/?${searchParams.toString()}`);
}

export async function createSavedSearch(data) {
  return apiFetch(`/api/estates/saved-searches/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function fetchSavedSearchMatches(searchId) {
  return apiFetch(`/api/estates/saved-searches/${searchId}/matches/`);
}

export async function downloadSocialPost(slug) {
  const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
  const token = localStorage.getItem("auth_token");
  const response = await fetch(
    `${API_BASE_URL}/api/estates/properties/${slug}/social-post/`,
    {
      headers: {
        Authorization: `Token ${token}`,
      },
    }
  );
  if (!response.ok) {
    throw new Error("Failed to download social post");
  }
  return response;
}

// Leads (WhatsApp group monitoring)
export async function fetchLeads(params = {}) {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.append("page", params.page);
  if (params.ordering) searchParams.append("ordering", params.ordering);
  if (params.status) searchParams.append("status", params.status);
  if (params.q) searchParams.append("q", params.q);
  if (params.property_type) searchParams.append("property_type", params.property_type);
  if (params.listing_type) searchParams.append("listing_type", params.listing_type);
  if (params.bedrooms) searchParams.append("bedrooms", params.bedrooms);
  if (params.location) searchParams.append("location", params.location);
  return apiFetch(`/api/estates/leads/?${searchParams.toString()}`);
}

function leadQueryString(params = {}) {
  const searchParams = new URLSearchParams();
  for (const key of ["q", "status", "property_type", "listing_type", "bedrooms", "location"]) {
    if (params[key]) searchParams.append(key, params[key]);
  }
  return searchParams.toString();
}


export async function fetchLeadDuplicates() {
  return apiFetch("/api/estates/leads/duplicates/");
}
export async function fetchLeadSummary(params = {}) {
  return apiFetch(`/api/estates/leads/summary/?${leadQueryString(params)}`);
}

export async function downloadLeadExport(format, params = {}) {
  const query = leadQueryString(params);
  const separator = query ? "&" : "";
  const response = await fetch(
    `${API_BASE_URL}/api/estates/leads/export/?${query}${separator}file_format=${encodeURIComponent(format)}`,
    { headers: getHeaders() },
  );
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const missingCredentials =
      response.status === 403 &&
      error.detail === "Authentication credentials were not provided.";
    if (
      (response.status === 401 || missingCredentials) &&
      typeof window !== "undefined"
    ) {
      const returnTo = `${window.location.pathname}${window.location.search}`;
      window.location.assign(`/login?next=${encodeURIComponent(returnTo)}`);
    }
    throw new Error(error.detail || `API error: ${response.status}`);
  }
  return response.blob();
}

export async function createLead(data) {
  return apiFetch(`/api/estates/leads/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function createEstateFromLead(leadId, data) {
  return apiFetch(`/api/estates/leads/${leadId}/create_estate/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function fetchBrokers(params = {}) {
  const searchParams = new URLSearchParams();
  if (params.q) searchParams.append("q", params.q);
  if (params.page) searchParams.append("page", params.page);
  return apiFetch(`/api/estates/brokers/?${searchParams.toString()}`);
}

export async function fetchBroker(brokerId) {
  return apiFetch(`/api/estates/brokers/${brokerId}/`);
}

export async function createBroker(data) {
  return apiFetch("/api/estates/brokers/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateBroker(brokerId, data) {
  return apiFetch(`/api/estates/brokers/${brokerId}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function fetchOwners(params = {}) {
  const searchParams = new URLSearchParams();
  if (params.q) searchParams.append("q", params.q);
  if (params.page) searchParams.append("page", params.page);
  return apiFetch(`/api/estates/owners/?${searchParams.toString()}`);
}

export async function fetchOwner(ownerId) {
  return apiFetch(`/api/estates/owners/${ownerId}/`);
}

export async function createOwner(data) {
  return apiFetch("/api/estates/owners/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateOwner(ownerId, data) {
  return apiFetch(`/api/estates/owners/${ownerId}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function fetchDataQualitySummary() {
  return apiFetch("/api/estates/data-quality/summary/");
}

export async function fetchScanInbox(params = {}) {
  const searchParams = new URLSearchParams();
  if (params.status) searchParams.append("status", params.status);
  if (params.q) searchParams.append("q", params.q);
  if (params.page) searchParams.append("page", params.page);
  return apiFetch(`/api/estates/scan-inbox/?${searchParams.toString()}`);
}

export async function processScanInboxItem(itemId, action, data = {}) {
  return apiFetch(`/api/estates/scan-inbox/${itemId}/${action}/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function fetchLead(leadId) {
  return apiFetch(`/api/estates/leads/${leadId}/`);
}

export async function updateLead(leadId, data) {
  return apiFetch(`/api/estates/leads/${leadId}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function updateLeadStatus(leadId, status) {
  return apiFetch(`/api/estates/leads/${leadId}/`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function ignoreLeadUser(leadId) {
  return apiFetch(`/api/estates/leads/${leadId}/ignore_user/`, {
    method: "POST",
  });
}

export async function unignoreLeadUser(leadId) {
  return apiFetch(`/api/estates/leads/${leadId}/unignore_user/`, {
    method: "POST",
  });
}

export async function fetchLeadMatches(params = {}) {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.append("page", params.page);
  if (params.status) searchParams.append("status", params.status);
  return apiFetch(`/api/estates/lead-matches/?${searchParams.toString()}`);
}

export async function notifyLeadMatch(matchId) {
  return apiFetch(`/api/estates/lead-matches/${matchId}/notify/`, {
    method: "POST",
  });
}

export async function dismissLeadMatch(matchId) {
  return apiFetch(`/api/estates/lead-matches/${matchId}/dismiss/`, {
    method: "POST",
  });
}

export async function fetchLeadLeadMatches(params = {}) {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.append("page", params.page);
  if (params.status) searchParams.append("status", params.status);
  return apiFetch(`/api/estates/lead-lead-matches/?${searchParams.toString()}`);
}

export async function notifyLeadLeadMatch(matchId) {
  return apiFetch(`/api/estates/lead-lead-matches/${matchId}/notify/`, {
    method: "POST",
  });
}

export async function dismissLeadLeadMatch(matchId) {
  return apiFetch(`/api/estates/lead-lead-matches/${matchId}/dismiss/`, {
    method: "POST",
  });
}

export async function fetchPendingMatchCount() {
  const [propRes, leadRes] = await Promise.all([
    apiFetch("/api/estates/lead-matches/pending-count/"),
    apiFetch("/api/estates/lead-lead-matches/pending-count/"),
  ]);
  return (propRes?.pending_count || 0) + (leadRes?.pending_count || 0);
}

export async function fetchEstates(params = {}) {
  const searchParams = new URLSearchParams();
  if (params.q) searchParams.append("q", params.q);
  if (params.property_type)
    searchParams.append("property_type", params.property_type);
  if (params.listing_type)
    searchParams.append("listing_type", params.listing_type);
  if (params.city) searchParams.append("city", params.city);
  if (params.min_price) searchParams.append("min_price", params.min_price);
  if (params.max_price) searchParams.append("max_price", params.max_price);
  if (params.bedrooms) searchParams.append("bedrooms", params.bedrooms);
  if (params.status) searchParams.append("status", params.status);
  if (params.page) searchParams.append("page", params.page);
  if (params.ordering) searchParams.append("ordering", params.ordering);

  return apiFetch(`/api/estates/properties/?${searchParams.toString()}`);
}

export async function fetchEstate(slug) {
  return apiFetch(`/api/estates/properties/${slug}/`);
}

// Projects
export async function fetchProjects(params = {}) {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.append("page", params.page);
  if (params.ordering) searchParams.append("ordering", params.ordering);
  if (params.status) searchParams.append("status", params.status);
  if (params.city) searchParams.append("city", params.city);
  return apiFetch(`/api/estates/projects/?${searchParams.toString()}`);
}

export async function fetchProject(slug) {
  return apiFetch(`/api/estates/projects/${slug}/`);
}

export async function createProject(data) {
  return apiFetch(`/api/estates/projects/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateProject(slug, data) {
  return apiFetch(`/api/estates/projects/${encodeURIComponent(slug)}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function updateEstate(slug, data) {
  return apiFetch(`/api/estates/properties/${encodeURIComponent(slug)}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// Project Units
export async function fetchProjectUnits(params = {}) {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.append("page", params.page);
  if (params.project) searchParams.append("project", params.project);
  if (params.status) searchParams.append("status", params.status);
  return apiFetch(`/api/estates/project-units/?${searchParams.toString()}`);
}

export async function bulkCreateProjectUnits(data) {
  return apiFetch(`/api/estates/project-units/bulk_create/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// Analytics
export async function fetchAnalyticsSummary() {
  return apiFetch(`/api/estates/analytics/`);
}

export async function fetchAnalyticsPriceTrends(params = {}) {
  const searchParams = new URLSearchParams();
  if (params.period) searchParams.append("period", params.period);
  if (params.city) searchParams.append("city", params.city);
  return apiFetch(`/api/estates/analytics/price_trends/?${searchParams.toString()}`);
}

export async function fetchAnalyticsRequestVolume(params = {}) {
  const searchParams = new URLSearchParams();
  if (params.period) searchParams.append("period", params.period);
  return apiFetch(`/api/estates/analytics/request_volume/?${searchParams.toString()}`);
}

export async function fetchAnalyticsConversionFunnel() {
  return apiFetch(`/api/estates/analytics/conversion_funnel/`);
}

export async function fetchAnalyticsCategoryStats() {
  return apiFetch(`/api/estates/analytics/category_stats/`);
}

export async function fetchAnalyticsLocationStats() {
  return apiFetch(`/api/estates/analytics/location_stats/`);
}

export async function fetchAnalyticsUnitStatus(params = {}) {
  const searchParams = new URLSearchParams();
  if (params.project) searchParams.append("project", params.project);
  return apiFetch(`/api/estates/analytics/unit_status/?${searchParams.toString()}`);
}

// WhatsApp chat import
export async function importWhatsAppChat(formData) {
  return apiFetch("/api/estates/whatsapp-import/import_chat/", {
    method: "POST",
    body: formData,
  });
}
