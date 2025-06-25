import React, { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { 
  Building2, 
  Users, 
  FileText, 
  Search, 
  Filter, 
  Eye, 
  Edit, 
  ToggleLeft, 
  ToggleRight,
  ArrowUpDown,
  Calendar,
  MapPin,
  Phone,
  Globe,
  Building,
  UserPlus,
  ExternalLink,
  CheckCircle,
  XCircle,
  Loader2,
  Plus,
  FileSpreadsheet
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import AdminEnhancedFacilityForm from "@/components/AdminEnhancedFacilityForm";

export default function AdminCompaniesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showShortnameDialog, setShortnameDialog] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    businessNumber: "",
    website: "",
    streetAddress: "",
    city: "",
    province: "",
    country: "",
    postalCode: "",
    phone: ""
  });
  const [newShortName, setNewShortName] = useState("");
  const [newStatus, setNewStatus] = useState(true);
  const [showFacilityDialog, setShowFacilityDialog] = useState(false);
  // Removed facilityForm state - using AdminEnhancedFacilityForm component now
  const [editingFacility, setEditingFacility] = useState<any>(null);
  
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Excel export function
  const exportToExcel = () => {
    const dataToExport = filteredAndSortedCompanies.map((company: any) => {
      const stats = getCompanyStats(company.id);
      return {
        'Company Name': company.name || '',
        'Short Name': company.shortName || '',
        'Business Number': company.businessNumber || '',
        'Type': company.isContractor ? 'Contractor' : 'Participant',
        'Phone': company.phone || '',
        'Website': company.website || '',
        'Address': [
          company.streetAddress,
          company.city,
          company.province,
          company.postalCode,
          company.country
        ].filter(Boolean).join(', ') || '',
        'Users': stats.userCount,
        'Facilities': 0, // Would need facility data
        'Applications': stats.applicationCount,
        'Status': company.isActive ? 'Active' : 'Inactive',
        'Registration Date': company.createdAt ? new Date(company.createdAt).toLocaleDateString() : ''
      };
    });

    // Convert to CSV format for Excel
    const headers = Object.keys(dataToExport[0] || {});
    const csvContent = [
      headers.join(','),
      ...dataToExport.map(row => 
        headers.map(header => {
          const value = (row as any)[header] || '';
          // Escape quotes and wrap in quotes if contains comma
          return value.toString().includes(',') ? `"${value.toString().replace(/"/g, '""')}"` : value;
        }).join(',')
      )
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `companies_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    toast({
      title: "Export Complete",
      description: `Exported ${dataToExport.length} companies to Excel file.`,
    });
  };

  // Fetch all companies
  const { data: companies = [], isLoading: companiesLoading } = useQuery({
    queryKey: ["/api/admin/companies"],
  });

  // Fetch all users to count per company
  const { data: users = [] } = useQuery({
    queryKey: ["/api/admin/users"],
  });

  // Fetch all applications to count per company
  const { data: applications = [] } = useQuery({
    queryKey: ["/api/admin/applications"],
  });

  // Create count maps for efficient lookup
  const userCounts = useMemo(() => {
    if (!Array.isArray(users)) return {};
    return users.reduce((acc: any, user: any) => {
      acc[user.companyId] = (acc[user.companyId] || 0) + 1;
      return acc;
    }, {});
  }, [users]);

  const applicationCounts = useMemo(() => {
    if (!Array.isArray(applications)) return {};
    return applications.reduce((acc: any, app: any) => {
      acc[app.companyId] = (acc[app.companyId] || 0) + 1;
      return acc;
    }, {});
  }, [applications]);

  const facilityCounts = useMemo(() => {
    if (!Array.isArray(companies)) return {};
    // This would need facility data, but for now we'll return 0s
    return {};
  }, [companies]);

  // Filter and sort companies
  const filteredAndSortedCompanies = useMemo(() => {
    if (!Array.isArray(companies)) return [];
    
    // First filter
    const filtered = companies.filter((company: any) => {
      const searchMatch = searchTerm === '' ||
        company.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        company.shortName?.toLowerCase().includes(searchTerm.toLowerCase());

      const typeMatch = typeFilter === "all" ||
        (typeFilter === "contractor" && company.isContractor) ||
        (typeFilter === "regular" && !company.isContractor);

      return searchMatch && typeMatch;
    });
    
    // Then sort
    const sorted = [...filtered].sort((a: any, b: any) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        default:
          return 0;
      }
    });
    
    return sorted;
  }, [companies, searchTerm, typeFilter, sortBy]);

  const getCompanyStats = (companyId: number) => {
    const safeUsers = Array.isArray(users) ? users : [];
    const safeApplications = Array.isArray(applications) ? applications : [];
    const userCount = safeUsers.filter((user: any) => user.companyId === companyId).length;
    const applicationCount = safeApplications.filter((app: any) => app.companyId === companyId).length;
    return { userCount, applicationCount };
  };

  // Company details query
  const { data: companyDetails, isLoading: detailsLoading } = useQuery({
    queryKey: ["/api/admin/companies", selectedCompany?.id, "details"],
    enabled: !!selectedCompany?.id && showDetailsDialog,
    queryFn: async () => {
      if (!selectedCompany?.id) return null;
      console.log('Fetching details for company:', selectedCompany.id);
      
      const response = await fetch(`/api/admin/companies/${selectedCompany.id}/details`);
      if (!response.ok) {
        throw new Error('Failed to fetch company details');
      }
      const data = await response.json();
      console.log('Company details received:', data);
      return data;
    },
  });

  const safeCompanies = Array.isArray(companies) ? companies : [];
  const safeCompanyDetails = companyDetails || { users: [], facilities: [], applications: [] };

  // Mutations
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ companyId, isActive }: { companyId: number, isActive: boolean }) => {
      return apiRequest(`/api/admin/companies/${companyId}/toggle-status`, "PATCH", { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies"] });
      toast({
        title: "Success",
        description: "Company status updated successfully.",
      });
      setShowStatusDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update company status.",
        variant: "destructive",
      });
    },
  });

  const updateShortNameMutation = useMutation({
    mutationFn: async ({ companyId, shortName }: { companyId: number, shortName: string }) => {
      return apiRequest(`/api/admin/companies/${companyId}/shortname`, "PATCH", { shortName });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/applications"] });
      toast({
        title: "Success",
        description: `Company shortname updated. ${data.updatedApplications || 0} application IDs updated.`,
      });
      setShortnameDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update company shortname.",
        variant: "destructive",
      });
    },
  });

  const updateCompanyMutation = useMutation({
    mutationFn: async ({ companyId, updates }: { companyId: number, updates: any }) => {
      return apiRequest(`/api/admin/companies/${companyId}`, "PATCH", updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies"] });
      toast({
        title: "Success",
        description: "Company information updated successfully.",
      });
      setShowEditDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update company information.",
        variant: "destructive",
      });
    },
  });

  const stats = {
    totalCompanies: Array.isArray(companies) ? companies.length : 0,
    contractorCompanies: Array.isArray(companies) ? companies.filter((c: any) => c.isContractor).length : 0,
    regularCompanies: Array.isArray(companies) ? companies.filter((c: any) => !c.isContractor).length : 0,
    activeCompanies: Array.isArray(companies) ? companies.filter((c: any) => c.isActive).length : 0,
  };

  // Handler functions
  const handleViewDetails = (company: any) => {
    setSelectedCompany(company);
    setShowDetailsDialog(true);
  };

  const handleEditCompany = (company: any) => {
    setSelectedCompany(company);
    setEditForm({
      name: company.name || "",
      businessNumber: company.businessNumber || "",
      website: company.website || "",
      streetAddress: company.streetAddress || "",
      city: company.city || "",
      province: company.province || "",
      country: company.country || "",
      postalCode: company.postalCode || "",
      phone: company.phone || ""
    });
    setShowEditDialog(true);
  };

  const handleToggleStatus = (company: any) => {
    setSelectedCompany(company);
    setNewStatus(!company.isActive);
    setShowStatusDialog(true);
  };

  const handleChangeShortName = (company: any) => {
    setSelectedCompany(company);
    setNewShortName(company.shortName);
    setShortnameDialog(true);
  };

  const handleViewUsers = (company: any) => {
    setLocation(`/admin/users?company=${company.id}`);
  };

  const handleViewApplications = (company: any) => {
    setSelectedCompany(company);
    setShowDetailsDialog(true);
  };

  const handleAddFacility = (company: any) => {
    setSelectedCompany(company);
    setEditingFacility(null);
    setShowFacilityDialog(true);
  };

  const handleEditFacility = (facility: any) => {
    setEditingFacility(facility);
    setShowFacilityDialog(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Company Management</h1>
          <p className="text-gray-600">Oversee all registered companies and their status</p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Companies</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCompanies}</div>
            <p className="text-xs text-muted-foreground">All registered</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Participants</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.regularCompanies}</div>
            <p className="text-xs text-muted-foreground">Program participants</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contractors</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.contractorCompanies}</div>
            <p className="text-xs text-muted-foreground">Service providers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Companies</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeCompanies}</div>
            <p className="text-xs text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>
      </div>

      {/* Companies Table */}
      <Card>
        <CardHeader>
          <CardTitle>Company Directory</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 mb-6">
            <div className="flex items-center space-x-4">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search companies by name or short name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
              
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-48">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="regular">Participants</SelectItem>
                  <SelectItem value="contractor">Contractors</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-48">
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="name-asc">Name A-Z</SelectItem>
                  <SelectItem value="name-desc">Name Z-A</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Total: {Array.isArray(companies) ? companies.length : 0} companies | 
                Filtered: {filteredAndSortedCompanies.length} companies
              </div>
              <Button 
                onClick={exportToExcel}
                variant="outline" 
                size="sm"
                className="flex items-center gap-2"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Export to Excel
              </Button>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company Name</TableHead>
                <TableHead>Short Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>Applications</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Registered</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedCompanies.map((company: any) => {
                const stats = getCompanyStats(company.id);
                return (
                  <TableRow key={company.id} className="hover:bg-gray-50">
                    <TableCell className="font-medium">
                      <button 
                        onClick={() => handleViewDetails(company)}
                        className="text-blue-600 hover:text-blue-800 hover:underline text-left"
                      >
                        {company.name}
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">{company.shortName}</Badge>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleChangeShortName(company)}
                          className="h-6 w-6 p-0"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={company.isContractor ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}>
                        {company.isContractor ? 'Contractor' : 'Participant'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <button 
                        onClick={() => handleViewUsers(company)}
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {stats.userCount}
                      </button>
                    </TableCell>
                    <TableCell>
                      <button 
                        onClick={() => handleViewApplications(company)}
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {stats.applicationCount}
                      </button>
                    </TableCell>
                    <TableCell>
                      <button 
                        onClick={() => handleToggleStatus(company)}
                        className="flex items-center space-x-1"
                      >
                        <Badge variant={company.isActive ? 'default' : 'secondary'} className="cursor-pointer">
                          {company.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        {company.isActive ? 
                          <ToggleRight className="h-4 w-4 text-green-600" /> :
                          <ToggleLeft className="h-4 w-4 text-gray-400" />
                        }
                      </button>
                    </TableCell>
                    <TableCell>
                      {company.createdAt ? new Date(company.createdAt).toLocaleDateString() : 'Unknown'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleViewDetails(company)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleEditCompany(company)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {filteredAndSortedCompanies.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No companies found matching your criteria.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Company Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Building2 className="h-5 w-5" />
              <span>{selectedCompany?.name}</span>
              <Badge variant="outline">{selectedCompany?.shortName}</Badge>
            </DialogTitle>
            <DialogDescription>
              Complete company information and management
            </DialogDescription>
          </DialogHeader>
          
          {detailsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading company details...</span>
            </div>
          ) : companyDetails ? (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="users">Users ({safeCompanyDetails.users?.length || 0})</TabsTrigger>
                <TabsTrigger value="facilities">Facilities ({safeCompanyDetails.facilities?.length || 0})</TabsTrigger>
                <TabsTrigger value="applications">Applications ({safeCompanyDetails.applications?.length || 0})</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Company Type</Label>
                      <div className="mt-1">
                        <Badge className={safeCompanyDetails.isContractor ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}>
                          {safeCompanyDetails.isContractor ? 'Contractor' : 'Participant'}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Status</Label>
                      <div className="mt-1">
                        <Badge variant={safeCompanyDetails.isActive ? 'default' : 'secondary'}>
                          {safeCompanyDetails.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Business Number</Label>
                      <p className="mt-1">{companyDetails.businessNumber || 'Not provided'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Website</Label>
                      <p className="mt-1">
                        {companyDetails.website ? (
                          <a href={companyDetails.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center">
                            {companyDetails.website}
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </a>
                        ) : 'Not provided'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Address</Label>
                      <div className="mt-1 text-sm">
                        {companyDetails.streetAddress && (
                          <div className="flex items-start space-x-1">
                            <MapPin className="h-4 w-4 mt-0.5 text-gray-400" />
                            <div>
                              <p>{companyDetails.streetAddress}</p>
                              <p>{companyDetails.city}, {companyDetails.province} {companyDetails.postalCode}</p>
                              <p>{companyDetails.country}</p>
                            </div>
                          </div>
                        )}
                        {!companyDetails.streetAddress && companyDetails.address && (
                          <div className="flex items-start space-x-1">
                            <MapPin className="h-4 w-4 mt-0.5 text-gray-400" />
                            <p>{companyDetails.address}</p>
                          </div>
                        )}
                        {!companyDetails.streetAddress && !companyDetails.address && (
                          <p className="text-gray-500">No address provided</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Phone</Label>
                      <div className="mt-1 flex items-center space-x-1">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <p>{companyDetails.phone || 'Not provided'}</p>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Registration Date</Label>
                      <div className="mt-1 flex items-center space-x-1">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <p>{companyDetails.createdAt ? new Date(companyDetails.createdAt).toLocaleDateString() : 'Unknown'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="users" className="space-y-4 mt-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Company Users</h3>
                  <Button onClick={() => handleViewUsers(selectedCompany)} size="sm">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Manage Users
                  </Button>
                </div>
                <div className="space-y-2">
                  {companyDetails.users?.length ? (
                    companyDetails.users.map((user: any) => (
                      <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{user.firstName} {user.lastName}</p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline">{user.role.replace('_', ' ')}</Badge>
                          <Badge variant={user.isActive ? 'default' : 'secondary'}>
                            {user.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-4">No users found for this company.</p>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="facilities" className="space-y-4 mt-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Company Facilities</h3>
                  <Button 
                    onClick={() => handleAddFacility(selectedCompany)}
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Facility
                  </Button>
                </div>
                <div className="space-y-2">
                  {safeCompanyDetails.facilities?.length ? (
                    safeCompanyDetails.facilities.map((facility: any) => (
                      <div key={facility.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium">{facility.name}</p>
                          <p className="text-sm text-gray-500">{facility.streetAddress || facility.address}</p>
                          {facility.naicsCode && (
                            <p className="text-xs text-gray-400">NAICS: {facility.naicsCode}</p>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline">{facility.facilitySector || 'N/A'}</Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditFacility(facility)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-4">No facilities found for this company.</p>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="applications" className="space-y-4 mt-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Company Applications</h3>
                </div>
                <div className="space-y-2">
                  {safeCompanyDetails.applications?.length ? (
                    safeCompanyDetails.applications.map((application: any) => (
                      <div key={application.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <Link 
                            href={`/applications/${application.id}`}
                            className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {application.applicationId}
                          </Link>
                          <p className="text-sm text-gray-500">{application.title}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline">{application.activityType}</Badge>
                          <Badge 
                            variant={
                              application.status === 'approved' ? 'default' :
                              application.status === 'submitted' ? 'secondary' :
                              application.status === 'rejected' ? 'destructive' : 'outline'
                            }
                          >
                            {application.status}
                          </Badge>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-4">No applications found for this company.</p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Edit Company Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Company Information</DialogTitle>
            <DialogDescription>
              Update company details and contact information.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Company Name</Label>
              <Input
                id="name"
                value={editForm.name}
                onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Company name"
              />
            </div>
            <div>
              <Label htmlFor="businessNumber">Business Number</Label>
              <Input
                id="businessNumber"
                value={editForm.businessNumber}
                onChange={(e) => setEditForm(prev => ({ ...prev, businessNumber: e.target.value }))}
                placeholder="Business registration number"
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={editForm.website}
                onChange={(e) => setEditForm(prev => ({ ...prev, website: e.target.value }))}
                placeholder="https://company.com"
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="streetAddress">Street Address</Label>
              <Input
                id="streetAddress"
                value={editForm.streetAddress}
                onChange={(e) => setEditForm(prev => ({ ...prev, streetAddress: e.target.value }))}
                placeholder="Street address"
              />
            </div>
            <div>
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={editForm.city}
                onChange={(e) => setEditForm(prev => ({ ...prev, city: e.target.value }))}
                placeholder="City"
              />
            </div>
            <div>
              <Label htmlFor="province">Province</Label>
              <Input
                id="province"
                value={editForm.province}
                onChange={(e) => setEditForm(prev => ({ ...prev, province: e.target.value }))}
                placeholder="Province/State"
              />
            </div>
            <div>
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={editForm.country}
                onChange={(e) => setEditForm(prev => ({ ...prev, country: e.target.value }))}
                placeholder="Country"
              />
            </div>
            <div>
              <Label htmlFor="postalCode">Postal Code</Label>
              <Input
                id="postalCode"
                value={editForm.postalCode}
                onChange={(e) => setEditForm(prev => ({ ...prev, postalCode: e.target.value }))}
                placeholder="Postal/ZIP code"
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={editForm.phone}
                onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="Phone number"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => updateCompanyMutation.mutate({ 
                companyId: selectedCompany.id, 
                updates: editForm 
              })}
              disabled={updateCompanyMutation.isPending}
            >
              {updateCompanyMutation.isPending ? "Updating..." : "Update Company"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Shortname Dialog */}
      <Dialog open={showShortnameDialog} onOpenChange={setShortnameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Company Short Name</DialogTitle>
            <DialogDescription>
              Update the company short name. All application IDs will be automatically updated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="shortName">New Short Name (max 6 characters)</Label>
              <Input
                id="shortName"
                value={newShortName}
                onChange={(e) => setNewShortName(e.target.value.toUpperCase().slice(0, 6))}
                placeholder="SHORTNAME"
                maxLength={6}
              />
              <p className="text-xs text-gray-500 mt-1">
                Current: {selectedCompany?.shortName} → New: {newShortName}
              </p>
            </div>
            {selectedCompany && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <div className="text-yellow-600 mt-0.5">⚠️</div>
                  <div className="text-sm">
                    <p className="font-medium text-yellow-800">Important:</p>
                    <p className="text-yellow-700">
                      This will update all application IDs for this company from {selectedCompany.shortName}-XXX-XXX to {newShortName}-XXX-XXX format.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShortnameDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => updateShortNameMutation.mutate({ 
                companyId: selectedCompany.id, 
                shortName: newShortName 
              })}
              disabled={updateShortNameMutation.isPending || !newShortName.trim()}
            >
              {updateShortNameMutation.isPending ? "Updating..." : "Update Short Name"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toggle Status Dialog */}
      <AlertDialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {newStatus ? 'Activate' : 'Deactivate'} Company
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {newStatus ? 'activate' : 'deactivate'} {selectedCompany?.name}?
              {!newStatus && (
                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-800">
                  Deactivating will make this company invisible to contractors and may affect ongoing applications.
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toggleStatusMutation.mutate({ 
                companyId: selectedCompany.id, 
                isActive: newStatus 
              })}
              disabled={toggleStatusMutation.isPending}
            >
              {toggleStatusMutation.isPending ? "Updating..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Enhanced Facility Management Dialog */}
      <Dialog open={showFacilityDialog} onOpenChange={setShowFacilityDialog}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              {editingFacility ? "Edit Facility" : "Add New Facility"}
            </DialogTitle>
            <DialogDescription>
              {editingFacility ? "Update facility information with complete details" : "Create a new facility for this company with comprehensive information"}
            </DialogDescription>
          </DialogHeader>
          
          <AdminEnhancedFacilityForm
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/admin/companies", selectedCompany?.id, "details"] });
              toast({
                title: "Success",
                description: `Facility ${editingFacility ? 'updated' : 'created'} successfully.`,
              });
              setShowFacilityDialog(false);
              setEditingFacility(null);
            }}
            onCancel={() => {
              setShowFacilityDialog(false);
              setEditingFacility(null);
            }}
            editingFacility={editingFacility}
            companyId={selectedCompany?.id}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}