import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import Alert from '../components/ui/Alert';
import {
  getMyStudentProfile,
  updateMyStudentProfile,
  uploadResume,
  deleteResume,
  openResumeInNewTab,
} from '../services/studentService';
import '../components/CompanyForm.css';
import './Students.css';

const emptyForm = {
  name: '',
  email: '',
  rollNo: '',
  branch: '',
  year: '',
  cgpa: '',
  phone: '',
  skills: '',
};

function Profile() {
  const [formData, setFormData] = useState(emptyForm);
  const [placementStatus, setPlacementStatus] = useState('Not Placed');
  const [resume, setResume] = useState(null);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [resumeMessage, setResumeMessage] = useState('');
  const [resumeError, setResumeError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const profile = await getMyStudentProfile();
        setFormData({
          name: profile.name || '',
          email: profile.email || '',
          rollNo: profile.rollNo || '',
          branch: profile.branch || '',
          year: profile.year || '',
          cgpa: profile.cgpa ?? '',
          phone: profile.phone || '',
          skills: (profile.skills || []).join(', '),
        });
        setPlacementStatus(profile.placementStatus || 'Not Placed');
        setResume(profile.resume || null);
      } catch (err) {
        setError(
          err.response?.data?.message ||
            'Unable to load your student profile. Ask an admin to create it if needed.'
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const handleResumeSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setResumeError('');
    setResumeMessage('');

    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'pdf' && file.type !== 'application/pdf') {
      setResumeError('Please select a valid PDF file (.pdf).');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setResumeError('File size exceeds 2 MB. Please select a smaller PDF.');
      return;
    }

    setUploadingResume(true);
    setUploadProgress(0);

    try {
      const result = await uploadResume(file, (percent) => setUploadProgress(percent));
      setResume(result.resume);
      setResumeMessage('Resume uploaded and attached to your profile successfully.');
    } catch (err) {
      setResumeError(err.response?.data?.message || 'Failed to upload resume.');
    } finally {
      setUploadingResume(false);
      e.target.value = '';
    }
  };

  const handleDeleteResume = async () => {
    if (!window.confirm('Are you sure you want to remove your resume from your profile?')) {
      return;
    }

    setResumeError('');
    setResumeMessage('');

    try {
      await deleteResume();
      setResume(null);
      setResumeMessage('Resume removed successfully.');
    } catch (err) {
      setResumeError(err.response?.data?.message || 'Failed to remove resume.');
    }
  };

  const handleViewResume = async () => {
    setResumeError('');
    setResumeMessage('');
    try {
      await openResumeInNewTab('me');
    } catch (err) {
      setResumeError(err.response?.data?.message || err.message || 'Failed to open resume.');
    }
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const cgpa = Number(formData.cgpa);
    const year = Number(formData.year);

    if (Number.isNaN(cgpa) || cgpa < 0 || cgpa > 10) {
      setError('CGPA must be between 0 and 10.');
      return;
    }

    if (Number.isNaN(year) || year < 1 || year > 4) {
      setError('Year must be between 1 and 4.');
      return;
    }

    setSaving(true);

    try {
      const updated = await updateMyStudentProfile({
        ...formData,
        year,
        cgpa,
        skills: formData.skills,
      });
      setPlacementStatus(updated.placementStatus || placementStatus);
      setSuccess('Profile updated successfully.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout title="My Profile" eyebrow="Student / Profile">
      <main className="students-main">
        <section className="students-form-panel">
        <div className="students-section-heading">
          <div>
            <h2>Academic and contact details</h2>
            <p>
              These details are used to check eligibility for placement drives.
              Placement status is updated by the placement cell.
            </p>
          </div>
          <span className={`students-status ${
            placementStatus === 'Placed'
              ? 'students-status-placed'
              : 'students-status-pending'
          }`}>
            {placementStatus}
          </span>
        </div>

        {loading ? (
          <p>Loading profile...</p>
        ) : (
          <form className="company-drive-form" onSubmit={handleSubmit}>
            <Alert type="error" message={error} />
            <Alert type="success" message={success} />

            <label>
              Full name *
              <input name="name" value={formData.name} onChange={handleChange} required />
            </label>
            <label>
              Email *
              <input type="email" name="email" value={formData.email} onChange={handleChange} required />
            </label>
            <label>
              Roll number *
              <input name="rollNo" value={formData.rollNo} onChange={handleChange} required />
            </label>
            <label>
              Branch *
              <input name="branch" value={formData.branch} onChange={handleChange} required />
            </label>
            <label>
              Year *
              <select name="year" value={formData.year} onChange={handleChange} required>
                <option value="">Select year</option>
                <option value="1">1st Year</option>
                <option value="2">2nd Year</option>
                <option value="3">3rd Year</option>
                <option value="4">4th Year</option>
              </select>
            </label>
            <label>
              CGPA *
              <input
                type="number"
                name="cgpa"
                min="0"
                max="10"
                step="0.01"
                value={formData.cgpa}
                onChange={handleChange}
                required
              />
            </label>
            <label>
              Phone *
              <input name="phone" value={formData.phone} onChange={handleChange} required />
            </label>
            <label>
              Skills
              <input
                name="skills"
                value={formData.skills}
                onChange={handleChange}
                placeholder="Java, SQL, React"
              />
              <small>Separate skills with commas. Skills are informational.</small>
            </label>
            <button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save profile'}
            </button>
          </form>
        )}
      </section>

      {/* Resume Upload & Management Section */}
      <section className="students-form-panel" style={{ marginTop: 24 }}>
        <div className="students-section-heading">
          <div>
            <h2>Resume / Curriculum Vitae</h2>
            <p>
              Upload your resume in PDF format (maximum 2 MB). Your resume will be accessible to authorized placement cell administrators during application review.
            </p>
          </div>
          {resume?.filename && (
            <span className="students-status students-status-placed" style={{ fontSize: '0.8rem' }}>
              ✓ Resume on File
            </span>
          )}
        </div>

        <Alert type="error" message={resumeError} />
        <Alert type="success" message={resumeMessage} />

        {resume?.filename ? (
          <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <p style={{ fontWeight: 700, color: '#0f172a', margin: 0, fontSize: '0.95rem' }}>
                  📄 {resume.filename}
                </p>
                <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: '0.82rem' }}>
                  Uploaded on {new Date(resume.uploadedAt).toLocaleDateString()} &bull;{' '}
                  {resume.size ? `${(resume.size / 1024).toFixed(1)} KB` : 'PDF Document'}
                </p>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="students-refresh"
                  style={{ backgroundColor: '#2563eb', color: '#fff', borderColor: '#2563eb', minHeight: '36px', touchAction: 'manipulation' }}
                  onClick={handleViewResume}
                >
                  👁 View Resume
                </button>
                <button
                  type="button"
                  className="students-refresh"
                  style={{ color: '#dc2626', borderColor: '#fca5a5', minHeight: '36px', touchAction: 'manipulation' }}
                  onClick={handleDeleteResume}
                >
                  ✕ Remove
                </button>
              </div>
            </div>

            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #e2e8f0' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                Replace with a new resume:
              </label>
              <input
                type="file"
                accept=".pdf,application/pdf"
                disabled={uploadingResume}
                onChange={handleResumeSelect}
                style={{ fontSize: '0.85rem' }}
              />
            </div>
          </div>
        ) : (
          <div style={{ backgroundColor: '#f8fafc', border: '2px dashed #cbd5e1', borderRadius: 8, padding: 24, textAlign: 'center' }}>
            <p style={{ fontSize: '1.8rem', margin: '0 0 8px' }}>📄</p>
            <p style={{ fontWeight: 600, color: '#1e293b', margin: '0 0 4px' }}>
              No resume uploaded yet
            </p>
            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 16px' }}>
              Upload your latest resume in PDF format (maximum 2 MB).
            </p>
            <label
              style={{
                display: 'inline-block',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                padding: '8px 18px',
                borderRadius: 6,
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: uploadingResume ? 'wait' : 'pointer',
              }}
            >
              {uploadingResume ? `Uploading (${uploadProgress}%)...` : '📁 Upload PDF Resume'}
              <input
                type="file"
                accept=".pdf,application/pdf"
                disabled={uploadingResume}
                onChange={handleResumeSelect}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        )}

        {uploadingResume && (
          <div style={{ marginTop: 12 }}>
            <div style={{ width: '100%', height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${uploadProgress}%`,
                  height: '100%',
                  backgroundColor: '#2563eb',
                  transition: 'width 0.2s ease',
                }}
              />
            </div>
            <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4, textAlign: 'right' }}>
              Uploading... {uploadProgress}%
            </p>
          </div>
        )}
      </section>

      {/* Account Security & Password Management Section */}
      <section className="students-form-panel" style={{ marginTop: 24 }}>
        <div className="students-section-heading">
          <div>
            <h2>Account Security</h2>
            <p>
              Manage your account password and security credentials.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 18 }}>
          <div>
            <p style={{ fontWeight: 700, color: '#0f172a', margin: 0, fontSize: '0.95rem' }}>
              🔒 Account Password
            </p>
            <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: '0.82rem' }}>
              We recommend using a strong password that you do not use on other sites.
            </p>
          </div>
          <Link
            to="/change-password"
            className="students-refresh"
            style={{ textDecoration: 'none', backgroundColor: '#2563eb', color: '#ffffff', borderColor: '#2563eb', display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: '38px', touchAction: 'manipulation' }}
          >
            <span>🔒</span> Change Password
          </Link>
        </div>
      </section>
      </main>
    </AppLayout>
  );
}

export default Profile;
