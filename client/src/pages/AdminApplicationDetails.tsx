import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertCircle, Download, Upload, FileText, CheckCircle, Clock, ArrowLeft, Copy, Check, Users, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AdminApplicationDetails() {
  const [, params] = useRoute("/applications/:id");
  const id = params?.id;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [copied, setCopied] = useState(false);

  // Fetch application details using admin endpoint
  const { data: application, isLoading } = useQuery({
    queryKey: ['/api/admin/applications', id, 'details'],
    queryFn: async () => {
      const response = await apiRequest(`/api/admin/applications/${id}/details`, "GET");
      return response.json();
    },
    enabled: !!id,
  });

  // Fetch form templates for this activity type
  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['/api/activity-templates', application?.activityType],
    queryFn: async () => {
      const response = await apiRequest(`/api/activity-templates/${application?.activityType}`, "GET");
      return response.json();
    },
    enabled: !!application?.activityType,
  });

  // Fetch submissions for this application
  const { data: submissions = [] } = useQuery({
    queryKey: ['/api/applications', id, 'submissions'],
    queryFn: async () => {
      const response = await apiRequest(`/api/applications/${id}/submissions`, "GET");
      return response.json();
    },
    enabled: !!id,
  });

  // Fetch assigned contractors
  const { data: assignedContractors = [] } = useQuery({
    queryKey: ["/api/applications", id, "assigned-contractors"],
    queryFn: async () => {
      const response = await apiRequest(`/api/applications/${id}/assigned-contractors`, "GET");
      return response.json();
    },
    enabled: !!id,
  });

  // Fetch documents
  const { data: documents = [] } = useQuery({
    queryKey: ['/api/applications', id, 'documents'],
    queryFn: async () => {
      const response = await apiRequest(`/api/applications/${id}/documents`, "GET");
      return response.json();
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-12 bg-gray-200 rounded w-1/2 mb-4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Application not found</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">The application you're looking for doesn't exist.</p>
          <Button onClick={() => navigate("/admin/panel")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Calculate template completion status
  const getTemplateStatus = () => {
    if (!templates.length) return { completed: 0, total: 0, label: "No Templates" };
    
    let completedTemplates = 0;
    let lastCompletedTemplate = "";
    
    templates.forEach((template: any) => {
      const templateSubmissions = submissions.filter((sub: any) => 
        sub.formTemplateId === template.id && sub.status === 'submitted'
      );
      if (templateSubmissions.length > 0) {
        completedTemplates++;
        lastCompletedTemplate = template.name;
      }
    });

    const progressPercentage = templates.length > 0 ? Math.round((completedTemplates / templates.length) * 100) : 0;
    
    if (completedTemplates === templates.length) {
      return { 
        completed: completedTemplates, 
        total: templates.length, 
        label: `${lastCompletedTemplate} Submitted`,
        progress: progressPercentage
      };
    } else if (completedTemplates > 0) {
      return { 
        completed: completedTemplates, 
        total: templates.length, 
        label: `${lastCompletedTemplate} Submitted`,
        progress: progressPercentage
      };
    } else {
      return { 
        completed: 0, 
        total: templates.length, 
        label: "Not Started",
        progress: 0
      };
    }
  };

  const templateStatus = getTemplateStatus();

  const handleCopyApplicationId = () => {
    navigator.clipboard.writeText(application.applicationId);
    setCopied(true);
    toast({
      title: "Copied!",
      description: "Application ID copied to clipboard",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return "N/A";
    }
  };

  const getSubmitterName = () => {
    if (application.submittedBy && typeof application.submittedBy === 'object') {
      return `${application.submittedBy.firstName} ${application.submittedBy.lastName}`;
    }
    return "N/A";
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/admin/panel")}
            className="mb-4 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {application.facility?.name || "Unknown Facility"}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {application.description}
            </p>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span className="font-medium">{application.activityType} Application</span>
              <span>{application.applicationId}</span>
            </div>
          </div>
        </div>

        {/* Status and Progress */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Status</span>
                <Badge variant={templateStatus.progress === 100 ? "default" : "secondary"}>
                  {templateStatus.label}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Assigned Contractors</span>
                <Users className="h-4 w-4 text-gray-400" />
              </div>
              <div className="space-y-1">
                {assignedContractors.length > 0 ? (
                  assignedContractors.map((contractor: any, index: number) => (
                    <div key={index} className="text-sm">
                      {contractor.user?.firstName} {contractor.user?.lastName}
                    </div>
                  ))
                ) : (
                  <span className="text-sm text-gray-500">None assigned</span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Application Progress</span>
                <span className="text-sm font-bold">{templateStatus.progress}% Complete</span>
              </div>
              <Progress value={templateStatus.progress} className="mt-2" />
            </CardContent>
          </Card>
        </div>

        {/* Timeline */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                <div>
                  <p className="font-medium">Started</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Application created</p>
                </div>
              </div>
              
              {templates.map((template: any, index: number) => {
                const templateSubmissions = submissions.filter((sub: any) => 
                  sub.formTemplateId === template.id && sub.status === 'submitted'
                );
                const isCompleted = templateSubmissions.length > 0;
                
                return (
                  <div key={template.id} className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-2 ${isCompleted ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                    <div>
                      <p className="font-medium">{isCompleted ? 'Completed' : 'Pending'}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{template.name}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="templates">
              {templates.map((t: any, i: number) => (
                <span key={t.id}>
                  {t.name}
                  {submissions.some((s: any) => s.formTemplateId === t.id && s.status === 'submitted') && ' ✓'}
                  {i < templates.length - 1 && ', '}
                </span>
              ))}
            </TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Application Details</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-600 dark:text-gray-400">Activity Type</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{application.activityType}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-600 dark:text-gray-400">Status</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{templateStatus.label}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-600 dark:text-gray-400">Facility Name</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{application.facility?.name}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-600 dark:text-gray-400">Created Date</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatDate(application.createdAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-600 dark:text-gray-400">Last Modified</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatDate(application.updatedAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-600 dark:text-gray-400">Created By</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{getSubmitterName()}</dd>
                  </div>
                  <div className="md:col-span-2">
                    <dt className="text-sm font-medium text-gray-600 dark:text-gray-400">Application ID</dt>
                    <dd className="mt-1 flex items-center gap-2">
                      <span className="text-sm text-gray-900 dark:text-gray-100">{application.applicationId}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCopyApplicationId}
                        className="h-6 w-6 p-0"
                      >
                        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates" className="mt-6">
            <div className="space-y-6">
              {templates.map((template: any) => {
                const templateSubmissions = submissions.filter((sub: any) => 
                  sub.formTemplateId === template.id
                );
                
                return (
                  <Card key={template.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          {template.name}
                          {templateSubmissions.some((s: any) => s.status === 'submitted') && (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          )}
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {templateSubmissions.length > 0 ? (
                        <div className="space-y-4">
                          {templateSubmissions.map((submission: any) => (
                            <div key={submission.id} className="p-4 border rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <Badge variant={submission.status === 'submitted' ? 'default' : 'secondary'}>
                                  {submission.status}
                                </Badge>
                                <span className="text-sm text-gray-500">
                                  {formatDate(submission.updatedAt)}
                                </span>
                              </div>
                              {submission.data && Object.keys(submission.data).length > 0 && (
                                <div className="mt-2">
                                  <h4 className="font-medium mb-2">Form Data:</h4>
                                  <div className="space-y-1 text-sm">
                                    {Object.entries(submission.data).map(([key, value]: [string, any]) => (
                                      <div key={key} className="flex gap-2">
                                        <span className="font-medium">{key}:</span>
                                        <span>{String(value)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500">No submissions for this template yet.</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="documents" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Documents
                </CardTitle>
              </CardHeader>
              <CardContent>
                {documents.length > 0 ? (
                  <div className="space-y-4">
                    {documents.map((doc: any) => (
                      <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-gray-400" />
                          <div>
                            <p className="font-medium">{doc.originalName}</p>
                            <p className="text-sm text-gray-500">
                              {doc.category} • {formatDate(doc.createdAt)}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(`/api/documents/${doc.id}/download`, '_blank')}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No documents uploaded yet.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}