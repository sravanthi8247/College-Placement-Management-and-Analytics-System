import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { getCompanies } from '../services/companyService';
import { getApplications } from '../services/applicationService';
import './Companies.css';

function formatDate(date) {
  if (!date) return 'Not set';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return 'Not set';
  return parsed.toLocaleDateString();
}

function Drives() {
  const [companies, setCompanies] = useState([]);
  const [appliedMap, setAppliedMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Open');

  const fetchDrives = async () => {
    setLoading(true);
    setError('');

    try {
      const [companiesData, applicationsData] = await Promise.all([
        getCompanies(),
        getApplications().catch(() => []),
      ]);
      setCompanies(Array.isArray(companiesData) ? companiesData : []);

      const map = {};
      if (Array.isArray(applicationsData)) {
        applicationsData.forEach((app) => {
          const companyId = app.company?._id || app.company;
          if (companyId) {
            map[companyId] = app.status || 'Applied';
          }
        });
      }
      setAppliedMap(map);
    } catch (err) {
      console.error('Error fetching drives:', err);
      setError('Unable to load placement drives. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrives();
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return companies.filter((company) => {
      const matchesStatus =
        statusFilter === 'All' || (company.driveStatus || 'Open') === statusFilter;
      const matchesSearch = [
        company.companyName,
        company.jobRole,
        company.location,
      ].some((value) => String(value || '').toLowerCase().includes(query));
      return matchesStatus && matchesSearch;
    });
  }, [companies, search, statusFilter]);

  return (
    <AppLayout title="Placement Drives" eyebrow="Student / Drives">
      <section className="companies-table-panel">
        <div className="companies-table-title">
          <h2>Available drives</h2>
          <p>Review eligibility and apply before the deadline.</p>
        </div>

        {error && (
          <div className="companies-error-banner" role="alert" style={{ margin: '0 24px 16px' }}>
            <span>{error}</span>
            <button
              type="button"
              className="companies-retry-btn"
              onClick={fetchDrives}
            >
              ↻ Retry
            </button>
          </div>
        )}

        <div className="companies-toolbar">
          <div className="companies-search">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              aria-label="Search drives"
              placeholder="Search company, role or location..."
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
            <option value="Open">Open</option>
            <option value="Closed">Closed</option>
            <option value="Completed">Completed</option>
            <option value="All">All</option>
          </select>
        </div>

        <div className="companies-table-scroll">
          <table className="companies-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Role</th>
                <th>Package</th>
                <th>Min CGPA</th>
                <th>Deadline</th>
                <th>Drive Status</th>
                <th>My Application</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="companies-empty">
                    <span className="refresh-icon spinning" aria-hidden="true" style={{ display: 'inline-block', marginRight: 8 }}>↻</span>
                    Loading available placement drives...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="companies-empty">
                    <strong>No placement drives match your filters</strong>
                    <p>Try searching with a different company name, role, location, or status.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((company) => {
                  const myAppStatus = appliedMap[company._id];
                  return (
                    <tr key={company._id}>
                      <td>{company.companyName || '—'}</td>
                      <td>{company.jobRole || '—'}</td>
                      <td>{company.packageOffered !== undefined && company.packageOffered !== null ? `${company.packageOffered} LPA` : '—'}</td>
                      <td>{company.eligibilityCGPA ?? '—'}</td>
                      <td>{formatDate(company.applicationDeadline)}</td>
                      <td>{company.driveStatus || 'Open'}</td>
                      <td>
                        {myAppStatus ? (
                          <span
                            className={`students-status ${
                              myAppStatus === 'Selected'
                                ? 'students-status-placed'
                                : 'students-status-pending'
                            }`}
                          >
                            {myAppStatus}
                          </span>
                        ) : (
                          <span className="cpma-muted-label">Not applied</span>
                        )}
                      </td>
                      <td>
                        <Link to={`/drives/${company._id}`}>
                          {myAppStatus ? 'View details' : 'Check eligibility'}
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AppLayout>
  );
}

export default Drives;
