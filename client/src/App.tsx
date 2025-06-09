import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import AuthPage from "@/pages/auth-page";
import PasswordReset from "@/pages/PasswordReset";
import Dashboard from "@/pages/Dashboard";
import Applications from "@/pages/Applications";
import Documents from "@/pages/Documents";
import TeamManagement from "@/pages/TeamManagement";
import AdminPanel from "@/pages/AdminPanel";
import AdminDashboard from "@/pages/AdminDashboard";
import ContractorManagement from "@/pages/ContractorManagement";
import Profile from "@/pages/Profile";
import SecuritySettings from "@/pages/security-settings";
import VerifyEmail from "@/pages/verify-email";
import ApplicationDetails from "@/pages/application-details";
import AdminFormBuilder from "@/pages/admin-form-builder";
import ThreadedMessages from "@/pages/threaded-messages";
import Layout from "@/components/Layout";

function Router() {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Switch>
      {!isAuthenticated ? (
        <>
          <Route path="/" component={Landing} />
          <Route path="/auth" component={AuthPage} />
          <Route path="/reset-password" component={PasswordReset} />
          <Route path="/verify-email" component={VerifyEmail} />
        </>
      ) : user?.role === 'system_admin' ? (
        <Layout>
          <Route path="/" component={AdminDashboard} />
          <Route path="/admin" component={AdminDashboard} />
          <Route path="/form-builder" component={AdminFormBuilder} />
          <Route path="/applications" component={Applications} />
          <Route path="/applications/:id" component={ApplicationDetails} />
          <Route path="/documents" component={Documents} />
          <Route path="/messages" component={ThreadedMessages} />
          <Route path="/team" component={TeamManagement} />
          <Route path="/contractors" component={ContractorManagement} />
          <Route path="/profile" component={Profile} />
          <Route path="/settings" component={Profile} />
          <Route path="/security" component={SecuritySettings} />
        </Layout>
      ) : (
        <Layout>
          <Route path="/" component={Dashboard} />
          <Route path="/applications" component={Applications} />
          <Route path="/applications/:id" component={ApplicationDetails} />
          <Route path="/documents" component={Documents} />
          <Route path="/messages" component={ThreadedMessages} />
          <Route path="/team" component={TeamManagement} />
          <Route path="/contractors" component={ContractorManagement} />
          <Route path="/admin" component={AdminPanel} />
          <Route path="/profile" component={Profile} />
          <Route path="/settings" component={Profile} />
          <Route path="/security" component={SecuritySettings} />
        </Layout>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
