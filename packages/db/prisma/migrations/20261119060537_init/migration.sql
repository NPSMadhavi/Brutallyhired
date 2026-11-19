-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('GOOGLE', 'MICROSOFT', 'LINKEDIN', 'EMAIL');

-- CreateEnum
CREATE TYPE "LinkIntentKind" AS ENUM ('LINK_EXISTING', 'VERIFY_EMAIL');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('ADMIN', 'RECRUITER', 'INTERVIEWER');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "RequirementKind" AS ENUM ('HARD', 'PREFERRED');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('TEXT', 'SINGLE_CHOICE', 'NUMBER');

-- CreateEnum
CREATE TYPE "ExperienceBand" AS ENUM ('LT_2', 'Y2_5', 'Y6_10', 'GT_10');

-- CreateEnum
CREATE TYPE "NoticePeriod" AS ENUM ('IMMEDIATE', 'D15', 'D30', 'D60', 'D90', 'OVER_90');

-- CreateEnum
CREATE TYPE "FilePurpose" AS ENUM ('RESUME', 'COVER_LETTER', 'ONBOARDING_DOCUMENT', 'OFFER_LETTER', 'PROCTOR_RECORDING');

-- CreateEnum
CREATE TYPE "ApplicationStage" AS ENUM ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'ASSESSMENT', 'INTERVIEW', 'OFFER', 'ONBOARDING', 'HIRED', 'NOT_SELECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "EventVisibility" AS ENUM ('PUBLIC', 'INTERNAL');

-- CreateEnum
CREATE TYPE "OverrideDecision" AS ENUM ('ADVANCE', 'HOLD', 'NOT_SELECTED');

-- CreateEnum
CREATE TYPE "AssessmentQuestionType" AS ENUM ('SINGLE_CHOICE', 'MULTI_CHOICE', 'TEXT');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('INVITED', 'IN_PROGRESS', 'SUBMITTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CaptureKind" AS ENUM ('CAMERA', 'SCREEN');

-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('AWAITING_BOOKING', 'SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'DECLINED', 'WITHDRAWN', 'EXPIRED');

-- CreateEnum
CREATE TYPE "OnboardingTaskStatus" AS ENUM ('PENDING', 'SUBMITTED', 'VERIFIED', 'REJECTED');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "brandColor" TEXT NOT NULL DEFAULT '#2F5BEA',
    "careersUrl" TEXT,
    "privacyNoticeUrl" TEXT,
    "termsUrl" TEXT,
    "supportEmail" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "eligibilityThreshold" INTEGER NOT NULL DEFAULT 60,
    "talentPoolMonths" INTEGER NOT NULL DEFAULT 12,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "displayName" TEXT,
    "locale" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Identity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "subject" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Identity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailCode" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthFlow" (
    "id" TEXT NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "nonce" TEXT NOT NULL,
    "codeVerifier" TEXT,
    "returnTo" TEXT NOT NULL,
    "linkUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthFlow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkIntent" (
    "id" TEXT NOT NULL,
    "kind" "LinkIntentKind" NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "subject" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "returnTo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "LinkIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "externalRef" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "department" TEXT,
    "location" TEXT NOT NULL,
    "employmentType" TEXT NOT NULL,
    "workplaceType" TEXT,
    "experienceText" TEXT,
    "summary" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "assessmentTemplateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobRequirement" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" "RequirementKind" NOT NULL,
    "keywords" TEXT[],
    "weight" INTEGER NOT NULL DEFAULT 1,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "JobRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobQuestion" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "helpText" TEXT,
    "type" "QuestionType" NOT NULL,
    "options" TEXT[],
    "required" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "JobQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "city" TEXT,
    "experience" "ExperienceBand",
    "noticePeriod" "NoticePeriod",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileObject" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "purpose" "FilePurpose" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recruiterUserId" TEXT,
    "stage" "ApplicationStage" NOT NULL DEFAULT 'DRAFT',
    "jobVersion" INTEGER NOT NULL,
    "resumeFileId" TEXT,
    "resumeReadStatus" TEXT NOT NULL DEFAULT 'NONE',
    "resumeSummary" JSONB,
    "resumeText" TEXT,
    "coverLetterText" TEXT,
    "coverLetterFileId" TEXT,
    "consentAccuracy" BOOLEAN NOT NULL DEFAULT false,
    "consentPrivacy" BOOLEAN NOT NULL DEFAULT false,
    "talentPoolUntil" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationAnswer" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "ApplicationAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationEvent" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "visibility" "EventVisibility" NOT NULL,
    "data" JSONB,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationScore" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "breakdown" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "missingInformation" TEXT[],
    "jobVersion" INTEGER NOT NULL,
    "rubricVersion" TEXT NOT NULL,
    "modelVersion" TEXT,
    "belowThreshold" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EligibilityOverride" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "staffUserId" TEXT NOT NULL,
    "decision" "OverrideDecision" NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EligibilityOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "durationMinutes" INTEGER NOT NULL,
    "proctored" BOOLEAN NOT NULL DEFAULT true,
    "topics" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentQuestion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "type" "AssessmentQuestionType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "options" TEXT[],
    "correct" INTEGER[],
    "points" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "AssessmentQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentInvite" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'INVITED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentAttempt" (
    "id" TEXT NOT NULL,
    "inviteId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "answers" JSONB,
    "autoScore" DOUBLE PRECISION,

    CONSTRAINT "AssessmentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProctoringEvent" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "detail" JSONB,

    CONSTRAINT "ProctoringEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProctoringChunk" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "kind" "CaptureKind" NOT NULL,
    "seq" INTEGER NOT NULL,
    "fileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProctoringChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewRound" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "preparation" TEXT,
    "durationMinutes" INTEGER NOT NULL,
    "status" "InterviewStatus" NOT NULL DEFAULT 'AWAITING_BOOKING',
    "bookByAt" TIMESTAMP(3),
    "scheduledStart" TIMESTAMP(3),
    "scheduledEnd" TIMESTAMP(3),
    "roomName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewPanelist" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "staffUserId" TEXT,

    CONSTRAINT "InterviewPanelist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewSlot" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "bookedAt" TIMESTAMP(3),

    CONSTRAINT "InterviewSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RescheduleRequest" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RescheduleRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "status" "OfferStatus" NOT NULL DEFAULT 'DRAFT',
    "terms" JSONB NOT NULL,
    "message" TEXT,
    "letterFileId" TEXT,
    "respondBy" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "signatureName" TEXT,
    "signatureIp" TEXT,
    "declineReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingTemplateItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OnboardingTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingTask" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "status" "OnboardingTaskStatus" NOT NULL DEFAULT 'PENDING',
    "fileId" TEXT,
    "reviewerNote" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "OnboardingTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JoiningDetails" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "arrivalTime" TEXT,
    "location" TEXT NOT NULL,
    "contactName" TEXT,
    "contactTitle" TEXT,
    "whatToBring" TEXT,
    "notes" TEXT,

    CONSTRAINT "JoiningDetails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "applicationId" TEXT,
    "type" TEXT NOT NULL,
    "data" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Identity_userId_idx" ON "Identity"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Identity_provider_subject_key" ON "Identity"("provider", "subject");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "EmailCode_email_createdAt_idx" ON "EmailCode"("email", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StaffMembership_userId_tenantId_key" ON "StaffMembership"("userId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Job_tenantId_externalRef_key" ON "Job"("tenantId", "externalRef");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateProfile_userId_tenantId_key" ON "CandidateProfile"("userId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "FileObject_storageKey_key" ON "FileObject"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "Application_reference_key" ON "Application"("reference");

-- CreateIndex
CREATE INDEX "Application_tenantId_stage_idx" ON "Application"("tenantId", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "Application_jobId_userId_key" ON "Application"("jobId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationAnswer_applicationId_questionId_key" ON "ApplicationAnswer"("applicationId", "questionId");

-- CreateIndex
CREATE INDEX "ApplicationEvent_applicationId_createdAt_idx" ON "ApplicationEvent"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "ApplicationScore_applicationId_createdAt_idx" ON "ApplicationScore"("applicationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentAttempt_inviteId_key" ON "AssessmentAttempt"("inviteId");

-- CreateIndex
CREATE INDEX "ProctoringEvent_attemptId_at_idx" ON "ProctoringEvent"("attemptId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "ProctoringChunk_attemptId_kind_seq_key" ON "ProctoringChunk"("attemptId", "kind", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewRound_roomName_key" ON "InterviewRound"("roomName");

-- CreateIndex
CREATE INDEX "InterviewRound_applicationId_sequence_idx" ON "InterviewRound"("applicationId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewSlot_roundId_startsAt_key" ON "InterviewSlot"("roundId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Offer_applicationId_key" ON "Offer"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "JoiningDetails_applicationId_key" ON "JoiningDetails"("applicationId");

-- CreateIndex
CREATE INDEX "Notification_userId_tenantId_createdAt_idx" ON "Notification"("userId", "tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "Identity" ADD CONSTRAINT "Identity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMembership" ADD CONSTRAINT "StaffMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMembership" ADD CONSTRAINT "StaffMembership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_assessmentTemplateId_fkey" FOREIGN KEY ("assessmentTemplateId") REFERENCES "AssessmentTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobRequirement" ADD CONSTRAINT "JobRequirement_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobQuestion" ADD CONSTRAINT "JobQuestion_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateProfile" ADD CONSTRAINT "CandidateProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateProfile" ADD CONSTRAINT "CandidateProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileObject" ADD CONSTRAINT "FileObject_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileObject" ADD CONSTRAINT "FileObject_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_recruiterUserId_fkey" FOREIGN KEY ("recruiterUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationAnswer" ADD CONSTRAINT "ApplicationAnswer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationAnswer" ADD CONSTRAINT "ApplicationAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "JobQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationEvent" ADD CONSTRAINT "ApplicationEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationScore" ADD CONSTRAINT "ApplicationScore_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EligibilityOverride" ADD CONSTRAINT "EligibilityOverride_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentTemplate" ADD CONSTRAINT "AssessmentTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentQuestion" ADD CONSTRAINT "AssessmentQuestion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AssessmentTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentInvite" ADD CONSTRAINT "AssessmentInvite_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentInvite" ADD CONSTRAINT "AssessmentInvite_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AssessmentTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "AssessmentInvite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProctoringEvent" ADD CONSTRAINT "ProctoringEvent_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "AssessmentAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProctoringChunk" ADD CONSTRAINT "ProctoringChunk_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "AssessmentAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewRound" ADD CONSTRAINT "InterviewRound_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewPanelist" ADD CONSTRAINT "InterviewPanelist_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "InterviewRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewSlot" ADD CONSTRAINT "InterviewSlot_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "InterviewRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RescheduleRequest" ADD CONSTRAINT "RescheduleRequest_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "InterviewRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingTemplateItem" ADD CONSTRAINT "OnboardingTemplateItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingTask" ADD CONSTRAINT "OnboardingTask_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JoiningDetails" ADD CONSTRAINT "JoiningDetails_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
