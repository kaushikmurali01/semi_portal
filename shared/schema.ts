import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  integer,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Enums
export const roleEnum = pgEnum("role", ["team_member", "company_admin", "contractor_individual", "system_admin"]);
export const permissionLevelEnum = pgEnum("permission_level", ["viewer", "editor", "manager"]);
export const activityTypeEnum = pgEnum("activity_type", ["FRA", "SEM", "EEA", "EMIS", "CR"]);
export const applicationStatusEnum = pgEnum("application_status", ["draft", "in_progress", "submitted", "under_review", "approved", "rejected", "needs_revision"]);
export const documentTypeEnum = pgEnum("document_type", ["pre_activity", "post_activity", "supporting", "template", "other"]);
export const typeOfOperationEnum = pgEnum("type_of_operation", ["continuous", "semi_continuous", "batch"]);
export const notificationTypeEnum = pgEnum("notification_type", ["facility_added", "application_submitted", "application_status_changed", "team_member_added", "document_uploaded"]);

// User storage table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  password: varchar("password"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: roleEnum("role").default("team_member").notNull(),
  permissionLevel: permissionLevelEnum("permission_level").default("viewer"),
  companyId: integer("company_id"),
  isActive: boolean("is_active").default(true),
  hearAboutUs: varchar("hear_about_us"),
  emailVerificationToken: varchar("email_verification_token"),
  verificationTokenExpiry: timestamp("verification_token_expiry"),
  emailVerifiedAt: timestamp("email_verified_at"),
  isEmailVerified: boolean("is_email_verified").default(false),
  twoFactorSecret: varchar("two_factor_secret"),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Companies
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  shortName: varchar("short_name", { length: 6 }).notNull().unique(),
  address: text("address"),
  phone: varchar("phone", { length: 20 }),
  website: varchar("website"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Facilities
export const facilities = pgTable("facilities", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 3 }).notNull(),
  
  // NAICS Information
  naicsCode: varchar("naics_code"),
  facilitySector: varchar("facility_sector"),
  facilityCategory: varchar("facility_category"),
  facilityType: varchar("facility_type"),
  facilityPhotoUrl: varchar("facility_photo_url"),
  
  // Address Information
  unitNumber: varchar("unit_number"),
  streetNumber: varchar("street_number"),
  streetName: varchar("street_name"),
  city: varchar("city"),
  province: varchar("province"),
  country: varchar("country").default("Canada"),
  postalCode: varchar("postal_code"),
  
  // Facility Details
  grossFloorArea: integer("gross_floor_area"),
  yearBuilt: integer("year_built"),
  weeklyOperatingHours: integer("weekly_operating_hours"),
  numberOfWorkersMainShift: integer("number_of_workers_main_shift"),
  typeOfOperation: typeOfOperationEnum("type_of_operation"),
  
  // Energy Management Information System
  hasEMIS: boolean("has_emis"),
  hasEnergyManager: boolean("has_energy_manager"),
  
  // Facility Process and Systems (stored as JSON array)
  processAndSystems: text("process_and_systems").array(),
  
  // Legacy fields
  address: text("address"),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Applications
export const applications = pgTable("applications", {
  id: serial("id").primaryKey(),
  applicationId: varchar("application_id", { length: 50 }).notNull().unique(),
  companyId: integer("company_id").notNull(),
  facilityId: integer("facility_id").notNull(),
  activityType: activityTypeEnum("activity_type").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: applicationStatusEnum("status").default("draft").notNull(),
  submittedBy: varchar("submitted_by"),
  submittedAt: timestamp("submitted_at"),
  reviewedBy: varchar("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Documents
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  applicationId: integer("application_id"),
  companyId: integer("company_id"),
  filename: varchar("filename", { length: 255 }).notNull(),
  originalName: varchar("original_name", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  size: integer("size").notNull(),
  documentType: documentTypeEnum("document_type").notNull(),
  isTemplate: boolean("is_template").default(false),
  isGlobal: boolean("is_global").default(false),
  uploadedBy: varchar("uploaded_by").notNull(),
  filePath: varchar("file_path", { length: 500 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Contractor details
export const contractorDetails = pgTable("contractor_details", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  supportedActivities: varchar("supported_activities").array(),
  technologyCapabilities: varchar("technology_capabilities").array(),
  serviceRegions: varchar("service_regions").array(),
  hasGST: boolean("has_gst").default(false),
  hasWCB: boolean("has_wcb").default(false),
  hasInsurance: boolean("has_insurance").default(false),
  codeOfConductSigned: boolean("code_of_conduct_signed").default(false),
  codeOfConductSignedAt: timestamp("code_of_conduct_signed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Application assignments (for contractor access)
export const applicationAssignments = pgTable("application_assignments", {
  id: serial("id").primaryKey(),
  applicationId: integer("application_id").notNull(),
  userId: varchar("user_id").notNull(),
  assignedBy: varchar("assigned_by").notNull(),
  permissions: varchar("permissions").array().default(["view"]),
  createdAt: timestamp("created_at").defaultNow(),
});

// Activity settings (admin configurable)
export const activitySettings = pgTable("activity_settings", {
  id: serial("id").primaryKey(),
  activityType: activityTypeEnum("activity_type").notNull().unique(),
  isEnabled: boolean("is_enabled").default(true),
  requiresFRA: boolean("requires_fra").default(false),
  maxApplications: integer("max_applications"),
  description: text("description"),
  updatedBy: varchar("updated_by"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Form Templates - Global forms for each activity type and phase
export const formTemplates = pgTable("form_templates", {
  id: serial("id").primaryKey(),
  activityType: activityTypeEnum("activity_type").notNull(),
  phase: varchar("phase", { length: 20 }).notNull(), // 'pre_activity' or 'post_activity'
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  formFields: text("form_fields"), // JSON string containing form field definitions
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Form Fields - Dynamic fields for each form template
export const formFields = pgTable("form_fields", {
  id: serial("id").primaryKey(),
  formTemplateId: integer("form_template_id").notNull(),
  fieldName: varchar("field_name", { length: 255 }).notNull(),
  fieldLabel: varchar("field_label", { length: 255 }).notNull(),
  fieldType: varchar("field_type", { length: 50 }).notNull(), // 'text', 'textarea', 'select', 'file', 'checkbox', 'number', 'date'
  isRequired: boolean("is_required").default(false),
  options: text("options"), // JSON string for select options
  validation: text("validation"), // JSON string for validation rules
  placeholder: varchar("placeholder", { length: 255 }),
  helpText: text("help_text"),
  orderIndex: integer("order_index").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Application Submissions - Tracks pre/post activity submissions
export const applicationSubmissions = pgTable("application_submissions", {
  id: serial("id").primaryKey(),
  applicationId: integer("application_id").notNull(),
  phase: varchar("phase", { length: 20 }).notNull(), // 'pre_activity' or 'post_activity'
  formTemplateId: integer("form_template_id").notNull(),
  submittedBy: varchar("submitted_by").notNull(),
  submittedAt: timestamp("submitted_at").defaultNow(),
  status: varchar("status", { length: 20 }).default("submitted").notNull(), // 'submitted', 'reviewed', 'approved', 'rejected'
  reviewedBy: varchar("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Form Responses - User responses to form fields
export const formResponses = pgTable("form_responses", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id").notNull(),
  formFieldId: integer("form_field_id").notNull(),
  value: text("value"), // Stores the user's response
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Messages - Communication between users and admin
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  fromUserId: varchar("from_user_id").notNull(),
  toUserId: varchar("to_user_id"), // null for messages to admin
  subject: varchar("subject", { length: 255 }).notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false),
  isAdminMessage: boolean("is_admin_message").default(false),
  isResolved: boolean("is_resolved").default(false),
  isArchived: boolean("is_archived").default(false),
  isDeleted: boolean("is_deleted").default(false),
  status: varchar("status", { length: 20 }).default("open"),
  priority: varchar("priority", { length: 20 }).default("normal"),
  ticketNumber: varchar("ticket_number", { length: 50 }),
  parentMessageId: integer("parent_message_id"),
  applicationId: integer("application_id"), // optional link to specific application
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Notifications - System notifications for status changes
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  type: varchar("type", { length: 50 }).notNull(), // 'application_approved', 'application_rejected', 'needs_revision', 'new_message'
  isRead: boolean("is_read").default(false),
  applicationId: integer("application_id"), // optional link to specific application
  messageId: integer("message_id"), // optional link to specific message
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  company: one(companies, {
    fields: [users.companyId],
    references: [companies.id],
  }),
  contractorDetails: one(contractorDetails, {
    fields: [users.id],
    references: [contractorDetails.userId],
  }),
  submittedApplications: many(applications, {
    relationName: "submitted_by",
  }),
  reviewedApplications: many(applications, {
    relationName: "reviewed_by",
  }),
  uploadedDocuments: many(documents),
  applicationAssignments: many(applicationAssignments),
}));

export const companiesRelations = relations(companies, ({ many }) => ({
  users: many(users),
  facilities: many(facilities),
  applications: many(applications),
  documents: many(documents),
}));

export const facilitiesRelations = relations(facilities, ({ one, many }) => ({
  company: one(companies, {
    fields: [facilities.companyId],
    references: [companies.id],
  }),
  applications: many(applications),
}));

export const applicationsRelations = relations(applications, ({ one, many }) => ({
  company: one(companies, {
    fields: [applications.companyId],
    references: [companies.id],
  }),
  facility: one(facilities, {
    fields: [applications.facilityId],
    references: [facilities.id],
  }),
  submitter: one(users, {
    fields: [applications.submittedBy],
    references: [users.id],
    relationName: "submitted_by",
  }),
  reviewer: one(users, {
    fields: [applications.reviewedBy],
    references: [users.id],
    relationName: "reviewed_by",
  }),
  documents: many(documents),
  assignments: many(applicationAssignments),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  application: one(applications, {
    fields: [documents.applicationId],
    references: [applications.id],
  }),
  company: one(companies, {
    fields: [documents.companyId],
    references: [companies.id],
  }),
  uploader: one(users, {
    fields: [documents.uploadedBy],
    references: [users.id],
  }),
}));

export const contractorDetailsRelations = relations(contractorDetails, ({ one }) => ({
  user: one(users, {
    fields: [contractorDetails.userId],
    references: [users.id],
  }),
}));

export const applicationAssignmentsRelations = relations(applicationAssignments, ({ one }) => ({
  application: one(applications, {
    fields: [applicationAssignments.applicationId],
    references: [applications.id],
  }),
  user: one(users, {
    fields: [applicationAssignments.userId],
    references: [users.id],
  }),
  assigner: one(users, {
    fields: [applicationAssignments.assignedBy],
    references: [users.id],
  }),
}));

export const formTemplatesRelations = relations(formTemplates, ({ many }) => ({
  formFields: many(formFields),
  applicationSubmissions: many(applicationSubmissions),
}));

export const formFieldsRelations = relations(formFields, ({ one, many }) => ({
  formTemplate: one(formTemplates, {
    fields: [formFields.formTemplateId],
    references: [formTemplates.id],
  }),
  formResponses: many(formResponses),
}));

export const applicationSubmissionsRelations = relations(applicationSubmissions, ({ one, many }) => ({
  application: one(applications, {
    fields: [applicationSubmissions.applicationId],
    references: [applications.id],
  }),
  formTemplate: one(formTemplates, {
    fields: [applicationSubmissions.formTemplateId],
    references: [formTemplates.id],
  }),
  submitter: one(users, {
    fields: [applicationSubmissions.submittedBy],
    references: [users.id],
  }),
  reviewer: one(users, {
    fields: [applicationSubmissions.reviewedBy],
    references: [users.id],
  }),
  formResponses: many(formResponses),
}));

export const formResponsesRelations = relations(formResponses, ({ one }) => ({
  submission: one(applicationSubmissions, {
    fields: [formResponses.submissionId],
    references: [applicationSubmissions.id],
  }),
  formField: one(formFields, {
    fields: [formResponses.formFieldId],
    references: [formFields.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
  role: true,
  companyId: true,
  hearAboutUs: true,
});

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFacilitySchema = createInsertSchema(facilities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertApplicationSchema = createInsertSchema(applications).omit({
  id: true,
  applicationId: true,
  submittedAt: true,
  reviewedBy: true,
  reviewedAt: true,
  reviewNotes: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
});

export const insertContractorDetailsSchema = createInsertSchema(contractorDetails).omit({
  id: true,
  codeOfConductSignedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertApplicationAssignmentSchema = createInsertSchema(applicationAssignments).omit({
  id: true,
  createdAt: true,
});

export const insertActivitySettingsSchema = createInsertSchema(activitySettings).omit({
  id: true,
  updatedAt: true,
});

export const insertFormTemplateSchema = createInsertSchema(formTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFormFieldSchema = createInsertSchema(formFields).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertApplicationSubmissionSchema = createInsertSchema(applicationSubmissions).omit({
  id: true,
  submittedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFormResponseSchema = createInsertSchema(formResponses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Facility = typeof facilities.$inferSelect;
export type InsertFacility = z.infer<typeof insertFacilitySchema>;
export type Application = typeof applications.$inferSelect;
export type InsertApplication = z.infer<typeof insertApplicationSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type ContractorDetails = typeof contractorDetails.$inferSelect;
export type InsertContractorDetails = z.infer<typeof insertContractorDetailsSchema>;
export type ApplicationAssignment = typeof applicationAssignments.$inferSelect;
export type InsertApplicationAssignment = z.infer<typeof insertApplicationAssignmentSchema>;
export type ActivitySettings = typeof activitySettings.$inferSelect;
export type InsertActivitySettings = z.infer<typeof insertActivitySettingsSchema>;
export type FormTemplate = typeof formTemplates.$inferSelect;
export type InsertFormTemplate = z.infer<typeof insertFormTemplateSchema>;
export type FormField = typeof formFields.$inferSelect;
export type InsertFormField = z.infer<typeof insertFormFieldSchema>;
export type ApplicationSubmission = typeof applicationSubmissions.$inferSelect;
export type InsertApplicationSubmission = z.infer<typeof insertApplicationSubmissionSchema>;
export type FormResponse = typeof formResponses.$inferSelect;
export type InsertFormResponse = z.infer<typeof insertFormResponseSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
