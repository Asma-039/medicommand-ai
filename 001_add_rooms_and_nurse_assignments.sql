-- =====================================================================
-- migrations/001_add_rooms_and_nurse_assignments.sql
--
-- ONLY for a database that was created with the OLDER scripts (9 tables,
-- beds linked directly to wards). It upgrades that database to the
-- current design (11 tables: rooms and nurse assignments added).
--
-- A fresh install does NOT need this file: 01_schema.sql ... 05_seed_data.sql
-- already create the final design.
--
-- Run each PART one after the other, in order, ONE TIME ONLY.
-- Tested on PostgreSQL 16: upgraded database == fresh install.
-- =====================================================================

-- PART 1 of 6: create rooms and give every bed a room (nothing is removed yet)
CREATE TABLE rooms (
    room_id      SERIAL       PRIMARY KEY,
    ward_id      INT          NOT NULL
                 REFERENCES wards (ward_id)
                 ON UPDATE CASCADE ON DELETE CASCADE,
    room_number  VARCHAR(10)  NOT NULL,
    room_type    VARCHAR(10)  NOT NULL DEFAULT 'Shared'
                 CHECK (room_type IN ('Private', 'Shared', 'ICU')),
    CONSTRAINT uq_room_number_per_ward UNIQUE (ward_id, room_number)
);

CREATE INDEX idx_rooms_ward ON rooms (ward_id);

ALTER TABLE beds
    ADD COLUMN room_id INT
    REFERENCES rooms (room_id) ON UPDATE CASCADE ON DELETE CASCADE;

-- Plan: ICU wards get 1 bed per room, all other wards get 2 beds per room.
CREATE TABLE _bed_room_plan AS
SELECT bed_id, ward_id, ward_type, room_no,
       MIN(prefix) OVER (PARTITION BY ward_id, room_no) || '-R' || room_no AS room_number
FROM (
    SELECT b.bed_id, b.ward_id, w.ward_type,
           split_part(b.bed_number, '-', 1) AS prefix,
           ((ROW_NUMBER() OVER (PARTITION BY b.ward_id ORDER BY b.bed_id) - 1)
              / CASE WHEN w.ward_type = 'ICU' THEN 1 ELSE 2 END) + 1 AS room_no
    FROM beds b
    JOIN wards w ON w.ward_id = b.ward_id
) s;

INSERT INTO rooms (ward_id, room_number, room_type)
SELECT ward_id, room_number, CASE WHEN ward_type = 'ICU' THEN 'ICU' ELSE 'Shared' END
FROM _bed_room_plan
GROUP BY ward_id, room_no, room_number, ward_type
ORDER BY ward_id, room_no;

UPDATE beds b
   SET room_id = r.room_id
  FROM _bed_room_plan p
  JOIN rooms r ON r.ward_id = p.ward_id AND r.room_number = p.room_number
 WHERE b.bed_id = p.bed_id;

DROP TABLE _bed_room_plan;

-- PART 2 of 6: move the ward link from beds to rooms
-- (a bed now finds its ward through its room)
DROP VIEW IF EXISTS v_ward_forecast;
DROP VIEW IF EXISTS v_current_patients;
DROP VIEW IF EXISTS v_ward_occupancy;

ALTER TABLE beds ALTER COLUMN room_id SET NOT NULL;
ALTER TABLE beds DROP COLUMN ward_id;
ALTER TABLE beds ADD CONSTRAINT uq_bed_number_per_room UNIQUE (room_id, bed_number);
CREATE INDEX idx_beds_room ON beds (room_id);

CREATE OR REPLACE FUNCTION ward_occupancy_pct(p_ward_id INT)
RETURNS NUMERIC
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(
               ROUND(100.0 * COUNT(*) FILTER (WHERE b.status = 'occupied')
                           / NULLIF(COUNT(*), 0), 2),
               0)
    FROM beds  b
    JOIN rooms r ON r.room_id = b.room_id
    WHERE r.ward_id = p_ward_id;
$$;

-- PART 3 of 6: recreate the views so they go through rooms, and add the bed map
CREATE OR REPLACE VIEW v_ward_occupancy AS
SELECT  w.ward_id,
        w.name                                              AS ward_name,
        w.ward_type,
        d.name                                              AS department,
        COUNT(b.bed_id)                                     AS total_beds,
        COUNT(*) FILTER (WHERE b.status = 'occupied')       AS occupied_beds,
        COUNT(*) FILTER (WHERE b.status = 'available')      AS available_beds,
        COALESCE(ROUND(100.0 * COUNT(*) FILTER (WHERE b.status = 'occupied')
                       / NULLIF(COUNT(b.bed_id), 0), 2), 0) AS occupancy_pct
FROM    wards       w
JOIN    departments d ON d.department_id = w.department_id
LEFT JOIN rooms     r ON r.ward_id       = w.ward_id
LEFT JOIN beds      b ON b.room_id       = r.room_id
GROUP BY w.ward_id, w.name, w.ward_type, d.name;

CREATE OR REPLACE VIEW v_current_patients AS
SELECT  a.admission_id,
        p.patient_id,
        p.full_name                                        AS patient_name,
        EXTRACT(YEAR FROM age(CURRENT_DATE, p.date_of_birth))::INT AS age,
        p.gender,
        w.name                                             AS ward_name,
        r.room_number,
        b.bed_number,
        s.full_name                                        AS doctor_name,
        a.diagnosis,
        a.severity,
        a.admitted_at,
        ROUND(EXTRACT(EPOCH FROM (now() - a.admitted_at)) / 86400, 1) AS days_admitted
FROM    admissions a
JOIN    patients   p ON p.patient_id = a.patient_id
JOIN    beds       b ON b.bed_id     = a.bed_id
JOIN    rooms      r ON r.room_id    = b.room_id
JOIN    wards      w ON w.ward_id    = r.ward_id
JOIN    staff      s ON s.staff_id   = a.doctor_id
WHERE   a.discharged_at IS NULL;

CREATE OR REPLACE VIEW v_ward_forecast AS
SELECT  w.ward_id,
        w.name                      AS ward_name,
        ap.forecast_date,
        ap.predicted_occupancy_pct,
        ap.model_name,
        wo.occupancy_pct            AS current_occupancy_pct,
        ap.predicted_occupancy_pct - wo.occupancy_pct AS expected_change
FROM    ai_predictions  ap
JOIN    wards           w  ON w.ward_id  = ap.ward_id
JOIN    v_ward_occupancy wo ON wo.ward_id = w.ward_id
WHERE   ap.forecast_date >= CURRENT_DATE;

CREATE OR REPLACE VIEW v_bed_map AS
SELECT  w.ward_id,
        w.name          AS ward_name,
        r.room_number,
        r.room_type,
        b.bed_id,
        b.bed_number,
        b.status        AS bed_status,
        p.full_name     AS patient_name,
        a.severity
FROM    wards  w
JOIN    rooms  r ON r.ward_id = w.ward_id
JOIN    beds   b ON b.room_id = r.room_id
LEFT JOIN admissions a ON a.bed_id = b.bed_id AND a.discharged_at IS NULL
LEFT JOIN patients   p ON p.patient_id = a.patient_id
ORDER BY w.ward_id, r.room_number, b.bed_number;

-- PART 4 of 6: update the two triggers that used to read the ward from the bed
CREATE OR REPLACE FUNCTION on_admission_created()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_ward_id INT;
    v_pct     NUMERIC;
BEGIN
    UPDATE beds
       SET status = 'occupied'
     WHERE bed_id = NEW.bed_id;

    SELECT r.ward_id INTO v_ward_id
      FROM beds  b
      JOIN rooms r ON r.room_id = b.room_id
     WHERE b.bed_id = NEW.bed_id;

    IF NEW.severity = 'Critical' THEN
        INSERT INTO alerts (ward_id, admission_id, alert_type, priority, message)
        VALUES (v_ward_id, NEW.admission_id, 'Critical Patient', 'Critical',
                'Critical patient admitted: ' || NEW.diagnosis);
    END IF;

    v_pct := ward_occupancy_pct(v_ward_id);

    IF v_pct >= 90
       AND NOT EXISTS (SELECT 1
                         FROM alerts
                        WHERE ward_id    = v_ward_id
                          AND alert_type = 'High Occupancy'
                          AND resolved_at IS NULL)
    THEN
        INSERT INTO alerts (ward_id, alert_type, priority, message)
        VALUES (v_ward_id, 'High Occupancy', 'High',
                'Ward occupancy reached ' || ROUND(v_pct) || '%');
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION on_admission_discharged()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_ward_id INT;
BEGIN
    UPDATE beds
       SET status = 'cleaning'
     WHERE bed_id = NEW.bed_id;

    SELECT r.ward_id INTO v_ward_id
      FROM beds  b
      JOIN rooms r ON r.room_id = b.room_id
     WHERE b.bed_id = NEW.bed_id;

    UPDATE alerts
       SET resolved_at = now()
     WHERE admission_id = NEW.admission_id
       AND resolved_at IS NULL;

    IF ward_occupancy_pct(v_ward_id) < 90 THEN
        UPDATE alerts
           SET resolved_at = now()
         WHERE ward_id    = v_ward_id
           AND alert_type = 'High Occupancy'
           AND resolved_at IS NULL;
    END IF;

    RETURN NEW;
END;
$$;

-- PART 5 of 6: nurse assignments (table, rule trigger and helper function)
CREATE TABLE nurse_assignments (
    assignment_id  SERIAL       PRIMARY KEY,
    admission_id   INT          NOT NULL
                   REFERENCES admissions (admission_id)
                   ON UPDATE CASCADE ON DELETE CASCADE,
    nurse_id       INT          NOT NULL
                   REFERENCES staff (staff_id)
                   ON UPDATE CASCADE ON DELETE RESTRICT,
    shift_date     DATE         NOT NULL,
    shift_type     VARCHAR(10)  NOT NULL
                   CHECK (shift_type IN ('Morning', 'Evening', 'Night')),
    CONSTRAINT uq_one_nurse_per_patient_shift UNIQUE (admission_id, shift_date, shift_type)
);

CREATE INDEX idx_nurse_assign_nurse ON nurse_assignments (nurse_id, shift_date, shift_type);

CREATE OR REPLACE FUNCTION check_nurse_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_role       VARCHAR(20);
    v_ward_id    INT;
    v_discharged TIMESTAMPTZ;
    v_patients   INT;
BEGIN
    SELECT role INTO v_role FROM staff WHERE staff_id = NEW.nurse_id;
    IF v_role IS DISTINCT FROM 'Nurse' THEN
        RAISE EXCEPTION 'Staff member % is not a nurse and cannot be assigned to a patient',
                        NEW.nurse_id;
    END IF;

    SELECT r.ward_id, a.discharged_at
      INTO v_ward_id, v_discharged
      FROM admissions a
      JOIN beds  b ON b.bed_id  = a.bed_id
      JOIN rooms r ON r.room_id = b.room_id
     WHERE a.admission_id = NEW.admission_id;

    IF v_ward_id IS NULL THEN
        RAISE EXCEPTION 'Admission % does not exist', NEW.admission_id;
    END IF;
    IF v_discharged IS NOT NULL THEN
        RAISE EXCEPTION 'Admission % is already discharged', NEW.admission_id;
    END IF;

    IF NOT EXISTS (SELECT 1
                     FROM shifts
                    WHERE staff_id   = NEW.nurse_id
                      AND ward_id    = v_ward_id
                      AND shift_date = NEW.shift_date
                      AND shift_type = NEW.shift_type)
    THEN
        RAISE EXCEPTION 'Nurse % is not on the % shift on % in the ward of admission %',
                        NEW.nurse_id, NEW.shift_type, NEW.shift_date, NEW.admission_id;
    END IF;

    SELECT COUNT(*) INTO v_patients
      FROM nurse_assignments na
      JOIN admissions a ON a.admission_id = na.admission_id
     WHERE na.nurse_id      = NEW.nurse_id
       AND na.shift_date    = NEW.shift_date
       AND na.shift_type    = NEW.shift_type
       AND a.discharged_at IS NULL
       AND na.assignment_id IS DISTINCT FROM NEW.assignment_id;

    IF v_patients >= 6 THEN
        RAISE EXCEPTION 'Nurse % already has % patients on the % shift on % (maximum is 6)',
                        NEW.nurse_id, v_patients, NEW.shift_type, NEW.shift_date;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_nurse_assignment
BEFORE INSERT OR UPDATE OF nurse_id, admission_id, shift_date, shift_type ON nurse_assignments
FOR EACH ROW
EXECUTE FUNCTION check_nurse_assignment();

CREATE OR REPLACE FUNCTION assign_nurse(
    p_admission_id INT,
    p_nurse_id     INT,
    p_shift_type   TEXT,
    p_shift_date   DATE DEFAULT CURRENT_DATE
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    v_assignment_id INT;
BEGIN
    INSERT INTO nurse_assignments (admission_id, nurse_id, shift_date, shift_type)
    VALUES (p_admission_id, p_nurse_id, p_shift_date, p_shift_type)
    RETURNING assignment_id INTO v_assignment_id;

    RETURN v_assignment_id;
END;
$$;

-- PART 6 of 6: nurse views and demo assignments for today
CREATE OR REPLACE VIEW v_nurse_workload AS
SELECT  na.shift_date,
        na.shift_type,
        st.staff_id     AS nurse_id,
        st.full_name    AS nurse_name,
        w.name          AS ward_name,
        COUNT(*)        AS patients
FROM    nurse_assignments na
JOIN    staff      st ON st.staff_id     = na.nurse_id
JOIN    admissions a  ON a.admission_id  = na.admission_id AND a.discharged_at IS NULL
JOIN    beds       b  ON b.bed_id        = a.bed_id
JOIN    rooms      r  ON r.room_id       = b.room_id
JOIN    wards      w  ON w.ward_id       = r.ward_id
GROUP BY na.shift_date, na.shift_type, st.staff_id, st.full_name, w.name;

CREATE OR REPLACE VIEW v_patients_without_nurse AS
SELECT  cp.admission_id,
        cp.patient_name,
        cp.ward_name,
        cp.room_number,
        cp.bed_number,
        cp.severity
FROM    v_current_patients cp
WHERE   NOT EXISTS (SELECT 1
                      FROM nurse_assignments na
                     WHERE na.admission_id = cp.admission_id
                       AND na.shift_date   = CURRENT_DATE);

CREATE OR REPLACE PROCEDURE seed_todays_shifts()
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO shifts (staff_id, ward_id, shift_date, shift_type) VALUES
        ( 1, 1, CURRENT_DATE, 'Morning'),
        ( 7, 1, CURRENT_DATE, 'Morning'),
        ( 2, 2, CURRENT_DATE, 'Morning'),
        ( 3, 3, CURRENT_DATE, 'Morning'),
        ( 9, 3, CURRENT_DATE, 'Morning'),
        ( 4, 4, CURRENT_DATE, 'Morning'),
        ( 8, 4, CURRENT_DATE, 'Morning'),
        (11, 4, CURRENT_DATE, 'Morning'),
        ( 5, 5, CURRENT_DATE, 'Morning'),
        (10, 5, CURRENT_DATE, 'Morning'),
        ( 6, 6, CURRENT_DATE, 'Morning'),
        (10, 6, CURRENT_DATE, 'Evening')
    ON CONFLICT (staff_id, shift_date, shift_type) DO NOTHING;

    INSERT INTO nurse_assignments (admission_id, nurse_id, shift_date, shift_type)
    SELECT a.admission_id, sh.staff_id, sh.shift_date, sh.shift_type
    FROM   admissions a
    JOIN   beds   b  ON b.bed_id    = a.bed_id
    JOIN   rooms  r  ON r.room_id   = b.room_id
    JOIN   shifts sh ON sh.ward_id  = r.ward_id
                    AND sh.shift_date = CURRENT_DATE
    JOIN   staff  st ON st.staff_id = sh.staff_id
                    AND st.role     = 'Nurse'
    WHERE  a.discharged_at IS NULL
    ON CONFLICT (admission_id, shift_date, shift_type) DO NOTHING;
END;
$$;

CALL seed_todays_shifts();

-- Check 1: nurses and how many patients each one has today (5 or 6 rows).
SELECT * FROM v_nurse_workload WHERE shift_date = CURRENT_DATE ORDER BY nurse_name;

-- Check 2: patients with no nurse today (4 rows, all in the Cardiac Care Unit).
SELECT * FROM v_patients_without_nurse ORDER BY admission_id;

