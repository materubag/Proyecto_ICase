CREATE TABLE "DeliveryWorkflow" (
  "projectId" TEXT PRIMARY KEY, "revision" INTEGER NOT NULL DEFAULT 0,
  "state" JSONB NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "DeliveryJob" (
  "id" TEXT PRIMARY KEY, "projectId" TEXT NOT NULL, "task" TEXT NOT NULL,
  "target" TEXT NOT NULL, "inputHash" TEXT NOT NULL, "cacheKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'QUEUED', "request" JSONB NOT NULL, "result" JSONB,
  "error" TEXT, "logs" JSONB NOT NULL, "attempts" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "DeliveryJob_cacheKey_key" ON "DeliveryJob"("cacheKey");
CREATE INDEX "DeliveryJob_projectId_status_idx" ON "DeliveryJob"("projectId", "status");
CREATE TABLE "DeliveryCall" (
  "id" TEXT PRIMARY KEY, "projectId" TEXT NOT NULL, "cacheKey" TEXT NOT NULL,
  "task" TEXT NOT NULL, "target" TEXT NOT NULL, "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'RUNNING',
  "request" JSONB NOT NULL, "response" JSONB, "usage" JSONB, "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "DeliveryCall_cacheKey_key" ON "DeliveryCall"("cacheKey");
CREATE INDEX "DeliveryCall_projectId_status_idx" ON "DeliveryCall"("projectId", "status");
