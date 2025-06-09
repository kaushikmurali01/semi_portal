import { apiRequest } from "./queryClient";

export interface CreateCompanyData {
  name: string;
  shortName: string;
  address?: string;
  phone?: string;
  website?: string;
}

export interface CreateFacilityData {
  name: string;
  code: string;
  address?: string;
  description?: string;
}

export interface CreateApplicationData {
  facilityId: number;
  activityType: string;
  title: string;
  description?: string;
}

export interface UpdateApplicationData {
  status?: string;
  title?: string;
  description?: string;
  reviewNotes?: string;
}

export interface UploadDocumentData {
  files: FileList;
  applicationId?: number;
  documentType: string;
}

// Company API
export const companyApi = {
  create: async (data: CreateCompanyData) => {
    const response = await apiRequest('POST', '/api/companies', data);
    return response.json();
  },

  getCurrent: async () => {
    const response = await apiRequest('GET', '/api/companies/current');
    return response.json();
  }
};

// Facility API
export const facilityApi = {
  create: async (data: CreateFacilityData) => {
    const response = await apiRequest('POST', '/api/facilities', data);
    return response.json();
  },

  getAll: async () => {
    const response = await apiRequest('GET', '/api/facilities');
    return response.json();
  }
};

// Application API
export const applicationApi = {
  create: async (data: CreateApplicationData) => {
    const response = await apiRequest('POST', '/api/applications', data);
    return response.json();
  },

  getAll: async () => {
    const response = await apiRequest('GET', '/api/applications');
    return response.json();
  },

  update: async (id: number, data: UpdateApplicationData) => {
    const response = await apiRequest('PATCH', `/api/applications/${id}`, data);
    return response.json();
  },

  submit: async (id: number) => {
    const response = await apiRequest('PATCH', `/api/applications/${id}`, {
      status: 'submitted',
      submittedAt: new Date().toISOString()
    });
    return response.json();
  }
};

// Document API
export const documentApi = {
  upload: async (data: UploadDocumentData) => {
    const formData = new FormData();
    
    Array.from(data.files).forEach(file => {
      formData.append('files', file);
    });
    
    if (data.applicationId) {
      formData.append('applicationId', data.applicationId.toString());
    }
    formData.append('documentType', data.documentType);

    const response = await fetch('/api/documents/upload', {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Upload failed');
    }

    return response.json();
  },

  getByApplication: async (applicationId: number) => {
    const response = await apiRequest('GET', `/api/documents/application/${applicationId}`);
    return response.json();
  },

  getTemplates: async () => {
    const response = await apiRequest('GET', '/api/documents/templates');
    return response.json();
  },

  download: async (id: number) => {
    const response = await fetch(`/api/documents/${id}/download`, {
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error('Download failed');
    }

    return response.blob();
  },

  delete: async (id: number) => {
    await apiRequest('DELETE', `/api/documents/${id}`);
  }
};

// Team API
export const teamApi = {
  getMembers: async () => {
    const response = await apiRequest('GET', '/api/team');
    return response.json();
  },

  updateRole: async (userId: string, role: string) => {
    const response = await apiRequest('PATCH', `/api/users/${userId}/role`, { role });
    return response.json();
  }
};

// Dashboard API
export const dashboardApi = {
  getStats: async () => {
    const response = await apiRequest('GET', '/api/dashboard/stats');
    return response.json();
  }
};

// Activity Settings API
export const activityApi = {
  getSettings: async () => {
    const response = await apiRequest('GET', '/api/activity-settings');
    return response.json();
  },

  updateSettings: async (activityType: string, updates: any) => {
    const response = await apiRequest('PATCH', `/api/activity-settings/${activityType}`, updates);
    return response.json();
  }
};

// Admin API
export const adminApi = {
  getAllUsers: async () => {
    const response = await apiRequest('GET', '/api/admin/users');
    return response.json();
  },

  getAllApplications: async () => {
    const response = await apiRequest('GET', '/api/admin/applications');
    return response.json();
  },

  getApplicationStats: async () => {
    const response = await apiRequest('GET', '/api/admin/stats');
    return response.json();
  }
};
