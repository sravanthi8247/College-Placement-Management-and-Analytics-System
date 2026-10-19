import api from './api.js';

export const getAnalytics = async () => {
  const response = await api.get('/analytics');
  return response.data;
};

export const downloadReport = async (type, fallbackName) => {
  const response = await api.get(`/analytics/export/${type}`, {
    responseType: 'blob',
  });

  const contentType = response.headers['content-type'] || '';

  if (contentType.includes('application/json')) {
    const text = await response.data.text();
    const payload = JSON.parse(text);
    throw new Error(payload.message || 'No data available to export.');
  }

  const blob = new Blob([response.data], {
    type: contentType || (type === 'pdf' ? 'application/pdf' : 'text/csv;charset=utf-8;'),
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fallbackName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
