import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, User, LogOut, Shield } from "lucide-react";
import { USER_ROLES } from "@/lib/constants";
import { useQuery } from "@tanstack/react-query";
import { NotificationBell } from "./NotificationBell";

export default function Header() {
  const { user } = useAuth();
  
  // Fetch current company data
  const { data: company } = useQuery({
    queryKey: ['/api/companies/current'],
    enabled: !!user,
  });



  const handleLogout = async () => {
    try {
      const response = await fetch("/api/auth/logout", { 
        method: "POST",
        credentials: "include"
      });
      
      if (response.ok) {
        window.location.href = "/auth";
      }
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const getInitials = (firstName: string = '', lastName: string = '') => {
    const first = firstName?.charAt(0) || '';
    const last = lastName?.charAt(0) || '';
    return `${first}${last}`.toUpperCase() || 'U';
  };

  const getUserRoleInfo = (role: string) => {
    return USER_ROLES[role as keyof typeof USER_ROLES] || USER_ROLES.team_member;
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4 sticky top-0 z-50">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Welcome back, {user?.firstName} {user?.lastName}
          </h1>
          {company?.name && (
            <p className="text-sm text-gray-500 mt-1">
              {company.name}
            </p>
          )}
          {user?.role && (
            <div className="mt-1">
              <Badge 
                variant="outline" 
                className={`border-${getUserRoleInfo(user.role).color}-200 text-${getUserRoleInfo(user.role).color}-800`}
              >
                {getUserRoleInfo(user.role).label}
              </Badge>
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Real-time Notifications */}
          <NotificationBell />
          
          {/* Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center space-x-3 h-auto p-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.profileImageUrl} alt={`${user?.firstName} ${user?.lastName}`} />
                  <AvatarFallback>
                    {getInitials(user?.firstName, user?.lastName)}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium text-gray-900">
                    {user?.firstName} {user?.lastName}
                  </p>
                </div>
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
              <DropdownMenuLabel>
                <div>
                  <p className="font-medium">{user?.firstName} {user?.lastName}</p>
                  <p className="text-xs text-gray-500">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => window.location.href = "/profile"}>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.location.href = "/security"}>
                <Shield className="mr-2 h-4 w-4" />
                Security
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
