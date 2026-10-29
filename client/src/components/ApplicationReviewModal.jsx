import { useEffect, useState } from 'react';
import { updateApplicationStatus } from '../services/applicationService';
import { openResumeInNewTab } from '../services/studentService';
import Alert from './ui/Alert';
import './ApplicationReviewModal.css';

const STATUS_OPTIONS = ['Applied', 'Shortlisted', 'Selected', 'Rejected'];

function ApplicationReviewModal({ application, isOpen, onClose, onSuccess }) {
  const [status, setStatus] = useState('Applied');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [viewingResume, setViewingResume] = useState(false);

  useEffect(() => {
    if (application) {
      setStatus(application.status || 'Applied');
      setRemarks(application.remarks || '');
      setError('');
    }
  }, [application]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !submitting) {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, submitting, onClose]);

  if (!isOpen || !application) {
    return null;
  }

  const student = application.student || {};
  const company = application.company || {};
  const resume = student.resume;

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await updateApplicationStatus(application._id, {
        status,
        remarks: remarks.trim(),
      });
      onSuccess(
        `Application for ${student.name || 'candidate'} updated to ${status}.`
      );
      onClose();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          'Failed to update application decision. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenResume = async () => {
    if (!student._id) return;
    setError('');
    setViewingResume(true);
    try {
      await openResumeInNewTab(student._id);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not load candidate resume.');
    } finally {
      setViewingResume(false);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !submitting) {
      onClose();
    }
  };

  return (
    <div
      className="review-modal-backdrop"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-modal-title"
    >
      <div className="review-modal-content">
        <div className="review-modal-header">
          <div>
            <h2 id="review-modal-title">Review Application Decision</h2>
            <p>Update placement drive status and record official decision remarks.</p>
          </div>
          <button
            type="button"
            className="review-modal-close"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close review modal"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSave}>
          <div className="review-modal-body">
            <Alert type="error" message={error} />

            <div className="review-details-card">
              <div className="review-detail-item">
                <span className="label">Candidate Name</span>
                <span className="value">{student.name || '—'}</span>
              </div>
              <div className="review-detail-item">
                <span className="label">Roll Number</span>
                <span className="value">{student.rollNo || '—'}</span>
              </div>
              <div className="review-detail-item">
                <span className="label">Branch &amp; Year</span>
                <span className="value">
                  {student.branch || '—'}{' '}
                  {student.year ? `(Year ${student.year})` : ''}
                </span>
              </div>
              <div className="review-detail-item">
                <span className="label">CGPA / Current Status</span>
                <span className="value">
                  {student.cgpa !== undefined ? student.cgpa : '—'} &bull;{' '}
                  <span
                    style={{
                      color:
                        student.placementStatus === 'Placed'
                          ? '#16a34a'
                          : '#ea580c',
                    }}
                  >
                    {student.placementStatus || 'Not Placed'}
                  </span>
                </span>
              </div>
              <div className="review-detail-item">
                <span className="label">Placement Drive</span>
                <span className="value">{company.companyName || '—'}</span>
              </div>
              <div className="review-detail-item">
                <span className="label">Role Offered</span>
                <span className="value">{company.jobRole || '—'}</span>
              </div>

              <div className="review-resume-box">
                <div>
                  <span className="label" style={{ display: 'block' }}>
                    Candidate Resume
                  </span>
                  <span style={{ fontSize: '0.85rem', color: '#475569' }}>
                    {resume?.filename ? (
                      <>📄 {resume.filename}</>
                    ) : (
                      'No resume uploaded'
                    )}
                  </span>
                </div>
                {resume?.filename && (
                  <button
                    type="button"
                    className="students-refresh"
                    style={{
                      backgroundColor: '#2563eb',
                      color: '#ffffff',
                      borderColor: '#2563eb',
                      fontSize: '0.8rem',
                      padding: '4px 10px',
                    }}
                    onClick={handleOpenResume}
                    disabled={viewingResume}
                  >
                    {viewingResume ? 'Loading...' : '👁 View Resume PDF'}
                  </button>
                )}
              </div>
            </div>

            <div className="review-status-selector">
              <label>Update Candidate Status *</label>
              <div className="review-status-pills">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    type="button"
                    key={opt}
                    className={`review-status-pill ${
                      status === opt ? `active-${opt}` : ''
                    }`}
                    onClick={() => setStatus(opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="review-remarks-group">
              <label htmlFor="review-remarks">Decision Remarks / Notes (Optional)</label>
              <textarea
                id="review-remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="e.g. Cleared technical interview; awaiting HR discussion."
                rows={3}
              />
            </div>
          </div>

          <div className="review-modal-footer">
            <button
              type="button"
              className="review-btn-cancel"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="review-btn-save"
              disabled={submitting}
            >
              {submitting ? 'Saving Decision...' : 'Save Decision'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ApplicationReviewModal;
