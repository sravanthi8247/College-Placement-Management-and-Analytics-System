import { useState } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import Alert from '../components/ui/Alert';
import {
  downloadImportTemplate,
  previewBulkImport,
  executeBulkImport,
  downloadImportErrors,
} from '../services/studentService';
import './Students.css';
import './Dashboard.css';

function BulkImportStudents() {
  const [file, setFile] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingImport, setLoadingImport] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [importSummary, setImportSummary] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    setError('');
    setSuccess('');
    setPreviewData(null);
    setImportSummary(null);

    if (!selected) {
      setFile(null);
      return;
    }

    const ext = selected.name.split('.').pop().toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      setError('Unsupported file type. Please select a CSV or Excel (.xlsx, .xls) file.');
      setFile(null);
      return;
    }

    if (selected.size > 5 * 1024 * 1024) {
      setError('File size exceeds the 5MB limit. Please upload a smaller file.');
      setFile(null);
      return;
    }

    setFile(selected);
  };

  const handleDownloadTemplate = async (format) => {
    setError('');
    try {
      await downloadImportTemplate(format);
    } catch (err) {
      setError('Unable to download template. Please try again.');
    }
  };

  const handlePreview = async () => {
    if (!file) {
      setError('Please select a file to preview.');
      return;
    }

    setError('');
    setSuccess('');
    setLoadingPreview(true);

    try {
      const data = await previewBulkImport(file);
      setPreviewData(data);
      if (data.summary.validCount === 0 && data.summary.totalRows > 0) {
        setError('No valid rows found in the uploaded file. Check the validation errors below.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to parse and validate file.');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!file) {
      setError('Please select a file to import.');
      return;
    }

    setError('');
    setSuccess('');
    setLoadingImport(true);

    try {
      const result = await executeBulkImport(file);
      setImportSummary(result.summary);
      setSuccess(`Successfully imported ${result.summary.importedCount} student records.`);
      setPreviewData(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Import operation failed.');
    } finally {
      setLoadingImport(false);
    }
  };

  const handleDownloadErrors = async () => {
    const errorsList = previewData?.errors || importSummary?.errors || [];
    if (!errorsList.length) return;

    try {
      await downloadImportErrors(errorsList);
    } catch (err) {
      setError('Failed to download error report.');
    }
  };

  const resetAll = () => {
    setFile(null);
    setPreviewData(null);
    setImportSummary(null);
    setError('');
    setSuccess('');
  };

  return (
    <AppLayout title="Bulk Student Import" eyebrow="Admin / Students / Import">
      <div style={{ marginBottom: 16 }}>
        <Link to="/students" style={{ color: '#2563eb', textDecoration: 'none' }}>
          ← Back to Student Directory
        </Link>
      </div>

      <Alert type="error" message={error} />
      <Alert type="success" message={success} />

      {/* Step 1 & 2: Template and File Upload Section */}
      <section className="students-form-panel" style={{ marginBottom: 24 }}>
        <div className="students-section-heading">
          <div>
            <h2>Upload Student Spreadsheet</h2>
            <p>Import thousands of students in batch using CSV or Excel (.xlsx) spreadsheets.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="students-refresh"
              onClick={() => handleDownloadTemplate('csv')}
            >
              📥 CSV Template
            </button>
            <button
              type="button"
              className="students-refresh"
              onClick={() => handleDownloadTemplate('xlsx')}
            >
              📥 Excel Template
            </button>
          </div>
        </div>

        <div
          style={{
            background: 'var(--color-surface, #f8fafc)',
            padding: 16,
            borderRadius: 8,
            marginBottom: 20,
            border: '1px solid #e2e8f0',
          }}
        >
          <strong style={{ display: 'block', marginBottom: 6, color: '#1e293b' }}>
            🔒 Secure Student Account Activation
          </strong>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>
            Student passwords are never collected in the spreadsheet. When students register on the
            Placement Portal with their college email, their pre-imported academic record, CGPA, and
            roll number automatically link to their account. Existing students and their placement
            status will not be overwritten.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ flex: 1, minWidth: 260 }}>
            <span style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>
              Select CSV or Excel (.xlsx) file (Max 5MB / 5,000 rows)
            </span>
            <input
              type="file"
              accept=".csv, .xlsx, .xls"
              onChange={handleFileChange}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                background: '#fff',
              }}
            />
          </label>

          <div style={{ marginTop: 22, display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="companies-edit-btn"
              onClick={handlePreview}
              disabled={!file || loadingPreview || loadingImport}
            >
              {loadingPreview ? 'Validating File...' : 'Preview & Validate'}
            </button>
            {file && (
              <button
                type="button"
                className="companies-cancel"
                onClick={resetAll}
                disabled={loadingPreview || loadingImport}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Step 3: Validation Summary & Preview */}
      {previewData && (
        <section style={{ marginBottom: 28 }}>
          <div className="students-stats" style={{ marginBottom: 20 }}>
            <article className="students-stat-card">
              <div>
                <p>Total Rows</p>
                <h2>{previewData.summary.totalRows}</h2>
              </div>
            </article>
            <article className="students-stat-card">
              <div>
                <p>Ready to Import</p>
                <h2 style={{ color: '#10b981' }}>{previewData.summary.validCount}</h2>
              </div>
            </article>
            <article className="students-stat-card">
              <div>
                <p>Skipped Duplicates</p>
                <h2 style={{ color: '#f59e0b' }}>{previewData.summary.duplicateCount}</h2>
              </div>
            </article>
            <article className="students-stat-card">
              <div>
                <p>Invalid Rows</p>
                <h2 style={{ color: '#ef4444' }}>{previewData.summary.invalidCount}</h2>
              </div>
            </article>
          </div>

          {/* Validation Actions */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              {previewData.summary.validCount > 0 ? (
                <button
                  type="button"
                  className="companies-edit-btn"
                  style={{ fontSize: '1rem', padding: '10px 20px' }}
                  onClick={handleExecuteImport}
                  disabled={loadingImport}
                >
                  {loadingImport
                    ? 'Importing in batches...'
                    : `Confirm & Import ${previewData.summary.validCount} Students`}
                </button>
              ) : (
                <span style={{ color: '#ef4444', fontWeight: 600 }}>
                  Fix the errors below before importing.
                </span>
              )}
            </div>

            {previewData.errors.length > 0 && (
              <button
                type="button"
                className="students-refresh"
                onClick={handleDownloadErrors}
              >
                📥 Download Error Report ({previewData.errors.length})
              </button>
            )}
          </div>

          {/* Errors table if any */}
          {previewData.errors.length > 0 && (
            <div className="companies-form-panel" style={{ marginBottom: 24 }}>
              <div className="companies-section-heading">
                <div>
                  <h3 style={{ color: '#b91c1c' }}>
                    Validation & Duplicate Warnings ({previewData.errors.length})
                  </h3>
                  <p>These rows will be skipped during import without affecting valid records.</p>
                </div>
              </div>
              <div className="companies-table-scroll">
                <table className="companies-table">
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Roll Number</th>
                      <th>Student Name</th>
                      <th>Email</th>
                      <th>Reason / Issues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.errors.slice(0, 50).map((err, idx) => (
                      <tr key={idx}>
                        <td>{err.rowNumber || '—'}</td>
                        <td>{err.rollNo || '—'}</td>
                        <td>{err.name || '—'}</td>
                        <td>{err.email || '—'}</td>
                        <td>
                          <span style={{ color: '#dc2626' }}>
                            {Array.isArray(err.issues) ? err.issues.join(' | ') : err.issues}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {previewData.errors.length > 50 && (
                <p style={{ marginTop: 8, fontSize: '0.85rem', color: '#64748b' }}>
                  Showing first 50 errors. Download the full error report CSV above.
                </p>
              )}
            </div>
          )}

          {/* Valid records preview table */}
          {previewData.preview.length > 0 && (
            <div className="companies-table-panel">
              <div className="companies-section-heading">
                <div>
                  <h3>Valid Records Preview (First {previewData.preview.length} rows)</h3>
                  <p>Verified against schema constraints and uniqueness indexes.</p>
                </div>
              </div>
              <div className="companies-table-scroll">
                <table className="companies-table">
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Roll Number</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Branch</th>
                      <th>Year</th>
                      <th>CGPA</th>
                      <th>Phone</th>
                      <th>Skills</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.preview.map((row) => (
                      <tr key={row.rowNumber}>
                        <td>{row.rowNumber}</td>
                        <td>
                          <strong>{row.rollNo}</strong>
                        </td>
                        <td>{row.name}</td>
                        <td>{row.email}</td>
                        <td>{row.branch}</td>
                        <td>{row.year}</td>
                        <td>{row.cgpa}</td>
                        <td>{row.phone}</td>
                        <td>{(row.skills || []).join(', ') || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Step 4: Final Summary Report */}
      {importSummary && (
        <section className="companies-form-panel" style={{ marginTop: 20 }}>
          <div className="companies-section-heading">
            <div>
              <h2 style={{ color: '#047857' }}>Bulk Import Completed</h2>
              <p>Mongoose batch insertion completed with status reporting.</p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Link to="/students">
                <button type="button" className="companies-edit-btn">
                  View Student Directory →
                </button>
              </Link>
              <button type="button" className="companies-cancel" onClick={resetAll}>
                Import Another File
              </button>
            </div>
          </div>

          <div className="students-stats" style={{ margin: '16px 0' }}>
            <article className="students-stat-card">
              <div>
                <p>Processed</p>
                <h2>{importSummary.totalRows}</h2>
              </div>
            </article>
            <article className="students-stat-card">
              <div>
                <p>Successfully Imported</p>
                <h2 style={{ color: '#10b981' }}>{importSummary.importedCount}</h2>
              </div>
            </article>
            <article className="students-stat-card">
              <div>
                <p>Skipped Duplicates</p>
                <h2 style={{ color: '#f59e0b' }}>{importSummary.skippedDuplicates}</h2>
              </div>
            </article>
            <article className="students-stat-card">
              <div>
                <p>Failed Records</p>
                <h2 style={{ color: '#ef4444' }}>{importSummary.failedCount}</h2>
              </div>
            </article>
          </div>

          {importSummary.errors?.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <button
                type="button"
                className="students-refresh"
                onClick={handleDownloadErrors}
              >
                📥 Download Skipped / Failed Rows ({importSummary.errors.length})
              </button>
            </div>
          )}
        </section>
      )}
    </AppLayout>
  );
}

export default BulkImportStudents;
