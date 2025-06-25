import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Users, Building2, FileText, UserPlus, HardHat, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ACTIVITY_TYPES } from "@/lib/constants";

export default function AdminContractorAssignmentPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activityFilter, setActivityFilter] = useState("all");
  const [selectedApplication, setSelectedApplication] = useState<any>(null);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedContractors, setSelectedContractors] = useState<string[]>([]);

  // Fetch all applications
  const { data: applications = [] } = useQuery({
    queryKey: ["/api/admin/applications"],
  });

  // Fetch all contractors
  const { data: contractors = [] } = useQuery({
    queryKey: ["/api/admin/contractors"],
  });

  // Fetch contractor assignments for applications
  const { data: assignments = [] } = useQuery({
    queryKey: ["/api/admin/contractor-assignments"],
  });

  // Assign contractors mutation
  const assignContractorsMutation = useMutation({
    mutationFn: async ({ applicationId, contractorIds }: { applicationId: number; contractorIds: string[] }) => {
      return await apiRequest(`/api/admin/applications/${applicationId}/assign-contractors`, "POST", {
        contractorIds
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contractor-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/applications"] });
      setShowAssignDialog(false);
      setSelectedApplication(null);
      setSelectedContractors([]);
      toast({
        title: "Success",
        description: "Contractors assigned successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to assign contractors.",
        variant: "destructive",
      });
    },
  });

  // Filter applications
  const filteredApplications = applications.filter((app: any) => {
    const searchMatch = 
      app.applicationId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.companyName?.toLowerCase().includes(searchTerm.toLowerCase());

    const statusMatch = statusFilter === "all" || app.status === statusFilter;
    const activityMatch = activityFilter === "all" || app.activityType === activityFilter;

    return searchMatch && statusMatch && activityMatch;
  });

  const getApplicationAssignments = (applicationId: number) => {
    return assignments.filter((assignment: any) => assignment.applicationId === applicationId);
  };

  const getContractorsByActivity = (activityType: string) => {
    return contractors.filter((contractor: any) => 
      contractor.supportedActivities?.includes(activityType) ||
      contractor.supportedActivities?.includes('ALL')
    );
  };

  const handleAssignContractors = (application: any) => {
    setSelectedApplication(application);
    setSelectedContractors([]);
    setShowAssignDialog(true);
  };

  const handleContractorToggle = (contractorId: string) => {
    setSelectedContractors(prev => 
      prev.includes(contractorId)
        ? prev.filter(id => id !== contractorId)
        : [...prev, contractorId]
    );
  };

  const handleSaveAssignments = () => {
    if (!selectedApplication) return;
    
    assignContractorsMutation.mutate({
      applicationId: selectedApplication.id,
      contractorIds: selectedContractors
    });
  };

  const getActivityColor = (activityType: string) => {
    const activity = ACTIVITY_TYPES[activityType as keyof typeof ACTIVITY_TYPES];
    switch (activity?.color) {
      case 'blue': return 'bg-blue-100 text-blue-800';
      case 'teal': return 'bg-teal-100 text-teal-800';
      case 'purple': return 'bg-purple-100 text-purple-800';
      case 'indigo': return 'bg-indigo-100 text-indigo-800';
      case 'green': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'submitted': return 'bg-yellow-100 text-yellow-800';
      case 'under_review': return 'bg-blue-100 text-blue-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const stats = {
    totalApplications: applications.length,
    assignedApplications: applications.filter((app: any) => getApplicationAssignments(app.id).length > 0).length,
    unassignedApplications: applications.filter((app: any) => getApplicationAssignments(app.id).length === 0).length,
    totalContractors: contractors.length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Contractor Assignment</h1>
          <p className="text-gray-600">Assign contractors to applications for project execution</p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Applications</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalApplications}</div>
            <p className="text-xs text-muted-foreground">All applications</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assigned</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.assignedApplications}</div>
            <p className="text-xs text-muted-foreground">With contractors</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unassigned</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.unassignedApplications}</div>
            <p className="text-xs text-muted-foreground">Need assignment</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Contractors</CardTitle>
            <HardHat className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalContractors}</div>
            <p className="text-xs text-muted-foreground">Service providers</p>
          </CardContent>
        </Card>
      </div>

      {/* Applications and Assignments */}
      <Card>
        <CardHeader>
          <CardTitle>Application Contractor Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search applications..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>

            <Select value={activityFilter} onValueChange={setActivityFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by activity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Activities</SelectItem>
                {Object.entries(ACTIVITY_TYPES).map(([value, activity]) => (
                  <SelectItem key={value} value={value}>
                    {activity.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Application</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Activity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned Contractors</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredApplications.map((application: any) => {
                const appAssignments = getApplicationAssignments(application.id);
                return (
                  <TableRow key={application.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{application.applicationId}</div>
                        <div className="text-sm text-gray-500">{application.title}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{application.companyName}</div>
                        <div className="text-sm text-gray-500">{application.facilityName}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getActivityColor(application.activityType)}>
                        {application.activityType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(application.status)}>
                        {application.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {appAssignments.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {appAssignments.map((assignment: any) => (
                            <Badge key={assignment.contractorId} variant="outline" className="text-xs">
                              {assignment.contractorName}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-500 text-sm">No contractors assigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAssignContractors(application)}
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Assign
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {filteredApplications.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No applications found matching your criteria.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assign Contractors Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Assign Contractors</DialogTitle>
            <DialogDescription>
              Select contractors to assign to {selectedApplication?.applicationId}
            </DialogDescription>
          </DialogHeader>
          
          {selectedApplication && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="font-medium">{selectedApplication.applicationId}</div>
                <div className="text-sm text-gray-600">{selectedApplication.title}</div>
                <div className="text-sm text-gray-600">
                  Activity: <Badge className={getActivityColor(selectedApplication.activityType)}>
                    {selectedApplication.activityType}
                  </Badge>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-3">Available Contractors for {selectedApplication.activityType}</h4>
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {getContractorsByActivity(selectedApplication.activityType).map((contractor: any) => (
                    <div key={contractor.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                      <Checkbox
                        checked={selectedContractors.includes(contractor.id)}
                        onCheckedChange={() => handleContractorToggle(contractor.id)}
                      />
                      <div className="flex-1">
                        <div className="font-medium">{contractor.name}</div>
                        <div className="text-sm text-gray-500">
                          Regions: {contractor.serviceRegions?.join(', ') || 'N/A'}
                        </div>
                        <div className="text-sm text-gray-500">
                          Activities: {contractor.supportedActivities?.join(', ') || 'N/A'}
                        </div>
                      </div>
                      <Badge variant={contractor.isActive ? 'default' : 'secondary'}>
                        {contractor.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  ))}
                </div>

                {getContractorsByActivity(selectedApplication.activityType).length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No contractors available for {selectedApplication.activityType} activities.
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveAssignments}
              disabled={selectedContractors.length === 0 || assignContractorsMutation.isPending}
            >
              {assignContractorsMutation.isPending ? "Assigning..." : `Assign ${selectedContractors.length} Contractors`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}