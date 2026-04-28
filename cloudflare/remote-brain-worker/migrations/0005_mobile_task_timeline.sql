ALTER TABLE mobile_task_schedule ADD COLUMN owner_uid TEXT NOT NULL DEFAULT '';
ALTER TABLE mobile_task_schedule ADD COLUMN kind TEXT NOT NULL DEFAULT 'todo';
ALTER TABLE mobile_task_schedule ADD COLUMN end_time TEXT;
ALTER TABLE mobile_task_schedule ADD COLUMN note TEXT;
ALTER TABLE mobile_task_schedule ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';

CREATE INDEX IF NOT EXISTS idx_mobile_task_schedule_owner_time
  ON mobile_task_schedule(owner_uid, start_time);
