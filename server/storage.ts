import {
  users,
  companies,
  facilities,
  applications,
  documents,
  contractorDetails,
  applicationAssignments,
  activitySettings,
  formTemplates,
  applicationSubmissions,
  messages,
  notifications,
  type User,
  type UpsertUser,
  type Company,
  type InsertCompany,
  type Facility,
  type InsertFacility,
  type Application,
  type InsertApplication,
  type Document,
  type InsertDocument,
  type ContractorDetails,
  type InsertContractorDetails,
  type ApplicationAssignment,
  type InsertApplicationAssignment,
  type ActivitySettings,
  type InsertActivitySettings,
  type FormTemplate,
  type InsertFormTemplate,
  type ApplicationSubmission,
  type InsertApplicationSubmission,
  type Message,
  type InsertMessage,
  type Notification,
  type InsertNotification,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, inArray, or, isNull, isNotNull, like } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getAdminUsers(): Promise<User[]>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByVerificationToken(token: string): Promise<User | undefined>;
  createUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<UpsertUser>): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Company operations
  createCompany(company: InsertCompany): Promise<Company>;
  getCompanyById(id: number): Promise<Company | undefined>;
  getCompanyByShortName(shortName: string): Promise<Company | undefined>;
  getCompanies(): Promise<Company[]>;
  updateCompany(id: number, updates: Partial<InsertCompany>): Promise<Company>;
  
  // Facility operations
  createFacility(facility: InsertFacility): Promise<Facility>;
  getFacilitiesByCompany(companyId: number): Promise<Facility[]>;
  getFacilityById(id: number): Promise<Facility | undefined>;
  updateFacility(id: number, updates: Partial<InsertFacility>): Promise<Facility>;
  
  // Application operations
  createApplication(application: InsertApplication): Promise<Application>;
  getApplicationById(id: number): Promise<Application | undefined>;
  getApplicationByApplicationId(applicationId: string): Promise<Application | undefined>;
  getApplicationsByCompany(companyId: number): Promise<Application[]>;
  getAllApplications(): Promise<Application[]>;
  getApplicationsByUser(userId: string): Promise<Application[]>;
  getApplicationsByFacilityAndActivity(facilityId: number, activityType: string): Promise<Application[]>;
  updateApplication(id: number, updates: Partial<InsertApplication>): Promise<Application>;
  generateApplicationId(companyId: number, facilityId: number, activityType: string): Promise<string>;
  
  // Document operations
  createDocument(document: InsertDocument): Promise<Document>;
  getDocumentsByApplication(applicationId: number): Promise<Document[]>;
  getDocumentsByCompany(companyId: number): Promise<Document[]>;
  getAllDocuments(): Promise<Document[]>;
  getGlobalTemplates(): Promise<Document[]>;
  getDocumentById(id: number): Promise<Document | undefined>;
  deleteDocument(id: number): Promise<void>;
  
  // Team management
  getUsersByCompany(companyId: number): Promise<User[]>;
  updateUserRole(userId: string, role: string): Promise<User>;
  deactivateUser(userId: string): Promise<User>;
  
  // Contractor operations
  createContractorDetails(details: InsertContractorDetails): Promise<ContractorDetails>;
  getContractorDetails(userId: string): Promise<ContractorDetails | undefined>;
  updateContractorDetails(userId: string, updates: Partial<InsertContractorDetails>): Promise<ContractorDetails>;
  
  // Application assignments
  createApplicationAssignment(assignment: InsertApplicationAssignment): Promise<ApplicationAssignment>;
  getApplicationAssignments(applicationId: number): Promise<ApplicationAssignment[]>;
  getUserAssignments(userId: string): Promise<ApplicationAssignment[]>;
  removeApplicationAssignment(applicationId: number, userId: string): Promise<void>;
  
  // Activity settings
  getActivitySettings(): Promise<ActivitySettings[]>;
  updateActivitySetting(activityType: string, isEnabled: boolean, updatedBy: string): Promise<ActivitySettings>;
  
  // Application submission operations
  createApplicationSubmission(submission: InsertApplicationSubmission): Promise<ApplicationSubmission>;
  getApplicationSubmissions(applicationId: number): Promise<ApplicationSubmission[]>;
  updateApplicationSubmission(id: number, updates: Partial<InsertApplicationSubmission>): Promise<ApplicationSubmission>;
  
  // Form template operations
  createFormTemplate(template: InsertFormTemplate): Promise<FormTemplate>;
  getFormTemplates(activityType: string): Promise<FormTemplate[]>;
  getAllFormTemplates(): Promise<FormTemplate[]>;
  updateFormTemplate(id: number, updates: Partial<InsertFormTemplate>): Promise<FormTemplate>;
  getApplication(id: number): Promise<Application | undefined>;
  

  
  // Admin operations
  getAllUsers(): Promise<User[]>;
  getAllApplications(): Promise<Application[]>;
  getApplicationStats(): Promise<any>;
  
  // Messaging operations
  createMessage(message: InsertMessage): Promise<Message>;
  getUserMessages(userId: string): Promise<Message[]>;
  getMessageThread(parentMessageId: number): Promise<Message[]>;
  getMessageWithDetails(messageId: number): Promise<Message | undefined>;
  getAllMessages(): Promise<Message[]>;
  markMessageAsRead(messageId: number, userId: string): Promise<void>;
  markThreadAsResolved(messageId: number): Promise<void>;
  updateMessageStatus(messageId: number, status: string): Promise<Message>;
  generateTicketNumber(): Promise<string>;
  
  // Notification operations
  createNotification(notification: InsertNotification): Promise<Notification>;
  getUserNotifications(userId: string): Promise<Notification[]>;
  markNotificationAsRead(notificationId: number, userId: string): Promise<void>;
  
  // Enhanced application operations
  updateApplicationStatus(applicationId: number, updates: { status: string; reviewNotes?: string; reviewedBy?: string; reviewedAt?: Date }): Promise<Application>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getAdminUsers(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, 'system_admin'));
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByVerificationToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.emailVerificationToken, token));
    return user;
  }

  async createUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<UpsertUser>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Company operations
  async createCompany(company: InsertCompany): Promise<Company> {
    const [newCompany] = await db.insert(companies).values(company).returning();
    return newCompany;
  }

  async getCompanyById(id: number): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company;
  }

  async getCompanyByShortName(shortName: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.shortName, shortName));
    return company;
  }

  async getCompanies(): Promise<Company[]> {
    return await db.select().from(companies).orderBy(companies.name);
  }

  async updateCompany(id: number, updates: Partial<InsertCompany>): Promise<Company> {
    const [company] = await db
      .update(companies)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(companies.id, id))
      .returning();
    return company;
  }

  // Facility operations
  async createFacility(facility: InsertFacility): Promise<Facility> {
    const [newFacility] = await db.insert(facilities).values(facility).returning();
    return newFacility;
  }

  async getFacilitiesByCompany(companyId: number): Promise<Facility[]> {
    return await db
      .select()
      .from(facilities)
      .where(and(eq(facilities.companyId, companyId), eq(facilities.isActive, true)))
      .orderBy(facilities.name);
  }

  async getFacilityById(id: number): Promise<Facility | undefined> {
    const [facility] = await db.select().from(facilities).where(eq(facilities.id, id));
    return facility;
  }

  async updateFacility(id: number, updates: Partial<InsertFacility>): Promise<Facility> {
    const [facility] = await db
      .update(facilities)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(facilities.id, id))
      .returning();
    return facility;
  }

  // Application operations
  async createApplication(application: InsertApplication): Promise<Application> {
    const [newApplication] = await db
      .insert(applications)
      .values(application)
      .returning();
    return newApplication;
  }

  async getApplicationById(id: number): Promise<Application | undefined> {
    const [application] = await db
      .select({
        id: applications.id,
        applicationId: applications.applicationId,
        companyId: applications.companyId,
        facilityId: applications.facilityId,
        activityType: applications.activityType,
        title: applications.title,
        description: applications.description,
        status: applications.status,
        submittedBy: applications.submittedBy,
        createdAt: applications.createdAt,
        updatedAt: applications.updatedAt,
        facility: {
          id: facilities.id,
          name: facilities.name,
          code: facilities.code,
          description: facilities.description,
        }
      })
      .from(applications)
      .leftJoin(facilities, eq(applications.facilityId, facilities.id))
      .where(eq(applications.id, id));
    
    return application;
  }

  async getApplicationByApplicationId(applicationId: string): Promise<Application | undefined> {
    const [application] = await db
      .select({
        id: applications.id,
        applicationId: applications.applicationId,
        companyId: applications.companyId,
        facilityId: applications.facilityId,
        activityType: applications.activityType,
        title: applications.title,
        description: applications.description,
        status: applications.status,
        submittedBy: applications.submittedBy,
        createdAt: applications.createdAt,
        updatedAt: applications.updatedAt,
        facility: {
          id: facilities.id,
          name: facilities.name,
          code: facilities.code,
          description: facilities.description,
        }
      })
      .from(applications)
      .leftJoin(facilities, eq(applications.facilityId, facilities.id))
      .where(eq(applications.applicationId, applicationId));
    
    return application;
  }

  async getApplicationsByCompany(companyId: number): Promise<any[]> {
    const appsWithFacilities = await db
      .select({
        id: applications.id,
        applicationId: applications.applicationId,
        title: applications.title,
        description: applications.description,
        activityType: applications.activityType,
        status: applications.status,
        submittedAt: applications.submittedAt,
        submittedBy: applications.submittedBy,
        createdAt: applications.createdAt,
        updatedAt: applications.updatedAt,
        facilityId: applications.facilityId,
        companyId: applications.companyId,
        facilityName: facilities.name,
      })
      .from(applications)
      .leftJoin(facilities, eq(applications.facilityId, facilities.id))
      .where(eq(applications.companyId, companyId))
      .orderBy(desc(applications.createdAt));
    
    // Get submission data for each application to determine detailed status
    const appsWithSubmissions = await Promise.all(
      appsWithFacilities.map(async (app) => {
        const submissions = await this.getApplicationSubmissions(app.id);
        const hasPreActivity = submissions.some(s => s.phase === 'pre_activity');
        const hasPostActivity = submissions.some(s => s.phase === 'post_activity');
        
        let detailedStatus = 'draft';
        
        // Determine workflow status based on submissions and application status
        if (hasPostActivity) {
          detailedStatus = 'post-activity-submitted';
        } else if (hasPreActivity) {
          // Pre-activity submitted, now in post-activity phase
          // Check if post-activity has been started (status would be updated when post-activity tab accessed)
          if (app.status === 'under_review') {
            detailedStatus = 'post-activity-started';
          } else {
            detailedStatus = 'pre-activity-submitted';
          }
        } else if (app.status === 'under_review') {
          // Status changed from draft, indicates pre-activity started
          detailedStatus = 'pre-activity-started';
        } else {
          detailedStatus = 'draft';
        }
        
        return {
          ...app,
          detailedStatus,
          hasPreActivitySubmission: hasPreActivity,
          hasPostActivitySubmission: hasPostActivity,
        };
      })
    );
    
    return appsWithSubmissions;
  }

  async getAllApplications(): Promise<any[]> {
    const appsWithFacilities = await db
      .select({
        id: applications.id,
        applicationId: applications.applicationId,
        title: applications.title,
        description: applications.description,
        activityType: applications.activityType,
        status: applications.status,
        submittedAt: applications.submittedAt,
        submittedBy: applications.submittedBy,
        createdAt: applications.createdAt,
        updatedAt: applications.updatedAt,
        facilityId: applications.facilityId,
        companyId: applications.companyId,
        facilityName: facilities.name,
        companyName: companies.name,
      })
      .from(applications)
      .leftJoin(facilities, eq(applications.facilityId, facilities.id))
      .leftJoin(companies, eq(applications.companyId, companies.id))
      .orderBy(desc(applications.createdAt));
    
    // Get submission data for each application to determine detailed status
    const appsWithSubmissions = await Promise.all(
      appsWithFacilities.map(async (app) => {
        const submissions = await this.getApplicationSubmissions(app.id);
        const hasPreActivity = submissions.some(s => s.phase === 'pre_activity');
        const hasPostActivity = submissions.some(s => s.phase === 'post_activity');
        
        let detailedStatus = 'draft';
        
        // Determine workflow status based on submissions and application status
        if (hasPostActivity) {
          detailedStatus = 'post-activity-submitted';
        } else if (hasPreActivity) {
          if (app.status === 'under_review') {
            detailedStatus = 'post-activity-started';
          } else {
            detailedStatus = 'pre-activity-submitted';
          }
        } else if (app.status === 'under_review') {
          detailedStatus = 'pre-activity-started';
        }
        
        return {
          ...app,
          detailedStatus,
          facility: app.facilityName ? { name: app.facilityName } : null,
          company: app.companyName ? { name: app.companyName } : null
        };
      })
    );
    
    return appsWithSubmissions;
  }

  async getApplicationsByUser(userId: string): Promise<Application[]> {
    const user = await this.getUser(userId);
    if (!user?.companyId) return [];
    
    return await this.getApplicationsByCompany(user.companyId);
  }

  async getApplicationsByFacilityAndActivity(facilityId: number, activityType: string): Promise<Application[]> {
    return await db
      .select()
      .from(applications)
      .where(
        and(
          eq(applications.facilityId, facilityId),
          eq(applications.activityType, activityType as any)
        )
      )
      .orderBy(desc(applications.createdAt));
  }

  async updateApplication(id: number, updates: Partial<InsertApplication>): Promise<Application> {
    const [application] = await db
      .update(applications)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(applications.id, id))
      .returning();
    return application;
  }

  async generateApplicationId(companyId: number, facilityId: number, activityType: string): Promise<string> {
    const company = await this.getCompanyById(companyId);
    const facility = await this.getFacilityById(facilityId);
    
    if (!company || !facility) {
      throw new Error("Company or facility not found");
    }

    // Activity type codes
    const activityCodes: Record<string, string> = {
      FRA: "1",
      CES: "2", 
      SEM: "3",
      EMIS: "4",
      CR: "5"
    };

    const activityCode = activityCodes[activityType] || "1";

    // Get next application number for this facility and activity
    const existingApps = await db
      .select()
      .from(applications)
      .where(
        and(
          eq(applications.facilityId, facilityId),
          eq(applications.activityType, activityType as any)
        )
      );

    const nextNumber = String(existingApps.length + 1).padStart(2, "0");
    
    return `${company.shortName}-${facility.code}-${activityCode}${nextNumber}`;
  }

  // Document operations
  async createDocument(document: InsertDocument): Promise<Document> {
    const [newDocument] = await db.insert(documents).values(document).returning();
    return newDocument;
  }

  async getDocumentsByApplication(applicationId: number): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(eq(documents.applicationId, applicationId))
      .orderBy(desc(documents.createdAt));
  }

  async getDocumentsByCompany(companyId: number): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(eq(documents.companyId, companyId))
      .orderBy(desc(documents.createdAt));
  }

  async getAllDocuments(): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .orderBy(desc(documents.createdAt));
  }

  async getGlobalTemplates(): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(and(eq(documents.isTemplate, true), eq(documents.isGlobal, true)))
      .orderBy(documents.originalName);
  }

  async getDocumentById(id: number): Promise<Document | undefined> {
    const [document] = await db.select().from(documents).where(eq(documents.id, id));
    return document;
  }

  async deleteDocument(id: number): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
  }

  // Team management
  async getUsersByCompany(companyId: number): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(and(eq(users.companyId, companyId), eq(users.isActive, true)))
      .orderBy(users.firstName, users.lastName);
  }

  async updateUserRole(userId: string, role: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ role: role as any, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async deactivateUser(userId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  // Contractor operations
  async createContractorDetails(details: InsertContractorDetails): Promise<ContractorDetails> {
    const [contractorDetails] = await db.insert(contractorDetails).values(details).returning();
    return contractorDetails;
  }

  async getContractorDetails(userId: string): Promise<ContractorDetails | undefined> {
    const [details] = await db.select().from(contractorDetails).where(eq(contractorDetails.userId, userId));
    return details;
  }

  async updateContractorDetails(userId: string, updates: Partial<InsertContractorDetails>): Promise<ContractorDetails> {
    const [details] = await db
      .update(contractorDetails)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(contractorDetails.userId, userId))
      .returning();
    return details;
  }

  // Application assignments
  async createApplicationAssignment(assignment: InsertApplicationAssignment): Promise<ApplicationAssignment> {
    const [newAssignment] = await db.insert(applicationAssignments).values(assignment).returning();
    return newAssignment;
  }

  async getApplicationAssignments(applicationId: number): Promise<ApplicationAssignment[]> {
    return await db
      .select()
      .from(applicationAssignments)
      .where(eq(applicationAssignments.applicationId, applicationId));
  }

  async getUserAssignments(userId: string): Promise<ApplicationAssignment[]> {
    return await db
      .select()
      .from(applicationAssignments)
      .where(eq(applicationAssignments.userId, userId));
  }

  async removeApplicationAssignment(applicationId: number, userId: string): Promise<void> {
    await db
      .delete(applicationAssignments)
      .where(
        and(
          eq(applicationAssignments.applicationId, applicationId),
          eq(applicationAssignments.userId, userId)
        )
      );
  }

  // Activity settings
  async getActivitySettings(): Promise<ActivitySettings[]> {
    return await db.select().from(activitySettings).orderBy(activitySettings.activityType);
  }

  async updateActivitySetting(activityType: string, isEnabled: boolean, updatedBy: string): Promise<ActivitySettings> {
    const [settings] = await db
      .update(activitySettings)
      .set({ 
        isEnabled, 
        updatedBy, 
        updatedAt: new Date() 
      })
      .where(eq(activitySettings.activityType, activityType as any))
      .returning();
    return settings;
  }

  // Admin operations
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(users.createdAt);
  }

  async getAllApplications(): Promise<Application[]> {
    return await db.select().from(applications).orderBy(desc(applications.createdAt));
  }

  async getApplicationStats(): Promise<any> {
    const stats = await db
      .select({
        status: applications.status,
        count: sql<number>`count(*)`,
      })
      .from(applications)
      .groupBy(applications.status);

    return stats.reduce((acc, stat) => {
      acc[stat.status] = stat.count;
      return acc;
    }, {} as Record<string, number>);
  }

  // Application submission operations
  async createApplicationSubmission(submission: InsertApplicationSubmission): Promise<ApplicationSubmission> {
    const [created] = await db
      .insert(applicationSubmissions)
      .values(submission)
      .returning();
    return created;
  }

  async getApplicationSubmissions(applicationId: number): Promise<ApplicationSubmission[]> {
    return await db
      .select()
      .from(applicationSubmissions)
      .where(eq(applicationSubmissions.applicationId, applicationId));
  }

  async updateApplicationSubmission(id: number, updates: Partial<InsertApplicationSubmission>): Promise<ApplicationSubmission> {
    const [submission] = await db
      .update(applicationSubmissions)
      .set(updates)
      .where(eq(applicationSubmissions.id, id))
      .returning();
    return submission;
  }

  // Form template operations
  async createFormTemplate(template: InsertFormTemplate): Promise<FormTemplate> {
    const [created] = await db
      .insert(formTemplates)
      .values(template)
      .returning();
    return created;
  }

  async getFormTemplates(activityType: string): Promise<FormTemplate[]> {
    return await db
      .select()
      .from(formTemplates)
      .where(eq(formTemplates.activityType, activityType as any));
  }

  async getAllFormTemplates(): Promise<FormTemplate[]> {
    return await db.select().from(formTemplates);
  }

  async updateFormTemplate(id: number, updates: Partial<InsertFormTemplate>): Promise<FormTemplate> {
    const [updated] = await db
      .update(formTemplates)
      .set(updates)
      .where(eq(formTemplates.id, id))
      .returning();
    return updated;
  }

  async getApplication(id: number): Promise<Application | undefined> {
    return this.getApplicationById(id);
  }

  // Messaging operations
  async generateTicketNumber(): Promise<string> {
    const year = new Date().getFullYear().toString().slice(-2);
    const existingTickets = await db.select().from(messages);
    const nextNumber = String(existingTickets.length + 1).padStart(4, "0");
    return `TKT-${year}-${nextNumber}`;
  }

  async createMessage(messageData: InsertMessage): Promise<Message> {
    // Use provided ticket number for replies, or generate new one for original messages
    const ticketNumber = messageData.ticketNumber || await this.generateTicketNumber();
    
    const [created] = await db
      .insert(messages)
      .values({
        ...messageData,
        ticketNumber,
        status: 'open',
        priority: 'normal'
      })
      .returning();
    return created;
  }

  async getUserMessages(userId: string): Promise<Message[]> {
    return await db
      .select({
        id: messages.id,
        fromUserId: messages.fromUserId,
        toUserId: messages.toUserId,
        subject: messages.subject,
        message: messages.message,
        isRead: messages.isRead,
        isAdminMessage: messages.isAdminMessage,
        isResolved: messages.isResolved,
        isArchived: messages.isArchived,
        isDeleted: messages.isDeleted,
        status: messages.status,
        priority: messages.priority,
        ticketNumber: messages.ticketNumber,
        parentMessageId: messages.parentMessageId,
        applicationId: messages.applicationId,
        createdAt: messages.createdAt,
        updatedAt: messages.updatedAt,
        fromUser: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          companyId: users.companyId,
        },
      })
      .from(messages)
      .leftJoin(users, eq(messages.fromUserId, users.id))
      .where(and(
        or(eq(messages.fromUserId, userId), eq(messages.toUserId, userId)),
        eq(messages.isDeleted, false)
      ))
      .orderBy(desc(messages.createdAt)) as Message[];
  }

  async getMessageThread(parentMessageId: number): Promise<Message[]> {
    return await db
      .select({
        id: messages.id,
        fromUserId: messages.fromUserId,
        toUserId: messages.toUserId,
        subject: messages.subject,
        message: messages.message,
        isRead: messages.isRead,
        isAdminMessage: messages.isAdminMessage,
        applicationId: messages.applicationId,
        createdAt: messages.createdAt,
        updatedAt: messages.updatedAt,
        fromUser: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          companyId: users.companyId,
        },
      })
      .from(messages)
      .leftJoin(users, eq(messages.fromUserId, users.id))
      .orderBy(messages.createdAt) as Message[];
  }

  async getMessagesByTicketOrSubject(ticketNumber: string): Promise<Message[]> {
    return await db
      .select({
        id: messages.id,
        fromUserId: messages.fromUserId,
        toUserId: messages.toUserId,
        subject: messages.subject,
        message: messages.message,
        isRead: messages.isRead,
        isAdminMessage: messages.isAdminMessage,
        applicationId: messages.applicationId,
        ticketNumber: messages.ticketNumber,
        createdAt: messages.createdAt,
        updatedAt: messages.updatedAt,
        fromUser: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          companyId: users.companyId,
        },
      })
      .from(messages)
      .leftJoin(users, eq(messages.fromUserId, users.id))
      .where(eq(messages.ticketNumber, ticketNumber))
      .orderBy(messages.createdAt) as Message[];
  }

  async getMessagesBySubject(subject: string): Promise<Message[]> {
    return await db
      .select({
        id: messages.id,
        fromUserId: messages.fromUserId,
        toUserId: messages.toUserId,
        subject: messages.subject,
        message: messages.message,
        isRead: messages.isRead,
        isAdminMessage: messages.isAdminMessage,
        applicationId: messages.applicationId,
        ticketNumber: messages.ticketNumber,
        createdAt: messages.createdAt,
        updatedAt: messages.updatedAt,
        fromUser: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          companyId: users.companyId,
        },
      })
      .from(messages)
      .leftJoin(users, eq(messages.fromUserId, users.id))
      .where(eq(messages.subject, subject))
      .orderBy(messages.createdAt) as Message[];
  }

  async getMessageWithDetails(messageId: number): Promise<Message | undefined> {
    const [message] = await db
      .select({
        id: messages.id,
        fromUserId: messages.fromUserId,
        toUserId: messages.toUserId,
        subject: messages.subject,
        message: messages.message,
        isRead: messages.isRead,
        isAdminMessage: messages.isAdminMessage,
        applicationId: messages.applicationId,
        status: messages.status,
        priority: messages.priority,
        ticketNumber: messages.ticketNumber,
        parentMessageId: messages.parentMessageId,
        createdAt: messages.createdAt,
        updatedAt: messages.updatedAt,
        fromUser: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          companyId: users.companyId,
        },
        application: {
          id: applications.id,
          applicationId: applications.applicationId,
          title: applications.title,
        },
        company: {
          id: companies.id,
          name: companies.name,
          shortName: companies.shortName,
        }
      })
      .from(messages)
      .leftJoin(users, eq(messages.fromUserId, users.id))
      .leftJoin(applications, eq(messages.applicationId, applications.id))
      .leftJoin(companies, eq(users.companyId, companies.id))
      .where(eq(messages.id, messageId));
    
    return message as Message | undefined;
  }

  async updateMessageStatus(messageId: number, status: string): Promise<Message> {
    const [message] = await db
      .update(messages)
      .set({ isRead: status === 'closed', updatedAt: new Date() })
      .where(eq(messages.id, messageId))
      .returning();
    return message;
  }

  async getAllMessages(): Promise<Message[]> {
    const allMessages = await db
      .select({
        id: messages.id,
        fromUserId: messages.fromUserId,
        toUserId: messages.toUserId,
        subject: messages.subject,
        message: messages.message,
        isAdminMessage: messages.isAdminMessage,
        isRead: messages.isRead,
        isResolved: messages.isResolved,
        isArchived: messages.isArchived,
        isDeleted: messages.isDeleted,
        status: messages.status,
        priority: messages.priority,
        ticketNumber: messages.ticketNumber,
        parentMessageId: messages.parentMessageId,
        applicationId: messages.applicationId,
        createdAt: messages.createdAt,
        updatedAt: messages.updatedAt,
        fromUser: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          companyId: users.companyId,
        },
        company: {
          id: companies.id,
          name: companies.name,
          shortName: companies.shortName,
        },
        application: {
          id: applications.id,
          applicationId: applications.applicationId,
          title: applications.title,
        }
      })
      .from(messages)
      .leftJoin(users, eq(messages.fromUserId, users.id))
      .leftJoin(companies, eq(users.companyId, companies.id))
      .leftJoin(applications, eq(messages.applicationId, applications.id))
      .where(eq(messages.isDeleted, false))
      .orderBy(desc(messages.createdAt));
    
    return allMessages as Message[];
  }

  async markMessageAsRead(messageId: number, userId: string): Promise<void> {
    await db
      .update(messages)
      .set({ isRead: true })
      .where(and(eq(messages.id, messageId), eq(messages.toUserId, userId)));
  }

  async markThreadAsResolved(messageId: number): Promise<void> {
    // Mark the specific message as resolved
    await db
      .update(messages)
      .set({ isResolved: true, updatedAt: new Date() })
      .where(eq(messages.id, messageId));
  }

  // Notification operations
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [created] = await db
      .insert(notifications)
      .values(notification)
      .returning();
    return created;
  }

  async getUserNotifications(userId: string): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  }

  async markNotificationAsRead(notificationId: number, userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, userId));
  }

  async deleteAllNotifications(userId: string): Promise<void> {
    await db
      .delete(notifications)
      .where(eq(notifications.userId, userId));
  }

  // Message archive and delete methods
  async archiveMessage(messageId: number): Promise<void> {
    await db
      .update(messages)
      .set({ isArchived: true })
      .where(eq(messages.id, messageId));
  }

  async unarchiveMessage(messageId: number): Promise<void> {
    await db
      .update(messages)
      .set({ isArchived: false })
      .where(eq(messages.id, messageId));
  }

  async deleteMessage(messageId: number): Promise<void> {
    await db
      .update(messages)
      .set({ isDeleted: true })
      .where(eq(messages.id, messageId));
  }

  async getArchivedMessages(): Promise<any[]> {
    const archivedMessages = await db
      .select({
        id: messages.id,
        fromUserId: messages.fromUserId,
        toUserId: messages.toUserId,
        subject: messages.subject,
        message: messages.message,
        isAdminMessage: messages.isAdminMessage,
        isRead: messages.isRead,
        isResolved: messages.isResolved,
        isArchived: messages.isArchived,
        isDeleted: messages.isDeleted,
        status: messages.status,
        priority: messages.priority,
        ticketNumber: messages.ticketNumber,
        parentMessageId: messages.parentMessageId,
        applicationId: messages.applicationId,
        createdAt: messages.createdAt,
        updatedAt: messages.updatedAt,
        fromUser: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          companyId: users.companyId,
        },
        company: {
          id: companies.id,
          name: companies.name,
          shortName: companies.shortName,
        },
        application: {
          id: applications.id,
          applicationId: applications.applicationId,
          title: applications.title,
        }
      })
      .from(messages)
      .leftJoin(users, eq(messages.fromUserId, users.id))
      .leftJoin(companies, eq(users.companyId, companies.id))
      .leftJoin(applications, eq(messages.applicationId, applications.id))
      .where(and(eq(messages.isArchived, true), eq(messages.isDeleted, false)))
      .orderBy(desc(messages.createdAt));
    
    return archivedMessages;
  }

  // Enhanced application operations
  async updateApplicationStatus(applicationId: number, updates: { status: string; reviewNotes?: string; reviewedBy?: string; reviewedAt?: Date }): Promise<Application> {
    const [updated] = await db
      .update(applications)
      .set(updates)
      .where(eq(applications.id, applicationId))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
