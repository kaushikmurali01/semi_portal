import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, requireAuth } from "./auth";
import { insertCompanySchema, insertFacilitySchema, insertApplicationSchema } from "@shared/schema";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { nanoid } from "nanoid";
import multer from "multer";
import path from "path";
import fs from "fs";
import { sendTeamInvitationEmail } from "./sendgrid";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

// Configure multer for file uploads
const uploadDir = "uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'image/jpeg',
      'image/png'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, DOCX, XLS, XLSX, CSV, JPEG, and PNG files are allowed.'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  setupAuth(app);

  // Company routes
  app.get('/api/companies/current', requireAuth, async (req: any, res: Response) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user || !user.companyId) {
        return res.status(404).json({ message: "No company associated" });
      }
      
      const company = await storage.getCompanyById(user.companyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      
      res.json(company);
    } catch (error) {
      console.error("Error fetching company:", error);
      res.status(500).json({ message: "Failed to fetch company" });
    }
  });

  app.post('/api/companies', requireAuth, async (req: any, res: Response) => {
    try {
      const userId = req.user.id;
      const validatedData = insertCompanySchema.parse(req.body);
      const company = await storage.createCompany(validatedData);
      
      res.json(company);
    } catch (error) {
      console.error("Error creating company:", error);
      res.status(500).json({ message: "Failed to create company" });
    }
  });

  // Update company information (company admin only)
  app.patch('/api/companies/current', requireAuth, async (req: any, res: Response) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user || user.role !== 'company_admin') {
        return res.status(403).json({ message: "Only company administrators can update company information" });
      }

      if (!user.companyId) {
        return res.status(404).json({ message: "No company found for user" });
      }

      const { name, address, phone, website } = req.body;

      if (!name?.trim()) {
        return res.status(400).json({ message: "Company name is required" });
      }

      const updatedCompany = await storage.updateCompany(user.companyId, {
        name: name.trim(),
        address: address?.trim() || null,
        phone: phone?.trim() || null,
        website: website?.trim() || null
      });

      res.json(updatedCompany);
    } catch (error) {
      console.error("Update company error:", error);
      res.status(500).json({ message: "Failed to update company" });
    }
  });

  app.get('/api/companies/check-shortname', async (req: Request, res: Response) => {
    try {
      const { shortName } = req.query;
      if (!shortName || typeof shortName !== 'string') {
        return res.status(400).json({ message: "Short name is required" });
      }

      const existingCompany = await storage.getCompanyByShortName(shortName);
      res.json({ exists: !!existingCompany });
    } catch (error) {
      console.error("Check shortname error:", error);
      res.status(500).json({ message: "Failed to check short name" });
    }
  });

  // Facility routes
  app.post('/api/facilities', requireAuth, async (req: any, res: Response) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user?.companyId) {
        return res.status(400).json({ message: "User must be associated with a company" });
      }

      // Get existing facilities to generate next code
      const existingFacilities = await storage.getFacilitiesByCompany(user.companyId);
      const nextCode = String(existingFacilities.length + 1).padStart(3, '0');

      const validatedData = insertFacilitySchema.parse({
        ...req.body,
        code: nextCode,
        companyId: user.companyId
      });
      
      const facility = await storage.createFacility(validatedData);
      res.json(facility);
    } catch (error) {
      console.error("Error creating facility:", error);
      res.status(500).json({ message: "Failed to create facility" });
    }
  });

  app.get('/api/facilities', requireAuth, async (req: any, res: Response) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
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

  app.patch('/api/facilities/:id', requireAuth, async (req: any, res: Response) => {
    try {
      const facilityId = parseInt(req.params.id);
      const facility = await storage.getFacilityById(facilityId);
      
      if (!facility) {
        return res.status(404).json({ message: "Facility not found" });
      }

      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      // Check if user has permission to edit this facility
      if (facility.companyId !== user?.companyId) {
        return res.status(403).json({ message: "Not authorized to edit this facility" });
      }

      // Check if user has required permissions
      if (user?.role !== 'company_admin' && user?.permissionLevel !== 'manager') {
        return res.status(403).json({ message: "Insufficient permissions to edit facilities" });
      }

      const updatedFacility = await storage.updateFacility(facilityId, req.body);
      res.json(updatedFacility);
    } catch (error) {
      console.error("Error updating facility:", error);
      res.status(500).json({ message: "Failed to update facility" });
    }
  });

  // Generate Application ID according to format: [CompanyShort]-[FacilityCode]-[ActivityCode][AppNumber]
  async function generateApplicationId(companyId: number, facilityId: number, activityType: string) {
    const company = await storage.getCompanyById(companyId);
    const facility = await storage.getFacilityById(facilityId);
    
    if (!company || !facility) {
      throw new Error("Company or facility not found");
    }

    // Activity codes: 1=FRA, 2=CES/EEA, 3=SEM, 4=EMIS, 5=CR
    const activityCodes: Record<string, string> = {
      'FRA': '1',
      'EEA': '2', // CES - Comprehensive Energy Study
      'SEM': '3',
      'EMIS': '4',
      'CR': '5'
    };

    const activityCode = activityCodes[activityType];
    if (!activityCode) {
      throw new Error(`Invalid activity type: ${activityType}`);
    }

    // Get existing applications for this facility and activity type to determine next number
    const existingApps = await storage.getApplicationsByFacilityAndActivity(facilityId, activityType);
    
    // Generate facility code based on position among company facilities
    const companyFacilities = await storage.getFacilitiesByCompany(companyId);
    const facilityIndex = companyFacilities.findIndex(f => f.id === facilityId);
    const facilityCode = String(facilityIndex + 1).padStart(3, '0');
    
    // Find the next available application number by checking existing application IDs
    let appNumber = 1;
    let applicationId;
    do {
      const appNumberStr = String(appNumber).padStart(2, '0');
      applicationId = `${company.shortName}-${facilityCode}-${activityCode}${appNumberStr}`;
      
      // Check if this ID already exists in the database
      const existingApp = await storage.getApplicationByApplicationId(applicationId);
      if (!existingApp) {
        break; // Found an available ID
      }
      appNumber++;
    } while (appNumber < 100); // Safety limit
    
    if (appNumber >= 100) {
      throw new Error('Maximum number of applications reached for this facility and activity type');
    }

    return applicationId;
  }

  // Application routes
  app.post('/api/applications', requireAuth, async (req: any, res: Response) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user?.companyId) {
        return res.status(400).json({ message: "User must be associated with a company" });
      }

      // Generate proper application ID
      const applicationId = await generateApplicationId(
        user.companyId, 
        req.body.facilityId, 
        req.body.activityType
      );
      
      console.log('Generated application ID:', applicationId);

      const validatedData = insertApplicationSchema.parse({
        ...req.body,
        companyId: user.companyId,
        submittedBy: userId
      });

      // Add the generated application ID
      const applicationData = {
        ...validatedData,
        applicationId
      };
      
      const application = await storage.createApplication(applicationData);
      res.json(application);
    } catch (error) {
      console.error("Error creating application:", error);
      res.status(500).json({ message: "Failed to create application" });
    }
  });

  app.get('/api/applications', requireAuth, async (req: any, res: Response) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      // If user is system admin, they can see all applications
      if (user?.role === 'system_admin') {
        const applications = await storage.getAllApplications();
        res.json(applications);
        return;
      }
      
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

  // Get single application by ID
  app.get('/api/applications/:id', requireAuth, async (req: any, res: Response) => {
    try {
      const { id } = req.params;
      const application = await storage.getApplication(parseInt(id));
      
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }

      // Check if user has access to this application
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'system_admin' && application.companyId !== user?.companyId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Add detailed status calculation (same logic as applications list)
      const submissions = await storage.getApplicationSubmissions(parseInt(id));
      const hasPreActivity = submissions.some(s => s.phase === 'pre_activity' && s.status === 'submitted');
      const hasPostActivity = submissions.some(s => s.phase === 'post_activity' && s.status === 'submitted');
      
      let detailedStatus;
      if (hasPostActivity) {
        detailedStatus = 'post-activity-submitted';
      } else if (hasPreActivity) {
        // Pre-activity submitted, now in post-activity phase
        if (application.status === 'under_review') {
          detailedStatus = 'post-activity-started';
        } else {
          detailedStatus = 'pre-activity-submitted';
        }
      } else if (application.status === 'under_review') {
        // Status changed from draft, indicates pre-activity started
        detailedStatus = 'pre-activity-started';
      } else {
        detailedStatus = 'draft';
      }

      // Fetch user information for created by
      let createdByUser = null;
      if (application.submittedBy) {
        createdByUser = await storage.getUser(application.submittedBy);
      }

      const enhancedApplication = {
        ...application,
        detailedStatus,
        hasPreActivitySubmission: hasPreActivity,
        hasPostActivitySubmission: hasPostActivity,
        createdByUser: createdByUser ? {
          id: createdByUser.id,
          firstName: createdByUser.firstName,
          lastName: createdByUser.lastName,
          email: createdByUser.email
        } : null,
      };

      res.json(enhancedApplication);
    } catch (error) {
      console.error("Error fetching application:", error);
      res.status(500).json({ message: "Failed to fetch application" });
    }
  });

  app.patch('/api/applications/:id', requireAuth, async (req: any, res: Response) => {
    try {
      const applicationId = parseInt(req.params.id);
      const updates = req.body;
      
      const application = await storage.updateApplication(applicationId, updates);
      res.json(application);
    } catch (error) {
      console.error("Error updating application:", error);
      res.status(500).json({ message: "Failed to update application" });
    }
  });

  // Document routes
  app.post('/api/documents/upload', requireAuth, upload.array('files'), async (req: any, res: Response) => {
    try {
      const userId = req.user.id;
      const { companyId } = req.user;
      const userRole = req.user.role;
      const files = req.files as Express.Multer.File[];
      const { applicationId, documentType = 'supporting', type } = req.body;

      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      // Allow system admins to upload template files without company association
      if (!companyId && userRole !== 'system_admin') {
        return res.status(400).json({ message: "User must be associated with a company" });
      }

      // For system admin template uploads, use a default company ID of 1 or null
      const effectiveCompanyId = companyId || (userRole === 'system_admin' && type === 'template' ? null : null);

      const documents = [];
      for (const file of files) {
        // Parse applicationId properly, handle empty strings and "NaN"
        let parsedApplicationId = null;
        if (applicationId && applicationId !== 'undefined' && applicationId !== 'null' && !isNaN(parseInt(applicationId))) {
          parsedApplicationId = parseInt(applicationId);
        }

        const document = await storage.createDocument({
          applicationId: parsedApplicationId,
          companyId: effectiveCompanyId,
          filename: file.originalname,
          originalName: file.originalname,
          filePath: file.path,
          size: file.size,
          mimeType: file.mimetype,
          documentType: documentType as any,
          uploadedBy: userId
        });
        documents.push(document);
      }

      res.json(documents);
    } catch (error) {
      console.error("Error uploading documents:", error);
      res.status(500).json({ message: "Failed to upload documents" });
    }
  });

  app.get('/api/documents/application/:id', requireAuth, async (req: any, res: Response) => {
    try {
      const applicationId = parseInt(req.params.id);
      const documents = await storage.getDocumentsByApplication(applicationId);
      console.log(`Fetching documents for application ${applicationId}:`, documents);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.get('/api/documents/templates', requireAuth, async (req: any, res: Response) => {
    try {
      const templates = await storage.getGlobalTemplates();
      res.json(templates);
    } catch (error) {
      console.error("Error fetching templates:", error);
      res.status(500).json({ message: "Failed to fetch templates" });
    }
  });

  // Get all documents for the company
  app.get('/api/documents', requireAuth, async (req: any, res: Response) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      console.log("User requesting documents:", req.user.id, "CompanyId:", user?.companyId);
      
      // If user is system admin, they can see all documents
      if (user?.role === 'system_admin') {
        const allDocuments = await storage.getAllDocuments();
        res.json(allDocuments);
        return;
      }
      
      if (!user?.companyId) {
        return res.status(400).json({ message: "User must be associated with a company" });
      }

      const documents = await storage.getDocumentsByCompany(user.companyId);
      console.log("Documents found for company:", documents.length);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.get('/api/documents/:id/download', requireAuth, async (req: any, res: Response) => {
    try {
      const documentId = parseInt(req.params.id);
      const document = await storage.getDocumentById(documentId);
      
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      const filePath = path.resolve(document.filePath);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "File not found on disk" });
      }

      res.download(filePath, document.filename);
    } catch (error) {
      console.error("Error downloading document:", error);
      res.status(500).json({ message: "Failed to download document" });
    }
  });

  app.delete('/api/documents/:id', requireAuth, async (req: any, res: Response) => {
    try {
      const documentId = parseInt(req.params.id);
      const document = await storage.getDocumentById(documentId);
      
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Delete file from disk
      if (fs.existsSync(document.filePath)) {
        fs.unlinkSync(document.filePath);
      }

      await storage.deleteDocument(documentId);
      res.json({ message: "Document deleted successfully" });
    } catch (error) {
      console.error("Error deleting document:", error);
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  // Application submission routes
  app.get('/api/applications/:id/submissions', requireAuth, async (req: any, res: Response) => {
    try {
      const { id } = req.params;
      console.log(`Fetching submissions for application ${id}`);
      const submissions = await storage.getApplicationSubmissions(parseInt(id));
      console.log(`Found ${submissions.length} submissions:`, submissions);
      res.json(submissions);
    } catch (error: any) {
      console.error('Error fetching submissions:', error);
      res.status(500).json({ message: 'Failed to fetch submissions' });
    }
  });

  app.post('/api/applications/:id/submit/:phase', requireAuth, async (req: any, res: Response) => {
    try {
      const { id, phase } = req.params;
      const userId = req.user.id;
      const userRole = req.user.role;

      // Check if user can submit (contractors cannot submit)
      if (userRole === 'contractor_individual') {
        return res.status(403).json({ message: 'Contractors cannot submit applications' });
      }

      // Get the application first to check ownership
      const application = await storage.getApplication(parseInt(id));
      if (!application) {
        return res.status(404).json({ message: 'Application not found' });
      }

      // Check if user has permission to submit for this application
      if (userRole !== 'system_admin') {
        const user = await storage.getUser(userId);
        if (!user?.companyId || application.companyId !== user.companyId) {
          return res.status(403).json({ message: 'Not authorized to submit this application' });
        }
      }

      // Get the form template for this activity type and phase
      const templates = await storage.getFormTemplates(application.activityType);
      console.log('Available templates:', templates.map(t => ({ id: t.id, activityType: t.activityType, phase: t.phase })));
      console.log('Looking for activityType:', application.activityType, 'phase:', phase);
      
      const template = templates.find(t => t.phase === phase);
      console.log('Found template:', template);
      
      if (!template) {
        return res.status(404).json({ message: `Form template not found for ${phase} phase` });
      }

      // Create application submission
      const submission = await storage.createApplicationSubmission({
        applicationId: parseInt(id),
        phase: phase as 'pre_activity' | 'post_activity',
        formTemplateId: template.id,
        submittedBy: userId,
        status: 'submitted'
      });

      // Store form data in reviewNotes field as JSON for now
      if (req.body && Object.keys(req.body).length > 0) {
        console.log('Form data received:', req.body);
        // Store the form data in the reviewNotes field as JSON
        await storage.updateApplicationSubmission(submission.id, {
          reviewNotes: JSON.stringify(req.body)
        });
      }

      // Update application status based on submission phase
      if (phase === 'pre_activity') {
        // After pre-activity submission, update status to show pre-activity is complete
        await storage.updateApplication(parseInt(id), { status: 'under_review' });
      } else if (phase === 'post_activity') {
        // After post-activity submission, mark as fully submitted
        await storage.updateApplication(parseInt(id), { status: 'submitted' });
      }

      res.json(submission);
    } catch (error: any) {
      console.error('Error submitting application:', error);
      res.status(500).json({ message: 'Failed to submit application' });
    }
  });

  // Form template routes for admin
  app.get('/api/documents/templates', requireAuth, async (req: any, res: Response) => {
    try {
      const { activityType } = req.query;
      const templates = await storage.getFormTemplates(activityType as string);
      res.json(templates);
    } catch (error: any) {
      console.error('Error fetching templates:', error);
      res.status(500).json({ message: 'Failed to fetch templates' });
    }
  });

  app.get('/api/documents/templates/:activityType', requireAuth, async (req: any, res: Response) => {
    try {
      const { activityType } = req.params;
      
      // Get form templates for this activity type
      const allTemplates = await storage.getAllFormTemplates();
      const templates = allTemplates.filter(t => t.activityType === activityType);
      
      // Parse the form_fields JSON for each template
      const parsedTemplates = templates.map(template => {
        let parsedFields = [];
        try {
          const formFieldsData = (template as any).formFields;
          parsedFields = typeof formFieldsData === 'string' 
            ? JSON.parse(formFieldsData) 
            : formFieldsData || [];
        } catch (e) {
          console.error('Error parsing form fields:', e);
          parsedFields = [];
        }
        
        return {
          ...template,
          fields: parsedFields,
          form_fields: parsedFields
        };
      });
      
      res.json(parsedTemplates);
    } catch (error: any) {
      console.error('Error fetching templates:', error);
      res.status(500).json({ message: 'Failed to fetch templates' });
    }
  });

  // Admin form builder routes
  app.post('/api/admin/form-templates', requireAuth, async (req: any, res: Response) => {
    try {
      const userRole = req.user.role;
      if (userRole !== 'system_admin') {
        return res.status(403).json({ message: 'Only system admins can create form templates' });
      }

      // Check if template already exists for this activity type and phase
      const existingTemplates = await storage.getAllFormTemplates();
      const duplicate = existingTemplates.find(t => 
        t.activityType === req.body.activityType && t.phase === req.body.phase
      );
      
      if (duplicate) {
        return res.status(400).json({ 
          message: `A template already exists for ${req.body.activityType} ${req.body.phase} activity. Please edit the existing template instead.` 
        });
      }

      // Prepare the template data with proper form fields
      const templateData = {
        name: req.body.name,
        description: req.body.description || '',
        activityType: req.body.activityType,
        phase: req.body.phase,
        isActive: req.body.isActive !== undefined ? req.body.isActive : true,
        formFields: JSON.stringify(req.body.fields || req.body.form_fields || []),
        createdBy: req.user.id,
      };

      const template = await storage.createFormTemplate(templateData);
      res.status(201).json(template);
    } catch (error: any) {
      console.error('Error creating form template:', error);
      res.status(500).json({ message: 'Failed to create form template' });
    }
  });

  app.get('/api/admin/form-templates', requireAuth, async (req: any, res: Response) => {
    try {
      const userRole = req.user.role;
      if (userRole !== 'system_admin') {
        return res.status(403).json({ message: 'Only system admins can access form templates' });
      }

      const templates = await storage.getAllFormTemplates();
      
      // Parse the form_fields JSON for each template
      const parsedTemplates = templates.map(template => {
        let parsedFields = [];
        try {
          // Access the correct field name from database
          const formFieldsData = (template as any).formFields;
          parsedFields = typeof formFieldsData === 'string' 
            ? JSON.parse(formFieldsData) 
            : formFieldsData || [];
        } catch (e) {
          console.error('Error parsing form fields:', e);
          parsedFields = [];
        }
        
        return {
          ...template,
          fields: parsedFields,
          form_fields: parsedFields
        };
      });
      
      res.json(parsedTemplates);
    } catch (error: any) {
      console.error('Error fetching form templates:', error);
      res.status(500).json({ message: 'Failed to fetch form templates' });
    }
  });

  app.patch('/api/admin/form-templates/:id', requireAuth, async (req: any, res: Response) => {
    try {
      const userRole = req.user.role;
      if (userRole !== 'system_admin') {
        return res.status(403).json({ message: 'Only system admins can update form templates' });
      }

      const { id } = req.params;
      
      console.log('Request body:', JSON.stringify(req.body, null, 2));
      
      // Only include the fields that should be updated
      const updateData: any = {};
      
      if (req.body.name) updateData.name = req.body.name;
      if (req.body.description !== undefined) updateData.description = req.body.description;
      if (req.body.activityType) updateData.activityType = req.body.activityType;
      if (req.body.phase) updateData.phase = req.body.phase;
      if (req.body.isActive !== undefined) updateData.isActive = req.body.isActive;
      
      // Handle form fields
      const fieldsData = req.body.form_fields || req.body.fields || [];
      updateData.formFields = JSON.stringify(fieldsData);
      
      console.log('Update data:', JSON.stringify(updateData, null, 2));
      
      const template = await storage.updateFormTemplate(parseInt(id), updateData);
      res.json(template);
    } catch (error: any) {
      console.error('Error updating form template:', error);
      res.status(500).json({ message: 'Failed to update form template' });
    }
  });

  // Team management routes
  app.get('/api/team', requireAuth, async (req: any, res: Response) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user?.companyId) {
        return res.status(400).json({ message: "User must be associated with a company" });
      }

      const team = await storage.getUsersByCompany(user.companyId);
      res.json(team);
    } catch (error) {
      console.error("Error fetching team:", error);
      res.status(500).json({ message: "Failed to fetch team" });
    }
  });

  app.post('/api/team/invite', requireAuth, async (req: any, res: Response) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user?.companyId) {
        return res.status(400).json({ message: "User must be associated with a company" });
      }

      // Check permissions - only company_admin can invite team members
      if (user.role !== 'company_admin') {
        return res.status(403).json({ message: "Only company administrators can invite team members" });
      }

      const { email, firstName, lastName, role, message } = req.body;

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists" });
      }

      // Get company information for the email
      const company = await storage.getCompanyById(user.companyId);
      if (!company) {
        return res.status(400).json({ message: "Company not found" });
      }

      // Generate temporary password for invited user
      const tempPassword = Math.random().toString(36).slice(-8) + "A1!";
      const hashedPassword = await hashPassword(tempPassword);

      // Create user account
      const newUser = await storage.createUser({
        id: nanoid(),
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: role as any,
        companyId: user.companyId
      });

      // Send invitation email
      const emailSent = await sendTeamInvitationEmail({
        to: email,
        invitedBy: `${user.firstName} ${user.lastName}`,
        invitedByEmail: user.email!,
        company: company.name,
        firstName,
        lastName,
        role,
        tempPassword,
        customMessage: message
      });

      if (!emailSent) {
        // If email fails, we should delete the created user
        await storage.updateUser(newUser.id, { isActive: false });
        return res.status(500).json({ message: "Failed to send invitation email. Please try again." });
      }

      res.json({ 
        message: "Team member invited successfully and invitation email sent",
        userId: newUser.id
      });
    } catch (error) {
      console.error("Error inviting team member:", error);
      res.status(500).json({ message: "Failed to invite team member" });
    }
  });

  // User role management routes
  app.patch('/api/users/:id/role', requireAuth, async (req: any, res: Response) => {
    try {
      const { id } = req.params;
      const { role } = req.body;
      const user = req.user;

      // Check if current user has permission to change roles
      if (user.role !== 'company_admin' && user.role !== 'system_admin') {
        return res.status(403).json({ message: "Insufficient permissions to change user roles" });
      }

      // Cannot change your own role through this endpoint
      if (id === user.id) {
        return res.status(400).json({ message: "Cannot change your own role" });
      }

      // Get the target user to verify they're in the same company (unless system admin)
      const targetUser = await storage.getUser(id);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.role === 'company_admin' && targetUser.companyId !== user.companyId) {
        return res.status(403).json({ message: "Cannot manage users from other companies" });
      }

      // Update the user's role
      await storage.updateUser(id, { role });

      res.json({ message: "User role updated successfully" });
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  // Update user permission level
  app.patch('/api/users/:id/permission-level', requireAuth, async (req: any, res: Response) => {
    try {
      const { id } = req.params;
      const { permissionLevel } = req.body;
      const user = req.user;

      // Check if user has permission to update permission levels
      const canEdit = user.role === 'company_admin' || 
                     (user.role === 'team_member' && user.permissionLevel === 'manager');
      
      if (!canEdit) {
        return res.status(403).json({ message: 'Insufficient permissions' });
      }

      // Validate permission level
      if (!['viewer', 'editor', 'manager'].includes(permissionLevel)) {
        return res.status(400).json({ message: 'Invalid permission level' });
      }

      // Get the target user
      const targetUser = await storage.getUser(id);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify same company (unless system admin)
      if (user.role === 'company_admin' && targetUser.companyId !== user.companyId) {
        return res.status(403).json({ message: "Cannot manage users from other companies" });
      }

      // Managers cannot change other managers or company admins
      if (user.role === 'team_member' && user.permissionLevel === 'manager') {
        if (targetUser.role === 'company_admin' || 
            (targetUser.role === 'team_member' && targetUser.permissionLevel === 'manager')) {
          return res.status(403).json({ message: 'Cannot modify permissions for this user' });
        }
      }

      // Update the user's permission level
      await storage.updateUser(id, { permissionLevel });

      res.json({ message: "User permission level updated successfully" });
    } catch (error) {
      console.error('Error updating user permission level:', error);
      res.status(500).json({ message: 'Failed to update user permission level' });
    }
  });

  // Transfer admin role
  app.patch('/api/team/transfer-admin', requireAuth, async (req: any, res: Response) => {
    try {
      const { newAdminId } = req.body;
      const user = req.user;

      // Only current company admin can transfer admin role
      if (user.role !== 'company_admin') {
        return res.status(403).json({ message: "Only company admins can transfer admin role" });
      }

      // Get the target user
      const newAdmin = await storage.getUser(newAdminId);
      if (!newAdmin) {
        return res.status(404).json({ message: "Target user not found" });
      }

      // Verify target user is in the same company
      if (newAdmin.companyId !== user.companyId) {
        return res.status(400).json({ message: "Cannot transfer admin to user from different company" });
      }

      // Verify target user is active
      if (!newAdmin.isActive) {
        return res.status(400).json({ message: "Cannot transfer admin to inactive user" });
      }

      // Transfer roles: make target user admin, current admin becomes team_member
      await storage.updateUser(newAdminId, { role: 'company_admin' });
      await storage.updateUser(user.id, { role: 'team_member' });

      res.json({ message: "Admin role transferred successfully" });
    } catch (error) {
      console.error("Error transferring admin role:", error);
      res.status(500).json({ message: "Failed to transfer admin role" });
    }
  });

  // Deactivate user
  app.patch('/api/users/:id/deactivate', requireAuth, async (req: any, res: Response) => {
    try {
      const { id } = req.params;
      const user = req.user;

      // Check permissions
      if (user.role !== 'company_admin' && user.role !== 'system_admin') {
        return res.status(403).json({ message: "Insufficient permissions to deactivate users" });
      }

      // Cannot deactivate yourself
      if (id === user.id) {
        return res.status(400).json({ message: "Cannot deactivate your own account" });
      }

      // Get the target user
      const targetUser = await storage.getUser(id);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify same company (unless system admin)
      if (user.role === 'company_admin' && targetUser.companyId !== user.companyId) {
        return res.status(403).json({ message: "Cannot manage users from other companies" });
      }

      // Deactivate the user
      await storage.updateUser(id, { isActive: false });

      res.json({ message: "User deactivated successfully" });
    } catch (error) {
      console.error("Error deactivating user:", error);
      res.status(500).json({ message: "Failed to deactivate user" });
    }
  });

  // Contractor management routes
  app.get('/api/contractors', requireAuth, async (req: any, res: Response) => {
    try {
      const contractors = await storage.getAllUsers();
      const contractorUsers = contractors.filter(user => 
        user.role === 'contractor_individual' || user.role === 'contractor_account_owner'
      );
      
      // Get contractor details for each contractor user
      const contractorsWithDetails = await Promise.all(
        contractorUsers.map(async (user) => {
          const details = await storage.getContractorDetails(user.id);
          return {
            ...user,
            contractorDetails: details
          };
        })
      );

      res.json(contractorsWithDetails);
    } catch (error) {
      console.error("Error fetching contractors:", error);
      res.status(500).json({ message: "Failed to fetch contractors" });
    }
  });

  app.post('/api/contractors/:id/details', requireAuth, async (req: any, res: Response) => {
    try {
      const userId = req.params.id;
      const contractorData = req.body;
      
      const details = await storage.createContractorDetails({
        userId,
        ...contractorData
      });

      res.json(details);
    } catch (error) {
      console.error("Error creating contractor details:", error);
      res.status(500).json({ message: "Failed to create contractor details" });
    }
  });

  // Dashboard routes
  app.get('/api/dashboard/stats', requireAuth, async (req: any, res: Response) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user?.companyId) {
        return res.status(400).json({ message: "User must be associated with a company" });
      }

      const applications = await storage.getApplicationsByCompany(user.companyId);
      const facilities = await storage.getFacilitiesByCompany(user.companyId);
      const teamMembers = await storage.getUsersByCompany(user.companyId);
      
      const stats = {
        totalApplications: applications.length,
        draftApplications: applications.filter(app => app.status === 'draft').length,
        submittedApplications: applications.filter(app => app.status === 'submitted').length,
        approvedApplications: applications.filter(app => app.status === 'approved').length,
        pendingApplications: applications.filter(app => app.status === 'under_review').length,
        totalFacilities: facilities.length,
        teamMembers: teamMembers.length
      };

      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Activity settings routes
  app.get('/api/activity-settings', requireAuth, async (req: any, res: Response) => {
    try {
      const settings = await storage.getActivitySettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching activity settings:", error);
      res.status(500).json({ message: "Failed to fetch activity settings" });
    }
  });

  // Admin routes (for Enerva system administrators)
  app.get('/api/admin/users', requireAuth, async (req: any, res: Response) => {
    try {
      const user = req.user;
      if (user.role !== 'system_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching all users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
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
      console.error("Error fetching all applications:", error);
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });

  app.get('/api/admin/companies', requireAuth, async (req: any, res: Response) => {
    try {
      const user = req.user;
      if (user.role !== 'system_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const companies = await storage.getCompanies();
      res.json(companies);
    } catch (error) {
      console.error("Error fetching companies:", error);
      res.status(500).json({ message: "Failed to fetch companies" });
    }
  });

  // Admin action routes
  app.patch('/api/admin/applications/:id/status', requireAuth, async (req: any, res: Response) => {
    try {
      const user = req.user;
      if (user.role !== 'system_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const applicationId = parseInt(req.params.id);
      const { status, notes } = req.body;
      
      const application = await storage.updateApplication(applicationId, { 
        status,
        reviewNotes: notes,
        reviewedBy: user.id,
        reviewedAt: new Date()
      });
      
      res.json(application);
    } catch (error) {
      console.error("Error updating application status:", error);
      res.status(500).json({ message: "Failed to update application status" });
    }
  });

  app.patch('/api/admin/users/:id/status', requireAuth, async (req: any, res: Response) => {
    try {
      const user = req.user;
      if (user.role !== 'system_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const userId = req.params.id;
      const { isActive } = req.body;
      
      const updatedUser = await storage.updateUser(userId, { isActive });
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user status:", error);
      res.status(500).json({ message: "Failed to update user status" });
    }
  });

  // Update activity settings
  app.patch('/api/admin/activity-settings', requireAuth, async (req: any, res: Response) => {
    try {
      const user = req.user;
      if (user.role !== 'system_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { activityType, isEnabled, updatedBy } = req.body;

      if (!activityType || typeof isEnabled !== 'boolean') {
        return res.status(400).json({ message: "Activity type and enabled status are required" });
      }

      // Don't allow disabling FRA as it's required
      if (activityType === 'FRA' && !isEnabled) {
        return res.status(400).json({ message: "FRA cannot be disabled as it's required for all facilities" });
      }

      const updatedSetting = await storage.updateActivitySetting(activityType, isEnabled, updatedBy || user.id);
      res.json(updatedSetting);
    } catch (error) {
      console.error("Error updating activity setting:", error);
      res.status(500).json({ message: "Failed to update activity setting" });
    }
  });

  // Create additional admin user
  app.post('/api/admin/create-admin-user', requireAuth, async (req: any, res: Response) => {
    try {
      const user = req.user;
      if (user.role !== 'system_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { email, firstName, lastName, password } = req.body;

      if (!email || !firstName || !lastName || !password) {
        return res.status(400).json({ message: "All fields are required" });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists" });
      }

      // Hash password  
      const salt = randomBytes(16).toString("hex");
      const buf = (await scryptAsync(password, salt, 64)) as Buffer;
      const hashedPassword = `${buf.toString("hex")}.${salt}`;
      
      // Create admin user
      const adminUser = await storage.upsertUser({
        id: nanoid(),
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: "system_admin",
        isActive: true
      });

      res.json({ message: "Admin user created successfully", userId: adminUser.id });
    } catch (error) {
      console.error("Error creating admin user:", error);
      res.status(500).json({ message: "Failed to create admin user" });
    }
  });

  // Track when user starts working on a phase
  app.post('/api/applications/:id/start-phase', requireAuth, async (req: any, res: Response) => {
    try {
      const applicationId = parseInt(req.params.id);
      const { phase } = req.body;
      const userId = req.user.id;

      const application = await storage.getApplicationById(applicationId);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      // Check user has access to this application
      const userCompany = await storage.getUser(userId);
      if (userCompany?.companyId !== application.companyId && req.user.role !== 'system_admin') {
        return res.status(403).json({ error: "Access denied" });
      }

      // Update application status to indicate phase has started
      let newStatus = application.status;
      if (phase === 'pre_activity' && application.status === 'draft') {
        newStatus = 'under_review'; // Use existing enum value
      }

      await storage.updateApplication(applicationId, { 
        status: newStatus
      });

      res.json({ message: "Phase started", phase, status: newStatus });
    } catch (error) {
      console.error("Error starting phase:", error);
      res.status(500).json({ error: "Failed to start phase" });
    }
  });

  // Create initial admin account (development only)
  app.post('/api/admin/create-admin', async (req: Request, res: Response) => {
    try {
      const { email, password, firstName, lastName } = req.body;
      
      // Check if admin already exists
      const existingAdmin = await storage.getUserByEmail(email);
      if (existingAdmin) {
        return res.status(400).json({ message: "Admin account already exists" });
      }

      // Hash password  
      const salt = randomBytes(16).toString("hex");
      const buf = (await scryptAsync(password, salt, 64)) as Buffer;
      const hashedPassword = `${buf.toString("hex")}.${salt}`;
      
      // Create admin user
      const adminUser = await storage.upsertUser({
        id: nanoid(),
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: "system_admin",
        isActive: true
      });

      res.json({ message: "Admin account created successfully", userId: adminUser.id });
    } catch (error) {
      console.error("Error creating admin account:", error);
      res.status(500).json({ message: "Failed to create admin account" });
    }
  });

  // Create sample FRA templates for testing
  app.post('/api/create-sample-templates', requireAuth, async (req: any, res: Response) => {
    try {
      const user = req.user;

      const sampleTemplates = [
        {
          activityType: 'FRA' as const,
          phase: 'pre_activity',
          name: 'FRA Pre-Activity Assessment',
          description: 'Facility Readiness Assessment - Initial Evaluation',
          formFields: JSON.stringify([
            {
              id: 'facility_overview',
              type: 'textarea',
              label: 'Facility Overview',
              required: true,
              placeholder: 'Describe your facility operations and main processes'
            },
            {
              id: 'energy_systems',
              type: 'select',
              label: 'Primary Energy Systems',
              required: true,
              options: ['Lighting', 'HVAC', 'Compressed Air', 'Motors', 'Boilers', 'Chillers']
            },
            {
              id: 'annual_energy_cost',
              type: 'number',
              label: 'Annual Energy Cost ($)',
              required: true,
              placeholder: 'Enter annual energy costs'
            }
          ]),
          isGlobal: true,
          createdBy: user.id
        },
        {
          activityType: 'FRA' as const,
          phase: 'post_activity',
          name: 'FRA Post-Activity Report',
          description: 'Facility Readiness Assessment - Implementation Results',
          formFields: JSON.stringify([
            {
              id: 'improvements_implemented',
              type: 'textarea',
              label: 'Energy Improvements Implemented',
              required: true,
              placeholder: 'Describe what energy efficiency measures were implemented'
            },
            {
              id: 'energy_savings',
              type: 'number',
              label: 'Estimated Annual Energy Savings (%)',
              required: true,
              placeholder: 'Enter percentage of energy savings achieved'
            },
            {
              id: 'cost_savings',
              type: 'number',
              label: 'Estimated Annual Cost Savings ($)',
              required: true,
              placeholder: 'Enter dollar amount of annual cost savings'
            }
          ]),
          isGlobal: true,
          createdBy: user.id
        }
      ];

      const createdTemplates = [];
      for (const template of sampleTemplates) {
        try {
          const created = await storage.createFormTemplate(template);
          createdTemplates.push(created);
        } catch (error) {
          console.log('Template may already exist:', error);
        }
      }
      
      res.json({ message: "Sample templates created", templates: createdTemplates });
    } catch (error) {
      console.error("Error creating sample templates:", error);
      res.status(500).json({ message: "Failed to create sample templates" });
    }
  });

  // Messages API Routes
  app.get('/api/messages', requireAuth, async (req: any, res: Response) => {
    try {
      // Completely disable caching and etag generation
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
      });
      
      // Disable etag for this route
      app.set('etag', false);

      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      // If user is system admin, they can see all messages
      if (user?.role === 'system_admin') {
        const allMessages = await storage.getAllMessages();
        res.json(allMessages);
        return;
      }
      
      const userMessages = await storage.getUserMessages(userId);
      res.json(userMessages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ message: 'Failed to fetch messages' });
    }
  });

  app.post('/api/messages', requireAuth, async (req: any, res: Response) => {
    try {
      const userId = req.user.id;
      const { subject, message, applicationId, toUserId } = req.body;
      
      // Check if this is a reply (subject starts with "Re:")
      let ticketNumber = null;
      if (subject.startsWith('Re:')) {
        // Extract original subject and find existing ticket
        const originalSubject = subject.replace(/^Re:\s*/, '');
        const existingMessages = await storage.getMessagesBySubject(originalSubject);
        if (existingMessages.length > 0) {
          ticketNumber = existingMessages[0].ticketNumber;
        }
      }
      
      const newMessage = await storage.createMessage({
        fromUserId: userId,
        toUserId: toUserId || null, // For admin replies, null for messages to admin
        subject,
        message,
        isAdminMessage: req.user.role === 'system_admin',
        applicationId: applicationId || null,
        ticketNumber: ticketNumber // Use existing ticket number for replies
      });

      // Create notifications based on who is sending
      if (req.user.role === 'system_admin' && toUserId) {
        // Admin replying to user - notify the user
        await storage.createNotification({
          userId: toUserId,
          title: `Admin replied: ${subject}`,
          message: `You have received a reply to your support message`,
          type: 'admin_reply',
          messageId: newMessage.id,
          applicationId: applicationId || null
        });
      } else if (req.user.role !== 'system_admin') {
        // User sending message to admin - notify admin
        const adminUsers = await storage.getAdminUsers();
        for (const admin of adminUsers) {
          await storage.createNotification({
            userId: admin.id,
            title: `New support message: ${subject}`,
            message: `New message from user requiring attention`,
            type: 'new_message',
            messageId: newMessage.id,
            applicationId: applicationId || null
          });
        }
      }

      res.status(201).json(newMessage);
    } catch (error) {
      console.error('Error creating message:', error);
      res.status(500).json({ message: 'Failed to send message' });
    }
  });

  app.patch('/api/messages/:id', requireAuth, async (req: any, res: Response) => {
    try {
      const messageId = parseInt(req.params.id);
      const { isRead, markResolved } = req.body;
      
      if (markResolved && req.user.role === 'system_admin') {
        // Admin marking thread as resolved - mark all messages in the thread as read
        await storage.markThreadAsResolved(messageId);
        
        // Get the message to find who to notify
        const message = await storage.getMessageWithDetails(messageId);
        if (message && message.fromUserId !== req.user.id) {
          await storage.createNotification({
            userId: message.fromUserId,
            title: 'Support Ticket Resolved',
            message: `Your support ticket "${message.subject}" has been resolved`,
            type: 'ticket_resolved',
            messageId: messageId,
            applicationId: message.applicationId
          });
        }
        
        res.json({ success: true, message: 'Thread marked as resolved' });
      } else if (isRead) {
        // Regular user marking message as read
        await storage.markMessageAsRead(messageId, req.user.id);
        res.json({ success: true });
      } else {
        res.status(400).json({ message: 'Invalid request' });
      }
    } catch (error) {
      console.error('Error updating message:', error);
      res.status(500).json({ message: 'Failed to update message' });
    }
  });

  // Notifications API Routes
  app.get('/api/notifications', requireAuth, async (req: any, res: Response) => {
    try {
      const userId = req.user.id;
      const notifications = await storage.getUserNotifications(userId);
      res.json(notifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ message: 'Failed to fetch notifications' });
    }
  });

  app.patch('/api/notifications/:id/read', requireAuth, async (req: any, res: Response) => {
    try {
      const notificationId = parseInt(req.params.id);
      const userId = req.user.id;
      
      await storage.markNotificationAsRead(notificationId, userId);
      res.json({ message: 'Notification marked as read' });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({ message: 'Failed to mark notification as read' });
    }
  });

  app.patch('/api/notifications/mark-all-read', requireAuth, async (req: any, res: Response) => {
    try {
      await storage.markAllNotificationsAsRead(req.user.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({ message: 'Failed to mark all notifications as read' });
    }
  });

  app.delete('/api/notifications/delete-all', requireAuth, async (req: any, res: Response) => {
    try {
      const userId = req.user.id;
      await storage.deleteAllNotifications(userId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting all notifications:', error);
      res.status(500).json({ message: 'Failed to delete notifications' });
    }
  });

  // Admin ticket management routes
  app.patch('/api/admin/messages/:id/archive', requireAuth, async (req: any, res: Response) => {
    try {
      if (req.user.role !== 'system_admin') {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const messageId = parseInt(req.params.id);
      await storage.archiveMessage(messageId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error archiving message:', error);
      res.status(500).json({ message: 'Failed to archive message' });
    }
  });

  app.patch('/api/admin/messages/:id/unarchive', requireAuth, async (req: any, res: Response) => {
    try {
      if (req.user.role !== 'system_admin') {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const messageId = parseInt(req.params.id);
      await storage.unarchiveMessage(messageId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error unarchiving message:', error);
      res.status(500).json({ message: 'Failed to unarchive message' });
    }
  });

  app.delete('/api/admin/messages/:id', requireAuth, async (req: any, res: Response) => {
    try {
      if (req.user.role !== 'system_admin') {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const messageId = parseInt(req.params.id);
      await storage.deleteMessage(messageId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting message:', error);
      res.status(500).json({ message: 'Failed to delete message' });
    }
  });

  app.get('/api/admin/messages/archived', requireAuth, async (req: any, res: Response) => {
    try {
      if (req.user.role !== 'system_admin') {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const archivedMessages = await storage.getArchivedMessages();
      res.json(archivedMessages);
    } catch (error) {
      console.error('Error fetching archived messages:', error);
      res.status(500).json({ message: 'Failed to fetch archived messages' });
    }
  });

  // Admin routes for application status updates with notifications
  app.patch('/api/admin/applications/:id/status', requireAuth, async (req: any, res: Response) => {
    try {
      if (req.user.role !== 'system_admin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const applicationId = parseInt(req.params.id);
      const { status, reviewNotes } = req.body;
      
      const updatedApplication = await storage.updateApplicationStatus(applicationId, {
        status,
        reviewNotes,
        reviewedBy: req.user.id,
        reviewedAt: new Date()
      });

      // Create notification for the user
      const application = await storage.getApplication(applicationId);
      if (application) {
        let notificationTitle = '';
        let notificationMessage = '';
        let notificationType = '';

        switch (status) {
          case 'approved':
            notificationTitle = 'Application Approved';
            notificationMessage = `Your application ${application.applicationId} has been approved.`;
            notificationType = 'application_approved';
            break;
          case 'rejected':
            notificationTitle = 'Application Rejected';
            notificationMessage = `Your application ${application.applicationId} has been rejected. Please review the notes.`;
            notificationType = 'application_rejected';
            break;
          case 'needs_revision':
            notificationTitle = 'Application Needs Revision';
            notificationMessage = `Your application ${application.applicationId} requires additional information.`;
            notificationType = 'needs_revision';
            break;
        }

        if (notificationTitle) {
          await storage.createNotification({
            userId: application.submittedBy || '',
            title: notificationTitle,
            message: notificationMessage,
            type: notificationType,
            applicationId: applicationId
          });
        }
      }

      res.json(updatedApplication);
    } catch (error) {
      console.error('Error updating application status:', error);
      res.status(500).json({ message: 'Failed to update application status' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}