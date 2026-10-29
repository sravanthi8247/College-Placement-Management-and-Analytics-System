import api from './api.js';

export const getStudents = async (params = {}) => {
  const response = await api.get('/students', { params });
  return response.data;
};

export const getMyStudentProfile = async () => {
  const response = await api.get('/students/me');
  return response.data;
};

export const updateMyStudentProfile = async (studentData) => {
  const response = await api.put('/students/me', studentData);
  return response.data;
};

export const addStudent = async (studentData) => {
  const response = await api.post('/students', studentData);
  return response.data;
};

export const updateStudent = async (id, studentData) => {
  const response = await api.put(`/students/${id}`, studentData);
  return response.data;
};

export const deleteStudent = async (id) => {
  const response = await api.delete(`/students/${id}`);
  return response.data;
};

export const getDashboardStats = async () => {
  const response = await api.get('/students/dashboard/stats');
  return response.data;
};

export const downloadImportTemplate = async (format = 'csv') => {
  const response = await api.get('/students/import/template', {
    params: { format },
    responseType: 'blob',
  });

  const blob = new Blob([response.data], {
    type:
      format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv;charset=utf-8;',
  });
  const filename = `student_import_template.${format}`;
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const previewBulkImport = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post('/students/import/preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const executeBulkImport = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post('/students/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const downloadImportErrors = async (errors) => {
  const response = await api.post(
    '/students/import/error-report',
    { errors },
    { responseType: 'blob' }
  );

  const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'student_import_errors.csv');
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const uploadResume = async (file, onProgress) => {
  const formData = new FormData();
  formData.append('resume', file);

  const response = await api.post('/students/me/resume', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percent);
      }
    },
  });
  return response.data;
};

export const deleteResume = async () => {
  const response = await api.delete('/students/me/resume');
  return response.data;
};

export const getResumeBlob = async (studentId = 'me') => {
  try {
    const response = await api.get(`/students/${studentId}/resume`, {
      responseType: 'blob',
    });
    return response.data;
  } catch (err) {
    if (err.response?.data instanceof Blob) {
      try {
        const text = await err.response.data.text();
        const json = JSON.parse(text);
        if (json && json.message) {
          err.response.data = json;
          err.message = json.message;
        }
      } catch {
        // Not a JSON error blob; preserve original error
      }
    }
    throw err;
  }
};

export const openResumeInNewTab = async (studentId = 'me') => {
  // Pre-open new tab synchronously during user gesture to prevent browser popup blockers
  let newTab = null;
  try {
    newTab = typeof window !== 'undefined' && window.open ? window.open('about:blank', '_blank') : null;
    if (newTab) {
      newTab.document.title = 'Loading Resume...';
      newTab.document.body.innerHTML = `
        <div style="font-family: system-ui, -apple-system, sans-serif; display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; color: #334155; background-color: #f8fafc;">
          <div style="border: 3px solid #cbd5e1; border-top-color: #2563eb; border-radius: 50%; width: 36px; height: 36px; animation: spin 1s linear infinite; margin-bottom: 16px;"></div>
          <p style="font-size: 1rem; font-weight: 500; margin: 0;">Loading candidate resume...</p>
          <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
        </div>
      `;
    }
  } catch {
    newTab = null;
  }

  try {
    const blob = await getResumeBlob(studentId);
    const pdfBlob = new Blob([blob], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(pdfBlob);

    if (newTab && !newTab.closed) {
      newTab.location.href = url;
    } else {
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      link.remove();
    }

    setTimeout(() => window.URL.revokeObjectURL(url), 120000);
  } catch (err) {
    if (newTab && !newTab.closed) {
      newTab.close();
    }
    throw err;
  }
};
