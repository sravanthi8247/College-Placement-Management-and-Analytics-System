import { useEffect, useState, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { useAuth } from '../context/AuthContext';
import { getDashboardStats, getMyStudentProfile } from '../services/studentService';
import { getCompanies } from '../services/companyService';
import { getApplications } from '../services/applicationService';
import './Dashboard.css';

const initialStats = {
  totalStudents: 0,
  placedStudents: 0,
  notPlacedStudents: 0,
  totalCompanies: 0,
  totalPlacements: 0,
  totalApplications: 0,
  upcomingDrives: 0,
  placementRate: 0,
  recentCompanies: [],
  branchDistribution: [],
  applicationStatus: [],
};

const adminCards = [
  { key: 'totalStudents', title: 'Total Students', icon: 'ST', color: 'blue' },
  { key: 'placedStudents', title: 'Students Placed', icon: 'PL', color: 'green' },
  { key: 'notPlacedStudents', title: 'Not Placed', icon: 'NP', color: 'orange' },
  { key: 'totalCompanies', title: 'Companies', icon: 'CO', color: 'purple' },
  { key: 'upcomingDrives', title: 'Upcoming Drives', icon: 'UD', color: 'pink' },
  { key: 'placementRate', title: 'Placement Rate', icon: 'PR', color: 'teal', suffix: '%' },
];

function Dashboard() {
  const location = useLocation();
  const { user, isAdmin } = useAuth();
  const [stats, setStats] = useState(initialStats);
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState('');
  const [profile, setProfile] = useState(null);
  const [openDrives, setOpenDrives] = useState([]);
  const [applications, setApplications] = useState([]);
  const loadDashboardData = useCallback(async () => {
    try {
      setLoadingStats(true);
      setStatsError('');
      const data = await getDashboardStats();
      setStats({ ...initialStats, ...data });

      if (!isAdmin) {
        const [me, companies, apps] = await Promise.all([
          getMyStudentProfile().catch(() => null),
          getCompanies({ status: 'Open' }).catch(() => []),
          getApplications().catch(() => []),
        ]);
        setProfile(me);
        setOpenDrives(Array.isArray(companies) ? companies.slice(0, 5) : []);
        setApplications(Array.isArray(apps) ? apps.slice(0, 5) : []);
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
      setStatsError('Statistics could not be loaded. Please try again.');
    } finally {
      setLoadingStats(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData, location.key]);

  const placementRate = Math.max(0, Math.min(100, Number(stats.placementRate) || 0));
  const maxBranch = Math.max(1, ...(stats.branchDistribution || []).map((item) => item.count));

  return (
    <AppLayout title="Dashboard overview" eyebrow="Workspace / Dashboard">
      <section className="cpma-welcome">
        <div>
          <span className="cpma-eyebrow">PLACEMENT PORTAL</span>
          <h2>Welcome back, {user?.name || 'there'}!</h2>
          <p>
            {isAdmin
              ? 'Review live placement statistics, upcoming drives, and recent company activity.'
              : 'Check your profile, view open placement drives, and track your applications.'}
          </p>
        </div>
        <div className="cpma-welcome-mark" aria-hidden="true">
          <span>PP</span>
        </div>
      </section>

      {statsError && (
        <div className="cpma-error" role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <span>{statsError}</span>
          <button
            type="button"
            className="cpma-retry-btn"
            onClick={loadDashboardData}
          >
            ↻ Retry
          </button>
        </div>
      )}

      <div className="cpma-section-heading">
        <div>
          <h2>{isAdmin ? 'Placement statistics' : 'College snapshot'}</h2>
          <p>Numbers are calculated from live database records</p>
        </div>
      </div>

      <section className="cpma-stat-grid" aria-label="Placement statistics">
        {adminCards.map((card) => {
          const value = Number(stats[card.key]) || 0;
          return (
            <article className="cpma-stat-card" key={card.key}>
              <div className="cpma-stat-top">
                <span className={`cpma-stat-icon ${card.color}`}>{card.icon}</span>
              </div>
              <p className="cpma-stat-title">{card.title}</p>
              <div className="cpma-stat-value">
                {loadingStats ? '—' : `${value}${card.suffix || ''}`}
              </div>
            </article>
          );
        })}
      </section>

      <section className="cpma-lower-grid">
        <article className="cpma-panel">
          <div className="cpma-panel-heading">
            <div>
              <h2>Placement overview</h2>
              <p>Unique placed students / total registered students</p>
            </div>
          </div>
          <div className="cpma-rate-summary">
            <div>
              <span className="cpma-muted-label">Placement rate</span>
              <strong>{loadingStats ? '—' : `${placementRate}%`}</strong>
            </div>
          </div>
          <div
            className="cpma-progress-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={placementRate}
          >
            <div className="cpma-progress-fill" style={{ width: `${placementRate}%` }} />
          </div>
          <div className="cpma-progress-labels">
            <span>Placed: {loadingStats ? '—' : stats.placedStudents}</span>
            <span>Not placed: {loadingStats ? '—' : stats.notPlacedStudents}</span>
          </div>
        </article>

        <article className="cpma-panel">
          <div className="cpma-panel-heading">
            <div>
              <h2>Branch-wise students</h2>
              <p>Distribution from student records</p>
            </div>
          </div>
          {(stats.branchDistribution || []).length === 0 ? (
            <p className="cpma-muted-label">No student records yet.</p>
          ) : (
            (stats.branchDistribution || []).map((item) => (
              <div className="cpma-overview-row cpma-branch-row" key={item.branch}>
                <span className="cpma-branch-name" title={item.branch}>{item.branch}</span>
                <div className="cpma-progress-track" style={{ flex: 1, margin: '0 12px' }}>
                  <div
                    className="cpma-progress-fill"
                    style={{ width: `${(item.count / maxBranch) * 100}%` }}
                  />
                </div>
                <strong>{item.count}</strong>
              </div>
            ))
          )}
        </article>
      </section>

      {isAdmin ? (
        <section className="cpma-lower-grid" style={{ marginTop: 24 }}>
          <article className="cpma-panel">
            <div className="cpma-panel-heading">
              <div>
                <h2>Recently added companies</h2>
                <p>Latest placement drives</p>
              </div>
            </div>
            {(stats.recentCompanies || []).length === 0 ? (
              <p className="cpma-muted-label">No companies have been added yet.</p>
            ) : (
              (stats.recentCompanies || []).map((company) => (
                <div className="cpma-overview-row" key={company._id}>
                  <span>
                    {company.companyName} — {company.jobRole || 'Role not set'}
                  </span>
                  <strong>{company.driveStatus || 'Open'}</strong>
                </div>
              ))
            )}
          </article>
          <article className="cpma-panel cpma-quick-panel">
            <div className="cpma-panel-heading">
              <div>
                <h2>Quick access</h2>
                <p>Open a management section</p>
              </div>
            </div>
            <Link to="/students" className="cpma-quick-link">
              <span className="cpma-quick-icon blue">ST</span>
              <span className="cpma-quick-text">
                <strong>Student management</strong>
                <small>Add and update student records</small>
              </span>
              <span className="cpma-quick-arrow">→</span>
            </Link>
            <Link to="/companies" className="cpma-quick-link">
              <span className="cpma-quick-icon purple">CO</span>
              <span className="cpma-quick-text">
                <strong>Company drives</strong>
                <small>Manage eligibility and deadlines</small>
              </span>
              <span className="cpma-quick-arrow">→</span>
            </Link>
            <Link to="/reports" className="cpma-quick-link">
              <span className="cpma-quick-icon green">RP</span>
              <span className="cpma-quick-text">
                <strong>Analytics and CSV reports</strong>
                <small>Export student and application data</small>
              </span>
              <span className="cpma-quick-arrow">→</span>
            </Link>
          </article>
        </section>
      ) : (
        <section className="cpma-lower-grid" style={{ marginTop: 24 }}>
          <article className="cpma-panel">
            <div className="cpma-panel-heading">
              <div>
                <h2>Your profile</h2>
                <p>Used for eligibility checks</p>
              </div>
              <Link to="/profile">Update</Link>
            </div>
            {profile ? (
              <>
                <div className="cpma-overview-row">
                  <span>CGPA</span>
                  <strong>{profile.cgpa ?? '—'}</strong>
                </div>
                <div className="cpma-overview-row">
                  <span>Branch / Year</span>
                  <strong>
                    {profile.branch || '—'} / {profile.year ?? '—'}
                  </strong>
                </div>
                <div className="cpma-overview-row">
                  <span>Placement status</span>
                  <strong>{profile.placementStatus || 'Not Placed'}</strong>
                </div>
              </>
            ) : (
              <p className="cpma-muted-label">
                Complete your student profile so you can apply to drives.
              </p>
            )}
          </article>
          <article className="cpma-panel">
            <div className="cpma-panel-heading">
              <div>
                <h2>Open drives</h2>
                <p>Currently accepting applications</p>
              </div>
              <Link to="/drives">View all</Link>
            </div>
            {openDrives.length === 0 ? (
              <p className="cpma-muted-label">No open drives right now.</p>
            ) : (
              openDrives.map((drive) => (
                <Link key={drive._id} to={`/drives/${drive._id}`} className="cpma-overview-row">
                  <span>
                    {drive.companyName} — {drive.jobRole || 'Role not set'}
                  </span>
                  <strong>{drive.packageOffered ?? '—'} LPA</strong>
                </Link>
              ))
            )}
          </article>
        </section>
      )}

      {!isAdmin && (
        <article className="cpma-panel" style={{ marginTop: 24 }}>
          <div className="cpma-panel-heading">
            <div>
              <h2>Recent applications</h2>
              <p>Your latest application updates</p>
            </div>
            <Link to="/applications">View all</Link>
          </div>
          {applications.length === 0 ? (
            <p className="cpma-muted-label">You have not applied to any drives yet.</p>
          ) : (
            applications.map((application) => (
              <div className="cpma-overview-row" key={application._id}>
                <span>{application.company?.companyName || 'Company'}</span>
                <strong>{application.status}</strong>
              </div>
            ))
          )}
        </article>
      )}

      <footer className="cpma-footer">
        <span>Placement Portal</span>
        <span>College Placement Management and Analytics System</span>
      </footer>
    </AppLayout>
  );
}

export default Dashboard;
