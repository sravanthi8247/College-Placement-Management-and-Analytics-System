import api from './api.js';

export const getCompanies = async (params = {}) => {
  const response = await api.get('/companies', { params });
  return response.data;
};

export const getCompanyById = async (id) => {
  const response = await api.get(`/companies/${id}`);
  return response.data;
};

export const addCompany = async (companyData) => {
  const response = await api.post('/companies', companyData);
  return response.data;
};

export const updateCompany = async (id, companyData) => {
  const response = await api.put(`/companies/${id}`, companyData);
  return response.data;
};

export const deleteCompany = async (id) => {
  const response = await api.delete(`/companies/${id}`);
  return response.data;
};

export const checkMyEligibility = async (companyId) => {
  const response = await api.get(`/companies/${companyId}/eligibility/me`);
  return response.data;
};

export const checkStudentEligibility = async (companyId, studentId) => {
  const response = await api.get(`/companies/${companyId}/eligibility/${studentId}`);
  return response.data;
};

export const getEligibleStudents = async (companyId) => {
  const response = await api.get(`/companies/${companyId}/eligible-students`);
  return response.data;
};
