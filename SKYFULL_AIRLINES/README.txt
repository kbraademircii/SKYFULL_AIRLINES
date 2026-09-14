SKYFULL AIRLINES - FLIGHT RESERVATION SYSTEM
===============================================

Course:       Database Management Systems

DESCRIPTION
-----------
SKYFULL Airlines is a comprehensive web-based flight management system developed using Java Spring Boot and Microsoft SQL Server. 
It features distinct panels for Administrators (Flight Management), Owners (Analytics), and Users (Booking & Check-in).

PREREQUISITES
-------------
1. Java Development Kit (JDK) 17 or higher
2. Maven (for build management)
3. Microsoft SQL Server (Local or Remote instance)
4. A Web Browser (Chrome/Edge recommended)

INSTALLATION & SETUP
--------------------

STEP 1: DATABASE SETUP (Choose ONE Option)
------------------------------------------

OPTION A: Restore from Backup (Primary Method)
1. Open Microsoft SQL Server Management Studio (SSMS).
2. Right-click on "Databases" -> "Restore Database...".
3. Select "Device", click "...", navigate to the `database` folder, and select `skyfull_db.bak`.
4. Click "OK" to restore `SkyfullDB`.

   IMPORTANT FOLLOW-UP FOR OPTION A:
   Restoring a backup often breaks the SQL User Login. You MUST proceed to "STEP 2" below to fix the 'airline_user' login.

OPTION B: Execute SQL Script (Alternative Method if Backup Fails)
1. Open SSMS and create a NEW database named `SkyfullDB`.
2. Open the `skyfull_db.sql` file (found in the `database` folder) in SSMS.
3. Ensure `USE SkyfullDB` is selected.
4. Execute the entire script. 
   (Note: This script AUTOMATICALLY creates the 'airline_user' login, so you may skip STEP 2).

STEP 2: USER CONFIGURATION (REQUIRED only for OPTION A)
-------------------------------------------------------
The project requires a specific SQL Login ('airline_user') to connect.
* If you used OPTION B (Script), this user is already created.
* If you used OPTION A (Backup), the user might be missing or disconnected.

ACTION REQUIRED:
Check if the 'airline_user' login exists under Security -> Logins.
If missing or not working, create it manually:

Default DB Credentials:
   URL: jdbc:sqlserver://localhost;databaseName=SkyfullDB
   Username: airline_user
   Password: Password123!

NOTE: Ensure your SQL Server supports Mixed Mode Authentication (SQL Server and Windows Authentication mode). This is standard.

STEP 3: RUNNING THE APPLICATION
-----------------------------

OPTION A: Using Eclipse IDE (Recommended)
1. Open Eclipse IDE.
2. Go to `File -> Import -> Maven -> Existing Maven Projects`.
3. Click "Browse" and select the `program` folder inside the project directory.
4. Click "Finish" and wait for Maven dependencies to download.
5. Right-click the project -> `Run As -> Java Application`.
6. Watch the Console for "Started SkyfullApplication".

OPTION B: Other IDEs or Command Line (Universal)
Since this is a standard Maven project, it can be run in IntelliJ IDEA, VS Code, or simply via Terminal.

1. Open the project/terminal in the `program` folder.
2. Run the Maven command: 
   mvn spring-boot:run
   (Or use your IDE's built-in "Run" button on `SkyfullApplication.java`).
3. The application will start automatically.

USAGE
-----
Access the application via your browser at:
http://localhost:8080

DEFAULT LOGIN CREDENTIALS
-------------------------
1. Administrator (Full Access):
   Username: admin
   Password: admin123

2. Airline Owner (Analytics Dashboard):
   Username: owner
   Password: owner123

3. Kübra Demirci (Booking & Check-in):
   Username: kbra
   Password: kbra123

TROUBLESHOOTING (ECLIPSE)
-------------------------
If you see RED ERROR MARKS (crosses) on the project folder after importing:
1. Right-click the project folder in Package Explorer.
2. Select `Maven -> Update Project...` (or press Alt+F5).
3. Check "Force Update of Snapshots/Releases" if available, then click OK.
4. If errors persist, go to top menu `Project -> Clean...`.
5. Ensure your Eclipse Workspace is using JDK 17+ (Window -> Preferences -> Java -> Installed JREs).

KEY FEATURES IMPLEMENTED
------------------------
- Stored Procedures: Used for critical operations like Booking, Cancellation, and Check-in logic.
- Triggers: Enforces data integrity (e.g., preventing double bookings on the same seat).
- database Functions: Calculates dynamic values like flight duration and revenue.
- Views: Optimizes queries for public schedules and owner analytics.
