"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

export default function ModerationPage() {
  const router = useRouter();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    const userStr = localStorage.getItem("auth_user");

    if (!token) {
      router.push("/login");
      return;
    }

    if (userStr) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUser(JSON.parse(userStr));
    }

    loadSubmissions();
  }, [router]);

  async function loadSubmissions() {
    try {
      const data = await apiFetch("/api/blacklist/submissions/");
      setSubmissions(data.results || []);
    } catch (err) {
      if (err.message?.includes("Authentication credentials were not provided.") || err.message?.includes("Invalid token")) {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("auth_user");
        router.push("/login");
        return;
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id, status, rejectionReason = "") {
    const endpoint =
      status === "approved"
        ? `/api/blacklist/submissions/${id}/approve/`
        : `/api/blacklist/submissions/${id}/reject/`;

    try {
      await apiFetch(endpoint, {
        method: "POST",
        body: JSON.stringify(status === "rejected" ? { rejection_reason: rejectionReason } : {}),
      });
      await loadSubmissions();
    } catch (err) {
      setError(err.message);
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    router.push("/login");
  };

  if (loading) return <div className="p-6">Loading...</div>;

  const statusBadge = (status) => {
    const colors = {
      pending: "bg-yellow-100 text-yellow-800",
      approved: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status]}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Report Moderation</h1>
          <p className="text-gray-600 text-sm">
            Staff: {user?.username || "Unknown"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/blacklist"
            className="text-blue-600 hover:underline text-sm"
          >
            ← Back to Lista Negra
          </Link>
          <button
            onClick={handleLogout}
            className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
          >
            Logout
          </button>
        </div>
      </div>

      {submissions.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No pending submissions.
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b text-left">
              <th className="p-3">ID</th>
              <th className="p-3">Name</th>
              <th className="p-3">ID Number</th>
              <th className="p-3">Category</th>
              <th className="p-3">Location</th>
              <th className="p-3">Submitted</th>
              <th className="p-3">Status</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((s) => (
              <tr key={s.id} className="border-b">
                <td className="p-3 font-mono text-xs">{s.submission_id}</td>
                <td className="p-3">{s.full_name}</td>
                <td className="p-3 text-xs">{s.identification}</td>
                <td className="p-3 text-xs capitalize">{s.category}</td>
                <td className="p-3 text-xs">{s.incident_location}</td>
                <td className="p-3 text-xs text-gray-500">
                  {new Date(s.submitted_at).toLocaleDateString()}
                </td>
                <td className="p-3">{statusBadge(s.status)}</td>
                <td className="p-3">
                  {s.status === "pending" ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateStatus(s.submission_id, "approved")}
                        className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          const reason = prompt("Rejection reason:");
                          if (reason !== null) {
                            updateStatus(s.submission_id, "rejected", reason);
                          }
                        }}
                        className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-500">{s.status}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
