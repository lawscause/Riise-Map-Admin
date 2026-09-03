import { pgTable, text, serial, integer, varchar, date, jsonb, numeric, timestamp, boolean, customType, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() { return "bytea"; },
  toDriver(value: Buffer) { return value; },
  fromDriver(value: Buffer) { return value; },
});

// Organizations Table
export const organizationsTable = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
export type Organization = typeof organizationsTable.$inferSelect;

// Users Table
export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  cognitoSub: varchar("cognito_sub", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull(),
  givenName: varchar("given_name", { length: 255 }),
  familyName: varchar("family_name", { length: 255 }),
  orgId: integer("org_id").references(() => organizationsTable.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 50 }).notNull().default("cognito"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow(),
});
export type User = typeof usersTable.$inferSelect;

// Learners Table
export const learnersTable = pgTable("learners", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").references(() => organizationsTable.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  pathway: varchar("pathway", { length: 255 }).notNull(),
  program: varchar("program", { length: 255 }).notNull(),
  coach: varchar("coach", { length: 255 }).notNull(),
  progress: integer("progress").notNull(),
  readiness: integer("readiness").notNull(),
  status: varchar("status", { length: 50 }).notNull(),
  lastActive: varchar("lastActive", { length: 255 }).notNull(),
  nextAction: varchar("nextAction", { length: 255 }).notNull(),
  joinDate: varchar("joinDate", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  photo: varchar("photo", { length: 255 }),
  background: text("background"),
  strengths: jsonb("strengths"),
  risks: jsonb("risks"),
  profileStrength: integer("profileStrength"),
  flaggedForSupport: boolean("flaggedForSupport").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const insertLearnerSchema = createInsertSchema(learnersTable).omit({ id: true, orgId: true, createdAt: true });
export type InsertLearner = z.infer<typeof insertLearnerSchema>;
export type Learner = typeof learnersTable.$inferSelect;

// Coaches Table
export const coachesTable = pgTable("coaches", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  role: varchar("role", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  learnersCount: integer("learnersCount").notNull(),
  atRisk: integer("atRisk").notNull(),
  workload: varchar("workload", { length: 50 }).notNull(),
  upcomingCheckIns: integer("upcomingCheckIns").notNull(),
  overdueCheckIns: integer("overdueCheckIns").notNull(),
  assignedLearners: jsonb("assignedLearners"),
});

export const insertCoachSchema = createInsertSchema(coachesTable).omit({ id: true });
export type InsertCoach = z.infer<typeof insertCoachSchema>;
export type Coach = typeof coachesTable.$inferSelect;

// Programs Table
export const programsTable = pgTable("programs", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").references(() => organizationsTable.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  programTag: varchar("programTag", { length: 100 }).notNull(),
  description: text("description").notNull(),
  pathwayCategory: varchar("pathwayCategory", { length: 255 }).notNull(),
  activeLearners: integer("activeLearners").notNull(),
  completionRate: integer("completionRate").notNull(),
  readinessScore: integer("readinessScore").notNull(),
  eventParticipation: integer("eventParticipation").notNull(),
  placementReady: integer("placementReady").notNull(),
  funderTag: varchar("funderTag", { length: 255 }).notNull(),
  cohort: varchar("cohort", { length: 255 }).notNull(),
  startDate: varchar("startDate", { length: 255 }).notNull(),
  endDate: varchar("endDate", { length: 255 }).notNull(),
  pathways: jsonb("pathways"),
}, (table) => ({
  // Tags collide per organization only; the old global unique() on programTag
  // blocked two orgs from ever using the same tag (F6).
  orgTagUnique: uniqueIndex("programs_org_id_program_tag_unique").on(table.orgId, table.programTag),
}));

export const insertProgramSchema = createInsertSchema(programsTable).omit({ id: true, orgId: true });
export type InsertProgram = z.infer<typeof insertProgramSchema>;
export type Program = typeof programsTable.$inferSelect;

// Pathways Table
export const pathwaysTable = pgTable("pathways", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").references(() => organizationsTable.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description").notNull(),
  targetProfile: text("targetProfile").notNull(),
  estimatedWeeks: integer("estimatedWeeks").notNull(),
  activeLearners: integer("activeLearners").notNull(),
  programCategory: varchar("programCategory", { length: 100 }),
  skills: jsonb("skills"),
  milestones: jsonb("milestones"),
  projects: jsonb("projects"),
  readinessCriteria: jsonb("readinessCriteria"),
});

export const insertPathwaySchema = createInsertSchema(pathwaysTable).omit({ id: true, orgId: true });
export type InsertPathway = z.infer<typeof insertPathwaySchema>;
export type Pathway = typeof pathwaysTable.$inferSelect;

// Learner Roadmaps Table
export const learnerRoadmapsTable = pgTable("learner_roadmaps", {
  id: serial("id").primaryKey(),
  learnerId: integer("learnerId").notNull().references(() => learnersTable.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  state: varchar("state", { length: 50 }).notNull(),
  dueDate: varchar("dueDate", { length: 255 }).notNull(),
});

export const insertLearnerRoadmapSchema = createInsertSchema(learnerRoadmapsTable).omit({ id: true });
export type InsertLearnerRoadmap = z.infer<typeof insertLearnerRoadmapSchema>;
export type LearnerRoadmap = typeof learnerRoadmapsTable.$inferSelect;

// Learner Projects Table
export const learnerProjectsTable = pgTable("learner_projects", {
  id: serial("id").primaryKey(),
  learnerId: integer("learnerId").notNull().references(() => learnersTable.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  completion: integer("completion").notNull(),
  status: varchar("status", { length: 50 }).notNull(),
});

export const insertLearnerProjectSchema = createInsertSchema(learnerProjectsTable).omit({ id: true });
export type InsertLearnerProject = z.infer<typeof insertLearnerProjectSchema>;
export type LearnerProject = typeof learnerProjectsTable.$inferSelect;

// Learner Events Table
export const learnerEventsTable = pgTable("learner_events", {
  id: serial("id").primaryKey(),
  learnerId: integer("learnerId").notNull().references(() => learnersTable.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  date: varchar("date", { length: 255 }).notNull(),
  status: varchar("status", { length: 50 }).notNull(),
});

export const insertLearnerEventSchema = createInsertSchema(learnerEventsTable).omit({ id: true });
export type InsertLearnerEvent = z.infer<typeof insertLearnerEventSchema>;
export type LearnerEvent = typeof learnerEventsTable.$inferSelect;

// Learner Notes Table
export const learnerNotesTable = pgTable("learner_notes", {
  id: serial("id").primaryKey(),
  learnerId: integer("learnerId").notNull().references(() => learnersTable.id, { onDelete: "cascade" }),
  author: varchar("author", { length: 255 }).notNull(),
  date: varchar("date", { length: 255 }).notNull(),
  content: text("content").notNull(),
});

export const insertLearnerNoteSchema = createInsertSchema(learnerNotesTable).omit({ id: true });
export type InsertLearnerNote = z.infer<typeof insertLearnerNoteSchema>;
export type LearnerNote = typeof learnerNotesTable.$inferSelect;

// Learner Readiness Scores Table
export const learnerReadinessScoresTable = pgTable("learner_readiness_scores", {
  id: serial("id").primaryKey(),
  learnerId: integer("learnerId").notNull().references(() => learnersTable.id, { onDelete: "cascade" }),
  dimension: varchar("dimension", { length: 255 }).notNull(),
  score: integer("score").notNull(),
});

export const insertLearnerReadinessScoreSchema = createInsertSchema(learnerReadinessScoresTable).omit({ id: true });
export type InsertLearnerReadinessScore = z.infer<typeof insertLearnerReadinessScoreSchema>;
export type LearnerReadinessScore = typeof learnerReadinessScoresTable.$inferSelect;

// Learner Activities Table
export const learnerActivitiesTable = pgTable("learner_activities", {
  id: serial("id").primaryKey(),
  learnerId: integer("learnerId").notNull().references(() => learnersTable.id, { onDelete: "cascade" }),
  date: varchar("date", { length: 255 }).notNull(),
  event: text("event").notNull(),
  type: varchar("type", { length: 50 }).notNull(),
});

export const insertLearnerActivitySchema = createInsertSchema(learnerActivitiesTable).omit({ id: true });
export type InsertLearnerActivity = z.infer<typeof insertLearnerActivitySchema>;
export type LearnerActivity = typeof learnerActivitiesTable.$inferSelect;

// Funding Sources Table
export const fundingSourcesTable = pgTable("funding_sources", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").references(() => organizationsTable.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  objectives: text("objectives"),
  narrative: text("narrative"),
  narrativeFile: bytea("narrative_file"),
  narrativeFileName: varchar("narrative_file_name", { length: 255 }),
  startDate: date("start_date"),
  endDate: date("end_date"),
  amount: numeric("amount", { precision: 12, scale: 2 }),
  learnerCount: integer("learner_count"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const insertFundingSourceSchema = createInsertSchema(fundingSourcesTable).omit({ id: true, orgId: true, createdAt: true, updatedAt: true, narrativeFile: true, narrativeFileName: true });
export type InsertFundingSource = z.infer<typeof insertFundingSourceSchema>;
export type FundingSource = typeof fundingSourcesTable.$inferSelect;

// Funding Source Learners Join Table
export const fundingSourceLearnersTable = pgTable("funding_source_learners", {
  id: serial("id").primaryKey(),
  fundingSourceId: integer("funding_source_id").notNull().references(() => fundingSourcesTable.id, { onDelete: "cascade" }),
  learnerId: integer("learner_id").notNull().references(() => learnersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const insertFundingSourceLearnerSchema = createInsertSchema(fundingSourceLearnersTable).omit({ id: true, createdAt: true });
export type InsertFundingSourceLearner = z.infer<typeof insertFundingSourceLearnerSchema>;
export type FundingSourceLearner = typeof fundingSourceLearnersTable.$inferSelect;

// Funding Source Programs Join Table
export const fundingSourceProgramsTable = pgTable("funding_source_programs", {
  id: serial("id").primaryKey(),
  fundingSourceId: integer("funding_source_id").notNull().references(() => fundingSourcesTable.id, { onDelete: "cascade" }),
  programId: integer("program_id").notNull().references(() => programsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const insertFundingSourceProgramSchema = createInsertSchema(fundingSourceProgramsTable).omit({ id: true, createdAt: true });
export type InsertFundingSourceProgram = z.infer<typeof insertFundingSourceProgramSchema>;
export type FundingSourceProgram = typeof fundingSourceProgramsTable.$inferSelect;

// Funding Source Pathways Join Table
export const fundingSourcePathwaysTable = pgTable("funding_source_pathways", {
  id: serial("id").primaryKey(),
  fundingSourceId: integer("funding_source_id").notNull().references(() => fundingSourcesTable.id, { onDelete: "cascade" }),
  pathwayId: integer("pathway_id").notNull().references(() => pathwaysTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const insertFundingSourcePathwaySchema = createInsertSchema(fundingSourcePathwaysTable).omit({ id: true, createdAt: true });
export type InsertFundingSourcePathway = z.infer<typeof insertFundingSourcePathwaySchema>;
export type FundingSourcePathway = typeof fundingSourcePathwaysTable.$inferSelect;

// Funding Source Goals Table
export const fundingSourceGoalsTable = pgTable("funding_source_goals", {
  id: serial("id").primaryKey(),
  fundingSourceId: integer("funding_source_id").notNull().references(() => fundingSourcesTable.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  note: text("note"),
  status: varchar("status", { length: 50 }).notNull().default("not_started"),
  documentFile: bytea("document_file"),
  documentFileName: varchar("document_file_name", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const insertFundingSourceGoalSchema = createInsertSchema(fundingSourceGoalsTable).omit({ id: true, createdAt: true, updatedAt: true, documentFile: true, documentFileName: true });
export type InsertFundingSourceGoal = z.infer<typeof insertFundingSourceGoalSchema>;
export type FundingSourceGoal = typeof fundingSourceGoalsTable.$inferSelect;

// Success Stories Table
export const successStoriesTable = pgTable("success_stories", {
  id: serial("id").primaryKey(),
  learnerId: integer("learner_id").references(() => learnersTable.id, { onDelete: "set null" }),
  learnerName: varchar("learner_name", { length: 255 }).notNull(),
  headline: varchar("headline", { length: 255 }).notNull(),
  story: text("story").notNull(),
  dataPoints: jsonb("data_points"),
  tags: jsonb("tags"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const insertSuccessStorySchema = createInsertSchema(successStoriesTable).omit({ id: true, createdAt: true });
export type InsertSuccessStory = z.infer<typeof insertSuccessStorySchema>;
export type SuccessStory = typeof successStoriesTable.$inferSelect;

// Learner Statuses Table
export const learnerStatusesTable = pgTable("learner_statuses", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
});
export type LearnerStatus = typeof learnerStatusesTable.$inferSelect;

// Pathway Programs Join Table
export const pathwayProgramsTable = pgTable("pathway_programs", {
  id: serial("id").primaryKey(),
  pathwayId: integer("pathway_id").notNull().references(() => pathwaysTable.id, { onDelete: "cascade" }),
  programId: integer("program_id").notNull().references(() => programsTable.id, { onDelete: "cascade" }),
});
export type PathwayProgram = typeof pathwayProgramsTable.$inferSelect;

// Audit Log Table
export const auditLogTable = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  action: varchar("action", { length: 20 }).notNull(), // created, updated, deleted
  entityType: varchar("entity_type", { length: 50 }).notNull(), // learner, program, pathway, funding_source, etc.
  entityId: integer("entity_id"),
  entityName: varchar("entity_name", { length: 255 }),
  userEmail: varchar("user_email", { length: 255 }),
  details: text("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
export type AuditLog = typeof auditLogTable.$inferSelect;
