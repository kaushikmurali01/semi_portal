import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eye, Edit, MoreHorizontal, Settings, Check } from "lucide-react";
import { APPLICATION_STATUSES, ACTIVITY_TYPES } from "@/lib/constants";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { useState, useEffect } from "react";

interface Application {
  id: number;
  applicationId: string;
  title: string;
  activityType: string;
  status: string;
  submittedAt?: string;
  submittedBy?: string;
  createdAt: string;
  updatedAt?: string;
  facilityName?: string;
  description?: string;
  detailedStatus?: string;
  hasPreActivitySubmission?: boolean;
  hasPostActivitySubmission?: boolean;
}

interface ApplicationTableProps {
  applications: Application[];
  showColumnSelector?: boolean;
  compact?: boolean;
}

interface ColumnVisibility {
  applicationId: boolean;
  title: boolean;
  activityType: boolean;
  status: boolean;
  facilityName: boolean;
  description: boolean;
  createdAt: boolean;
  updatedAt: boolean;
  submittedAt: boolean;
}

const DEFAULT_COLUMNS: ColumnVisibility = {
  applicationId: true,
  title: false,
  activityType: true,
  status: true,
  facilityName: true,
  description: false,
  createdAt: true,
  updatedAt: false,
  submittedAt: false,
};

export function ApplicationTable({ applications, showColumnSelector = false, compact = false }: ApplicationTableProps) {
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>(DEFAULT_COLUMNS);

  // For compact mode (dashboard), override column visibility
  const effectiveColumnVisibility = compact ? {
    applicationId: true,
    title: false,
    activityType: true,
    status: true,
    facilityName: true,
    description: false,
    createdAt: true,
    updatedAt: false,
    submittedAt: false,
  } : columnVisibility;

  // Load saved column preferences (only for non-compact mode)
  useEffect(() => {
    if (!compact) {
      const saved = localStorage.getItem('applicationTable_columnVisibility');
      if (saved) {
        try {
          const parsedColumns = JSON.parse(saved);
          setColumnVisibility({ ...DEFAULT_COLUMNS, ...parsedColumns });
        } catch (error) {
          console.error('Failed to parse saved column preferences:', error);
        }
      }
    }
  }, [compact]);

  // Save column preferences when they change
  const updateColumnVisibility = (column: keyof ColumnVisibility, visible: boolean) => {
    const newVisibility = { ...columnVisibility, [column]: visible };
    setColumnVisibility(newVisibility);
    localStorage.setItem('applicationTable_columnVisibility', JSON.stringify(newVisibility));
  };
  // Enhanced status logic to show detailed workflow stages
  const getDetailedStatus = (application: Application) => {
    // Use the detailedStatus from backend if available
    if (application.detailedStatus) {
      switch (application.detailedStatus) {
        case 'draft':
          return { label: 'Draft', color: 'bg-gray-100 text-gray-800' };
        case 'pre-activity-started':
          return { label: 'Pre-Activity Started', color: 'bg-orange-100 text-orange-800' };
        case 'pre-activity-submitted':
          return { label: 'Pre-Activity Submitted', color: 'bg-blue-100 text-blue-800' };
        case 'post-activity-started':
          return { label: 'Post-Activity Started', color: 'bg-purple-100 text-purple-800' };
        case 'post-activity-submitted':
          return { label: 'Post-Activity Submitted', color: 'bg-green-100 text-green-800' };
        default:
          break;
      }
    }
    
    // Fallback to basic status logic
    if (application.status === 'draft') {
      return { label: 'Draft', color: 'bg-gray-100 text-gray-800' };
    }
    
    if (application.status === 'submitted') {
      return { label: 'Pre-Activity Submitted', color: 'bg-blue-100 text-blue-800' };
    }
    
    if (application.status === 'under_review') {
      return { label: 'Under Review', color: 'bg-yellow-100 text-yellow-800' };
    }
    
    if (application.status === 'approved') {
      return { label: 'Approved', color: 'bg-green-100 text-green-800' };
    }
    
    if (application.status === 'rejected') {
      return { label: 'Rejected', color: 'bg-red-100 text-red-800' };
    }
    
    if (application.status === 'needs_revision') {
      return { label: 'Needs Revision', color: 'bg-orange-100 text-orange-800' };
    }
    
    return { label: 'Draft', color: 'bg-gray-100 text-gray-800' };
  };

  const getStatusBadge = (application: Application) => {
    const status = getDetailedStatus(application);
    return (
      <Badge className={status.color}>
        {status.label}
      </Badge>
    );
  };

  const getActivityBadge = (activityType: string) => {
    const activity = ACTIVITY_TYPES[activityType as keyof typeof ACTIVITY_TYPES];
    if (!activity) return <Badge variant="outline">{activityType}</Badge>;

    const colorClass = {
      blue: "bg-blue-100 text-blue-800",
      purple: "bg-purple-100 text-purple-800",
      indigo: "bg-indigo-100 text-indigo-800",
      green: "bg-green-100 text-green-800",
      teal: "bg-teal-100 text-teal-800",
      orange: "bg-orange-100 text-orange-800"
    }[activity.color];

    return (
      <Badge className={colorClass}>
        {activityType}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (applications.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-400 mb-2">
          <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-sm font-medium text-gray-900">No applications</h3>
        <p className="text-sm text-gray-500">Get started by creating your first application.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden">
      {showColumnSelector && (
        <div className="mb-4 flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Show Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={columnVisibility.applicationId}
                onCheckedChange={(checked) => updateColumnVisibility('applicationId', checked)}
              >
                Application ID
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columnVisibility.title}
                onCheckedChange={(checked) => updateColumnVisibility('title', checked)}
              >
                Title
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columnVisibility.activityType}
                onCheckedChange={(checked) => updateColumnVisibility('activityType', checked)}
              >
                Activity Type
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columnVisibility.status}
                onCheckedChange={(checked) => updateColumnVisibility('status', checked)}
              >
                Status
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columnVisibility.facilityName}
                onCheckedChange={(checked) => updateColumnVisibility('facilityName', checked)}
              >
                Facility
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columnVisibility.description}
                onCheckedChange={(checked) => updateColumnVisibility('description', checked)}
              >
                Description
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columnVisibility.createdAt}
                onCheckedChange={(checked) => updateColumnVisibility('createdAt', checked)}
              >
                Date Created
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columnVisibility.updatedAt}
                onCheckedChange={(checked) => updateColumnVisibility('updatedAt', checked)}
              >
                Date Updated
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columnVisibility.submittedAt}
                onCheckedChange={(checked) => updateColumnVisibility('submittedAt', checked)}
              >
                Date Submitted
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      
      <Table>
        <TableHeader>
          <TableRow>
            {effectiveColumnVisibility.applicationId && <TableHead>Application ID</TableHead>}
            {effectiveColumnVisibility.facilityName && <TableHead>Facility</TableHead>}
            {effectiveColumnVisibility.activityType && <TableHead>Activity Type</TableHead>}
            {effectiveColumnVisibility.status && <TableHead>Status</TableHead>}
            {effectiveColumnVisibility.createdAt && <TableHead>Created</TableHead>}
            {effectiveColumnVisibility.title && <TableHead>Title</TableHead>}
            {effectiveColumnVisibility.description && <TableHead>Description</TableHead>}
            {effectiveColumnVisibility.updatedAt && <TableHead>Updated</TableHead>}
            {effectiveColumnVisibility.submittedAt && <TableHead>Submitted</TableHead>}
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {applications.map((application) => (
            <TableRow key={application.id} className="table-row-hover">
              {effectiveColumnVisibility.applicationId && (
                <TableCell className="font-medium">
                  <button
                    onClick={() => window.location.href = `/applications/${application.id}`}
                    className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                  >
                    {application.applicationId}
                  </button>
                </TableCell>
              )}
              {effectiveColumnVisibility.facilityName && (
                <TableCell className="text-sm text-gray-600">
                  {application.facilityName || '-'}
                </TableCell>
              )}
              {effectiveColumnVisibility.activityType && (
                <TableCell>
                  {getActivityBadge(application.activityType)}
                </TableCell>
              )}
              {effectiveColumnVisibility.status && (
                <TableCell>
                  {getStatusBadge(application)}
                </TableCell>
              )}
              {effectiveColumnVisibility.createdAt && (
                <TableCell className="text-sm text-gray-500">
                  {formatDate(application.createdAt)}
                </TableCell>
              )}
              {effectiveColumnVisibility.title && (
                <TableCell>
                  <div>
                    <p className="font-medium text-gray-900">{application.title}</p>
                  </div>
                </TableCell>
              )}
              {effectiveColumnVisibility.description && (
                <TableCell className="text-sm text-gray-600 max-w-[200px] truncate">
                  {application.description || '-'}
                </TableCell>
              )}
              {effectiveColumnVisibility.updatedAt && (
                <TableCell className="text-sm text-gray-500">
                  {application.updatedAt ? formatDate(application.updatedAt) : '-'}
                </TableCell>
              )}
              {effectiveColumnVisibility.submittedAt && (
                <TableCell className="text-sm text-gray-500">
                  {application.submittedAt 
                    ? formatDate(application.submittedAt)
                    : 'Not submitted'
                  }
                </TableCell>
              )}
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <span className="sr-only">Open menu</span>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => window.location.href = `/applications/${application.id}`}>
                      <Eye className="mr-2 h-4 w-4" />
                      View Details
                    </DropdownMenuItem>
                    {(application.status === 'draft' || application.status === 'needs_revision') && (
                      <DropdownMenuItem onClick={() => window.location.href = `/applications/${application.id}`}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Application
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigator.clipboard.writeText(application.applicationId)}>
                      Copy Application ID
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
