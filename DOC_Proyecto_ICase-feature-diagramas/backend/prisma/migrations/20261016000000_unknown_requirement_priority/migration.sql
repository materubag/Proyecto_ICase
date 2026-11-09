-- Preserve existing priorities. Only future unspecified values become unknown.
ALTER TABLE "requirement_candidates" ALTER COLUMN "priority" DROP DEFAULT;
ALTER TABLE "requirement_candidates" ALTER COLUMN "priority" DROP NOT NULL;
ALTER TABLE "requirements" ALTER COLUMN "priority" DROP DEFAULT;
ALTER TABLE "requirements" ALTER COLUMN "priority" DROP NOT NULL;
