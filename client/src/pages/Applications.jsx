import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import Alert from '../components/ui/Alert';
import { useAuth } from '../context/AuthContext';
import { getApplications } from '../services/applicationService';
import { openResumeInNewTab } from '../services/studentService';
import ApplicationReviewModal from '../components/ApplicationReviewModal';
import './Placements.css';

function Applications() {
  const location = useLocation();
  const { isAdmin } = useAuth();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedAppForReview, setSelectedAppForReview] = useState(null);

  const load = async () => {
    try {
      setError('');
      const data = await getApplications();
      setApplications(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('Unable to load applications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [location.key]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return applications.filter((application) => {
      const matchesStatus =
        statusFilter === 'All' || application.status === statusFilter;
      const matchesSearch = [
        application.student?.name,
        application.student?.rollNo,
        application.company?.companyName,
        application.status,
      ].some((value) => String(value || '').toLowerCase().includes(query));
      return matchesStatus && matchesSearch;
    });
  }, [applications, search, statusFilter]);

  return (
    <AppLayout
      title={isAdmin ? 'Applications' : 'My Applications'}
      eyebrow={isAdmin ? 'Admin / Applications' : 'Student / Applications'}
    >
      <main className="placements-main">
        <div className="placements-heading" style={{ marginBottom: 24 }}>
          <div>
            <p className="placements-eyebrow">
              {isAdmin ? 'APPLICATION MANAGEMENT' : 'PLACEMENT TRACKING'}
            </p>
            <h1>{isAdmin ? 'Student Applications' : 'My Applications'}</h1>
            <p className="placements-subtitle">
              {isAdmin
                ? 'Review and manage all submitted student drive applications and outcomes.'
                : 'Track the status and progress of your job and placement drive applications.'}
            </p>
          </div>
        </div>

      {error && (
        <div className="placements-error-banner" role="alert">
          <span>{error}</span>
          <button
            type="button"
            className="placements-retry-btn"
            onClick={load}
          >
            ↻ Retry
          </button>
        </div>
      )}
      <Alert type="success" message={success} />

      <section className="placements-table-panel">
        <div className="placements-table-title">
          <h2>{isAdmin ? 'All student applications' : 'Your application history'}</h2>
          <p>Status values: Applied, Shortlisted, Selected, Rejected.</p>
        </div>

        <div className="placements-toolbar">
          <div className="placements-search">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              aria-label="Search applications"
              placeholder="Search student, company or status..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <select
            className="placements-status-filter"
            aria-label="Filter by application status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="All">All statuses</option>
            <option value="Applied">Applied</option>
            <option value="Shortlisted">Shortlisted</option>
            <option value="Selected">Selected</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>

        {loading ? (
          <div style={{ padding: '32px 24px', textAlign: 'center', color: '#64748b' }}>
            <span className="refresh-icon spinning" aria-hidden="true" style={{ display: 'inline-block', marginRight: 8 }}>↻</span>
            Loading applications...
          </div>
        ) : (
          <div className="placements-table-scroll">
            <table className="placements-table">
              <thead>
                <tr>
                  {isAdmin && <th>Student</th>}
                  <th>Company</th>
                  <th>Role</th>
                  <th>Applied on</th>
                  <th>Resume</th>
                  <th>Status</th>
                  <th>Remarks</th>
                  {isAdmin && <th>Action</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 8 : 6} className="placements-empty">
                      <strong>No applications found</strong>
                      <p>Apply to an open drive or change the current filter.</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((application) => (
                    <tr key={application._id}>
                      {isAdmin && (
                        <td>
                          {application.student?.name || '—'}
                          <br />
                          <small>{application.student?.rollNo || ''}</small>
                        </td>
                      )}
                      <td>{application.company?.companyName || '—'}</td>
                      <td>{application.company?.jobRole || '—'}</td>
                      <td>
                        {application.appliedAt
                          ? new Date(application.appliedAt).toLocaleDateString()
                          : '—'}
                      </td>
                      <td>
                        {application.student?.resume?.filename ? (
                          <button
                            type="button"
                            className="students-refresh"
                            style={{
                              padding: '4px 10px',
                              minHeight: '32px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.8rem',
                              backgroundColor: '#eff6ff',
                              borderColor: '#bfdbfe',
                              color: '#1d4ed8',
                              fontWeight: 600,
                              cursor: 'pointer',
                              touchAction: 'manipulation',
                            }}
                            title={`View resume: ${application.student.resume.filename}`}
                            onClick={() => openResumeInNewTab(application.student._id || 'me')}
                          >
                            📄 View
                          </button>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>None</span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`students-status ${
                            application.status === 'Selected'
                              ? 'students-status-placed'
                              : 'students-status-pending'
                          }`}
                          style={{
                            cursor: isAdmin ? 'pointer' : 'default',
                            fontSize: '0.8rem',
                            touchAction: 'manipulation',
                          }}
                          onClick={() => {
                            if (isAdmin) setSelectedAppForReview(application);
                          }}
                          title={isAdmin ? 'Click to review candidate decision' : ''}
                        >
                          {application.status}
                        </span>
                      </td>
                      <td>{application.remarks || '—'}</td>
                      {isAdmin && (
                        <td>
                          <button
                            type="button"
                            className="students-refresh"
                            style={{
                              padding: '4px 10px',
                              minHeight: '32px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              borderColor: '#3b82f6',
                              color: '#1d4ed8',
                              backgroundColor: '#ffffff',
                              cursor: 'pointer',
                              touchAction: 'manipulation',
                            }}
                            onClick={() => setSelectedAppForReview(application)}
                          >
                            ✏️ Review
                          </button>
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
      </main>

      <ApplicationReviewModal
        application={selectedAppForReview}
        isOpen={Boolean(selectedAppForReview)}
        onClose={() => setSelectedAppForReview(null)}
        onSuccess={(msg) => {
          setSuccess(msg);
          load();
        }}
      />
    </AppLayout>
  );
}

export default Applications;
