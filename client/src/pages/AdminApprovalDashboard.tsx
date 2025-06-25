import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Search, 
  Eye, 
  Filter,
  AlertCircle,
  ChevronRight,
  Building,
  MapPin,
  User,
  Calendar,
  FileText,
  Users
} from "lucide-react";

export default function AdminApprovalDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch pending submissions
  const { data: pendingSubmissions = [], isLoading } = useQuery({
    queryKey: ["/api/admin/pending-submissions"],
  });

  // Process the submissions data to get statistics
  const submissions = (pendingSubmissions as any[]) || [];
  const totalPending = submissions.filter(s => s.approvalStatus === 'pending').length;
  const totalApproved = submissions.filter(s => s.approvalStatus === 'approved').length;
  const totalRejected = submissions.filter(s => s.approvalStatus === 'rejected').length;

  // Quick approve/reject mutations
  const approveMutation = useMutation({
    mutationFn: async (submissionId: number) => {
      return apiRequest(`/api/admin/submissions/${submissionId}/approve`, "POST", {
        reviewNotes: "Quick approval from dashboard"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-submissions"] });
      toast({
        title: "Submission Approved",
        description: "The submission has been approved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to approve submission.",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (submissionId: number) => {
      return apiRequest(`/api/admin/submissions/${submissionId}/reject`, "POST", {
        reviewNotes: "Quick rejection from dashboard"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-submissions"] });
      toast({
        title: "Submission Rejected",
        description: "The submission has been rejected.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to reject submission.",
        variant: "destructive",
      });
    },
  });

  const handleQuickApprove = (submissionId: number) => {
    approveMutation.mutate(submissionId);
  };

  const handleQuickReject = (submissionId: number) => {
    rejectMutation.mutate(submissionId);
  };

  // Filter submissions based on status and search term
  const filteredSubmissions = submissions.filter(submission => {
    const matchesStatus = statusFilter === "all" || submission.approvalStatus === statusFilter;
    const matchesSearch = searchTerm === "" || 
      submission.applicationData?.applicationId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      submission.company?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      submission.template?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesStatus && matchesSearch;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-2">
          <Clock className="h-4 w-4 animate-spin" />
          <span>Loading submissions...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">System Admin - Submission Approvals</h1>
        <p className="text-gray-600 mt-2">
          Review and approve activity template submissions from all companies in the system
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{submissions.length}</div>
            <p className="text-xs text-muted-foreground">All submissions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{totalPending}</div>
            <p className="text-xs text-muted-foreground">Awaiting approval</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{totalApproved}</div>
            <p className="text-xs text-muted-foreground">Successfully approved</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{totalRejected}</div>
            <p className="text-xs text-muted-foreground">Rejected submissions</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="h-5 w-5 mr-2" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by application ID, company name, or template..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="w-full md:w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Submissions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Submissions for Review</CardTitle>
          <CardDescription>
            {filteredSubmissions.length} submission{filteredSubmissions.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Application ID</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Activity Type</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Approval Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSubmissions.map((submission) => (
                <TableRow key={submission.id}>
                  <TableCell>
                    <div className="flex items-center">
                      <FileText className="h-4 w-4 mr-2 text-blue-600" />
                      <span className="font-medium">
                        {submission.applicationData?.applicationId || `APP-${submission.applicationId}`}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Building className="h-4 w-4 mr-2 text-gray-600" />
                      <div>
                        <div className="font-medium">{submission.company?.name || 'N/A'}</div>
                        <div className="text-sm text-gray-500">{submission.company?.shortName || 'N/A'}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <FileText className="h-4 w-4 mr-2 text-purple-600" />
                      <span>{submission.template?.name || `Template ${submission.formTemplateId}`}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {submission.applicationData?.activityType || 'FRA'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-2 text-gray-600" />
                      <span className="text-sm">
                        {submission.submittedAt ? new Date(submission.submittedAt).toLocaleDateString() : new Date(submission.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={
                        submission.approvalStatus === 'pending' ? 'default' :
                        submission.approvalStatus === 'approved' ? 'secondary' : 'destructive'
                      }
                      className={
                        submission.approvalStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        submission.approvalStatus === 'approved' ? 'bg-green-100 text-green-800' :
                        'bg-red-100 text-red-800'
                      }
                    >
                      {submission.approvalStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setLocation(`/admin/submissions/${submission.id}/review`)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Review
                      </Button>
                      
                      {submission.approvalStatus === 'pending' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleQuickApprove(submission.id)}
                            disabled={approveMutation.isPending}
                            className="text-green-700 border-green-200 hover:bg-green-50"
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Quick Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleQuickReject(submission.id)}
                            disabled={rejectMutation.isPending}
                            className="text-red-700 border-red-200 hover:bg-red-50"
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Quick Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {filteredSubmissions.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No submissions found matching your criteria
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}