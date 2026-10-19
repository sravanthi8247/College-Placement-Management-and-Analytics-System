import api from './api.js';

export const getApplications = async (params = {}) => {
  const response = await api.get('/applications', { params });
  return response.data;
};

export const applyToDrive = async (companyId) => {
  const response = await api.post('/applications', { companyId });
  return response.data;
};

export const updateApplicationStatus = async (id, data) => {
  const response = await api.put(`/applications/${id}`, data);
  return response.data;
};

export const getApplicationStats = async (companyId) => {
  const response = await api.get(`/applications/stats/${companyId}`);
  return response.data;
};
