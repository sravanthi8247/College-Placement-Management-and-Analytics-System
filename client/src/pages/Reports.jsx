import { useEffect, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import Alert from '../components/ui/Alert';
import { downloadReport, getAnalytics } from '../services/analyticsService';
import './Dashboard.css';
import './Students.css';

function Reports() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getAnalytics();
        setAnalytics(data);
      } catch (err) {
        setError('Unable to load analytics.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const [exporting, setExporting] = useState(false);

  const handleExport = async (type, filename) => {
    setError('');
    setMessage('');
    setExporting(true);
    try {
      await downloadReport(type, filename);
      setMessage(`${filename} downloaded successfully.`);
    } catch (err) {
      setError(err.message || 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  const totals = analytics?.totals || {};
  const maxBranch = Math.max(
    1,
    ...(analytics?.branchStats || []).map((item) => item.total)
  );
  const maxCompany = Math.max(
    1,
    ...(analytics?.companyPlacements || []).map((item) => item.count)
  );

  return (
    <AppLayout title="Analytics and reports" eyebrow="Admin / Reports">
      <main className="students-main">
        <div className="students-heading">
        <div>
          <p className="students-eyebrow">REPORTS &amp; ANALYTICS</p>
          <h1>Placement Reports</h1>
          <p className="students-subtitle">
            Export data reports and analyze placement statistics across branches and companies.
          </p>
        </div>
      </div>

      <Alert type="error" message={error} />
      <Alert type="success" message={message} />

      {loading ? (
        <div style={{ padding: '36px 24px', textAlign: 'center', color: '#64748b' }}>
          <span className="refresh-icon spinning" aria-hidden="true" style={{ display: 'inline-block', marginRight: 8 }}>↻</span>
          Loading analytics...
        </div>
      ) : (
        <>
          <section className="students-stats">
            <article className="students-stat-card">
              <div>
                <p>Registered students</p>
                <h2>{totals.totalStudents || 0}</h2>
              </div>
            </article>
            <article className="students-stat-card">
              <div>
                <p>Placed / Not placed</p>
                <h2>
                  {totals.placedStudents || 0} / {totals.notPlacedStudents || 0}
                </h2>
              </div>
            </article>
            <article className="students-stat-card">
              <div>
                <p>Placement percentage</p>
                <h2>{totals.placementPercentage || 0}%</h2>
                <span>Unique placed students</span>
              </div>
            </article>
            <article className="students-stat-card">
              <div>
                <p>Applications</p>
                <h2>{totals.totalApplications || 0}</h2>
                <span>{totals.totalDrivesOpen || 0} open drives</span>
              </div>
            </article>
          </section>

          <section className="cpma-lower-grid">
            <article className="cpma-panel">
              <div className="cpma-panel-heading">
                <div>
                  <h2>Branch-wise placements</h2>
                  <p>Placed students compared with branch strength</p>
                </div>
              </div>
              {(analytics?.branchStats || []).length === 0 ? (
                <p>No student data available.</p>
              ) : (
                analytics.branchStats.map((item) => (
                  <div className="cpma-overview-row" key={item.branch}>
                    <span>
                      {item.branch} ({item.placed}/{item.total})
                    </span>
                    <div className="cpma-progress-track" style={{ flex: 1, margin: '0 12px' }}>
                      <div
                        className="cpma-progress-fill"
                        style={{ width: `${(item.total / maxBranch) * 100}%` }}
                      />
                    </div>
                    <strong>{item.percentage}%</strong>
                  </div>
                ))
              )}
            </article>

            <article className="cpma-panel">
              <div className="cpma-panel-heading">
                <div>
                  <h2>Company-wise selections</h2>
                  <p>From placement records with status Selected</p>
                </div>
              </div>
              {(analytics?.companyPlacements || []).length === 0 ? (
                <p>No selected placement records yet.</p>
              ) : (
                analytics.companyPlacements.map((item) => (
                  <div className="cpma-overview-row" key={item.companyName}>
                    <span>{item.companyName}</span>
                    <div className="cpma-progress-track" style={{ flex: 1, margin: '0 12px' }}>
                      <div
                        className="cpma-progress-fill"
                        style={{ width: `${(item.count / maxCompany) * 100}%` }}
                      />
                    </div>
                    <strong>{item.count}</strong>
                  </div>
                ))
              )}
            </article>
          </section>

          <section className="cpma-lower-grid" style={{ marginTop: 24 }}>
            <article className="cpma-panel">
              <div className="cpma-panel-heading">
                <div>
                  <h2>Applications by status</h2>
                </div>
              </div>
              {(analytics?.applicationStatus || []).length === 0 ? (
                <p>No applications yet.</p>
              ) : (
                analytics.applicationStatus.map((item) => (
                  <div className="cpma-overview-row" key={item.status}>
                    <span>{item.status}</span>
                    <strong>{item.count}</strong>
                  </div>
                ))
              )}
              {analytics?.packageStats && (
                <div style={{ marginTop: 16 }}>
                  <p>
                    Average package (per confirmed offer):{' '}
                    <strong>
                      {analytics.packageStats.averagePerOffer || analytics.packageStats.average} LPA
                    </strong>
                  </p>
                  {analytics.packageStats.averagePerStudent && (
                    <p>
                      Average package (per placed candidate):{' '}
                      <strong>{analytics.packageStats.averagePerStudent} LPA</strong>
                    </p>
                  )}
                  <p>
                    Highest / lowest offer:{' '}
                    <strong>
                      {analytics.packageStats.highest} / {analytics.packageStats.lowest} LPA
                    </strong>
                  </p>
                </div>
              )}
            </article>

            <article className="cpma-panel">
              <div className="cpma-panel-heading">
                <div>
                  <h2>Institutional Reports &amp; Exports</h2>
                  <p>Download official PDF placement reports or raw CSV datasets for accreditation.</p>
                </div>
              </div>

              <div style={{ padding: '16px 0', borderBottom: '1px solid #e2e8f0', marginBottom: 16 }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
                  📄 Official PDF Placement Report
                </h3>
                <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 12 }}>
                  Institutional document containing placement KPI summaries, compensation statistics, branch breakdowns, top recruiting partners, and pagination.
                </p>
                <button
                  type="button"
                  className="students-refresh"
                  style={{
                    backgroundColor: '#1e40af',
                    color: '#ffffff',
                    borderColor: '#1e40af',
                    fontWeight: 600,
                    cursor: exporting ? 'wait' : 'pointer',
                  }}
                  disabled={exporting}
                  onClick={() =>
                    handleExport(
                      'pdf',
                      `Placement_Report_${new Date().toISOString().slice(0, 10)}.pdf`
                    )
                  }
                >
                  {exporting ? 'Generating report...' : '📥 Download PDF Report'}
                </button>
              </div>

              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
                  📊 Raw CSV Datasets
                </h3>
                <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 12 }}>
                  Export raw data files for spreadsheet processing. Passwords and credentials are never included.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <button
                    type="button"
                    className="students-refresh"
                    disabled={exporting}
                    onClick={() => handleExport('students', 'students-report.csv')}
                  >
                    Export Students (CSV)
                  </button>
                  <button
                    type="button"
                    className="students-refresh"
                    disabled={exporting}
                    onClick={() => handleExport('applications', 'applications-report.csv')}
                  >
                    Export Applications (CSV)
                  </button>
                  <button
                    type="button"
                    className="students-refresh"
                    disabled={exporting}
                    onClick={() => handleExport('placements', 'placements-report.csv')}
                  >
                    Export Placements (CSV)
                  </button>
                </div>
              </div>
            </article>
          </section>
        </>
      )}
      </main>
    </AppLayout>
  );
}

export default Reports;
