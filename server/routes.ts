import { type Express, type Request, Response } from "express";
import { storage } from "./storage";
import { requireAuth, setupAuth } from "./auth";
import { createServer } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";

const upload = multer({ dest: "uploads/" });

export function registerRoutes(app: Express) {
  setupAuth(app);
  const server = createServer(app);

  // Authentication routes
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { email, password, twoFactorCode } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isValidPassword = await storage.verifyPassword(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      if (user.twoFactorEnabled && !twoFactorCode) {
        return res.status(200).json({ requiresTwoFactor: true });
      }

      if (user.twoFactorEnabled && twoFactorCode) {
        const isValidTwoFactor = await storage.verifyTwoFactorCode(user.id, twoFactorCode);
        if (!isValidTwoFactor) {
          return res.status(401).json({ message: "Invalid two-factor code" });
        }
      }

      // Set session
      (req as any).session.userId = user.id;
      res.json({ user: { ...user, password: undefined } });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.get('/api/auth/user', requireAuth, async (req: any, res: Response) => {
    try {
      const user = req.user;
      res.json({ ...user, password: undefined });
    } catch (error) {
      res.status(401).json({ message: "Not authenticated" });
    }
  });

  app.post('/api/auth/logout', (req: any, res: Response) => {
    req.session.destroy((err: any) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie('connect.sid');
      res.json({ message: "Logged out successfully" });
    });
  });

  // Admin routes
  app.get('/api/admin/users', requireAuth, async (req: any, res: Response) => {
    try {
      const user = req.user;
      if (user.role !== 'system_admin') {
        return res.status(403).json({ message: "Access denied" });
      }
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get('/api/admin/companies', requireAuth, async (req: any, res: Response) => {
    try {
      const user = req.user;
      if (user.role !== 'system_admin') {
        return res.status(403).json({ message: "Access denied" });
      }
      const companies = await storage.getAllCompaniesForAdmin();
      res.json(companies);
    } catch (error) {
      console.error("Error fetching companies:", error);
      res.status(500).json({ message: "Failed to fetch companies" });
    }
  });

  app.get('/api/admin/companies/:id/details', requireAuth, async (req: any, res: Response) => {
    try {
      const user = req.user;
      if (user.role !== 'system_admin') {
        return res.status(403).json({ message: "Access denied" });
      }
      const companyId = parseInt(req.params.id);
      const companyDetails = await storage.getCompanyWithDetails(companyId);
      if (!companyDetails) {
        return res.status(404).json({ message: "Company not found" });
      }
      res.json(companyDetails);
    } catch (error) {
      console.error("Error fetching company details:", error);
      res.status(500).json({ message: "Failed to fetch company details" });
    }
  });

  app.get('/api/admin/applications', requireAuth, async (req: any, res: Response) => {
    try {
      const user = req.user;
      if (user.role !== 'system_admin') {
        return res.status(403).json({ message: "Access denied" });
      }
      const applications = await storage.getAllApplications();
      res.json(applications);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });

  app.get('/api/admin/pending-submissions', requireAuth, async (req: any, res: Response) => {
    try {
      const user = req.user;
      if (user.role !== 'system_admin') {
        return res.status(403).json({ message: "Access denied" });
      }
      const submissions = await storage.getPendingSubmissions();
      res.json(submissions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch pending submissions" });
    }
  });

  // System Announcements API Routes
  app.get('/api/admin/announcements', requireAuth, async (req: any, res: Response) => {
    try {
      const user = req.user;
      if (user.role !== 'system_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const announcements = await storage.getAllSystemAnnouncements();
      res.json(announcements);
    } catch (error) {
      console.error("Error fetching announcements:", error);
      res.status(500).json({ message: "Failed to fetch announcements" });
    }
  });

  app.get('/api/announcements/active', requireAuth, async (req: any, res: Response) => {
    try {
      const user = req.user;
      const announcements = await storage.getActiveSystemAnnouncements(user.role);
      res.json(announcements);
    } catch (error) {
      console.error("Error fetching active announcements:", error);
      res.status(500).json({ message: "Failed to fetch active announcements" });
    }
  });

  app.post('/api/admin/announcements', requireAuth, async (req: any, res: Response) => {
    try {
      const user = req.user;
      if (user.role !== 'system_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const announcementData = {
        ...req.body,
        createdBy: user.id
      };

      const announcement = await storage.createSystemAnnouncement(announcementData);
      res.json(announcement);
    } catch (error) {
      console.error("Error creating announcement:", error);
      res.status(500).json({ message: "Failed to create announcement" });
    }
  });

  app.patch('/api/admin/announcements/:id', requireAuth, async (req: any, res: Response) => {
    try {
      const user = req.user;
      if (user.role !== 'system_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { id } = req.params;
      const announcement = await storage.updateSystemAnnouncement(parseInt(id), req.body);
      res.json(announcement);
    } catch (error) {
      console.error("Error updating announcement:", error);
      res.status(500).json({ message: "Failed to update announcement" });
    }
  });

  app.delete('/api/admin/announcements/:id', requireAuth, async (req: any, res: Response) => {
    try {
      const user = req.user;
      if (user.role !== 'system_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { id } = req.params;
      await storage.deleteSystemAnnouncement(parseInt(id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting announcement:", error);
      res.status(500).json({ message: "Failed to delete announcement" });
    }
  });

  app.post('/api/announcements/:id/acknowledge', requireAuth, async (req: any, res: Response) => {
    try {
      const user = req.user;
      const { id } = req.params;
      
      const acknowledgment = await storage.acknowledgeAnnouncement(parseInt(id), user.id);
      res.json(acknowledgment);
    } catch (error) {
      console.error("Error acknowledging announcement:", error);
      res.status(500).json({ message: "Failed to acknowledge announcement" });
    }
  });

  app.get('/api/admin/announcements/:id/stats', requireAuth, async (req: any, res: Response) => {
    try {
      const user = req.user;
      if (user.role !== 'system_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { id } = req.params;
      const stats = await storage.getAnnouncementStats(parseInt(id));
      res.json(stats);
    } catch (error) {
      console.error("Error fetching announcement stats:", error);
      res.status(500).json({ message: "Failed to fetch announcement stats" });
    }
  });

  // Facilities management routes
  app.get('/api/facilities', requireAuth, async (req: any, res: Response) => {
    try {
      const user = req.user;
      if (!user?.companyId) {
        return res.status(400).json({ message: "User must be associated with a company" });
      }
      const facilities = await storage.getFacilitiesByCompany(user.companyId);
      res.json(facilities);
    } catch (error) {
      console.error("Error fetching facilities:", error);
      res.status(500).json({ message: "Failed to fetch facilities" });
    }
  });

  // Additional company management routes
  app.get('/api/companies/:id/facilities', requireAuth, async (req: any, res: Response) => {
    try {
      const companyId = parseInt(req.params.id);
      const facilities = await storage.getFacilitiesByCompany(companyId);
      res.json(facilities);
    } catch (error) {
      console.error("Error fetching company facilities:", error);
      res.status(500).json({ message: "Failed to fetch facilities" });
    }
  });

  app.get('/api/companies/:id/applications', requireAuth, async (req: any, res: Response) => {
    try {
      const companyId = parseInt(req.params.id);
      const applications = await storage.getApplicationsByCompany(companyId);
      res.json(applications);
    } catch (error) {
      console.error("Error fetching company applications:", error);
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });

  // Admin facilities endpoint
  app.get('/api/admin/facilities', requireAuth, async (req: any, res: Response) => {
    try {
      const user = req.user;
      if (user.role !== 'system_admin') {
        return res.status(403).json({ message: "Access denied" });
      }
      const facilities = await storage.getAllFacilities();
      res.json(facilities);
    } catch (error) {
      console.error("Error fetching all facilities:", error);
      res.status(500).json({ message: "Failed to fetch facilities" });
    }
  });

  // Facility activity endpoints
  app.get('/api/facilities/:id/activities', requireAuth, async (req: any, res: Response) => {
    try {
      const facilityId = parseInt(req.params.id);
      const activitySettings = await storage.getFacilityActivitySettings(facilityId);
      const enabledActivities = activitySettings
        .filter((setting: any) => setting.isEnabled)
        .map((setting: any) => setting.activityType);
      
      // If no specific settings found, default to FRA only
      if (enabledActivities.length === 0) {
        enabledActivities.push('FRA');
      }
      
      res.json({ enabledActivities });
    } catch (error) {
      console.error("Error fetching facility activities:", error);
      res.json({ enabledActivities: ['FRA'] }); // Fallback to FRA
    }
  });

  // APPLICATION MANAGEMENT ENDPOINTS
  // ================================
  // These endpoints handle individual application operations and details
  // DO NOT REMOVE - Critical for application viewing and management functionality
  
  // GET all applications for company
  app.get('/api/applications', requireAuth, async (req: any, res: Response) => {
    try {
      const user = req.user;
      if (!user?.companyId) {
        return res.status(400).json({ message: "User must be associated with a company" });
      }
      const applications = await storage.getApplicationsByCompany(user.companyId);
      res.json(applications);
    } catch (error) {
      console.error("Error fetching applications:", error);
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });

  // GET individual application by ID - CRITICAL for application details page
  app.get('/api/applications/:id', requireAuth, async (req: any, res: Response) => {
    try {
      const applicationId = parseInt(req.params.id);
      const application = await storage.getApplicationById(applicationId);
      
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }
      
      // Check if user has access to this application
      const user = req.user;
      if (user.role !== 'system_admin' && application.companyId !== user.companyId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(application);
    } catch (error) {
      console.error("Error fetching application:", error);
      res.status(500).json({ message: "Failed to fetch application" });
    }
  });

  // GET application submissions - CRITICAL for application workflow
  app.get('/api/applications/:id/submissions', requireAuth, async (req: any, res: Response) => {
    try {
      const applicationId = parseInt(req.params.id);
      const submissions = await storage.getApplicationSubmissions(applicationId);
      res.json(submissions);
    } catch (error) {
      console.error("Error fetching application submissions:", error);
      res.status(500).json({ message: "Failed to fetch application submissions" });
    }
  });

  // GET assigned contractors for application - CRITICAL for contractor workflow
  app.get('/api/applications/:id/assigned-contractors', requireAuth, async (req: any, res: Response) => {
    try {
      const applicationId = parseInt(req.params.id);
      const contractors = await storage.getApplicationAssignedContractors(applicationId);
      res.json(contractors);
    } catch (error) {
      console.error("Error fetching assigned contractors:", error);
      res.status(500).json({ message: "Failed to fetch assigned contractors" });
    }
  });

  // GET application documents - CRITICAL for document management
  app.get('/api/applications/:id/documents', requireAuth, async (req: any, res: Response) => {
    try {
      const applicationId = parseInt(req.params.id);
      const documents = await storage.getApplicationDocuments(applicationId);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching application documents:", error);
      res.status(500).json({ message: "Failed to fetch application documents" });
    }
  });

  // POST start application phase - CRITICAL for application workflow
  app.post('/api/applications/:id/start-phase', requireAuth, async (req: any, res: Response) => {
    try {
      const applicationId = parseInt(req.params.id);
      const { phase } = req.body;
      const user = req.user;
      
      const result = await storage.startApplicationPhase(applicationId, phase, user.id);
      res.json(result);
    } catch (error) {
      console.error("Error starting application phase:", error);
      res.status(500).json({ message: "Failed to start application phase" });
    }
  });

  // DELETE application - CRITICAL for application management
  app.delete('/api/applications/:id', requireAuth, async (req: any, res: Response) => {
    try {
      const applicationId = parseInt(req.params.id);
      const user = req.user;
      
      // Only system admin or application owner can delete
      const application = await storage.getApplicationById(applicationId);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }
      
      if (user.role !== 'system_admin' && application.companyId !== user.companyId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      await storage.deleteApplication(applicationId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting application:", error);
      res.status(500).json({ message: "Failed to delete application" });
    }
  });

  // Activity settings endpoint
  app.get('/api/activity-settings', requireAuth, async (req: any, res: Response) => {
    try {
      const activitySettings = await storage.getActivitySettings();
      res.json(activitySettings);
    } catch (error) {
      console.error("Error fetching activity settings:", error);
      res.status(500).json({ message: "Failed to fetch activity settings" });
    }
  });

  // FORM TEMPLATE MANAGEMENT ENDPOINTS
  // =================================
  // These endpoints manage the form templates used in the system admin form builder
  // DO NOT REMOVE - Critical for form builder functionality
  
  // GET all form templates for admin form builder
  app.get('/api/admin/form-templates', requireAuth, async (req: any, res: Response) => {
    try {
      const user = req.user;
      if (user.role !== 'system_admin') {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const templates = await storage.getAllFormTemplates();
      res.json(templates);
    } catch (error: any) {
      console.error('Error fetching form templates:', error);
      res.status(500).json({ message: 'Error fetching form templates', error: error.message });
    }
  });

  // CREATE new form template
  app.post('/api/admin/form-templates', requireAuth, async (req: any, res: Response) => {
    try {
      const user = req.user;
      if (user.role !== 'system_admin') {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const templateData = {
        ...req.body,
        createdBy: user.id,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const template = await storage.createFormTemplate(templateData);
      res.json(template);
    } catch (error: any) {
      console.error('Error creating form template:', error);
      res.status(500).json({ message: 'Error creating form template', error: error.message });
    }
  });

  app.put('/api/admin/form-templates/:id', requireAuth, async (req: any, res: Response) => {
    try {
      const user = req.user;
      if (user.role !== 'system_admin') {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const templateId = parseInt(req.params.id);
      const updates = {
        ...req.body,
        updatedAt: new Date()
      };
      
      const template = await storage.updateFormTemplate(templateId, updates);
      res.json(template);
    } catch (error: any) {
      console.error('Error updating form template:', error);
      res.status(500).json({ message: 'Error updating form template', error: error.message });
    }
  });

  // DELETE form template
  app.delete('/api/admin/form-templates/:id', requireAuth, async (req: any, res: Response) => {
    try {
      const user = req.user;
      if (user.role !== 'system_admin') {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const templateId = parseInt(req.params.id);
      
      // Check if template has submissions
      const hasSubmissions = await storage.checkFormTemplateHasSubmissions(templateId);
      
      if (hasSubmissions) {
        // Deactivate instead of delete to preserve data integrity
        await storage.updateFormTemplate(templateId, { isActive: false });
        res.json({ success: true, preservedData: true });
      } else {
        await storage.deleteFormTemplate(templateId);
        res.json({ success: true });
      }
    } catch (error: any) {
      console.error('Error deleting form template:', error);
      res.status(500).json({ message: 'Error deleting form template', error: error.message });
    }
  });

  // SUBMISSION REVIEW ENDPOINTS
  // ===========================
  // These endpoints manage the admin approval system for application submissions
  // DO NOT REMOVE - Critical for admin approval workflow
  
  // Get detailed submission for review
  app.get('/api/admin/submission-details/:id', requireAuth, async (req: any, res: Response) => {
    try {
      const user = req.user;
      if (user.role !== 'system_admin') {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const submissionId = parseInt(req.params.id);
      const submissionDetails = await storage.getSubmissionDetails(submissionId);
      res.json(submissionDetails);
    } catch (error: any) {
      console.error('Error fetching submission details:', error);
      res.status(500).json({ message: 'Error fetching submission details', error: error.message });
    }
  });

  // Approve submission
  app.post('/api/admin/submissions/:id/approve', requireAuth, async (req: any, res: Response) => {
    try {
      const user = req.user;
      if (user.role !== 'system_admin') {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const submissionId = parseInt(req.params.id);
      const { reviewNotes } = req.body;
      
      const submission = await storage.approveSubmission(submissionId, user.id, reviewNotes);
      res.json(submission);
    } catch (error: any) {
      console.error('Error approving submission:', error);
      res.status(500).json({ message: 'Error approving submission', error: error.message });
    }
  });

  // Reject submission
  app.post('/api/admin/submissions/:id/reject', requireAuth, async (req: any, res: Response) => {
    try {
      const user = req.user;
      if (user.role !== 'system_admin') {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const submissionId = parseInt(req.params.id);
      const { reviewNotes } = req.body;
      
      const submission = await storage.rejectSubmission(submissionId, user.id, reviewNotes);
      res.json(submission);
    } catch (error: any) {
      console.error('Error rejecting submission:', error);
      res.status(500).json({ message: 'Error rejecting submission', error: error.message });
    }
  });

  return server;
}