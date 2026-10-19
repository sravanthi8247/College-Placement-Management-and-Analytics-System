import { useEffect, useState, useCallback, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout";
import StudentForm from "../components/StudentForm";
import {
  getStudents,
  deleteStudent,
  updateStudent,
} from "../services/studentService";
import { useAuth } from "../context/AuthContext";
import "../styles/data-table.css";
import "./Students.css";

function Students() {
  const location = useLocation();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);

  // Filters & Search
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [branchFilter, setBranchFilter] = useState("All");
  const [yearFilter, setYearFilter] = useState("All");
  const [minCgpa, setMinCgpa] = useState("");

  // Pagination states
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [globalStats, setGlobalStats] = useState({
    totalStudents: 0,
    placedCount: 0,
    notPlacedCount: 0,
  });
  const [branchesList, setBranchesList] = useState([]);

  const searchTimeoutRef = useRef(null);
  const { isAdmin } = useAuth();

  const fetchStudents = useCallback(
    async () => {
      setLoading(true);
      setError("");

      try {
        const params = {
          page,
          limit,
        };
        if (search.trim()) params.search = search.trim();
        if (statusFilter !== "All") params.status = statusFilter;
        if (branchFilter !== "All") params.branch = branchFilter;
        if (yearFilter !== "All") params.year = yearFilter;
        if (minCgpa !== "") params.minCgpa = minCgpa;

        const data = await getStudents(params);

        if (data && typeof data === "object" && Array.isArray(data.students)) {
          setStudents(data.students);
          setTotalRecords(data.total || 0);
          setTotalPages(data.totalPages || 1);
          if (data.stats) {
            setGlobalStats(data.stats);
          }
          if (Array.isArray(data.branches) && data.branches.length > 0) {
            setBranchesList(data.branches);
          }
        } else if (Array.isArray(data)) {
          setStudents(data);
          setTotalRecords(data.length);
          setTotalPages(Math.max(1, Math.ceil(data.length / limit)));
        }
      } catch (err) {
        console.error("Error fetching students:", err);
        setError("Unable to load students. Please check your connection and try again.");
      } finally {
        setLoading(false);
      }
    },
    [page, limit, search, statusFilter, branchFilter, yearFilter, minCgpa]
  );

  useEffect(() => {
    fetchStudents();
  }, [page, limit, statusFilter, branchFilter, yearFilter, minCgpa, location.key, fetchStudents]);

  const handleSearchChange = (event) => {
    const val = event.target.value;
    setSearch(val);
    setPage(1); // Reset to page 1 on search change

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      fetchStudents();
    }, 250);
  };

  const handleFilterChange = (setter) => (event) => {
    setter(event.target.value);
    setPage(1); // Reset to page 1 on filter change
  };

  const handleDelete = async (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this student?"
    );

    if (!confirmed) return;

    try {
      await deleteStudent(id);
      if (selectedStudent?._id === id) {
        setSelectedStudent(null);
      }
      await fetchStudents();
    } catch (err) {
      console.error("Error deleting student:", err);
      window.alert("Unable to delete the student. Please try again.");
    }
  };

  const handleEdit = (student) => {
    setSelectedStudent(student);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleUpdate = async (updatedData) => {
    if (!selectedStudent?._id) return;

    try {
      await updateStudent(selectedStudent._id, updatedData);
      setSelectedStudent(null);
      await fetchStudents();
      window.alert("Student updated successfully!");
    } catch (err) {
      console.error("Error updating student:", err);
      window.alert("Failed to update student. Please try again.");
    }
  };

  // Compute stat card metrics
  const totalStudents = globalStats.totalStudents || totalRecords;
  const placedCount = globalStats.placedCount || 0;
  const notPlacedCount = globalStats.notPlacedCount || Math.max(0, totalStudents - placedCount);
  const placementRate =
    totalStudents > 0 ? Math.round((placedCount / totalStudents) * 100) : 0;

  // Pagination boundaries
  const startRecord = totalRecords === 0 ? 0 : (page - 1) * limit + 1;
  const endRecord = Math.min(page * limit, totalRecords);

  const branches = branchesList.length > 0 ? branchesList : [
    ...new Set(
      students
        .map((student) => String(student.branch ?? "").trim())
        .filter(Boolean)
    ),
  ].sort();

  return (
    <AppLayout title="Student Management" eyebrow="Admin / Students">
      <main className="students-main">
        <div className="students-heading">
          <div>
            <p className="students-eyebrow">PLACEMENT MANAGEMENT</p>
            <h1>Student Management</h1>
            <p className="students-subtitle">
              Manage student profiles and monitor placement progress.
            </p>
          </div>

          <div className="students-header-actions">
            <Link to="/students/import">
              <button className="students-primary-action" type="button">
                <span aria-hidden="true">📥</span> Bulk Import
              </button>
            </Link>
          </div>
        </div>

        {error && (
          <div className="students-error-banner" role="alert">
            <span>{error}</span>
            <button
              type="button"
              className="students-retry-btn"
              onClick={() => fetchStudents()}
            >
              ↻ Retry
            </button>
          </div>
        )}

        <section className="students-stats">
          <article className="students-stat-card">
            <div className="students-stat-icon students-icon-blue">👥</div>
            <div>
              <p>Total Students</p>
              <h2>{totalStudents}</h2>
              <span>Registered students</span>
            </div>
          </article>

          <article className="students-stat-card">
            <div className="students-stat-icon students-icon-green">✓</div>
            <div>
              <p>Placed Students</p>
              <h2>{placedCount}</h2>
              <span>Placement confirmed</span>
            </div>
          </article>

          <article className="students-stat-card">
            <div className="students-stat-icon students-icon-orange">◷</div>
            <div>
              <p>Not Yet Placed</p>
              <h2>{notPlacedCount}</h2>
              <span>Still seeking opportunities</span>
            </div>
          </article>

          <article className="students-stat-card">
            <div className="students-stat-icon students-icon-purple">%</div>
            <div>
              <p>Placement Rate</p>
              <h2>{placementRate}%</h2>
              <span>Based on registered students</span>
            </div>
          </article>
        </section>

        {isAdmin ? (
          <section className="students-form-panel">
            <div className="students-section-heading">
              <div>
                <h2>
                  {selectedStudent ? "Edit Student Profile" : "Add New Student"}
                </h2>
                <p>
                  {selectedStudent
                    ? "Update the details for this registered student."
                    : "Create a new student record for placement drives."}
                </p>
              </div>

              {selectedStudent && (
                <button
                  className="students-cancel"
                  type="button"
                  onClick={() => setSelectedStudent(null)}
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <StudentForm
              onStudentAdded={fetchStudents}
              selectedStudent={selectedStudent}
              onUpdateStudent={handleUpdate}
            />
          </section>
        ) : (
          <div className="students-readonly">
            <span>ⓘ</span>
            You have read-only access. Only administrators can add, edit, or
            delete student records.
          </div>
        )}

        <section className="students-table-panel">
          <div className="students-table-heading">
            <div>
              <h2>Student Directory</h2>
              <p>
                Showing {totalRecords} total matching students
              </p>
            </div>
          </div>

          <div className="students-toolbar">
            <div className="students-search-wrap">
              <span aria-hidden="true">⌕</span>
              <input
                type="search"
                aria-label="Search students"
                placeholder="Search by name, roll no, email or branch..."
                value={search}
                onChange={handleSearchChange}
              />
            </div>

            <select
              aria-label="Filter by placement status"
              className="students-status-filter"
              value={statusFilter}
              onChange={handleFilterChange(setStatusFilter)}
            >
              <option value="All">All statuses</option>
              <option value="Placed">Placed</option>
              <option value="Not Placed">Not Placed</option>
            </select>

            <select
              aria-label="Filter by branch"
              className="students-status-filter"
              value={branchFilter}
              onChange={handleFilterChange(setBranchFilter)}
            >
              <option value="All">All branches</option>
              {branches.map((branch) => (
                <option key={branch} value={branch}>
                  {branch}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by year"
              className="students-status-filter"
              value={yearFilter}
              onChange={handleFilterChange(setYearFilter)}
            >
              <option value="All">All years</option>
              <option value="1">1st Year</option>
              <option value="2">2nd Year</option>
              <option value="3">3rd Year</option>
              <option value="4">4th Year</option>
            </select>

            <input
              type="number"
              min="0"
              max="10"
              step="0.01"
              aria-label="Minimum CGPA"
              className="students-status-filter"
              placeholder="Min CGPA"
              value={minCgpa}
              onChange={handleFilterChange(setMinCgpa)}
            />
          </div>

          {loading ? (
            <div className="students-message">
              <div className="students-loader" />
              <p>Loading student records...</p>
            </div>
          ) : (
            <>
              <div className="students-table-scroll">
                <table className="students-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Roll Number</th>
                      <th>Branch</th>
                      <th>Year</th>
                      <th>CGPA</th>
                      <th>Phone</th>
                      <th>Placement Status</th>
                      {isAdmin && <th>Actions</th>}
                    </tr>
                  </thead>

                  <tbody>
                    {students.length === 0 ? (
                      <tr>
                        <td
                          colSpan={isAdmin ? 8 : 7}
                          className="students-empty"
                        >
                          <div className="students-empty-icon">⌕</div>
                          <strong>No students found</strong>
                          <p>
                            Try a different search term or change the status filter.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      students.map((student) => (
                        <tr key={student._id}>
                          <td>
                            <div className="students-person">
                              <div className="students-avatar">
                                {String(student.name || "S")
                                  .trim()
                                  .charAt(0)
                                  .toUpperCase()}
                              </div>
                              <div className="students-person-details">
                                <strong>{student.name || "—"}</strong>
                                <span>{student.email || "—"}</span>
                              </div>
                            </div>
                          </td>

                          <td>{student.rollNo || "—"}</td>
                          <td>{student.branch || "—"}</td>
                          <td>{student.year ?? "—"}</td>
                          <td>{student.cgpa ?? "—"}</td>
                          <td>{student.phone || "—"}</td>

                          <td>
                            <span
                              className={`students-status ${
                                student.placementStatus === "Placed"
                                  ? "students-status-placed"
                                  : "students-status-pending"
                              }`}
                            >
                              <span className="students-status-dot" />
                              {student.placementStatus || "Not Placed"}
                            </span>
                          </td>

                          {isAdmin && (
                            <td>
                              <div className="students-actions">
                                <button
                                  className="students-edit-btn"
                                  type="button"
                                  onClick={() => handleEdit(student)}
                                  aria-label={`Edit ${student.name}`}
                                >
                                  Edit
                                </button>

                                <button
                                  className="students-delete-btn"
                                  type="button"
                                  onClick={() => handleDelete(student._id)}
                                  aria-label={`Delete ${student.name}`}
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

              {/* Table Pagination Bar */}
              <div className="table-pagination">
                <div className="table-pagination-info">
                  Showing <strong>{startRecord}</strong> to <strong>{endRecord}</strong> of{" "}
                  <strong>{totalRecords}</strong> students
                </div>

                <div className="table-pagination-controls">
                  <div className="table-pagination-per-page">
                    <label htmlFor="student-per-page">Per page:</label>
                    <select
                      id="student-per-page"
                      className="table-pagination-select"
                      value={limit}
                      onChange={(e) => {
                        setLimit(Number(e.target.value));
                        setPage(1);
                      }}
                    >
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                  </div>

                  <div className="table-pagination-nav">
                    <button
                      type="button"
                      className="table-pagination-btn"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1 || loading}
                      aria-label="Previous page"
                    >
                      ‹ Previous
                    </button>
                    <span className="table-pagination-indicator">
                      Page <strong>{page}</strong> of <strong>{totalPages}</strong>
                    </span>
                    <button
                      type="button"
                      className="table-pagination-btn"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages || loading}
                      aria-label="Next page"
                    >
                      Next ›
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>

        <footer className="students-footer">
          Placement Portal
        </footer>
      </main>
    </AppLayout>
  );
}

export default Students;
