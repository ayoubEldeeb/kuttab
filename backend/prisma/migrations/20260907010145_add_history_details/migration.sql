-- AlterTable
ALTER TABLE "History" ADD COLUMN "fromPart" TEXT;
ALTER TABLE "History" ADD COLUMN "nextReviewDate" DATETIME;
ALTER TABLE "History" ADD COLUMN "nextReviewFrom" TEXT;
ALTER TABLE "History" ADD COLUMN "nextReviewTo" TEXT;
ALTER TABLE "History" ADD COLUMN "toPart" TEXT;
ALTER TABLE "History" ADD COLUMN "type" TEXT;
