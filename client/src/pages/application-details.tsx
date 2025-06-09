import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
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
import { AlertCircle, Download, Upload, FileText, CheckCircle, Clock, ArrowLeft, Copy, Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";


export default function ApplicationDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [uploadingFiles, setUploadingFiles] = useState<{ [key: string]: boolean }>({});
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; docId: number | null; filename: string }>({ 
    open: false, 
    docId: null, 
    filename: '' 
  });
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingSubmission, setPendingSubmission] = useState<{phase: string, formData: any} | null>(null);
  const [phasesStarted, setPhasesStarted] = useState<{[key: string]: boolean}>({});
  const [copied, setCopied] = useState(false);

  // Handle file deletion with confirmation
  const handleDeleteFile = async (docId: number) => {
    try {
      const response = await fetch(`/api/documents/${docId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (response.ok) {
        await queryClient.refetchQueries({
          queryKey: ['/api/documents/application', parseInt(id as string)],
        });
        toast({
          title: "Success",
          description: "File deleted successfully"
        });
      } else {
        throw new Error('Failed to delete file');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete file",
        variant: "destructive"
      });
    }
    setDeleteConfirm({ open: false, docId: null, filename: '' });
  };

  // Fetch application details
  const { data: application, isLoading } = useQuery({
    queryKey: ['/api/applications', id],
    queryFn: async () => {
      const response = await fetch(`/api/applications/${id}`);
      if (!response.ok) throw new Error('Failed to fetch application');
      return response.json();
    },
    enabled: !!id,
  });

  // Fetch form templates for this activity type
  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['/api/documents/templates', application?.activityType],
    queryFn: async () => {
      console.log('Fetching templates for activity type:', application?.activityType);
      const response = await fetch(`/api/documents/templates/${application?.activityType}`);
      if (!response.ok) throw new Error('Failed to fetch templates');
      const data = await response.json();
      console.log('Templates response:', data);
      return data;
    },
    enabled: !!application?.activityType,
  });

  // Debug logging
  console.log('Application data:', application);
  console.log('Activity type:', application?.activityType);
  console.log('Templates enabled:', !!application?.activityType);
  console.log('Templates data:', templates);

  // Fetch application submissions (pre/post activity)
  const { data: submissions = [] } = useQuery({
    queryKey: ['/api/applications', id, 'submissions'],
    queryFn: async () => {
      console.log('Fetching submissions for application:', id);
      const response = await fetch(`/api/applications/${id}/submissions`);
      if (!response.ok) throw new Error('Failed to fetch submissions');
      const data = await response.json();
      console.log('Submissions fetched:', data);
      return data;
    },
    enabled: !!id,
  });

  // Debug submissions
  console.log('Submissions data:', submissions);

  // Start phase mutation
  const startPhaseMutation = useMutation({
    mutationFn: async ({ applicationId, phase }: { applicationId: number, phase: string }) => {
      const response = await fetch(`/api/applications/${applicationId}/start-phase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phase }),
      });
      if (!response.ok) throw new Error('Failed to start phase');
      return response.json();
    },
    onSuccess: () => {
      // Refresh application data to get updated status
      queryClient.invalidateQueries({ queryKey: ['/api/applications', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/applications'] });
    },
  });

  // Submit pre-activity or post-activity
  const submitActivityMutation = useMutation({
    mutationFn: async ({ phase, formData }: { phase: 'pre_activity' | 'post_activity', formData: any }) => {
      const response = await fetch(`/api/applications/${id}/submit/${phase}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!response.ok) throw new Error('Failed to submit');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/applications', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/applications', id, 'submissions'] });
      // Force refetch submissions immediately
      queryClient.refetchQueries({ queryKey: ['/api/applications', id, 'submissions'] });
      toast({ title: "Success", description: "Activity submitted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit activity", variant: "destructive" });
    },
  });

  // File upload for documents
  const uploadDocumentMutation = useMutation({
    mutationFn: async ({ files, documentType }: { files: FileList, documentType: string }) => {
      const formData = new FormData();
      Array.from(files).forEach(file => formData.append('files', file));
      formData.append('applicationId', id!);
      formData.append('documentType', documentType);

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('Upload failed');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents/application', id] });
      toast({ title: "Success", description: "Documents uploaded successfully" });
      setUploadingFiles({});
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to upload documents", variant: "destructive" });
      setUploadingFiles({});
    },
  });

  const handleFileUpload = (files: FileList, documentType: string) => {
    if (files.length === 0) return;
    
    setUploadingFiles(prev => ({ ...prev, [documentType]: true }));
    uploadDocumentMutation.mutate({ files, documentType });
  };

  const getApplicationProgress = () => {
    const preActivitySubmitted = submissions.some((s: any) => s.phase === 'pre_activity' && s.status === 'submitted');
    const postActivitySubmitted = submissions.some((s: any) => s.phase === 'post_activity' && s.status === 'submitted');
    
    if (postActivitySubmitted) return 100;
    if (preActivitySubmitted) return 67; // Pre-activity completed, ready for post-activity
    return 33; // Application started
  };

  const getPhaseStatus = (phase: 'pre_activity' | 'post_activity') => {
    const submission = submissions.find((s: any) => s.phase === phase);
    if (!submission) return 'not_started';
    return submission.status;
  };

  const canSubmitApplication = user?.role !== 'contractor_individual';

  // Enhanced status logic to match ApplicationTable component
  const getDetailedStatusLabel = () => {
    // Use the detailedStatus from backend if available
    if (application.detailedStatus) {
      switch (application.detailedStatus) {
        case 'draft':
          return 'Draft';
        case 'pre-activity-started':
          return 'Pre-Activity Started';
        case 'pre-activity-submitted':
          return 'Pre-Activity Submitted';
        case 'post-activity-started':
          return 'Post-Activity Started';
        case 'post-activity-submitted':
          return 'Post-Activity Submitted';
        default:
          break;
      }
    }
    
    // Fallback to basic status logic
    if (application.status === 'draft') {
      return 'Draft';
    }
    
    if (application.status === 'submitted') {
      return 'Pre-Activity Submitted';
    }
    
    if (application.status === 'under_review') {
      return 'Under Review';
    }
    
    if (application.status === 'approved') {
      return 'Approved';
    }
    
    if (application.status === 'rejected') {
      return 'Rejected';
    }
    
    if (application.status === 'needs_revision') {
      return 'Needs Revision';
    }
    
    return 'Draft';
  };

  // Copy application ID to clipboard
  const copyApplicationId = async () => {
    try {
      await navigator.clipboard.writeText(application.applicationId);
      setCopied(true);
      toast({ title: "Copied", description: "Application ID copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({ title: "Error", description: "Failed to copy application ID", variant: "destructive" });
    }
  };

  // Handle tab changes and automatically mark phases as started
  const handleTabChange = (newTab: string) => {
    console.log('Tab changed to:', newTab, 'Application ID:', id, 'Application exists:', !!application);
    setActiveTab(newTab);
    
    // Mark phase as started when user accesses pre-activity or post-activity tabs
    if ((newTab === 'pre_activity' || newTab === 'post_activity') && application && id) {
      const phaseKey = `${id}-${newTab}`;
      console.log('Phase key:', phaseKey, 'Already started:', phasesStarted[phaseKey]);
      
      // Only call the API once per phase per session
      if (!phasesStarted[phaseKey]) {
        console.log('Starting phase:', newTab, 'for application:', id);
        startPhaseMutation.mutate({ 
          applicationId: parseInt(id), 
          phase: newTab 
        });
        setPhasesStarted(prev => ({ ...prev, [phaseKey]: true }));
      }
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading application...</div>;
  }

  if (!application) {
    return <div className="p-6">Application not found</div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
        
        <div className="space-y-6">
          {/* Facility Name - Primary Header */}
          <div className="space-y-3">
            <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">{application.facility?.name}</h1>
            <h2 className="text-2xl font-bold text-gray-800">{application.description}</h2>
          </div>
          
          {/* Application Details Row */}
          <div className="flex items-center gap-4 flex-wrap">
            {/* Application Type - Boxed */}
            <div className="px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg shadow-sm">
              <span className="text-sm font-medium text-blue-800">{application.activityType} Application</span>
            </div>
            
            {/* Application ID with Copy Button */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg shadow-sm hover:bg-gray-100 transition-colors">
              <span className="text-sm font-mono font-medium text-gray-800">{application.applicationId}</span>
              <button
                onClick={copyApplicationId}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
                title="Copy Application ID"
              >
                {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3 text-gray-500" />}
              </button>
            </div>
            
            {/* Status Badge */}
            <Badge 
              variant={getDetailedStatusLabel() === 'Draft' ? 'secondary' : 'default'}
              className="text-sm"
            >
              {getDetailedStatusLabel()}
            </Badge>
          </div>
        </div>

        {/* Progress Bar */}
        <Card className="mb-4 mt-8">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Application Progress</h3>
                <span className="text-sm text-gray-500">{getApplicationProgress()}% Complete</span>
              </div>
              <Progress value={getApplicationProgress()} className="w-full" />
              
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="space-y-2">
                  <div className={`mx-auto w-8 h-8 rounded-full flex items-center justify-center ${
                    getApplicationProgress() >= 33 ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {getApplicationProgress() >= 33 ? <CheckCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                  </div>
                  <div className="text-xs">
                    <div className="font-medium">Started</div>
                    <div className="text-gray-500">Application created</div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className={`mx-auto w-8 h-8 rounded-full flex items-center justify-center ${
                    getApplicationProgress() >= 67 ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {getApplicationProgress() >= 67 ? <CheckCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                  </div>
                  <div className="text-xs">
                    <div className="font-medium">Pre-Activity</div>
                    <div className="text-gray-500">Initial submission</div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className={`mx-auto w-8 h-8 rounded-full flex items-center justify-center ${
                    getApplicationProgress() >= 100 ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {getApplicationProgress() >= 100 ? <CheckCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                  </div>
                  <div className="text-xs">
                    <div className="font-medium">Post-Activity</div>
                    <div className="text-gray-500">Final submission</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different sections */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pre_activity">Pre-Activity</TabsTrigger>
          <TabsTrigger value="post_activity">Post-Activity</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Application Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Activity Type</label>
                  <p className="text-sm text-gray-900">{application.activityType}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Status</label>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={getDetailedStatusLabel() === 'Draft' ? 'secondary' : 'default'}
                      className="text-sm"
                    >
                      {getDetailedStatusLabel()}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Facility Name</label>
                  <p className="text-sm text-gray-900">{application.facility?.name || 'Not available'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Created Date</label>
                  <p className="text-sm text-gray-900">
                    {application.createdAt ? new Date(application.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    }) : 'Not available'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Last Modified</label>
                  <p className="text-sm text-gray-900">
                    {application.updatedAt ? new Date(application.updatedAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    }) : 'Not available'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Created By</label>
                  <p className="text-sm text-gray-900">
                    {application.createdByUser 
                      ? `${application.createdByUser.firstName} ${application.createdByUser.lastName}` 
                      : 'Not available'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Application ID</label>
                  <p className="text-sm text-gray-900 font-mono">{application.applicationId}</p>
                </div>
              </div>

              {user?.role === 'contractor_individual' && (
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="h-5 w-5 text-orange-600" />
                    <div>
                      <p className="text-sm font-medium text-orange-800">Contractor Access</p>
                      <p className="text-sm text-orange-700">
                        You can view and edit application details but cannot submit activities. 
                        The company admin will handle final submissions.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pre_activity" className="space-y-6">
          <PreActivitySection 
            application={application}
            templates={templates.filter((t: any) => t.phase === 'pre_activity')}
            submissions={submissions}
            onFileUpload={(files: FileList) => handleFileUpload(files, 'pre_activity')}
            onSubmit={(formData) => {
              setPendingSubmission({ phase: 'pre_activity', formData });
              setShowConfirmDialog(true);
            }}
            canSubmit={canSubmitApplication}
            uploading={uploadingFiles['pre_activity']}
            user={user}
          />
        </TabsContent>

        <TabsContent value="post_activity" className="space-y-6">
          <PostActivitySection 
            application={application}
            templates={templates.filter((t: any) => t.phase === 'post_activity')}
            submissions={submissions}
            onFileUpload={(files: FileList) => handleFileUpload(files, 'post_activity')}
            onSubmit={(formData) => {
              setPendingSubmission({ phase: 'post_activity', formData });
              setShowConfirmDialog(true);
            }}
            canSubmit={canSubmitApplication}
            uploading={uploadingFiles['post_activity']}
            preActivityCompleted={getPhaseStatus('pre_activity') === 'submitted'}
            user={user}
          />
        </TabsContent>

        <TabsContent value="documents" className="space-y-6">
          <DocumentsSection 
            applicationId={id!} 
            onDeleteFile={(docId: number, filename: string) => {
              setDeleteConfirm({ open: true, docId, filename });
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Submission</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to submit this activity? Once submitted, it cannot be modified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowConfirmDialog(false);
              setPendingSubmission(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (pendingSubmission) {
                submitActivityMutation.mutate({
                  phase: pendingSubmission.phase as 'pre_activity' | 'post_activity',
                  formData: pendingSubmission.formData
                });
              }
              setShowConfirmDialog(false);
              setPendingSubmission(null);
            }}>
              Submit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* File Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirm.open} onOpenChange={(open) => setDeleteConfirm({ open, docId: null, filename: '' })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete File</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirm.filename}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (deleteConfirm.docId) {
                  handleDeleteFile(deleteConfirm.docId);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Simple inline file upload component for forms
function SimpleFileUpload({ applicationId, canUpload, documentType = 'other' }: { applicationId: number, canUpload: boolean, documentType?: string }) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);

  // Query to get uploaded documents for this application
  const { data: documents = [], isLoading: documentsLoading } = useQuery({
    queryKey: ['/api/documents/application', applicationId],
    queryFn: () => fetch(`/api/documents/application/${applicationId}`, { credentials: 'include' }).then(res => res.json()),
    enabled: !!applicationId,
  });

  // Debug log to see what documents we're getting
  console.log('Documents for application', applicationId, ':', documents);

  const handleFileUpload = async (files: FileList) => {
    if (!canUpload || files.length === 0) return;

    setIsUploading(true);
    const formData = new FormData();
    
    Array.from(files).forEach(file => {
      formData.append('files', file);
    });
    
    formData.append('applicationId', applicationId.toString());
    formData.append('documentType', documentType);

    try {
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      // Refresh documents after upload
      await queryClient.invalidateQueries({
        queryKey: ['/api/documents/application', applicationId],
      });
      
      // Also refetch immediately to ensure UI updates
      await queryClient.refetchQueries({
        queryKey: ['/api/documents/application', applicationId],
      });
      
      toast({
        title: "Success",
        description: "Files uploaded successfully",
      });
    } catch (error) {
      toast({
        title: "Error", 
        description: "Failed to upload files",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
        <Upload className="h-8 w-8 mx-auto mb-4 text-gray-400" />
        <div className="space-y-2">
          <label className="cursor-pointer">
            <span className="text-sm font-medium text-blue-600 hover:text-blue-500">
              {isUploading ? 'Uploading...' : 'Choose files to upload'}
            </span>
            <input
              type="file"
              multiple
              accept=".pdf,.xlsx,.xls,.docx,.doc"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) {
                  handleFileUpload(e.target.files);
                }
              }}
              disabled={!canUpload || isUploading}
            />
          </label>
          <p className="text-xs text-gray-500">
            PDF, Excel, Word files supported
          </p>
        </div>
      </div>
      
      {/* Show uploaded files */}
      {documentsLoading ? (
        <div className="text-sm text-gray-500">Loading files...</div>
      ) : (
        Array.isArray(documents) && documents.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Uploaded Files ({documents.length}):</p>
            {documents.map((doc: any) => (
              <div key={doc.id} className="flex items-center justify-between p-2 bg-gray-50 border rounded">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-gray-600" />
                  <div>
                    <span className="text-sm text-gray-700">{doc.originalName || doc.filename}</span>
                    <p className="text-xs text-gray-500">{Math.round(doc.size / 1024)} KB</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      window.open(`/api/documents/${doc.id}/download`, '_blank');
                    }}
                    className="text-xs"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Download
                  </Button>
                  {canUpload && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onDeleteFile(doc.id, doc.originalName || doc.filename);
                      }}
                      className="text-xs text-red-600 hover:text-red-700"
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-500">No files uploaded yet</div>
        )
      )}
    </div>
  );
}

// Component to display uploaded files for submitted forms
function UploadedFilesDisplay({ applicationId, documentType, onDeleteFile }: { applicationId: number, documentType?: string, onDeleteFile: (docId: number, filename: string) => void }) {
  const { data: documents, isLoading } = useQuery({
    queryKey: ['/api/documents/application', applicationId],
    queryFn: () => fetch(`/api/documents/application/${applicationId}`, { credentials: 'include' }).then(res => res.json()),
    enabled: !!applicationId,
  });

  console.log('UploadedFilesDisplay - applicationId:', applicationId, 'documents:', documents);

  if (isLoading) {
    return <p className="text-sm text-gray-500">Loading files...</p>;
  }

  // Filter documents by type if specified
  const filteredDocuments = documentType 
    ? documents?.filter((doc: any) => doc.documentType === documentType) || []
    : documents || [];

  if (!filteredDocuments || !Array.isArray(filteredDocuments) || filteredDocuments.length === 0) {
    return (
      <p className="text-sm text-gray-500 italic">No files uploaded</p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700">Uploaded Files:</p>
      {filteredDocuments.map((doc: any) => (
        <div key={doc.id} className="flex items-center justify-between p-2 bg-white border rounded">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-gray-600" />
            <div>
              <span className="text-sm text-gray-700">{doc.originalName || doc.filename}</span>
              <p className="text-xs text-gray-500">{Math.round(doc.size / 1024)} KB</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              window.open(`/api/documents/${doc.id}/download`, '_blank');
            }}
            className="text-xs"
          >
            <Download className="h-3 w-3 mr-1" />
            Download
          </Button>
        </div>
      ))}
    </div>
  );
}

// Dynamic Form Component
function DynamicForm({ fields, onSubmit, canSubmit, submitLabel, submitButtonClass, isSubmitted, userRole, submittedData, applicationId, phase }: any) {
  const [formData, setFormData] = useState<Record<string, any>>(submittedData || {});

  const handleFieldChange = (fieldId: string, value: any) => {
    if (isSubmitted) return; // Don't allow changes if already submitted
    setFormData(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitted) return;
    
    // Filter out file fields from form data since files are uploaded separately
    const filteredFormData = Object.entries(formData).reduce((acc, [key, value]) => {
      const field = fields.find((f: any) => f.id === key);
      if (field?.type !== 'file') {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, any>);
    
    onSubmit(filteredFormData);
  };

  if (!fields || fields.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No form fields configured</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {fields.map((field: any) => (
        <div key={field.id} className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          
          {field.type === 'text' && (
            <input
              type="text"
              placeholder={field.placeholder}
              required={field.required}
              value={formData[field.id] || ''}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              disabled={isSubmitted}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isSubmitted ? 'bg-gray-50 text-gray-700 cursor-not-allowed' : ''
              }`}
            />
          )}
          
          {field.type === 'textarea' && (
            <textarea
              placeholder={field.placeholder}
              required={field.required}
              value={formData[field.id] || ''}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              rows={4}
              disabled={isSubmitted}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isSubmitted ? 'bg-gray-50 text-gray-700 cursor-not-allowed' : ''
              }`}
            />
          )}
          
          {field.type === 'number' && (
            <input
              type="number"
              placeholder={field.placeholder}
              required={field.required}
              value={formData[field.id] || ''}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              disabled={isSubmitted}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isSubmitted ? 'bg-gray-50 text-gray-700 cursor-not-allowed' : ''
              }`}
            />
          )}
          
          {field.type === 'select' && (
            <select
              required={field.required}
              value={formData[field.id] || ''}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              disabled={isSubmitted}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isSubmitted ? 'bg-gray-50 text-gray-700 cursor-not-allowed' : ''
              }`}
            >
              <option value="">Select an option</option>
              {field.options?.map((option: string, index: number) => (
                <option key={index} value={option}>
                  {option}
                </option>
              ))}
            </select>
          )}

          {field.type === 'file' && (
            <div>
              {isSubmitted ? (
                <div className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="h-5 w-5 text-gray-600" />
                    <span className="text-sm font-medium text-gray-700">Uploaded Files</span>
                  </div>
                  <UploadedFilesDisplay 
                    applicationId={applicationId} 
                    documentType={phase} 
                    onDeleteFile={(docId: number, filename: string) => {
                      setDeleteConfirm({ open: true, docId, filename });
                    }}
                  />
                </div>
              ) : (
                <SimpleFileUpload 
                  applicationId={applicationId} 
                  canUpload={canSubmit || userRole === 'contractor'} 
                  documentType={phase}
                />
              )}
            </div>
          )}
          
          {field.type === 'radio' && (
            <div className="space-y-2">
              {field.options?.map((option: string, index: number) => (
                <label key={index} className={`flex items-center ${isSubmitted ? 'text-gray-600' : ''}`}>
                  <input
                    type="radio"
                    name={field.id}
                    value={option}
                    checked={formData[field.id] === option}
                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                    disabled={isSubmitted}
                    className="mr-2"
                  />
                  {option}
                </label>
              ))}
            </div>
          )}

          {field.type === 'file_download' && (
            <div className="flex items-center justify-between p-3 border rounded-lg bg-blue-50">
              <div className="flex items-center space-x-3">
                <FileText className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium text-sm">{field.fileName || field.label}</p>
                  <p className="text-xs text-gray-500">{field.description}</p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  field.downloadUrl && window.open(field.downloadUrl, '_blank');
                }}
                disabled={!field.downloadUrl}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          )}
          
          {field.description && field.type !== 'file_download' && (
            <p className="text-xs text-gray-500">{field.description}</p>
          )}
        </div>
      ))}
      
      <div className="flex justify-end space-x-4 pt-4">
        {canSubmit && (
          <Button
            type="submit"
            className={submitButtonClass}
          >
            {submitLabel}
          </Button>
        )}
        
        {!canSubmit && (
          <div className="text-sm text-gray-600">
            {isSubmitted 
              ? "This activity has already been submitted and cannot be modified"
              : (userRole === 'contractor' 
                ? "Only company members can submit activities"
                : "You do not have permission to submit activities"
              )
            }
          </div>
        )}
      </div>
    </form>
  );
}

// Pre-Activity Section Component
function PreActivitySection({ 
  application, 
  templates, 
  submissions, 
  onFileUpload, 
  onSubmit, 
  canSubmit, 
  uploading,
  user
}: any) {
  const preSubmission = submissions.find((s: any) => s.phase === 'pre_activity');
  const status = preSubmission?.status || 'not_started';
  const preTemplates = templates.filter((t: any) => t.phase === 'pre_activity');
  
  // Get submitted form data from the submission's reviewNotes field
  const getSubmittedData = (templateId: number) => {
    if (!preSubmission || !preSubmission.reviewNotes) return {};
    try {
      return JSON.parse(preSubmission.reviewNotes);
    } catch {
      return {};
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Pre-Activity Submission</span>
          <Badge variant={status === 'submitted' ? 'default' : 'secondary'}>
            {status.replace('_', ' ')}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {status === 'submitted' && (
          <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-lg">
            <CheckCircle className="h-5 w-5" />
            <span className="text-sm font-medium">Pre-activity submission completed</span>
          </div>
        )}

        {preTemplates.map((template: any) => (
          <div key={template.id} className="space-y-4">
            <div>
              <h4 className="font-medium">{template.name}</h4>
              <p className="text-sm text-gray-600">{template.description}</p>
            </div>
            
            <DynamicForm 
              fields={template.fields || template.form_fields || []}
              onSubmit={onSubmit}
              canSubmit={canSubmit && status !== 'submitted'}
              submitLabel="Submit Pre-Activity"
              submitButtonClass="bg-green-600 hover:bg-green-700"
              isSubmitted={status === 'submitted'}
              userRole={user?.role}
              submittedData={getSubmittedData(template.id)}
              applicationId={application?.id}
              phase="pre_activity"
            />
          </div>
        ))}

        {preTemplates.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500">No pre-activity form template configured</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Post-Activity Section Component
function PostActivitySection({ 
  application, 
  templates, 
  submissions, 
  onFileUpload, 
  onSubmit, 
  canSubmit, 
  uploading,
  preActivityCompleted,
  user
}: any) {
  const postTemplates = templates.filter((t: any) => t.phase === 'post_activity');
  const postSubmission = submissions.find((s: any) => s.phase === 'post_activity');
  const status = postSubmission?.status || 'not_started';
  
  // Get submitted form data from the submission's reviewNotes field
  const getSubmittedData = (templateId: number) => {
    if (!postSubmission || !postSubmission.reviewNotes) return {};
    try {
      return JSON.parse(postSubmission.reviewNotes);
    } catch {
      return {};
    }
  };

  if (!preActivityCompleted) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Pre-Activity Required</h3>
            <p className="text-gray-600">
              Complete and submit the pre-activity phase before accessing post-activity submission.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }



  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Post-Activity Submission</span>
          <Badge variant={status === 'submitted' ? 'default' : 'secondary'}>
            {status.replace('_', ' ')}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {status === 'submitted' && (
          <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-lg">
            <CheckCircle className="h-5 w-5" />
            <span className="text-sm font-medium">Post-activity submission completed</span>
          </div>
        )}

        {postTemplates.map((template: any) => (
          <div key={template.id} className="space-y-4">
            <div>
              <h3 className="text-lg font-medium">{template.name}</h3>
              {template.description && (
                <p className="text-sm text-gray-600 mt-1">{template.description}</p>
              )}
            </div>
            
            <DynamicForm
              fields={template.formFields}
              onSubmit={onSubmit}
              canSubmit={canSubmit && status !== 'submitted'}
              submitLabel="Submit Post-Activity"
              submitButtonClass="w-full bg-green-600 hover:bg-green-700"
              isSubmitted={status === 'submitted'}
              userRole={user?.role}
              submittedData={getSubmittedData(template.id)}
              applicationId={application?.id}
              phase="post_activity"
            />
          </div>
        ))}

        {postTemplates.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500">No post-activity form template configured</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Documents Section Component
function DocumentsSection({ applicationId, onDeleteFile }: { applicationId: string; onDeleteFile: (docId: number, filename: string) => void }) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const { data: documents = [], refetch, isLoading } = useQuery({
    queryKey: ['/api/documents/application', applicationId],
    queryFn: async () => {
      console.log('Fetching documents for applicationId:', applicationId);
      const response = await fetch(`/api/documents/application/${applicationId}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }
      const data = await response.json();
      console.log('Documents fetched:', data);
      return data;
    },
    refetchOnWindowFocus: true,
    staleTime: 0,
    enabled: !!applicationId,
  });

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append('files', file);
      });
      formData.append('applicationId', applicationId);
      formData.append('documentType', 'supporting');

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: `${files.length} file(s) uploaded successfully`,
        });
        // Force immediate refetch
        await refetch();
        // Also invalidate cache
        queryClient.invalidateQueries({
          queryKey: ['/api/documents/application', applicationId]
        });
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to upload files",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (docId: number) => {
    try {
      const response = await fetch(`/api/documents/${docId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Document deleted successfully",
        });
        // Force immediate refetch
        await refetch();
        // Also invalidate cache
        queryClient.invalidateQueries({
          queryKey: ['/api/documents/application', applicationId]
        });
      } else {
        throw new Error('Delete failed');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete document",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>All Documents</CardTitle>
          <div className="flex items-center space-x-2">
            <input
              type="file"
              multiple
              onChange={(e) => handleFileUpload(e.target.files)}
              className="hidden"
              id="document-upload"
              disabled={uploading}
            />
            <label
              htmlFor="document-upload"
              className={`inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer ${
                uploading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? 'Uploading...' : 'Add Files'}
            </label>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {documents.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No documents uploaded yet</p>
            <p className="text-sm text-gray-400">Click "Add Files" to upload supporting documents</p>
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((doc: any) => {
              // Check if this document is from a form submission (pre_activity or post_activity)
              const isFormSubmissionDocument = doc.documentType === 'pre_activity' || doc.documentType === 'post_activity';
              
              return (
                <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-center space-x-3">
                    <FileText className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-medium text-sm">{doc.originalName || doc.filename}</p>
                      <p className="text-xs text-gray-500">
                        {doc.documentType.replace('_', ' ')} • {new Date(doc.createdAt).toLocaleDateString()} • {Math.round(doc.size / 1024)} KB
                        {isFormSubmissionDocument && <span className="ml-2 text-orange-600 font-medium">(Form Submission)</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(`/api/documents/${doc.id}/download`, '_blank')}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    {!isFormSubmissionDocument && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          onDeleteFile(doc.id, doc.originalName || doc.filename);
                        }}
                        className="text-red-600 hover:text-red-700 hover:border-red-300"
                      >
                        ×
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}