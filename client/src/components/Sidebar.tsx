import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import semiLogo from "@/assets/semi-logo.svg";
import { 
  Home,
  FileText, 
  Upload,
  Users,
  HardHat,
  Settings,
  Building2,
  Shield,
  Building,
  BarChart,
  Download,
  Wrench,
  MessageSquare
} from "lucide-react";

const iconMap = {
  Home,
  FileText,
  Upload, 
  Users,
  HardHat,
  Settings,
  Building2,
  Shield,
  Building,
  BarChart,
  Download,
  Wrench,
  MessageSquare
};

export default function Sidebar() {
  const { user } = useAuth();
  const [location] = useLocation();

  const navigationItems = [
    {
      name: "Dashboard",
      href: "/",
      icon: "Home",
      roles: ["company_admin", "team_member", "contractor_account_owner", "contractor_individual", "system_admin"]
    },
    {
      name: "Applications", 
      href: "/applications",
      icon: "FileText",
      roles: ["company_admin", "team_member", "contractor_account_owner", "contractor_individual", "system_admin"]
    },
    {
      name: "Documents",
      href: "/documents", 
      icon: "Upload",
      roles: ["company_admin", "team_member", "contractor_account_owner", "contractor_individual", "system_admin"]
    },
    {
      name: "Team Management",
      href: "/team",
      icon: "Users",
      roles: ["company_admin", "system_admin"]
    },
    {
      name: "Support",
      href: "/messages",
      icon: "MessageSquare",
      roles: ["company_admin", "team_member", "contractor_account_owner", "contractor_individual", "system_admin"]
    }
  ];

  const adminNavigationItems = [
    {
      name: "System Admin",
      href: "/admin",
      icon: "Shield",
      roles: ["system_admin"]
    },
    {
      name: "Form Builder",
      href: "/form-builder",
      icon: "Wrench",
      roles: ["system_admin"]
    },
    {
      name: "Companies", 
      href: "/admin/companies",
      icon: "Building",
      roles: ["system_admin"]
    },
    {
      name: "Reports",
      href: "/admin/reports", 
      icon: "BarChart",
      roles: ["system_admin"]
    }
  ];

  const filteredNavItems = navigationItems.filter(item => 
    user?.role && item.roles.includes(user.role)
  );

  const filteredAdminItems = adminNavigationItems.filter(item =>
    user?.role && item.roles.includes(user.role)
  );

  return (
    <aside className="w-64 bg-white shadow-sm border-r border-gray-200 fixed left-0 top-0 h-full z-10 overflow-y-auto scrollbar-thin">
      {/* Logo */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-full h-16">
            <img 
              src={semiLogo} 
              alt="SEMI Program" 
              className="w-full h-full object-contain"
            />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-bold text-gray-900">SEMI Portal</h2>
            <p className="text-xs text-gray-500">Strategic Energy Management</p>
          </div>
        </div>
      </div>
      
      <nav className="p-4">
        {/* Main Navigation */}
        <div className="space-y-8">
          <div>
            <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Main</h3>
            <div className="mt-2 space-y-1">
              {filteredNavItems.map((item) => {
                const Icon = iconMap[item.icon as keyof typeof iconMap];
                const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                
                return (
                  <Link key={item.name} href={item.href}>
                    <a className={cn(
                      "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                      isActive 
                        ? "bg-primary text-white" 
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    )}>
                      <Icon className="w-5 h-5 mr-3" />
                      {item.name}
                    </a>
                  </Link>
                );
              })}
            </div>
          </div>
          
          {/* Admin Section */}
          {filteredAdminItems.length > 0 && (
            <div>
              <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Administration</h3>
              <div className="mt-2 space-y-1">
                {filteredAdminItems.map((item) => {
                  const Icon = iconMap[item.icon as keyof typeof iconMap];
                  const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                  
                  return (
                    <Link key={item.name} href={item.href}>
                      <a className={cn(
                        "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                        isActive 
                          ? "bg-primary text-white" 
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      )}>
                        <Icon className="w-5 h-5 mr-3" />
                        {item.name}
                      </a>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </nav>
    </aside>
  );
}
