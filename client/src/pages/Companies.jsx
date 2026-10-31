
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import CompanyForm from "../components/CompanyForm";
import AppLayout from "../components/layout/AppLayout";
import {
  getCompanies,
  deleteCompany,
  updateCompany,
  getEligibleStudents,
} from "../services/companyService";
import { useAuth } from "../context/AuthContext";
import "../styles/data-table.css";
import "./Companies.css";

function Companies() {
  const location = useLocation();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [eligiblePanel, setEligiblePanel] = useState(null);
  const [onlyEligible, setOnlyEligible] = useState(false);

  const { isAdmin } = useAuth();

  const fetchCompanies = async () => {
    try {
      setError("");
      const data = await getCompanies();
      setCompanies(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching companies:", err);
      setError("Unable to load company records. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, [location.key]);

  const handleDelete = async (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this company?"
    );

    if (!confirmed) return;

    try {
      await deleteCompany(id);

      setCompanies((previous) =>
        previous.filter((company) => company._id !== id)
      );

      if (selectedCompany?._id === id) {
        setSelectedCompany(null);
      }
    } catch (err) {
      console.error("Error deleting company:", err);
      window.alert("Failed to delete company. Please try again.");
    }
  };

  const handleEdit = (company) => {
    setSelectedCompany(company);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleUpdate = async (updatedData) => {
    if (!selectedCompany?._id) return;

    try {
      await updateCompany(selectedCompany._id, updatedData);
      setSelectedCompany(null);
      setSearch("");
      await fetchCompanies();
      window.alert("Company updated successfully!");
    } catch (err) {
      console.error("Error updating company:", err);
      window.alert("Failed to update company. Please try again.");
    }
  };

  const formatDate = (date) => {
    if (!date) return "Not scheduled";

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "Not scheduled";
    }

    const day = String(parsedDate.getUTCDate()).padStart(2, "0");
    const month = String(parsedDate.getUTCMonth() + 1).padStart(2, "0");
    const year = parsedDate.getUTCFullYear();

    return `${day}-${month}-${year}`;
  };

  const filteredCompanies = useMemo(() => {
    const query = search.trim().toLowerCase();

    return companies.filter((company) => {
      const matchesStatus =
        statusFilter === "All" ||
        (company.driveStatus || "Open") === statusFilter;

      const matchesSearch = [
        company.companyName,
        company.location,
        company.jobRole,
        company.driveStatus,
        company.description,
        ...(Array.isArray(company.eligibleBranches)
          ? company.eligibleBranches
          : []),
        ...(Array.isArray(company.eligibleYears)
          ? company.eligibleYears
          : []),
        ...(Array.isArray(company.requiredSkills)
          ? company.requiredSkills
          : []),
      ].some((value) =>
        String(value ?? "").toLowerCase().includes(query)
      );

      return matchesStatus && matchesSearch;
    });
  }, [companies, search, statusFilter]);

  const upcomingDrives = companies.filter((company) => {
    if (!company.driveDate) return false;

    const driveDate = new Date(company.driveDate);

    if (Number.isNaN(driveDate.getTime())) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return driveDate >= today;
  }).length;

  const jobRoleCount = new Set(
    companies
      .map((company) =>
        String(company.jobRole ?? "").trim().toLowerCase()
      )
      .filter(Boolean)
  ).size;

  const packageValues = companies
    .map((company) => {
      const value = Number.parseFloat(
        String(company.packageOffered ?? "").replace(/,/g, "")
      );

      return Number.isFinite(value) && value >= 0 ? value : null;
    })
    .filter((value) => value !== null);

  const averagePackage = packageValues.length
    ? (
        packageValues.reduce((total, value) => total + value, 0) /
        packageValues.length
      ).toFixed(1)
    : null;

  const handleEligible = async (company) => {
    try {
      const data = await getEligibleStudents(company._id);
      setEligiblePanel(data);
    } catch (err) {
      window.alert(err.response?.data?.message || "Unable to load eligible students.");
    }
  };

  return (
    <AppLayout title="Company Management" eyebrow="Admin / Companies">
      <main className="companies-main">
        <header className="companies-heading">
          <div>
            <p className="companies-eyebrow">
              PLACEMENT MANAGEMENT
            </p>

            <h1>Company Management</h1>

            <p className="companies-subtitle">
              Manage recruiting companies, job opportunities and
              campus drive dates.
            </p>
          </div>

        </header>

        {error && (
          <div className="companies-error-banner" role="alert">
            <span>{error}</span>
            <button
              type="button"
              className="companies-retry-btn"
              onClick={fetchCompanies}
            >
              ↻ Retry
            </button>
          </div>
        )}

        <section className="companies-stats">
          <article className="companies-stat-card">
            <div className="companies-stat-icon companies-blue">
              ▦
            </div>

            <div>
              <p>Total Companies</p>
              <h2>{companies.length}</h2>
              <span>Company records</span>
            </div>
          </article>

          <article className="companies-stat-card">
            <div className="companies-stat-icon companies-green">
              ↗
            </div>

            <div>
              <p>Upcoming Drives</p>
              <h2>{upcomingDrives}</h2>
              <span>Scheduled for today or later</span>
            </div>
          </article>

          <article className="companies-stat-card">
            <div className="companies-stat-icon companies-purple">
              ⌘
            </div>

            <div>
              <p>Job Roles</p>
              <h2>{jobRoleCount}</h2>
              <span>Distinct role names</span>
            </div>
          </article>

          <article className="companies-stat-card">
            <div className="companies-stat-icon companies-orange">
              ₹
            </div>

            <div>
              <p>Average Package</p>
              <h2>
                {averagePackage === null ? "—" : averagePackage}
              </h2>

              <span>
                {averagePackage === null
                  ? "Package data unavailable"
                  : "LPA, based on numeric values"}
              </span>
            </div>
          </article>
        </section>

        {isAdmin ? (
          <section className="companies-form-panel">
            <div className="companies-section-heading">
              <div>
                <h2>
                  {selectedCompany ? "Edit Company" : "Add a Company"}
                </h2>

                <p>
                  {selectedCompany
                    ? "Update the selected company's details."
                    : "Add a recruiting company and its drive information."}
                </p>
              </div>

              {selectedCompany && (
                <button
                  type="button"
                  className="companies-cancel"
                  onClick={() => setSelectedCompany(null)}
                >
                  Cancel edit
                </button>
              )}
            </div>

            <CompanyForm
              onCompanyAdded={fetchCompanies}
              selectedCompany={selectedCompany}
              onUpdateCompany={handleUpdate}
            />
          </section>
        ) : (
          <div className="companies-readonly">
            <span>ⓘ</span>
            You have read-only access. Only administrators can add,
            edit, or delete company records.
          </div>
        )}

        <section className="companies-table-panel">
          <div className="companies-table-title">
            <h2>Company Directory</h2>
            <p>
              Showing {filteredCompanies.length} of {companies.length} companies
            </p>
          </div>

          <div className="companies-toolbar">
            <div className="companies-search">
              <span aria-hidden="true">⌕</span>

              <input
                type="search"
                aria-label="Search companies"
                placeholder="Search company, location, role, skills..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <select
              aria-label="Filter by drive status"
              className="companies-status-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="All">All statuses</option>
              <option value="Open">Open</option>
              <option value="Closed">Closed</option>
              <option value="Completed">Completed</option>
            </select>
          </div>

          {loading ? (
            <div className="companies-message">
              <div className="companies-loader" />
              <p>Loading company records...</p>
            </div>
          ) : error ? (
            <div className="companies-message companies-error">
              <p>{error}</p>

              <button type="button" onClick={fetchCompanies}>
                Try again
              </button>
            </div>
          ) : (
            <div className="companies-table-scroll">
              <table className="companies-table">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Package (LPA)</th>
                    <th>Location</th>
                    <th>Job Role</th>
                    <th>Minimum CGPA</th>
                    <th>Eligible Branches</th>
                    <th>Eligible Years</th>
                    <th>Required Skills</th>
                    <th>Application Deadline</th>
                    <th>Recruitment Drive Date</th>
                    <th>Drive Status</th>
                    <th>Description</th>
                    {isAdmin && <th>Actions</th>}
                  </tr>
                </thead>

                <tbody>
                  {filteredCompanies.length === 0 ? (
                    <tr>
                      <td
                        colSpan={isAdmin ? 13 : 12}
                        className="companies-empty"
                      >
                        <div className="companies-empty-icon">
                          ⌕
                        </div>

                        <strong>No companies found</strong>

                        <p>
                          Try another search, or add a company if you
                          are an admin.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredCompanies.map((company) => (
                      <tr key={company._id}>
                        <td>
                          <div className="companies-person">
                            <div className="companies-avatar">
                              {String(company.companyName || "C")
                                .trim()
                                .charAt(0)
                                .toUpperCase()}
                            </div>

                            <strong>
                              {company.companyName || "—"}
                            </strong>
                          </div>
                        </td>

                        <td>{company.packageOffered ?? "—"}</td>
                        <td>{company.location || "—"}</td>
                        <td>{company.jobRole || "—"}</td>
                        <td>{company.eligibilityCGPA ?? "—"}</td>

                        <td>
                          {Array.isArray(company.eligibleBranches) &&
                          company.eligibleBranches.length > 0
                            ? company.eligibleBranches.join(", ")
                            : "All branches"}
                        </td>

                        <td>
                          {Array.isArray(company.eligibleYears) &&
                          company.eligibleYears.length > 0
                            ? company.eligibleYears.join(", ")
                            : "All years"}
                        </td>

                        <td>
                          {Array.isArray(company.requiredSkills) &&
                          company.requiredSkills.length > 0
                            ? company.requiredSkills.join(", ")
                            : "Not specified"}
                        </td>

                        <td>
                          {formatDate(company.applicationDeadline)}
                        </td>

                        <td>
                          <span className="companies-date">
                            {formatDate(company.driveDate)}
                          </span>
                        </td>

                        <td>
                          <span className="companies-date">
                            {company.driveStatus || "Open"}
                          </span>
                        </td>

                        <td>
                          {company.description || "—"}
                        </td>

                        {isAdmin && (
                          <td>
                            <div className="companies-actions">
                              <button
                                type="button"
                                className="companies-edit-btn"
                                onClick={() => handleEdit(company)}
                                aria-label={`Edit ${company.companyName}`}
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                className="companies-delete-btn"
                                onClick={() =>
                                  handleDelete(company._id)
                                }
                                aria-label={`Delete ${company.companyName}`}
                              >
                                Delete
                              </button>
                              <button
                                type="button"
                                className="companies-edit-btn"
                                onClick={() => handleEligible(company)}
                              >
                                Eligible students
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

        {eligiblePanel && (
          <section className="companies-form-panel">
            <div className="companies-section-heading">
              <div>
                <h2>
                  Eligible students for {eligiblePanel.company?.companyName}
                </h2>
                <p>
                  {eligiblePanel.eligibleCount} eligible of {eligiblePanel.students?.length || 0} students
                </p>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={onlyEligible}
                    onChange={(e) => setOnlyEligible(e.target.checked)}
                  />
                  Show eligible only
                </label>
                <button
                  type="button"
                  className="companies-cancel"
                  onClick={() => {
                    setEligiblePanel(null);
                    setOnlyEligible(false);
                  }}
                >
                  Close
                </button>
              </div>
            </div>
            <div className="companies-table-scroll">
              <table className="companies-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Roll No</th>
                    <th>Eligible</th>
                    <th>Reasons</th>
                  </tr>
                </thead>
                <tbody>
                  {(eligiblePanel.students || [])
                    .filter((item) => !onlyEligible || item.eligible)
                    .map((item) => (
                      <tr key={item.student.id}>
                        <td>{item.student.name}</td>
                        <td>{item.student.rollNo}</td>
                        <td>{item.eligible ? "Yes" : "No"}</td>
                        <td>{item.reasons.join(" ") || "—"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <footer className="companies-footer">
          Placement Portal
        </footer>
      </main>
    </AppLayout>
  );
}

export default Companies;
