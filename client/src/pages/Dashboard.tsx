import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ApplicationForm } from "@/components/ApplicationForm";
import { DocumentUpload } from "@/components/DocumentUpload";
import { ApplicationTable } from "@/components/ApplicationTable";
import { FacilityForm } from "@/components/FacilityForm";
import TwoFactorPrompt from "@/components/TwoFactorPrompt";
import { 
  FileText, 
  CheckCircle, 
  Clock, 
  Users, 
  Building, 
  Plus, 
  Upload, 
  UserPlus,
  AlertCircle,
  MessageSquare,
  Send,
  BarChart3,
  TrendingUp,
  Lock,
  Unlock
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";

export default function Dashboard() {
  const { user } = useAuth();
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [showDocumentUpload, setShowDocumentUpload] = useState(false);
  const [showFacilityForm, setShowFacilityForm] = useState(false);
  const [editingFacility, setEditingFacility] = useState(null);

  // Queries
  const { data: applications } = useQuery({ queryKey: ["/api/applications"] });
  const { data: facilities } = useQuery({ queryKey: ["/api/facilities"] });
  const { data: company } = useQuery({ queryKey: ["/api/companies/current"] });
  const { data: stats } = useQuery({ queryKey: ["/api/dashboard/stats"] });
  const { data: activitySettings } = useQuery({ queryKey: ["/api/activity-settings"] });

  // Permission checks
  const canManageFacilities = user?.role === 'company_admin' || user?.role === 'team_member';

  if (user?.showTwoFactorPrompt) {
    return <TwoFactorPrompt />;
  }

  const recentApplications = applications?.slice(0, 5) || [];

  return (
    <div className="p-6 space-y-6">
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {user?.firstName || user?.email}
          </h1>
          <p className="text-gray-600">Here's what's happening with your applications</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Applications</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalApplications || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.draftApplications || 0} drafts, {(stats?.totalApplications || 0) - (stats?.draftApplications || 0)} submitted
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.approvedApplications || 0}</div>
            <p className="text-xs text-muted-foreground">
              +{((stats?.approvedApplications || 0) / Math.max(stats?.totalApplications || 1, 1) * 100).toFixed(0)}% approval rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Under Review</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats?.pendingApplications || 0}</div>
            <p className="text-xs text-muted-foreground">Awaiting evaluation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Members</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats?.teamMembers || 0}</div>
            <p className="text-xs text-muted-foreground">Active users</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Facilities */}
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <Building className="h-6 w-6 mr-2 text-blue-600" />
                  <div>
                    <h3 className="text-xl text-blue-800">Facilities</h3>
                    <p className="text-sm text-blue-600 font-normal">Manage your facilities and create applications</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowFacilityForm(true)}
                  className="h-8 w-8 p-0"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {facilities?.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                  <Building className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Create Your First Facility</h3>
                  <p className="text-sm text-gray-500 mb-4 max-w-sm mx-auto">
                    Before you can start any applications, you need to register at least one facility. 
                    Each facility can have multiple activity applications like FRA, SEM, EMIS, and more.
                  </p>
                  <Button
                    onClick={() => setShowFacilityForm(true)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Facility
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {facilities?.map((facility: any, index: number) => (
                    <div key={facility.id} className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-sm">{facility.name}</h4>
                            <Badge variant="secondary" className="text-xs">
                              {company?.shortName}-{String(index + 1).padStart(3, '0')}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-500">{facility.city}, {facility.province}</p>
                          <p className="text-xs text-gray-400">{facility.facilityType}</p>
                        </div>
                        {canManageFacilities && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingFacility(facility)}
                            className="h-8 w-8 p-0"
                          >
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </Button>
                        )}
                        {user?.role === 'contractor_individual' && (
                          <div className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
                            View Only
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h5 className="text-xs font-medium text-gray-700">Available Applications:</h5>
                          {user?.role === 'contractor_individual' && (
                            <span className="text-xs text-orange-600">Cannot start applications</span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { type: 'FRA', name: 'Facility Readiness Assessment', enabled: true },
                            { type: 'SEM', name: 'Strategic Energy Management', enabled: activitySettings?.find((a: any) => a.activityType === 'SEM')?.isEnabled || false },
                            { type: 'EEA', name: 'Energy Efficiency Assessment', enabled: activitySettings?.find((a: any) => a.activityType === 'EEA')?.isEnabled || false },
                            { type: 'EMIS', name: 'Energy Management Information System', enabled: activitySettings?.find((a: any) => a.activityType === 'EMIS')?.isEnabled || false },
                            { type: 'CR', name: 'Continuous Recognition', enabled: activitySettings?.find((a: any) => a.activityType === 'CR')?.isEnabled || false }
                          ].map((activity) => (
                            <Button
                              key={activity.type}
                              size="sm"
                              variant="outline"
                              className={`justify-start h-8 text-xs ${
                                !activity.enabled ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                              disabled={user?.role === 'contractor_individual' || !activity.enabled}
                              onClick={async () => {
                                if (!activity.enabled) return;
                                
                                try {
                                  const response = await fetch('/api/applications', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      facilityId: facility.id,
                                      activityType: activity.type,
                                      title: `${activity.name} Application`,
                                      description: `Application for ${activity.name} at ${facility.name}`
                                    })
                                  });
                                  
                                  if (response.ok) {
                                    const newApp = await response.json();
                                    window.location.href = `/applications/${newApp.id}`;
                                  }
                                } catch (error) {
                                  console.error('Error creating application:', error);
                                }
                              }}
                            >
                              <span className="flex items-center gap-1">
                                {activity.enabled ? 
                                  <Unlock className="h-3 w-3 text-green-600" /> : 
                                  <Lock className="h-3 w-3 text-gray-400" />
                                }
                                {activity.type}
                              </span>
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <div className="text-center pt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowFacilityForm(true)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Another Facility
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Applications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <BarChart3 className="h-6 w-6 mr-2 text-green-600" />
                  <div>
                    <h3 className="text-xl text-green-800">Recent Applications</h3>
                    <p className="text-sm text-green-600 font-normal">Your latest submissions and their status</p>
                  </div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentApplications.length > 0 ? (
                <ApplicationTable applications={recentApplications} />
              ) : (
                <div className="text-center py-6">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm text-gray-600">No applications yet</p>
                  <p className="text-xs text-gray-500 mt-1">Start by creating a facility above</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Applications Awaiting Action */}
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader>
              <CardTitle className="text-orange-800 flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Action Required
              </CardTitle>
            </CardHeader>
            <CardContent>
              {applications?.filter((app: any) => app.status === 'needs_revision' || app.status === 'rejected').length > 0 ? (
                <div className="space-y-3">
                  {applications?.filter((app: any) => app.status === 'needs_revision' || app.status === 'rejected').map((app: any) => (
                    <div key={app.id} className="flex items-center justify-between p-3 bg-white border border-orange-200 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{app.facility?.name}</p>
                        <p className="text-sm text-gray-600">{app.description}</p>
                        <p className="text-xs text-orange-600">
                          {app.status === 'needs_revision' ? 'Additional information required' : 'Application denied - review required'}
                        </p>
                      </div>
                      <Link href={`/application/${app.id}`}>
                        <Button size="sm" variant="outline" className="border-orange-300 text-orange-700 hover:bg-orange-100">
                          Review
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                  <p className="text-sm text-gray-600">No actions required at this time</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modals */}
      {showApplicationForm && (
        <ApplicationForm onClose={() => setShowApplicationForm(false)} />
      )}
      
      {showDocumentUpload && (
        <DocumentUpload onClose={() => setShowDocumentUpload(false)} />
      )}

      {showFacilityForm && (
        <FacilityForm 
          open={showFacilityForm}
          onClose={() => {
            setShowFacilityForm(false);
            setEditingFacility(null);
          }}
          facility={editingFacility}
        />
      )}
    </div>
  );
}