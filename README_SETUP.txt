DOCUMENT MANAGEMENT SYSTEM — SETUP GUIDE

Included files
- index.html : dashboard layout
- style.css  : screenshot-inspired responsive styling
- script.js  : frontend functionality
- Code.gs    : Google Apps Script backend

IMPORTANT SECURITY / DEPLOYMENT NOTES
This is a starter implementation. Do not upload confidential or patient-identifiable records until your Workspace administrator has reviewed access, sharing, retention, and data-protection requirements. Google Apps Script deployment identity and account policies vary by Workspace configuration.

STEP 1 — Create the backend
1. Visit https://script.google.com and create a New project.
2. Replace the default Code.gs with the supplied Code.gs.
3. In CONFIG.ADMIN_EMAILS, replace the placeholder with your Google account email.
4. Save. Select setup from the function list and Run. Approve Drive and Sheets permissions.
5. In Apps Script, open Project Settings > Script Properties. setup() creates DMS_ROOT_ID and DMS_SHEET_ID automatically.
6. Open the execution log. It prints the database spreadsheet and Drive root folder URLs.

STEP 2 — Deploy
1. Click Deploy > New deployment > Web app.
2. Execute as: Me.
3. Who has access: choose your Google Workspace organisation if available. If you use a personal Gmail account, Apps Script may not offer a truly private signed-in-user deployment option. Do not choose anonymous public access for confidential documents.
4. Deploy, authorise if prompted, and copy the Web app URL ending in /exec.

STEP 3 — Configure frontend
1. Open script.js.
2. Replace PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE with the /exec URL.
3. Host index.html, style.css and script.js together on a hosting platform that supports static files, or serve them through an approved internal web host.
4. Sign in with the Google account added to ADMIN_EMAILS.

STEP 4 — Add users
Sign in as Admin > Manage Users. Add exact Google account email addresses and assign:
- Admin: full access and user management
- Editor: create containers, upload, delete and restore documents
- Viewer: view and download documents

FEATURE NOTES / LIMITATIONS
- Uploads are sent through Apps Script and currently limited to 20 MB per file in this starter code. Apps Script request/runtime and Google Drive quotas may impose lower practical limits.
- PDF/image preview opens the Drive file URL. The user must have Drive access. Google Drive viewer handles the preview.
- ZIP creation makes a ZIP file in the DMS root Drive folder and returns its download URL.
- Recycle Bin uses Drive trash and a metadata log. Restore is supported; permanent deletion/automatic purge is not implemented.
- The code stores files in a private Drive folder and metadata in a private Sheet. Do not share the root folder or database sheet publicly.
- The app uses Apps Script's active-user email. In some deployment/account combinations it may be blank; use a Google Workspace domain deployment with an appropriate access policy. Test with a non-admin account before real use.
- This starter version does not yet include edit-container UI, audit log, antivirus scanning, file versioning, or a formal compliance review.

BEFORE PRODUCTION
Ask your Google Workspace administrator to verify who can access the deployment, ensure Drive files inherit private permissions, review data retention and backups, and test Viewer/Editor/Admin roles using separate accounts. Do not store sensitive health/patient information without organisational approval.
