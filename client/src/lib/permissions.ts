// Permission system for role-based access control

export const PERMISSIONS = {
  // Company Management
  MANAGE_COMPANY: 'manage_company',
  VIEW_COMPANY: 'view_company',
  
  // Team Management
  INVITE_TEAM_MEMBERS: 'invite_team_members',
  MANAGE_TEAM_MEMBERS: 'manage_team_members',
  VIEW_TEAM_MEMBERS: 'view_team_members',
  
  // Facility Management
  CREATE_FACILITIES: 'create_facilities',
  EDIT_FACILITIES: 'edit_facilities',
  DELETE_FACILITIES: 'delete_facilities',
  VIEW_FACILITIES: 'view_facilities',
  
  // Application Management
  CREATE_APPLICATIONS: 'create_applications',
  EDIT_APPLICATIONS: 'edit_applications',
  SUBMIT_APPLICATIONS: 'submit_applications',
  DELETE_APPLICATIONS: 'delete_applications',
  VIEW_APPLICATIONS: 'view_applications',
  REVIEW_APPLICATIONS: 'review_applications',
  
  // Document Management
  UPLOAD_DOCUMENTS: 'upload_documents',
  DELETE_DOCUMENTS: 'delete_documents',
  VIEW_DOCUMENTS: 'view_documents',
  DOWNLOAD_DOCUMENTS: 'download_documents',
  
  // Contractor Management
  MANAGE_CONTRACTORS: 'manage_contractors',
  VIEW_CONTRACTORS: 'view_contractors',
  
  // System Admin
  SYSTEM_ADMIN: 'system_admin',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// Role-based permissions mapping
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  company_admin: [
    PERMISSIONS.MANAGE_COMPANY,
    PERMISSIONS.VIEW_COMPANY,
    PERMISSIONS.INVITE_TEAM_MEMBERS,
    PERMISSIONS.MANAGE_TEAM_MEMBERS,
    PERMISSIONS.VIEW_TEAM_MEMBERS,
    PERMISSIONS.CREATE_FACILITIES,
    PERMISSIONS.EDIT_FACILITIES,
    PERMISSIONS.DELETE_FACILITIES,
    PERMISSIONS.VIEW_FACILITIES,
    PERMISSIONS.CREATE_APPLICATIONS,
    PERMISSIONS.EDIT_APPLICATIONS,
    PERMISSIONS.SUBMIT_APPLICATIONS,
    PERMISSIONS.DELETE_APPLICATIONS,
    PERMISSIONS.VIEW_APPLICATIONS,
    PERMISSIONS.UPLOAD_DOCUMENTS,
    PERMISSIONS.DELETE_DOCUMENTS,
    PERMISSIONS.VIEW_DOCUMENTS,
    PERMISSIONS.DOWNLOAD_DOCUMENTS,
    PERMISSIONS.MANAGE_CONTRACTORS,
    PERMISSIONS.VIEW_CONTRACTORS,
  ],
  
  team_member: [
    PERMISSIONS.VIEW_COMPANY,
    PERMISSIONS.VIEW_TEAM_MEMBERS,
    PERMISSIONS.VIEW_FACILITIES,
    PERMISSIONS.VIEW_APPLICATIONS,
    PERMISSIONS.VIEW_DOCUMENTS,
    PERMISSIONS.DOWNLOAD_DOCUMENTS,
    PERMISSIONS.VIEW_CONTRACTORS,
  ],
  
  contractor_individual: [
    PERMISSIONS.VIEW_COMPANY,
    PERMISSIONS.VIEW_FACILITIES,
    PERMISSIONS.VIEW_APPLICATIONS,
    PERMISSIONS.UPLOAD_DOCUMENTS,
    PERMISSIONS.VIEW_DOCUMENTS,
    PERMISSIONS.DOWNLOAD_DOCUMENTS,
  ],
  
  contractor_account_owner: [
    PERMISSIONS.VIEW_COMPANY,
    PERMISSIONS.INVITE_TEAM_MEMBERS,
    PERMISSIONS.MANAGE_TEAM_MEMBERS,
    PERMISSIONS.VIEW_TEAM_MEMBERS,
    PERMISSIONS.VIEW_FACILITIES,
    PERMISSIONS.VIEW_APPLICATIONS,
    PERMISSIONS.EDIT_APPLICATIONS,
    PERMISSIONS.UPLOAD_DOCUMENTS,
    PERMISSIONS.VIEW_DOCUMENTS,
    PERMISSIONS.DOWNLOAD_DOCUMENTS,
    PERMISSIONS.MANAGE_CONTRACTORS,
    PERMISSIONS.VIEW_CONTRACTORS,
  ],
  
  contractor_manager: [
    PERMISSIONS.VIEW_COMPANY,
    PERMISSIONS.INVITE_TEAM_MEMBERS,
    PERMISSIONS.MANAGE_TEAM_MEMBERS,
    PERMISSIONS.VIEW_TEAM_MEMBERS,
    PERMISSIONS.VIEW_FACILITIES,
    PERMISSIONS.VIEW_APPLICATIONS,
    PERMISSIONS.EDIT_APPLICATIONS,
    PERMISSIONS.UPLOAD_DOCUMENTS,
    PERMISSIONS.VIEW_DOCUMENTS,
    PERMISSIONS.DOWNLOAD_DOCUMENTS,
    PERMISSIONS.VIEW_CONTRACTORS,
  ],
  
  contractor_team_member: [
    PERMISSIONS.VIEW_COMPANY,
    PERMISSIONS.VIEW_TEAM_MEMBERS,
    PERMISSIONS.VIEW_FACILITIES,
    PERMISSIONS.VIEW_APPLICATIONS,
    PERMISSIONS.UPLOAD_DOCUMENTS,
    PERMISSIONS.VIEW_DOCUMENTS,
    PERMISSIONS.DOWNLOAD_DOCUMENTS,
    PERMISSIONS.VIEW_CONTRACTORS,
  ],
  
  system_admin: [
    PERMISSIONS.SYSTEM_ADMIN,
    ...Object.values(PERMISSIONS),
  ],
};

// Permission check functions
export function hasPermission(userRole: string, permission: Permission): boolean {
  const rolePermissions = ROLE_PERMISSIONS[userRole] || [];
  return rolePermissions.includes(permission);
}

export function hasAnyPermission(userRole: string, permissions: Permission[]): boolean {
  return permissions.some(permission => hasPermission(userRole, permission));
}

export function hasAllPermissions(userRole: string, permissions: Permission[]): boolean {
  return permissions.every(permission => hasPermission(userRole, permission));
}

// Role information
export const ROLE_INFO = {
  company_admin: {
    label: 'Company Administrator',
    description: 'Full company control including company profile changes and team management',
    color: 'blue',
  },
  team_member: {
    label: 'Team Member',
    description: 'Can create and manage applications, upload documents, view company data',
    color: 'green',
  },
  contractor_individual: {
    label: 'Individual Contractor',
    description: 'Limited access to view applications and upload documents',
    color: 'yellow',
  },
  system_admin: {
    label: 'System Admin',
    description: 'Full system access and administrative capabilities',
    color: 'red',
  },
};

export function getRoleInfo(role: string) {
  return ROLE_INFO[role as keyof typeof ROLE_INFO] || ROLE_INFO.team_member;
}

// Permission level functions for team members
export function hasPermissionLevel(user: any, requiredLevel: string): boolean {
  if (!user) return false;
  
  // Company admin and system admin have all permissions
  if (user.role === 'company_admin' || user.role === 'system_admin') {
    return true;
  }
  
  // For team members, check permission level
  if (user.role === 'team_member') {
    const userLevel = user.permissionLevel || 'viewer';
    
    switch (requiredLevel) {
      case 'viewer':
        return ['viewer', 'editor', 'manager'].includes(userLevel);
      case 'editor':
        return ['editor', 'manager'].includes(userLevel);
      case 'manager':
        return userLevel === 'manager';
      default:
        return false;
    }
  }
  
  return false;
}

export function canInviteUsers(user: any): boolean {
  return user?.role === 'company_admin' || hasPermissionLevel(user, 'manager');
}

export function canEditPermissions(user: any): boolean {
  return user?.role === 'company_admin' || hasPermissionLevel(user, 'manager');
}

export function canCreateEdit(user: any): boolean {
  return user?.role === 'company_admin' || hasPermissionLevel(user, 'editor');
}

export function canViewOnly(user: any): boolean {
  return hasPermissionLevel(user, 'viewer');
}

// Permission level info
export const PERMISSION_LEVEL_INFO = {
  viewer: {
    label: 'Viewer',
    description: 'Read-only access to view company data',
    color: 'gray',
  },
  editor: {
    label: 'Editor', 
    description: 'Can create, edit and submit facilities and applications',
    color: 'blue',
  },
  manager: {
    label: 'Manager',
    description: 'Can invite users and assign permissions (except for other managers and company admin)',
    color: 'green',
  },
};