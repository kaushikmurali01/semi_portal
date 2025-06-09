import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { UserPlus, Mail, Shield, User, MoreVertical, Settings, UserX } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { hasPermission, PERMISSIONS, getRoleInfo, canInviteUsers, canEditPermissions, PERMISSION_LEVEL_INFO } from "@/lib/permissions";

export default function TeamManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [showPermissionLevelDialog, setShowPermissionLevelDialog] = useState(false);
  const [showTransferAdminDialog, setShowTransferAdminDialog] = useState(false);
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['/api/team'],
  });

  const inviteUserMutation = useMutation({
    mutationFn: async (userData: any) => {
      const res = await apiRequest("POST", "/api/team/invite", userData);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Invitation sent",
        description: "Team member invited successfully. An email with login credentials has been sent.",
      });
      setShowInviteDialog(false);
      queryClient.invalidateQueries({ queryKey: ['/api/team'] });
    },
    onError: (error: any) => {
      toast({
        title: "Invitation failed",
        description: error.message || "Failed to send invitation.",
        variant: "destructive",
      });
    }
  });



  const transferAdminMutation = useMutation({
    mutationFn: async ({ newAdminId }: { newAdminId: string }) => {
      return await apiRequest('PATCH', `/api/team/transfer-admin`, { newAdminId });
    },
    onSuccess: () => {
      toast({
        title: "Admin transferred",
        description: "Company admin role has been transferred successfully.",
      });
      setShowTransferAdminDialog(false);
      setSelectedMember(null);
      queryClient.invalidateQueries({ queryKey: ['/api/team'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to transfer admin",
        description: error.message || "An error occurred while transferring admin role.",
        variant: "destructive",
      });
    }
  });

  const updatePermissionLevelMutation = useMutation({
    mutationFn: async ({ userId, permissionLevel }: { userId: string; permissionLevel: string }) => {
      return await apiRequest('PATCH', `/api/users/${userId}/permission-level`, { permissionLevel });
    },
    onSuccess: () => {
      toast({
        title: "Permissions updated",
        description: "User permission level has been updated successfully.",
      });
      setShowPermissionLevelDialog(false);
      setSelectedMember(null);
      queryClient.invalidateQueries({ queryKey: ['/api/team'] });
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update user permission level.",
        variant: "destructive",
      });
    }
  });

  const deactivateUserMutation = useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      return await apiRequest('PATCH', `/api/users/${userId}/deactivate`, {});
    },
    onSuccess: () => {
      toast({
        title: "User deactivated",
        description: "User has been deactivated successfully.",
      });
      setShowDeactivateDialog(false);
      setSelectedMember(null);
      queryClient.invalidateQueries({ queryKey: ['/api/team'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to deactivate user",
        description: error.message || "An error occurred while deactivating the user.",
        variant: "destructive",
      });
    }
  });

  const handleInviteUser = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const role = formData.get('role') as string;
    const firstName = formData.get('firstName') as string;
    const lastName = formData.get('lastName') as string;
    const message = formData.get('message') as string;

    inviteUserMutation.mutate({
      email,
      role,
      firstName,
      lastName,
      message
    });
  };

  const getInitials = (firstName: string = '', lastName: string = '') => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'company_admin':
        return 'bg-blue-100 text-blue-800';
      case 'team_member':
        return 'bg-gray-100 text-gray-800';
      case 'contractor_account_owner':
        return 'bg-purple-100 text-purple-800';
      case 'contractor_individual':
        return 'bg-green-100 text-green-800';
      case 'system_admin':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'company_admin':
        return 'Company Admin';
      case 'team_member':
        return 'Team Member';
      case 'contractor_account_owner':
        return 'Contractor Owner';
      case 'contractor_individual':
        return 'Contractor';
      case 'system_admin':
        return 'System Admin';
      default:
        return role;
    }
  };

  const canInviteTeamMembers = user ? hasPermission(user.role, PERMISSIONS.INVITE_TEAM_MEMBERS) : false;
  const canManageTeam = user ? hasPermission(user.role, PERMISSIONS.MANAGE_TEAM_MEMBERS) : false;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Management</h1>
          <p className="text-gray-600">
            Manage your team members, roles, and permissions.
          </p>
        </div>
        {canInviteTeamMembers && (
          <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90">
                <UserPlus className="h-4 w-4 mr-2" />
                Invite Team Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite Team Member</DialogTitle>
                <DialogDescription>
                  Send an invitation to a new team member to join your organization.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleInviteUser} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input id="firstName" name="firstName" required />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input id="lastName" name="lastName" required />
                  </div>
                </div>
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" name="email" type="email" required />
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select name="role" defaultValue="team_member">
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="team_member">Team Member</SelectItem>
                      {(user?.role === 'company_admin' || user?.role === 'system_admin') && (
                        <SelectItem value="company_admin">Company Admin</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="message">Personal Message (Optional)</Label>
                  <Textarea 
                    id="message" 
                    name="message" 
                    placeholder="Add a personal message to the invitation..."
                    rows={3}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setShowInviteDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={inviteUserMutation.isPending}>
                    {inviteUserMutation.isPending ? 'Sending...' : 'Send Invitation'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Team Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Team Members</p>
                <p className="text-3xl font-bold text-gray-900">{teamMembers.length}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <User className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Admins</p>
                <p className="text-3xl font-bold text-gray-900">
                  {teamMembers.filter((member: any) => member.role === 'company_admin').length}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Shield className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Members</p>
                <p className="text-3xl font-bold text-gray-900">
                  {teamMembers.filter((member: any) => member.isActive).length}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <User className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team Members List */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          {teamMembers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {teamMembers.map((member: any) => (
                <div key={member.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={member.profileImageUrl} alt={`${member.firstName} ${member.lastName}`} />
                        <AvatarFallback>
                          {getInitials(member.firstName, member.lastName)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h4 className="font-semibold text-gray-900">
                          {member.firstName} {member.lastName}
                        </h4>
                        <div className="flex items-center space-x-2 mt-1">
                          <Mail className="h-3 w-3 text-gray-400" />
                          <span className="text-sm text-gray-500">{member.email}</span>
                        </div>
                      </div>
                    </div>

                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Role:</span>
                      <Badge className={getRoleBadgeColor(member.role)}>
                        {getRoleDisplayName(member.role)}
                      </Badge>
                    </div>
                    
                    {member.role === 'team_member' && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Permission Level:</span>
                        <Badge variant="outline" className={getPermissionLevelColor(member.permissionLevel || 'viewer')}>
                          {getPermissionLevelDisplayName(member.permissionLevel || 'viewer')}
                        </Badge>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Status:</span>
                      <Badge variant={member.isActive ? "default" : "secondary"}>
                        {member.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>

                    {member.createdAt && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Joined:</span>
                        <span className="text-sm text-gray-700">
                          {new Date(member.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>

                  {hasPermission(user?.role, PERMISSIONS.MANAGE_TEAM_MEMBERS) && member.id !== user?.id && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full">
                            <Settings className="h-4 w-4 mr-2" />
                            Manage
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {member.role === 'team_member' && canEditPermissions(user) && (
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedMember(member);
                                setShowPermissionLevelDialog(true);
                              }}
                            >
                              <User className="h-4 w-4 mr-2" />
                              Change Permissions
                            </DropdownMenuItem>
                          )}
                          {user?.role === 'company_admin' && member.role !== 'company_admin' && (
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedMember(member);
                                setShowTransferAdminDialog(true);
                              }}
                            >
                              <Shield className="h-4 w-4 mr-2" />
                              Make Company Admin
                            </DropdownMenuItem>
                          )}
                          {member.isActive && (
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedMember(member);
                                setShowDeactivateDialog(true);
                              }}
                            >
                              <UserX className="h-4 w-4 mr-2" />
                              Deactivate
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <User className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No team members found</p>
              <p className="text-sm text-gray-400">Start by inviting your first team member</p>
            </div>
          )}
        </CardContent>
      </Card>



      {/* Transfer Admin Dialog */}
      <AlertDialog open={showTransferAdminDialog} onOpenChange={setShowTransferAdminDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transfer Admin Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to transfer the company admin role to {selectedMember?.firstName} {selectedMember?.lastName}? 
              This action will make them the company admin and change your role to team member. This cannot be undone without their approval.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedMember) {
                  transferAdminMutation.mutate({ newAdminId: selectedMember.id });
                }
              }}
              disabled={transferAdminMutation.isPending}
            >
              {transferAdminMutation.isPending ? 'Transferring...' : 'Transfer Admin Role'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Deactivate User Dialog */}
      <AlertDialog open={showDeactivateDialog} onOpenChange={setShowDeactivateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate {selectedMember?.firstName} {selectedMember?.lastName}? 
              They will lose access to the system and cannot perform any actions until reactivated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedMember) {
                  deactivateUserMutation.mutate({ userId: selectedMember.id });
                }
              }}
              disabled={deactivateUserMutation.isPending}
            >
              {deactivateUserMutation.isPending ? 'Deactivating...' : 'Deactivate User'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permission Level Dialog */}
      <Dialog open={showPermissionLevelDialog} onOpenChange={setShowPermissionLevelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Permission Level</DialogTitle>
            <DialogDescription>
              Update the permission level for {selectedMember?.firstName} {selectedMember?.lastName}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const permissionLevel = formData.get('permissionLevel') as string;
            if (selectedMember && permissionLevel) {
              updatePermissionLevelMutation.mutate({ 
                userId: selectedMember.id, 
                permissionLevel 
              });
            }
          }}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="permissionLevel">Permission Level</Label>
                <Select name="permissionLevel" defaultValue={selectedMember?.permissionLevel || 'viewer'}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select permission level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">
                      <div>
                        <div className="font-medium">Viewer</div>
                        <div className="text-xs text-gray-500">Read-only access to view company data</div>
                      </div>
                    </SelectItem>
                    <SelectItem value="editor">
                      <div>
                        <div className="font-medium">Editor</div>
                        <div className="text-xs text-gray-500">Can create, edit and submit facilities and applications</div>
                      </div>
                    </SelectItem>
                    <SelectItem value="manager">
                      <div>
                        <div className="font-medium">Manager</div>
                        <div className="text-xs text-gray-500">Can invite users and assign permissions</div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setShowPermissionLevelDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updatePermissionLevelMutation.isPending}>
                {updatePermissionLevelMutation.isPending ? 'Updating...' : 'Update Permission Level'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper functions
function getInitials(firstName?: string, lastName?: string) {
  return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
}

function getRoleDisplayName(role: string) {
  const roleInfo = getRoleInfo(role);
  return roleInfo.label;
}

function getRoleBadgeColor(role: string) {
  switch (role) {
    case 'company_admin':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'team_member':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'contractor_individual':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'system_admin':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

function getPermissionLevelDisplayName(permissionLevel: string) {
  const levelInfo = PERMISSION_LEVEL_INFO[permissionLevel as keyof typeof PERMISSION_LEVEL_INFO];
  return levelInfo?.label || permissionLevel;
}

function getPermissionLevelColor(permissionLevel: string) {
  switch (permissionLevel) {
    case 'manager':
      return 'bg-green-50 text-green-700 border-green-200';
    case 'editor':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'viewer':
      return 'bg-gray-50 text-gray-700 border-gray-200';
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200';
  }
}
