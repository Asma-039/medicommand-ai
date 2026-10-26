# AI Hospital Command Center

A hospital operations dashboard backed by a normalized PostgreSQL database. It tracks bed capacity across wards, rooms and beds, admitted patients, nurse assignments, staff shifts and critical alerts. New patients are scored by an AI-assisted triage from their vital signs and symptoms, which decides how severe the case is and which doctor takes it. The system also stores AI occupancy forecasts so staff can see problems before they happen.

!\[React](https://img.shields.io/badge/React-18-61DAFB?logo=react\&logoColor=white)
!\[TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript\&logoColor=white)
!\[PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-4169E1?logo=postgresql\&logoColor=white)
!\[Supabase](https://img.shields.io/badge/Supabase-Cloud\_hosted-3ECF8E?logo=supabase\&logoColor=white)
!\[License](https://img.shields.io/badge/License-MIT-blue)

## Problem statement

Hospitals often track beds, patients and staff in separate registers. Bed information goes stale, wards fill up without warning, nobody can tell quickly which nurse is looking after which patient, and critical cases are noticed late. This project keeps all of that in one relational database with rules that stop invalid data, and shows it on a live dashboard.

## What it does

* Models the hospital as department, ward, room and bed, and shows live occupancy per ward
* Admits and discharges patients while enforcing that a bed holds one patient at a time
* **AI-assisted triage:** staff enter heart rate, blood pressure, oxygen level, temperature, breathing rate, consciousness and symptoms. An early-warning score (modelled on NEWS2) sets the severity (Low, Medium, High, Critical) and the department, and the least busy doctor of that department is assigned automatically. Nobody types the severity or picks the doctor by hand
* Assigns nurses to patients for each shift, and only allows a nurse who is rostered in that ward (maximum 6 patients per nurse per shift)
* Raises alerts automatically for critical patients and for wards that reach 90% occupancy
* Schedules staff on shifts and finds wards or patients that have no nurse on duty
* Stores AI occupancy forecasts and compares them with current occupancy
* Keeps all data in a cloud-hosted PostgreSQL database (Supabase)

## Tech stack and database

|Area|Technology|
|-|-|
|**Database**|**PostgreSQL 16 (hosted on Supabase)**|
|Database language|SQL and PL/pgSQL (views, functions, a procedure, triggers)|
|Front end|React 18, TypeScript, Vite|
|Styling and charts|Tailwind CSS, Recharts, Lucide icons|
|State management|Zustand|
|Database client|`@supabase/supabase-js`|

## How it works

```
Browser (React + Vite)  --HTTPS-->  Supabase API  --->  PostgreSQL (tables, views, triggers)
```

The front end reads the views (`v\_ward\_occupancy`, `v\_bed\_map`, `v\_current\_patients`, `v\_open\_alerts`, `v\_ward\_forecast`, `v\_nurse\_workload`, `v\_patients\_without\_nurse`). The business rules live in the database, so they apply no matter which client writes the data.

## ER diagram

!\[ER diagram](docs/er\_diagram.png)

<details>
<summary>Mermaid source (renders on GitHub)</summary>

```mermaid
erDiagram
    DEPARTMENTS ||--o{ WARDS : "has"
    DEPARTMENTS ||--o{ STAFF : "employs"
    WARDS ||--o{ ROOMS : "is made of"
    ROOMS ||--o{ BEDS : "contains"
    WARDS ||--o{ SHIFTS : "is staffed by"
    STAFF ||--o{ SHIFTS : "works"
    WARDS ||--o{ ALERTS : "raises"
    WARDS ||--o{ AI\_PREDICTIONS : "is forecast by"
    STAFF ||--o{ ADMISSIONS : "attends as doctor"
    BEDS ||--o{ ADMISSIONS : "holds"
    PATIENTS ||--o{ ADMISSIONS : "has"
    ADMISSIONS ||--o{ NURSE\_ASSIGNMENTS : "is cared for through"
    STAFF ||--o{ NURSE\_ASSIGNMENTS : "cares for as nurse"
    ADMISSIONS |o--o{ ALERTS : "may trigger"
    ADMISSIONS ||--o| TRIAGE\_ASSESSMENTS : "is scored by"
    TRIAGE\_ASSESSMENTS ||--o{ ASSESSMENT\_SYMPTOMS : "records"
    SYMPTOM\_CATALOG ||--o{ ASSESSMENT\_SYMPTOMS : "is reported in"
    DEPARTMENTS ||--o{ SYMPTOM\_CATALOG : "handles"
    DEPARTMENTS ||--o{ TRIAGE\_ASSESSMENTS : "is recommended by"
```

</details>

## Relational schema

Primary keys are shown in bold as `PK`, foreign keys as `FK`.

|Table|Columns|
|-|-|
|`departments`|**department\_id (PK)**, name (UNIQUE), floor\_no|
|`wards`|**ward\_id (PK)**, department\_id (FK), name, ward\_type|
|`symptom\_catalog`|**symptom\_code (PK)**, label (UNIQUE), points, department\_id (FK)|
|`triage\_assessments`|**assessment\_id (PK)**, admission\_id (FK, UNIQUE), heart\_rate, systolic\_bp, diastolic\_bp, spo2, temperature\_c, resp\_rate, alert\_level, total\_score, severity, department\_id (FK), assessed\_at|
|`assessment\_symptoms`|**(assessment\_id, symptom\_code) (composite PK)**, both FK|
|`rooms`|**room\_id (PK)**, ward\_id (FK), room\_number, room\_type|
|`beds`|**bed\_id (PK)**, room\_id (FK), bed\_number, status|
|`staff`|**staff\_id (PK)**, department\_id (FK), full\_name, role, email (UNIQUE), phone|
|`patients`|**patient\_id (PK)**, full\_name, date\_of\_birth, gender, blood\_group, phone|
|`admissions`|**admission\_id (PK)**, patient\_id (FK), bed\_id (FK), doctor\_id (FK to staff), admitted\_at, discharged\_at, diagnosis, severity|
|`shifts`|**shift\_id (PK)**, staff\_id (FK), ward\_id (FK), shift\_date, shift\_type|
|`nurse\_assignments`|**assignment\_id (PK)**, admission\_id (FK), nurse\_id (FK to staff), shift\_date, shift\_type|
|`alerts`|**alert\_id (PK)**, ward\_id (FK), admission\_id (FK, optional), alert\_type, priority, message, created\_at, resolved\_at|
|`ai\_predictions`|**prediction\_id (PK)**, ward\_id (FK), forecast\_date, predicted\_occupancy\_pct, model\_name, created\_at|

Constraints used: `PRIMARY KEY`, `FOREIGN KEY` with `ON DELETE RESTRICT/CASCADE/SET NULL`, `UNIQUE`, `NOT NULL`, `CHECK` (statuses, severities, date order, percentage range) and partial unique indexes (one active admission per bed and per patient).

## How the AI triage works

The score adds points for each abnormal vital sign (heart rate, systolic blood pressure, oxygen saturation, breathing rate, temperature, consciousness) and for each reported symptom. A total of 8 or more is **Critical**, 5 to 7 is **High**, 2 to 4 is **Medium** and 0 to 1 is **Low**. A single red-flag finding (for example chest pain or oxygen below 92%) is always at least High. Children under 16 go to Pediatrics. Otherwise the symptoms with the most points choose the department, and Critical cases with no specific department go to Intensive Care. The result lists every reason, so a doctor can check it. The points of each symptom are stored in the `symptom\_catalog` table, so they can be changed without changing code. This is a transparent rule-based score, not a trained machine-learning model.

## Normalization

The schema is in 1NF, 2NF, 3NF and BCNF. A bed stores only its room (its ward is found through the room), age and bed counts are derived, not stored, and there is no duplicate `status` column in `admissions`. The full working, with the functional dependencies and the starting flat table, is in [docs/NORMALIZATION.md](docs/NORMALIZATION.md).

## Database features

|Feature|Name|What it does|
|-|-|-|
|Views|`v\_ward\_occupancy`, `v\_current\_patients`, `v\_open\_alerts`, `v\_ward\_forecast`|Dashboard read models built with joins and aggregates|
|Views|`v\_bed\_map`|Ward, room and bed with the patient in it|
|Views|`v\_nurse\_workload`, `v\_patients\_without\_nurse`|Patients per nurse per shift, and patients with no nurse today|
|Function|`ward\_occupancy\_pct(ward\_id)`|Percentage of beds occupied in a ward|
|Function|`admit\_patient(...)`|Admits a patient and returns the admission id|
|Function|`assign\_nurse(...)`|Assigns a nurse to a patient for a shift|
|Function|`calc\_triage(...)`|The scoring rules: returns score, severity, department and the reasons in plain words|
|Function|`pick\_doctor(department\_id)`|Chooses the doctor of the department who has the fewest current patients|
|Function|`triage\_preview(...)`|Live result shown on the admission form, changes no data|
|Function|`admit\_with\_triage(...)`|Creates the patient, scores them, picks the doctor, admits to the bed and optionally assigns the chosen nurse, all in one transaction|
|Views|`v\_free\_beds`, `v\_nurses\_on\_duty`, `v\_triage\_log`|Free beds, nurses rostered today with their load, and the triage history|
|Procedure|`discharge\_patient(admission\_id)`|Discharges a patient (`CALL discharge\_patient(7);`)|
|Trigger|`trg\_check\_admission`|Rejects an admission to a bed that is not free, or by a non-doctor|
|Trigger|`trg\_admission\_created`|Marks the bed occupied and raises critical and high-occupancy alerts|
|Trigger|`trg\_admission\_discharged`|Marks the bed for cleaning and resolves the related alerts|
|Trigger|`trg\_check\_nurse\_assignment`|Only a nurse rostered in the patient's ward may be assigned, up to 6 patients per shift|

Sample queries (joins, `GROUP BY` / `HAVING`, subqueries, a CTE, a window function, set operations and DML) are in [database/06\_queries.sql](database/06_queries.sql).

## Repository structure

|Path|Purpose|
|-|-|
|`database/00\_reset.sql`|Optional: drops everything this project creates|
|`database/01\_schema.sql`|Tables, keys, constraints and indexes (DDL)|
|`database/02\_functions\_procedures.sql`|Stored functions and procedure|
|`database/03\_triggers.sql`|Business-rule triggers|
|`database/04\_views.sql`|Dashboard views|
|`database/05\_seed\_data.sql`|Synthetic demo data (DML)|
|`database/06\_queries.sql`|Example queries for the demo|
|`database/07\_triage.sql`|AI triage: 3 tables, scoring and admission functions, views (run after 05)|
|`database/run\_all\_in\_supabase.sql`|Files 01 to 05 and 07 joined into one script|
|`database/migrations/`|Upgrade script for databases built with the older 9-table design|
|`docs/er\_diagram.png`, `docs/er\_diagram.mmd`|ER diagram image and its source|
|`docs/NORMALIZATION.md`|Normalization working|
|`src/`|React front end|

## Team members

|Name|Roll number|Div|
|-|-|-|
|Vaibhavi Jumle|1262241795|ECE AIML B G3|
|Asma Shaikh|1262242223|ECE AIML B G3|
|Aadit Pansare|1262242672|ECE AIML B G3|

## Setup and execution

You need Node.js 18 or newer and a free [Supabase](https://supabase.com) account.

### 1\. Create the cloud database

1. Create a new Supabase project and wait for it to finish starting.
2. Open **SQL Editor** and run the files in `database/` in this order, one at a time: `01\_schema.sql`, `02\_functions\_procedures.sql`, `03\_triggers.sql`, `04\_views.sql`, `05\_seed\_data.sql`, `07\_triage.sql`. (Or run `run\_all\_in\_supabase.sql` once instead.)
3. Check that **Table Editor** now shows the fourteen tables with data.

Use a new project. If the project already has tables with the same names, run `00\_reset.sql` first, which deletes them. If your database was built with the older 9-table scripts, run `database/migrations/001\_add\_rooms\_and\_nurse\_assignments.sql` instead of starting over.

Demo tip: shifts and nurse assignments are created for the day the seed script runs. On another day, run `CALL seed\_todays\_shifts();` in the SQL Editor first.

### 2\. Run the web app

```bash
git clone https://github.com/vaibhavijumle16-pixel/ai-hospital-commant-centre.git
cd hospital-commant-centre
npm install
```

Copy `.env.example` to `.env` and fill in the values from Supabase **Project Settings > API**:

```env
VITE\_SUPABASE\_URL=your\_supabase\_project\_url
VITE\_SUPABASE\_ANON\_KEY=your\_supabase\_anon\_key
```

```bash
npm run dev
```

The app opens at [http://localhost:5173](http://localhost:5173). Stop it with Ctrl+C.

### Alternative: run the database locally

With PostgreSQL installed, run the same files in order:

```bash
createdb hospital
for f in 01\_schema 02\_functions\_procedures 03\_triggers 04\_views 05\_seed\_data 07\_triage; do
  psql -d hospital -f database/$f.sql
done
psql -d hospital -f database/06\_queries.sql
```

## Sustainable Development Goal mapping

|SDG|Target|How the project supports it|
|-|-|-|
|**SDG 3: Good Health and Well-being**|**3.8** Achieve universal health coverage, including access to quality essential health-care services|Better bed and staff use means more patients get a bed and timely care|
|**SDG 3: Good Health and Well-being**|**3.d** Strengthen capacity for early warning, risk reduction and management of national and global health risks|Occupancy alerts and AI forecasts warn staff before a ward is full|
|**SDG 9: Industry, Innovation and Infrastructure**|**9.1** Develop quality, reliable and resilient infrastructure to support human well-being|A reliable data system for hospital operations|

## Security note

The demo data is synthetic. Before storing real patient data, turn on Row Level Security in Supabase and add policies, because the anon key in the browser is public.

## License

Released under the MIT License.

