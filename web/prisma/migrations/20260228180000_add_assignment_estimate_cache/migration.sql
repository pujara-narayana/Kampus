-- CreateTable
CREATE TABLE "assignment_estimate_cache" (
    "content_hash" VARCHAR(64) NOT NULL,
    "estimated_hours" DECIMAL(4,1) NOT NULL,
    "ai_study_tip" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignment_estimate_cache_pkey" PRIMARY KEY ("content_hash")
);
