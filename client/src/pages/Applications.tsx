import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApplicationTable } from "@/components/ApplicationTable";
import { useAuth } from "@/hooks/useAuth";

export default function Applications() {
  const { user } = useAuth();

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ['/api/applications'],
  });

  const { data: assignedApplications = [] } = useQuery({
    queryKey: ['/api/applications/assigned'],
    enabled: user?.role === 'contractor_individual',
  });

  const applicationsToShow = user?.role === 'contractor_individual' ? assignedApplications : applications;

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">All Applications</h1>
          <p className="text-gray-600">Loading applications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">All Applications</h1>
        <p className="text-gray-600">
          {user?.role === 'contractor_individual' 
            ? "Applications you've been assigned to support."
            : "All applications for your organization."
          }
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Applications ({applicationsToShow.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ApplicationTable 
            applications={applicationsToShow} 
            showColumnSelector={true}
          />
        </CardContent>
      </Card>
    </div>
  );
}