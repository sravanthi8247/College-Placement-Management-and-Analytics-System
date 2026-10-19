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
  const response = await api.get(`/students/${studentId}/resume`, {
    responseType: 'blob',
  });
  return response.data;
};

export const openResumeInNewTab = async (studentId = 'me') => {
  const blob = await getResumeBlob(studentId);
  const pdfBlob = new Blob([blob], { type: 'application/pdf' });
  const url = window.URL.createObjectURL(pdfBlob);
  window.open(url, '_blank');
  setTimeout(() => window.URL.revokeObjectURL(url), 60000);
};