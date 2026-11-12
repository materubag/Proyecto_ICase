-- Additive: existing projects and approvals are retained, but require workflow review.
CREATE TABLE "DocumentWorkflow" (
  "projectId" TEXT PRIMARY KEY, "revision" INTEGER NOT NULL DEFAULT 0,
  "state" JSONB NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "DocumentWorkflowCall" (
  "id" TEXT PRIMARY KEY, "projectId" TEXT NOT NULL, "cacheKey" TEXT NOT NULL,
  "stage" TEXT NOT NULL, "task" TEXT NOT NULL, "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'RUNNING',
  "inputVersions" JSONB NOT NULL, "response" JSONB, "usage" JSONB, "error" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "DocumentWorkflowCall_cacheKey_key" ON "DocumentWorkflowCall"("cacheKey");
CREATE INDEX "DocumentWorkflowCall_projectId_status_idx" ON "DocumentWorkflowCall"("projectId", "status");
