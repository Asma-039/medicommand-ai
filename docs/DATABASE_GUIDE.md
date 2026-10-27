Database Guide — MediCommand AI

1. Introduction

MediCommand AI is an AI-powered hospital command center project. Its database layer is intended to organize hospital-related information and support the application’s implemented workflows.

This document describes the database scripts, schema setup, database programming objects, sample data, and query resources included in the project.

The SQL scripts in the repository are the authoritative reference for the actual database design and behavior.

2. Database Technology

The repository includes SQL scripts and a Supabase integration module. The exact database platform and configuration should be confirmed from the project setup.

Where Supabase is configured to use PostgreSQL, PostgreSQL provides relational tables, constraints, SQL queries, and database-side programming capabilities.

The application should use only the database connection and configuration intended for this project.

3. Database Folder Structure

The repository contains database-related scripts, including:

File	Purpose
database/00_reset.sql	Reset or clean up database objects, according to the script’s actual contents. Review carefully before execution.
database/01_schema.sql	Defines the database schema and related objects.
database/02_functions_procedures.sql	Contains database functions and procedures, if defined in the script.
database/03_triggers.sql	Defines triggers and their associated behavior, if implemented.
database/04_views.sql	Defines database views, if implemented.
database/05_seed_data.sql	Supplies sample or initial data, according to the script.
database/06_queries.sql	Contains SQL queries used for demonstrations, analysis, or testing.
database/001_add_rooms_and_nurse_assignments.sql	Contains additional database changes related to rooms and nurse assignments; inspect the script for its exact operations.
database/migrations/	Contains migration scripts used to apply database changes over time.
database/run_all_in_supabase.sql	Provides a combined SQL script if its contents include the setup operations described by its name.

Verify the actual file locations in the repository before finalizing this table.

4. Database Schema

The schema defines how hospital-related information is represented and connected.

Inspect 01_schema.sql and document each actual table, including:

* Table name and purpose.
* Primary key.
* Foreign keys and relationships.
* Important columns and their data types.
* NOT NULL, UNIQUE, CHECK, and other constraints where present.

Do not assume that a table or column exists without confirming it in the SQL scripts.

5. Entity-Relationship Diagram

The repository includes docs/er_diagram.png and docs/er_diagram.mmd.

The ER diagram can be used to understand the database entities and their relationships. Compare it with the schema script and update the documentation if the diagram and schema differ.

Explain the main relationships, such as one-to-many or many-to-many, only where supported by the actual design.

6. Normalization

The repository includes docs/NORMALIZATION.md.

Normalization organizes relational data to reduce unnecessary duplication and help maintain data consistency.

Document the normal forms actually addressed in the project and explain how they apply to the real tables. Do not claim that the entire database satisfies a particular normal form without checking the schema and dependencies.

7. SQL Functions and Procedures

Inspect 02_functions_procedures.sql.

For each implemented function or procedure, document:

* Name.
* Purpose.
* Input parameters.
* Return value or result.
* Main operations performed.
* Any relevant validation or error handling.

Include a short example call only if it is valid for the actual SQL definition.

8. Triggers

Inspect 03_triggers.sql.

For each implemented trigger, describe:

* The table and event that activate it.
* Whether it runs before or after the event.
* The function or action it invokes.
* The intended effect on data consistency or application behavior.

Explain only the triggers present in the project.

9. Views

Inspect 04_views.sql.

For each implemented view, explain:

* Its name.
* The underlying tables.
* The information it presents.
* How it may be useful to the application or reporting workflow.

Include an example query if appropriate.

10. Sample Data

Inspect 05_seed_data.sql.

Describe the purpose of the sample data and which tables it populates. Explain how the sample records help developers test the application.

Use synthetic or appropriately anonymized patient information for demonstrations. Do not include real patient details or credentials in documentation.

11. SQL Queries

Inspect 06_queries.sql.

Select representative queries and explain their purpose, such as retrieving records, joining related tables, filtering results, grouping data, or generating summaries, if those operations appear in the script.

For each selected query, include:

* The question it answers.
* The tables it uses.
* The important SQL operations.
* The expected type of result.

Make sure every example matches the actual schema.

12. Database Setup

Before executing any scripts, confirm the target database and review the scripts for destructive operations.

If the project uses Supabase:

1. Open the appropriate Supabase project.
2. Back up any important existing data.
3. Review the SQL scripts before execution.
4. Apply the required schema and migration scripts in the intended order.
5. Apply seed data only when appropriate.
6. Verify that the expected tables and database objects were created.
7. Test the queries and application integration.

The precise execution order must be confirmed from the migration dependencies and script contents.

Warning: A reset script may delete or recreate database objects. Never execute it against a database containing important data unless the consequences are understood and an appropriate backup exists.

13. Frontend Integration

The repository includes frontend support files under src/lib/, including supabase.ts and types.ts.

Inspect these files to determine how the application configures its database client, represents data, and performs database operations.

Document the actual tables and operations used by the frontend. Do not assume every database table is connected to the interface.

Store configuration securely. Never commit passwords, service-role keys, access tokens, or other secrets. Browser-exposed Supabase configuration must follow appropriate database permissions and Row Level Security policies where applicable.

14. Data Integrity and Security

Important database practices include:

* Using primary keys to identify records.
* Using foreign keys where relationships require them.
* Applying appropriate constraints and validation.
* Restricting access to sensitive information.
* Using suitable permissions and Row Level Security where supported and configured.
* Keeping credentials outside version control.
* Avoiding real patient information in demonstration data.

Document the protections actually configured in this project separately from recommended improvements.

15. Testing and Verification

Suggested checks include:

* Confirming that schema scripts execute successfully.
* Checking primary and foreign key constraints.
* Verifying the behavior of implemented functions, procedures, and triggers.
* Running representative queries.
* Checking sample data.
* Testing frontend database operations where configured.

These are recommended checks, not a claim that all tests have already been executed.

16. Future Improvements

Possible future improvements include:

* More automated database tests.
* Additional constraints and validation where needed.
* Better migration documentation.
* Query performance analysis and indexing where justified.
* Improved access controls and auditability.
* Keeping the ER diagram synchronized with schema changes.

These items are recommendations rather than claims about existing features.

17. Conclusion

The database scripts provide the foundation for the data model and database operations used by MediCommand AI. The schema, migrations, SQL queries, and supporting documentation should be kept consistent with the application’s actual implementation.

This guide should be updated whenever the schema or database logic changes.
