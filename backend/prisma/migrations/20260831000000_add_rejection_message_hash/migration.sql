-- Admin's explanation for a rejection, shown to the submitter, and a hash of the
-- user-editable fields as they stood when rejected. The hash gates resubmission:
-- a reading must actually change before it returns to the pending queue.
ALTER TABLE "submissions" ADD COLUMN "rejection_message" TEXT;
ALTER TABLE "submissions" ADD COLUMN "rejection_hash" TEXT;
