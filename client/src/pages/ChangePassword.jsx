import { useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import Alert from '../components/ui/Alert';
import { changePassword } from '../services/authService';
import '../components/CompanyForm.css';
import './Students.css';

function ChangePassword() {
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const { currentPassword, newPassword, confirmPassword } = formData;

    if (!currentPassword) {
      setError('Current password is required.');
      return;
    }

    if (!newPassword) {
      setError('New password is required.');
      return;
    }

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }

    if (!confirmPassword) {
      setError('Please confirm your new password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    if (currentPassword === newPassword) {
      setError('New password must be different from current password.');
      return;
    }

    setSaving(true);

    try {
      const response = await changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      setSuccess(response.message || 'Password changed successfully.');
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          'Failed to change password. Please check your current password and try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout title="Change Password" eyebrow="Account Security">
      <section className="students-form-panel" style={{ maxWidth: 640 }}>
        <div className="students-section-heading">
          <div>
            <h2>Update Your Password</h2>
            <p>
              Ensure your account is protected with a strong password of at least 6 characters.
            </p>
          </div>
        </div>

        <form className="company-drive-form" onSubmit={handleSubmit} noValidate>
          <Alert type="error" message={error} />
          <Alert type="success" message={success} />

          <div style={{ marginBottom: 16 }}>
            <label htmlFor="currentPassword" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
              Current Password *
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                id="currentPassword"
                name="currentPassword"
                type={showCurrent ? 'text' : 'password'}
                value={formData.currentPassword}
                onChange={handleChange}
                required
                autoComplete="current-password"
                placeholder="Enter current password"
                style={{ width: '100%', paddingRight: 70 }}
              />
              <button
                type="button"
                onClick={() => setShowCurrent((prev) => !prev)}
                aria-label={showCurrent ? 'Hide current password' : 'Show current password'}
                style={{
                  position: 'absolute',
                  right: 8,
                  background: 'none',
                  border: 'none',
                  color: '#475569',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  padding: '4px 8px',
                  fontWeight: 500,
                }}
              >
                {showCurrent ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label htmlFor="newPassword" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
              New Password *
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                id="newPassword"
                name="newPassword"
                type={showNew ? 'text' : 'password'}
                value={formData.newPassword}
                onChange={handleChange}
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="Enter new password (min. 6 characters)"
                style={{ width: '100%', paddingRight: 70 }}
              />
              <button
                type="button"
                onClick={() => setShowNew((prev) => !prev)}
                aria-label={showNew ? 'Hide new password' : 'Show new password'}
                style={{
                  position: 'absolute',
                  right: 8,
                  background: 'none',
                  border: 'none',
                  color: '#475569',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  padding: '4px 8px',
                  fontWeight: 500,
                }}
              >
                {showNew ? 'Hide' : 'Show'}
              </button>
            </div>
            <small style={{ color: '#64748b', marginTop: 4, display: 'block' }}>
              Must be at least 6 characters and different from your current password.
            </small>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label htmlFor="confirmPassword" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
              Confirm New Password *
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirm ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                autoComplete="new-password"
                placeholder="Re-enter new password"
                style={{ width: '100%', paddingRight: 70 }}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((prev) => !prev)}
                aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                style={{
                  position: 'absolute',
                  right: 8,
                  background: 'none',
                  border: 'none',
                  color: '#475569',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  padding: '4px 8px',
                  fontWeight: 500,
                }}
              >
                {showConfirm ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button type="submit" disabled={saving}>
              {saving ? 'Updating password...' : 'Update Password'}
            </button>
          </div>
        </form>
      </section>
    </AppLayout>
  );
}

export default ChangePassword;
