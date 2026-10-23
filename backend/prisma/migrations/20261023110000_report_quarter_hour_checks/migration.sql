-- Enforce the report form's quarter-hour precision for direct API/database writes too.
ALTER TABLE "ReportTask"
  ADD CONSTRAINT "ReportTask_plannedHours_quarter_check"
    CHECK ("plannedHours" * 4 = ROUND("plannedHours" * 4)),
  ADD CONSTRAINT "ReportTask_spentHours_quarter_check"
    CHECK ("spentHours" * 4 = ROUND("spentHours" * 4));

ALTER TABLE "NextWeekTask"
  ADD CONSTRAINT "NextWeekTask_estimatedHours_quarter_check"
    CHECK (
      "estimatedHours" IS NULL OR
      "estimatedHours" * 4 = ROUND("estimatedHours" * 4)
    );

ALTER TABLE "TimeEntry"
  ADD CONSTRAINT "TimeEntry_hours_quarter_check"
    CHECK ("hours" * 4 = ROUND("hours" * 4));
