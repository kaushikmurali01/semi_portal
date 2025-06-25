import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, Settings, AlertTriangle, CheckCircle, XCircle, Edit2, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ACTIVITY_TYPES } from "@/lib/constants";

export default function AdminApplicationLimitsPage() {
  const { toast } = useToast();
  const [editingActivity, setEditingActivity] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ [key: string]: number | null }>({});

  // Fetch activity settings for Application Limits
  const { data: activitySettings = [], isLoading: settingsLoading } = useQuery({
    queryKey: ["/api/activity-settings"],
  });

  // Fetch all applications to show current usage
  const { data: applications = [] } = useQuery({
    queryKey: ["/api/admin/applications"],
  });

  // Mutation to update activity limits
  const updateActivityLimitMutation = useMutation({
    mutationFn: async ({ activityType, maxApplications, isEnabled }: { 
      activityType: string; 
      maxApplications: number | null;
      isEnabled?: boolean;
    }) => {
      return await apiRequest(`/api/admin/activity-settings/${activityType}`, "PATCH", {
        maxApplications,
        ...(isEnabled !== undefined && { isEnabled })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activity-settings"] });
      setEditingActivity(null);
      setEditValues({});
      toast({
        title: "Success",
        description: "Application limit updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Could not update the application limit. Please try again.",
        variant: "destructive",
      });
    },
  });

  const getActivityUsage = (activityType: string) => {
    return applications.filter((app: any) => app.activityType === activityType).length;
  };

  const getActivityColor = (activityType: string) => {
    const activity = ACTIVITY_TYPES[activityType as keyof typeof ACTIVITY_TYPES];
    return activity?.color || 'gray';
  };

  const handleStartEdit = (activityType: string, currentLimit: number | null) => {
    setEditingActivity(activityType);
    setEditValues({ [activityType]: currentLimit });
  };

  const handleSaveEdit = (activityType: string) => {
    const newLimit = editValues[activityType];
    updateActivityLimitMutation.mutate({
      activityType,
      maxApplications: newLimit
    });
  };

  const handleCancelEdit = () => {
    setEditingActivity(null);
    setEditValues({});
  };

  const handleToggleActivity = (activityType: string, currentEnabled: boolean) => {
    updateActivityLimitMutation.mutate({
      activityType,
      maxApplications: null, // Keep current limit
      isEnabled: !currentEnabled
    });
  };

  const getUsageStatus = (usage: number, limit: number | null) => {
    if (limit === null) return 'unlimited';
    if (usage >= limit) return 'exceeded';
    if (usage / limit >= 0.8) return 'warning';
    return 'normal';
  };

  const getUsageColor = (status: string) => {
    switch (status) {
      case 'exceeded': return 'text-red-600 bg-red-100';
      case 'warning': return 'text-yellow-600 bg-yellow-100';
      case 'unlimited': return 'text-blue-600 bg-blue-100';
      default: return 'text-green-600 bg-green-100';
    }
  };

  // Merge activity settings with predefined activity types
  const mergedActivities = Object.entries(ACTIVITY_TYPES).map(([activityType, activity]) => {
    const setting = activitySettings.find((s: any) => s.activityType === activityType);
    const usage = getActivityUsage(activityType);
    
    return {
      activityType,
      ...activity,
      isEnabled: setting?.isEnabled ?? true,
      maxApplications: setting?.maxApplications ?? null,
      currentUsage: usage,
      usageStatus: getUsageStatus(usage, setting?.maxApplications ?? null)
    };
  });

  const stats = {
    totalActivities: mergedActivities.length,
    enabledActivities: mergedActivities.filter(a => a.isEnabled).length,
    limitedActivities: mergedActivities.filter(a => a.maxApplications !== null).length,
    activitiesNearLimit: mergedActivities.filter(a => a.usageStatus === 'warning' || a.usageStatus === 'exceeded').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Application Limits</h1>
          <p className="text-gray-600">Manage application limits and activity availability</p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalActivities}</div>
            <p className="text-xs text-muted-foreground">Available activity types</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Enabled Activities</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.enabledActivities}</div>
            <p className="text-xs text-muted-foreground">Currently available</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Limited Activities</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.limitedActivities}</div>
            <p className="text-xs text-muted-foreground">With application limits</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Attention Needed</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activitiesNearLimit}</div>
            <p className="text-xs text-muted-foreground">Near or at limit</p>
          </CardContent>
        </Card>
      </div>

      {/* Activity Limits Table */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Limits Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Activity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Current Usage</TableHead>
                <TableHead>Application Limit</TableHead>
                <TableHead>Usage Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mergedActivities.map((activity) => (
                <TableRow key={activity.activityType}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold bg-${activity.color}-600`}>
                        {activity.icon}
                      </div>
                      <div>
                        <div className="font-medium">{activity.name}</div>
                        <div className="text-sm text-gray-500">{activity.description}</div>
                      </div>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={activity.isEnabled}
                        onCheckedChange={() => handleToggleActivity(activity.activityType, activity.isEnabled)}
                        disabled={updateActivityLimitMutation.isPending}
                      />
                      <Badge variant={activity.isEnabled ? 'default' : 'secondary'}>
                        {activity.isEnabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="text-lg font-semibold">{activity.currentUsage}</div>
                  </TableCell>

                  <TableCell>
                    {editingActivity === activity.activityType ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="1"
                          value={editValues[activity.activityType] || ''}
                          onChange={(e) => setEditValues(prev => ({
                            ...prev,
                            [activity.activityType]: e.target.value ? parseInt(e.target.value) : null
                          }))}
                          placeholder="No limit"
                          className="w-24"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleSaveEdit(activity.activityType)}
                          disabled={updateActivityLimitMutation.isPending}
                        >
                          <Save className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCancelEdit}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-semibold">
                          {activity.maxApplications || 'No limit'}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleStartEdit(activity.activityType, activity.maxApplications)}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </TableCell>

                  <TableCell>
                    <Badge className={getUsageColor(activity.usageStatus)}>
                      {activity.usageStatus === 'unlimited' && 'Unlimited'}
                      {activity.usageStatus === 'normal' && 'Normal'}
                      {activity.usageStatus === 'warning' && 'Near Limit'}
                      {activity.usageStatus === 'exceeded' && 'Exceeded'}
                    </Badge>
                    {activity.maxApplications && (
                      <div className="text-xs text-gray-500 mt-1">
                        {activity.currentUsage}/{activity.maxApplications} ({Math.round((activity.currentUsage / activity.maxApplications) * 100)}%)
                      </div>
                    )}
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-2">
                      {activity.isEnabled ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-gray-400" />
                      )}
                      {activity.usageStatus === 'exceeded' && (
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                      )}
                      {activity.usageStatus === 'warning' && (
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Usage Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Application Usage Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {mergedActivities.map((activity) => (
              <div key={activity.activityType} className="text-center p-4 border rounded-lg">
                <div className={`w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center text-white font-bold
                  ${activity.isEnabled ? `bg-${activity.color}-600` : 'bg-gray-400'}`}>
                  {activity.icon}
                </div>
                <div className="font-medium text-sm mb-1">{activity.activityType}</div>
                <div className="text-2xl font-bold mb-1">{activity.currentUsage}</div>
                <div className="text-xs text-gray-500">
                  {activity.maxApplications ? `/ ${activity.maxApplications}` : '/ ∞'}
                </div>
                {!activity.isEnabled && (
                  <Badge variant="secondary" className="mt-2 text-xs">Disabled</Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}