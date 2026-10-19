import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import Alert from '../components/ui/Alert';
import {
  checkMyEligibility,
  getCompanyById,
} from '../services/companyService';
import { applyToDrive, getApplications } from '../services/applicationService';
import './Companies.css';
import './Dashboard.css';

function formatDate(date) {
  if (!date) return 'Not specified';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return 'Not specified';
  return parsed.toLocaleDateString();
}

function DriveDetail() {
  const { id } = useParams();
  const [company, setCompany] = useState(null);
  const [eligibility, setEligibility] = useState(null);
  const [existingApplication, setExistingApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [drive, check, apps] = await Promise.all([
          getCompanyById(id),
          checkMyEligibility(id),
          getApplications({ companyId: id }).catch(() => []),
        ]);
        setCompany(drive);
        setEligibility(check);
        if (Array.isArray(apps) && apps.length > 0) {
          setExistingApplication(apps[0]);
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Unable to load this drive.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  const handleApply = async () => {
    setMessage('');
    setError('');
    setApplying(true);

    try {
      const created = await applyToDrive(id);
      setExistingApplication(created);
      setMessage('Application submitted successfully.');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to submit application.');
    } finally {
      setApplying(false);
    }
  };

  return (
    <AppLayout title="Drive details" eyebrow="Student / Drives">
      <p style={{ marginBottom: 16 }}>
        <Link to="/drives">← Back to drives</Link>
      </p>

      {loading ? (
        <p>Loading drive details...</p>
      ) : (
        <>
          <Alert type="error" message={error} />
          <Alert type="success" message={message} />

          {company && (
            <section className="cpma-lower-grid">
              <article className="cpma-panel">
                <div className="cpma-panel-heading">
                  <div>
                    <h2>{company.companyName}</h2>
                    <p>{company.jobRole || 'Role not specified'}</p>
                  </div>
                  <span>{company.driveStatus || 'Open'}</span>
                </div>
                <div className="cpma-overview-row">
                  <span>Package</span>
                  <strong>{company.packageOffered ?? '—'} LPA</strong>
                </div>
                <div className="cpma-overview-row">
                  <span>Location</span>
                  <strong>{company.location || '—'}</strong>
                </div>
                <div className="cpma-overview-row">
                  <span>Drive date</span>
                  <strong>{formatDate(company.driveDate)}</strong>
                </div>
                <div className="cpma-overview-row">
                  <span>Application deadline</span>
                  <strong>{formatDate(company.applicationDeadline)}</strong>
                </div>
                <div className="cpma-overview-row">
                  <span>Eligible branches</span>
                  <strong>
                    {(company.eligibleBranches || []).length
                      ? company.eligibleBranches.join(', ')
                      : 'All branches'}
                  </strong>
                </div>
                <div className="cpma-overview-row">
                  <span>Eligible years</span>
                  <strong>
                    {(company.eligibleYears || []).length
                      ? company.eligibleYears.join(', ')
                      : 'All years'}
                  </strong>
                </div>
                <p style={{ marginTop: 16 }}>{company.description || 'No additional description.'}</p>
              </article>

              <article className="cpma-panel">
                <div className="cpma-panel-heading">
                  <div>
                    <h2>Eligibility check</h2>
                    <p>Compared with your student profile</p>
                  </div>
                  <strong>{eligibility?.status || 'Unavailable'}</strong>
                </div>

                {eligibility && (
                  <>
                    <div className="cpma-overview-row">
                      <span>Minimum CGPA {eligibility.checks.cgpa.required}</span>
                      <strong>Your CGPA {eligibility.checks.cgpa.student}</strong>
                    </div>
                    <div className="cpma-overview-row">
                      <span>Branch</span>
                      <strong>{eligibility.checks.branch.ok ? 'Eligible' : 'Not eligible'}</strong>
                    </div>
                    <div className="cpma-overview-row">
                      <span>Academic year</span>
                      <strong>{eligibility.checks.year.ok ? 'Eligible' : 'Not eligible'}</strong>
                    </div>
                    <div className="cpma-overview-row">
                      <span>Drive status</span>
                      <strong>{eligibility.checks.driveStatus.value}</strong>
                    </div>
                    <div className="cpma-overview-row">
                      <span>Deadline</span>
                      <strong>
                        {eligibility.checks.deadline.passed ? 'Passed' : 'Open'}
                      </strong>
                    </div>

                    {eligibility.reasons.length > 0 && (
                      <div style={{ marginTop: 16 }}>
                        <strong>Reasons you cannot apply</strong>
                        <ul>
                          {eligibility.reasons.map((reason) => (
                            <li key={reason}>{reason}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div style={{ marginTop: 16 }}>
                      <p>
                        Matching skills:{' '}
                        {eligibility.skills.matching.length
                          ? eligibility.skills.matching.join(', ')
                          : 'None'}
                      </p>
                      <p>
                        Missing skills:{' '}
                        {eligibility.skills.missing.length
                          ? eligibility.skills.missing.join(', ')
                          : 'None'}
                      </p>
                      <small>{eligibility.skills.note}</small>
                    </div>

                    {existingApplication && (
                      <div
                        style={{
                          marginTop: 16,
                          padding: '14px',
                          background: 'rgba(15, 23, 42, 0.03)',
                          border: '1px solid #cbd5e1',
                          borderRadius: 8,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong>Application Status</strong>
                          <span
                            className={`students-status ${
                              existingApplication.status === 'Selected'
                                ? 'students-status-placed'
                                : 'students-status-pending'
                            }`}
                          >
                            {existingApplication.status}
                          </span>
                        </div>
                        {existingApplication.appliedAt && (
                          <p style={{ marginTop: 6, fontSize: '0.85rem', color: '#64748b' }}>
                            Applied on: {new Date(existingApplication.appliedAt).toLocaleDateString()}
                          </p>
                        )}
                        {existingApplication.remarks && (
                          <p style={{ marginTop: 6, fontSize: '0.85rem', color: '#334155' }}>
                            Remarks: {existingApplication.remarks}
                          </p>
                        )}
                      </div>
                    )}

                    <button
                      type="button"
                      className="companies-edit-btn"
                      style={{ marginTop: 18 }}
                      onClick={handleApply}
                      disabled={!eligibility.eligible || applying || Boolean(existingApplication)}
                    >
                      {applying
                        ? 'Applying...'
                        : existingApplication
                        ? `Already Applied (${existingApplication.status})`
                        : 'Apply to this drive'}
                    </button>
                    {!eligibility.eligible && !existingApplication && (
                      <p className="cpma-muted-label" style={{ marginTop: 8 }}>
                        You can apply only if every required check passes and the drive is open.
                      </p>
                    )}
                    {existingApplication && (
                      <p className="cpma-muted-label" style={{ marginTop: 8 }}>
                        Your application for this drive is currently {existingApplication.status.toLowerCase()}. Check the Applications tab for updates.
                      </p>
                    )}
                  </>
                )}
              </article>
            </section>
          )}
        </>
      )}
    </AppLayout>
  );
}

export default DriveDetail;
