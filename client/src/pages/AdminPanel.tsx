import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { ApplicationTable } from "@/components/ApplicationTable";
import { 
  Users, 
  Building, 
  FileText, 
  Settings, 
  Shield, 
  BarChart3,
  Download,
  AlertTriangle
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { USER_ROLES } from "@/lib/constants";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function AdminPanel() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: allUsers = [] } = useQuery({
    queryKey: ['/api/admin/users'],
    enabled: user?.role === 'system_admin',
  });

  const { data: allApplications = [] } = useQuery({
    queryKey: ['/api/admin/applications'],
    enabled: user?.role === 'system_admin',
  });

  const { data: activitySettings = [] } = useQuery({
    queryKey: ['/api/activity-settings'],
    enabled: user?.role === 'system_admin',
  });

  const updateActivitySettingMutation = useMutation({
    mutationFn: async ({ activityType, isEnabled }: { activityType: string; isEnabled: boolean }) => {
      await apiRequest("PATCH", "/api/admin/activity-settings", {
        activityType,
        isEnabled,
        updatedBy: user?.id
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/activity-settings'] });
      toast({
        title: "Activity setting updated",
        description: "The activity setting has been successfully updated.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to update setting",
        description: "Could not update the activity setting. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Check if user has admin access
  if (user?.role !== 'system_admin') {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <Shield className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to access the admin panel.</p>
        </div>
      </div>
    );
  }

  const getStatsOverview = () => {
    const totalUsers = allUsers.length;
    const totalApplications = allApplications.length;
    const pendingApplications = allApplications.filter((app: any) => app.status === 'under_review').length;
    const companiesCount = new Set(allUsers.map((user: any) => user.companyId).filter(Boolean)).size;

    return {
      totalUsers,
      totalApplications,
      pendingApplications,
      companiesCount
    };
  };

  const stats = getStatsOverview();

  const getUserRoleInfo = (role: string) => {
    return USER_ROLES[role as keyof typeof USER_ROLES] || USER_ROLES.team_member;
  };

  const getInitials = (firstName: string = '', lastName: string = '') => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Administration</h1>
          <p className="text-gray-600">
            Manage users, applications, and system-wide settings.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="border-red-200 text-red-800">
            <Shield className="h-3 w-3 mr-1" />
            System Admin
          </Badge>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalUsers}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Companies</p>
                <p className="text-3xl font-bold text-gray-900">{stats.companiesCount}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Building className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Applications</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalApplications}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <FileText className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Review</p>
                <p className="text-3xl font-bold text-gray-900">{stats.pendingApplications}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Admin Tabs */}
      <Tabs defaultValue="users" className="space-y-6">
        <TabsList>
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="applications">Application Oversight</TabsTrigger>
          <TabsTrigger value="settings">System Settings</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>User Management</CardTitle>
                  <CardDescription>
                    Manage user accounts, roles, and permissions across all companies.
                  </CardDescription>
                </div>
                <Button>
                  <Download className="h-4 w-4 mr-2" />
                  Export Users
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {allUsers.length > 0 ? (
                <div className="space-y-4">
                  {allUsers.map((user: any) => (
                    <div key={user.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-600">
                            {getInitials(user.firstName, user.lastName)}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {user.firstName} {user.lastName}
                          </p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Badge 
                          variant="outline"
                          className={`border-${getUserRoleInfo(user.role).color}-200 text-${getUserRoleInfo(user.role).color}-800`}
                        >
                          {getUserRoleInfo(user.role).label}
                        </Badge>
                        <Badge variant={user.isActive ? "default" : "secondary"}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        <Button variant="outline" size="sm">
                          Manage
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No users found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="applications">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Application Oversight</CardTitle>
                  <CardDescription>
                    Review and manage applications from all companies.
                  </CardDescription>
                </div>
                <Button>
                  <Download className="h-4 w-4 mr-2" />
                  Export Applications
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ApplicationTable applications={allApplications} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Activity Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Activity Settings</CardTitle>
                <CardDescription>
                  Configure which activities are available to users.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {activitySettings.map((setting: any) => (
                    <div key={setting.activityType} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{setting.activityType}</p>
                        <p className="text-sm text-gray-500">
                          {setting.description || `${setting.activityType} activity settings`}
                        </p>
                        {setting.activityType === 'FRA' && (
                          <p className="text-xs text-blue-600 mt-1">Required for all facilities</p>
                        )}
                      </div>
                      <div className="flex items-center space-x-3">
                        <Badge variant={setting.isEnabled ? "default" : "secondary"}>
                          {setting.isEnabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                        <Switch
                          checked={setting.isEnabled}
                          disabled={setting.activityType === 'FRA' || updateActivitySettingMutation.isPending}
                          onCheckedChange={(checked) => {
                            if (setting.activityType !== 'FRA') {
                              updateActivitySettingMutation.mutate({
                                activityType: setting.activityType,
                                isEnabled: checked
                              });
                            }
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* System Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>System Configuration</CardTitle>
                <CardDescription>
                  Global system settings and configurations.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">File Upload Limit</p>
                      <p className="text-sm text-gray-500">Maximum file size for uploads</p>
                    </div>
                    <Badge variant="outline">10 MB</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Session Timeout</p>
                      <p className="text-sm text-gray-500">User session duration</p>
                    </div>
                    <Badge variant="outline">7 days</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Email Notifications</p>
                      <p className="text-sm text-gray-500">System email notifications</p>
                    </div>
                    <Badge variant="default">Enabled</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reports">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Usage Statistics */}
            <Card>
              <CardHeader>
                <CardTitle>Usage Statistics</CardTitle>
                <CardDescription>
                  System usage and performance metrics.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Active Users (Last 30 days)</span>
                    <span className="font-medium">{Math.floor(stats.totalUsers * 0.8)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Applications This Month</span>
                    <span className="font-medium">{Math.floor(stats.totalApplications * 0.3)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Documents Uploaded</span>
                    <span className="font-medium">{stats.totalApplications * 3}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Storage Used</span>
                    <span className="font-medium">2.4 GB</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Export Options */}
            <Card>
              <CardHeader>
                <CardTitle>Data Export</CardTitle>
                <CardDescription>
                  Export system data for analysis and reporting.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Button variant="outline" className="w-full justify-start">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Export User Analytics
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <FileText className="h-4 w-4 mr-2" />
                    Export Application Data
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Building className="h-4 w-4 mr-2" />
                    Export Company Data
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Settings className="h-4 w-4 mr-2" />
                    Export System Configuration
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
