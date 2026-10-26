# Normalization

This document shows how the schema was derived and why every table is in Third Normal Form (3NF) and Boyce-Codd Normal Form (BCNF).

## 1. Starting point: one flat table

A first, naive design stores everything in a single table:

```
hospital_record(patient_name, date_of_birth, phone, blood_group,
                bed_number, bed_status, room_number, room_type,
                ward_name, ward_type, department_name, floor_no,
                doctor_name, doctor_email, doctor_role,
                nurse_name, nurse_email,
                diagnosis, severity, admitted_at, discharged_at)
```

This design causes three kinds of anomaly:

| Anomaly | Example |
|---|---|
| Update | Moving the Cardiology department to another floor means editing every patient row in that department. |
| Insertion | A new room or bed cannot be stored until a patient is admitted to it. |
| Deletion | Deleting the last patient of a ward also deletes the only record that the ward exists. |

## 2. Functional dependencies found

| Determinant | Determines |
|---|---|
| `patient_id` | name, date of birth, gender, blood group, phone |
| `department_id` | department name, floor |
| `ward_id` | ward name, ward type, `department_id` |
| `room_id` | `ward_id`, room number, room type |
| `bed_id` | `room_id`, bed number, bed status |
| `staff_id` | `department_id`, name, role, email, phone |
| `admission_id` | `patient_id`, `bed_id`, `doctor_id`, admitted/discharged time, diagnosis, severity |
| `(staff_id, shift_date, shift_type)` | `ward_id` |
| `(admission_id, shift_date, shift_type)` | `nurse_id` |
| `alert_id` | ward, admission, type, priority, message, created/resolved time |
| `(ward_id, forecast_date, model_name)` | predicted occupancy |

## 3. Normal forms step by step

**First Normal Form (1NF).** Every column holds one atomic value and every table has a primary key. A doctor's name, a bed number and a diagnosis are separate columns, and there are no repeating groups such as `bed1, bed2, bed3`.

**Second Normal Form (2NF).** There are no partial dependencies. Tables with a single-column key (`SERIAL` surrogate keys) cannot have one. In `shifts` and `nurse_assignments` the surrogate key is the primary key, and the composite candidate keys determine `ward_id` and `nurse_id` as a whole, not in part.

**Third Normal Form (3NF).** There are no transitive dependencies. In the flat table, `admission → bed → room → ward → department → floor` was a chain. Splitting it into `admissions`, `beds`, `rooms`, `wards` and `departments` means each fact is stored once. The same applies to the doctor details, which moved to `staff`.

**BCNF.** For every dependency `X → Y` in a table, `X` is a candidate key of that table.

| Table | Determinants | Candidate keys | BCNF? |
|---|---|---|---|
| departments | `department_id`, `name` | `department_id`, `name` (UNIQUE) | Yes |
| wards | `ward_id`, `(department_id, name)` | same | Yes |
| rooms | `room_id`, `(ward_id, room_number)` | same | Yes |
| beds | `bed_id`, `(room_id, bed_number)` | same | Yes |
| staff | `staff_id`, `email` | same | Yes |
| patients | `patient_id` | `patient_id` | Yes |
| admissions | `admission_id` | `admission_id` | Yes |
| shifts | `shift_id`, `(staff_id, shift_date, shift_type)` | same | Yes |
| nurse_assignments | `assignment_id`, `(admission_id, shift_date, shift_type)` | same | Yes |
| alerts | `alert_id` | `alert_id` | Yes |
| ai_predictions | `prediction_id`, `(ward_id, forecast_date, model_name)` | same | Yes |

## 4. Design decisions that keep the schema clean

- **Rooms keep beds out of trouble.** A bed stores only its `room_id`. If `beds` also stored `ward_id`, the chain `bed → room → ward` would be a transitive dependency and break 3NF, so the ward is found through the room.
- **Derived data is not stored.** A patient's age is calculated from `date_of_birth`, and the number of beds in a ward or room is counted in the views.
- **No `status` column in `admissions`.** Whether a patient is still admitted follows from `discharged_at IS NULL`. Storing both would create the dependency `discharged_at → status`, which breaks 3NF.
- **Many-to-many relationships resolved.** Staff and wards are related many-to-many, so the `shifts` table links them. Admissions and nurses are related many-to-many (one patient, several nurses over several shifts), so `nurse_assignments` links them.

## 5. Controlled redundancy (be ready to explain this)

Two places repeat information on purpose, and triggers keep them correct:

1. `beds.status = 'occupied'` can also be found from an open row in `admissions`. It is kept so the dashboard can read bed state without a join. Triggers `trg_admission_created` and `trg_admission_discharged` update it automatically.
2. `alerts.ward_id` can be derived from `alerts.admission_id` through the bed and room, but many alerts (for example high occupancy) have no admission, so the ward must be stored.

This redundancy is across tables, not inside one table, so it does not break 3NF or BCNF. It is a deliberate trade-off of a little redundancy for faster reads.

## 6. Rules that normalization alone cannot express

Some rules involve several tables, so a `CHECK` constraint cannot hold them. They are enforced by triggers instead:

- `trg_check_nurse_assignment` makes sure the assigned person is a nurse, that the patient is still admitted, that the nurse is rostered in the patient's ward on that shift (a lookup in `shifts`), and that she has at most 6 patients per shift.
- `trg_check_admission` makes sure the bed is free and that the attending staff member is a doctor.
