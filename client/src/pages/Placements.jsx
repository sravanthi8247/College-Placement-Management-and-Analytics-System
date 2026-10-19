
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout";
import PlacementForm from "../components/PlacementForm";
import {
  getPlacements,
  deletePlacement,
  updatePlacement,
} from "../services/placementService";
import { useAuth } from "../context/AuthContext";
import "../styles/data-table.css";
import "./Placements.css";

function Placements() {
  const location = useLocation();
  const [placements, setPlacements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPlacement, setSelectedPlacement] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const { isAdmin } = useAuth();

  const fetchPlacements = async () => {
    try {
      setError("");
      const data = await getPlacements();
      setPlacements(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching placements:", err);
      setError("Unable to load placement records. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlacements();
  }, [location.key]);

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this placement?")) {
      return;
    }

    try {
      await deletePlacement(id);
      setPlacements((previous) =>
        previous.filter((placement) => placement._id !== id)
      );

      if (selectedPlacement?._id === id) {
        setSelectedPlacement(null);
      }
    } catch (err) {
      console.error("Error deleting placement:", err);
      window.alert("Failed to delete placement. Please try again.");
    }
  };

  const handleEdit = (placement) => {
    setSelectedPlacement(placement);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleUpdate = async (updatedData) => {
    if (!selectedPlacement?._id) return;

    try {
      await updatePlacement(selectedPlacement._id, updatedData);
      setSelectedPlacement(null);
      setSearch("");
      setStatusFilter("All");
      await fetchPlacements();
      window.alert("Placement updated successfully!");
    } catch (err) {
      console.error("Error updating placement:", err);
      const message =
        err.response?.data?.message || "Failed to update placement. Please try again.";
      window.alert(message);
      throw err;
    }
  };

  const formatDate = (date) => {
    if (!date) return "Not scheduled";

    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) return "Not scheduled";

    const day = String(parsedDate.getUTCDate()).padStart(2, "0");
    const month = String(parsedDate.getUTCMonth() + 1).padStart(2, "0");
    const year = parsedDate.getUTCFullYear();

    return `${day}-${month}-${year}`;
  };

  const getStatusClass = (status) => {
    switch (String(status ?? "").toLowerCase()) {
      case "selected":
        return "placements-status-selected";
      case "pending":
        return "placements-status-pending";
      case "rejected":
        return "placements-status-rejected";
      default:
        return "placements-status-other";
    }
  };

  const filteredPlacements = useMemo(() => {
    const query = search.trim().toLowerCase();

    return placements.filter((placement) => {
      const matchesSearch = [
        placement.student?.name,
        placement.company?.companyName,
        placement.status,
      ].some((value) =>
        String(value ?? "").toLowerCase().includes(query)
      );

      const matchesStatus =
        statusFilter === "All" ||
        String(placement.status ?? "").toLowerCase() ===
          statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [placements, search, statusFilter]);

  const selectedCount = placements.filter(
    (placement) =>
      String(placement.status ?? "").toLowerCase() === "selected"
  ).length;

  const pendingCount = placements.filter(
    (placement) =>
      String(placement.status ?? "").toLowerCase() === "pending"
  ).length;

  const rejectedCount = placements.filter(
    (placement) =>
      String(placement.status ?? "").toLowerCase() === "rejected"
  ).length;

  const selectionRate = placements.length
    ? Math.round((selectedCount / placements.length) * 100)
    : 0;

  return (
    <AppLayout title="Placement Management" eyebrow="Admin / Placements">
      <main className="placements-main">
        <header className="placements-heading">
          <div>
            <p className="placements-eyebrow">PLACEMENT MANAGEMENT</p>
            <h1>Placement Management</h1>
            <p className="placements-subtitle">
              Track student selections, company offers, and placement outcomes.
            </p>
          </div>

        </header>

        {error && (
          <div className="placements-error-banner" role="alert">
            <span>{error}</span>
            <button
              type="button"
              className="placements-retry-btn"
              onClick={fetchPlacements}
            >
              ↻ Retry
            </button>
          </div>
        )}

        <section className="placements-stats">
          <article className="placements-stat-card">
            <div className="placements-stat-icon placements-blue">▦</div>
            <div>
              <p>Total Records</p>
              <h2>{placements.length}</h2>
              <span>Placement entries</span>
            </div>
          </article>

          <article className="placements-stat-card">
            <div className="placements-stat-icon placements-green">✓</div>
            <div>
              <p>Selected</p>
              <h2>{selectedCount}</h2>
              <span>Selection confirmed</span>
            </div>
          </article>

          <article className="placements-stat-card">
            <div className="placements-stat-icon placements-orange">◷</div>
            <div>
              <p>Pending</p>
              <h2>{pendingCount}</h2>
              <span>Awaiting an outcome</span>
            </div>
          </article>

          <article className="placements-stat-card">
            <div className="placements-stat-icon placements-purple">%</div>
            <div>
              <p>Selection Rate</p>
              <h2>{selectionRate}%</h2>
              <span>Selected records / total records</span>
            </div>
          </article>
        </section>

        {isAdmin ? (
          <section className="placements-form-panel">
            <div className="placements-section-heading">
              <div>
                <h2>
                  {selectedPlacement ? "Edit Placement" : "Add a Placement"}
                </h2>
                <p>
                  {selectedPlacement
                    ? "Update the selected placement record."
                    : "Record a student's placement outcome."}
                </p>
              </div>

              {selectedPlacement && (
                <button
                  type="button"
                  className="placements-cancel"
                  onClick={() => setSelectedPlacement(null)}
                >
                  Cancel edit
                </button>
              )}
            </div>

            <PlacementForm
              onPlacementAdded={fetchPlacements}
              selectedPlacement={selectedPlacement}
              onUpdatePlacement={handleUpdate}
            />
          </section>
        ) : (
          <div className="placements-readonly">
            <span>ⓘ</span>
            You have read-only access. Only administrators can add, edit, or
            delete placement records.
          </div>
        )}

        <section className="placements-table-panel">
          <div className="placements-table-title">
            <h2>Placement Records</h2>
            <p>
              Showing {filteredPlacements.length} of {placements.length} records
            </p>
          </div>

          <div className="placements-toolbar">
            <div className="placements-search">
              <span aria-hidden="true">⌕</span>
              <input
                type="search"
                aria-label="Search placements"
                placeholder="Search by student, company or status..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <select
              className="placements-status-filter"
              aria-label="Filter by placement status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="All">All statuses</option>
              <option value="Selected">Selected</option>
              <option value="Pending">Pending</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          {loading ? (
            <div className="placements-message">
              <div className="placements-loader" />
              <p>Loading placement records...</p>
            </div>
          ) : error ? (
            <div className="placements-message placements-error">
              <p>{error}</p>
              <button type="button" onClick={fetchPlacements}>
                Try again
              </button>
            </div>
          ) : (
            <div className="placements-table-scroll">
              <table className="placements-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Company</th>
                    <th>Package</th>
                    <th>Placement Date</th>
                    <th>Status</th>
                    {isAdmin && <th>Actions</th>}
                  </tr>
                </thead>

                <tbody>
                  {filteredPlacements.length === 0 ? (
                    <tr>
                      <td
                        colSpan={isAdmin ? 6 : 5}
                        className="placements-empty"
                      >
                        <div className="placements-empty-icon">⌕</div>
                        <strong>No placements found</strong>
                        <p>
                          Try changing your search or status filter.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredPlacements.map((placement) => (
                      <tr key={placement._id}>
                        <td>
                          <div className="placements-person">
                            <div className="placements-avatar">
                              {String(placement.student?.name || "S")
                                .trim()
                                .charAt(0)
                                .toUpperCase()}
                            </div>
                            <strong>
                              {placement.student?.name || "N/A"}
                            </strong>
                          </div>
                        </td>

                        <td>{placement.company?.companyName || "N/A"}</td>

                        <td>
                          {placement.packageOffered == null ||
                          placement.packageOffered === ""
                            ? "—"
                            : `${placement.packageOffered} LPA`}
                        </td>

                        <td>
                          <span className="placements-date">
                            {formatDate(placement.placementDate)}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`placements-status ${getStatusClass(
                              placement.status
                            )}`}
                          >
                            <span className="placements-status-dot" />
                            {placement.status || "Not specified"}
                          </span>
                        </td>

                        {isAdmin && (
                          <td>
                            <div className="placements-actions">
                              <button
                                type="button"
                                className="placements-edit-btn"
                                onClick={() => handleEdit(placement)}
                                aria-label={`Edit placement for ${
                                  placement.student?.name || "student"
                                }`}
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                className="placements-delete-btn"
                                onClick={() => handleDelete(placement._id)}
                                aria-label={`Delete placement for ${
                                  placement.student?.name || "student"
                                }`}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="placements-footer">
          Placement Portal
        </footer>
      </main>
    </AppLayout>
  );
}

export default Placements;
