-- Additive migration: legacy rows retain NULL until a reviewed consolidation.
ALTER TABLE "requirement_candidates" ADD COLUMN "canonicalKey" TEXT;
ALTER TABLE "requirements" ADD COLUMN "canonicalKey" TEXT;
DROP INDEX "requirement_candidates_promotedRequirementId_key";
CREATE INDEX "requirement_candidates_promotedRequirementId_idx" ON "requirement_candidates"("promotedRequirementId");
CREATE UNIQUE INDEX "requirement_candidates_projectId_canonicalKey_key" ON "requirement_candidates"("projectId", "canonicalKey");
CREATE UNIQUE INDEX "requirements_projectId_canonicalKey_key" ON "requirements"("projectId", "canonicalKey");
