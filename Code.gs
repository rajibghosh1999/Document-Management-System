/**
 * Document Management System backend (Public Portal / No Login Required)
 * 1) Run setup() once from the Apps Script editor.
 * 2) Deploy as Web app: Execute as ME; access: Anyone.
 * 3) Put the deployed /exec URL in script.js.
 */
const CONFIG = {
  ROOT_FOLDER_NAME: "Document Management System",
  MAX_FILE_BYTES: 20 * 1024 * 1024 // 20 MB per-file limit
};

const SHEETS = {
  CONTAINERS: "Containers",
  FILES: "Files",
  USERS: "Users",
  SESSIONS: "Sessions",
  TRASH: "Trash"
};

function setup() {
  const props = PropertiesService.getScriptProperties();
  let rootId = props.getProperty("DMS_ROOT_ID");
  let root;
  if(rootId){ try{ root = DriveApp.getFolderById(rootId); } catch(e){ root = null; } }
  if(!root){ root = DriveApp.createFolder(CONFIG.ROOT_FOLDER_NAME); props.setProperty("DMS_ROOT_ID", root.getId()); }
  
  const ssId = props.getProperty("DMS_SHEET_ID"); let ss;
  if(ssId){ try{ ss = SpreadsheetApp.openById(ssId); } catch(e){ ss = null; } }
  if(!ss){ ss = SpreadsheetApp.create("DMS Database"); props.setProperty("DMS_SHEET_ID", ss.getId()); }
  
  const headers = {
    Containers: ["id", "name", "title", "description", "date", "category", "tags", "folderId", "createdAt", "createdBy", "deleted"],
    Files: ["id", "containerId", "name", "mimeType", "size", "driveFileId", "uploadedAt", "uploadedBy", "deleted"],
    Users: ["email", "role", "addedAt"],
    Sessions: ["token", "email", "expiresAt"],
    Trash: ["id", "type", "name", "parentId", "driveId", "deletedAt", "deletedBy"]
  };
  
  Object.keys(headers).forEach(n => {
    let sh = ss.getSheetByName(n) || ss.insertSheet(n);
    if(sh.getLastRow() === 0) sh.appendRow(headers[n]);
  });
  
  Logger.log("Setup complete. Spreadsheet: " + ss.getUrl() + " | Root folder: " + root.getUrl());
}

function doGet(){ 
  return ContentService.createTextOutput("DMS API is running.").setMimeType(ContentService.MimeType.TEXT); 
}

function doPost(e){
  try {
    const p = JSON.parse(e.postData.contents || "{}");
    const action = p.action;
    let result;
    const publicUser = { email: "public@portal", role: "Admin" };
    
    switch(action){
      case "listContainers":
        result = { containers: listContainers_() };
        break;
      case "createContainer":
        result = { container: createContainer_(p.container, publicUser) };
        break;
      case "getFilePreview":
        result = fileUrl_(p.id, true);
        break;
      case "getContainer":
        result = getContainer_(p.id);
        break;
      case "uploadFile":
        result = uploadFile_(p.containerId, p.file, publicUser);
        break;
      case "downloadContainerZip":
        result = zipContainer_(p.id);
        break;
      case "trashContainer":
        result = trashContainer_(p.id, publicUser);
        break;
      case "trashFile":
        result = trashFile_(p.id, publicUser);
        break;
      case "listTrash":
        result = { items: listTrash_() };
        break;
      case "restoreItem":
        result = restoreItem_(p.id, p.type);
        break;
      default:
        throw new Error("Unknown action");
    }
    return json(Object.assign({ ok: true }, result || {}));
  } catch(err) {
    return json({ ok: false, error: err.message || String(err) });
  }
}

function fileUrl_(id, preview){
  const f = rows_("Files").find(x => x.id === id && !x.deleted);
  if(!f) throw new Error("File not found.");
  const file = DriveApp.getFileById(f.driveFileId);
  return { url: preview ? file.getUrl() : file.getDownloadUrl(), downloadUrl: file.getDownloadUrl() };
}

function json(o){ 
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); 
}

function db_(){ 
  return SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("DMS_SHEET_ID")); 
}

function sh_(name){ 
  return db_().getSheetByName(name); 
}

function rows_(name){ 
  const s = sh_(name), v = s.getDataRange().getValues(); 
  return v.length < 2 ? [] : v.slice(1).map(r => {
    let o = {}; 
    v[0].forEach((h, i) => o[h] = r[i]); 
    return o;
  }); 
}

function append_(name, obj){ 
  const s = sh_(name), h = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0]; 
  s.appendRow(h.map(k => obj[k] === undefined ? "" : obj[k])); 
}

function update_(name, id, patch){ 
  const s = sh_(name), v = s.getDataRange().getValues(), h = v[0], idx = h.indexOf("id"); 
  for(let i = 1; i < v.length; i++) {
    if(String(v[i][idx]) === String(id)){ 
      Object.keys(patch).forEach(k => {
        const c = h.indexOf(k); 
        if(c >= 0) s.getRange(i+1, c+1).setValue(patch[k]);
      }); 
      return true; 
    }
  }
  throw new Error("Record not found"); 
}

function root_(){ 
  return DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty("DMS_ROOT_ID")); 
}

function listContainers_(){
  const fs = rows_("Files");
  return rows_("Containers").filter(c => !c.deleted).map(c => {
    const f = fs.filter(x => x.containerId === c.id && !x.deleted);
    return {
      id: c.id, 
      name: c.name, 
      title: c.title, 
      description: c.description, 
      date: c.date, 
      category: c.category, 
      tags: c.tags, 
      fileCount: f.length, 
      totalSize: formatSize_(f.reduce((a, x) => a + Number(x.size || 0), 0))
    };
  });
}

function createContainer_(c, u){
  if(!c || !c.name || !c.title) throw new Error("Container name and title are required.");
  const id = Utilities.getUuid(), folder = root_().createFolder(c.name);
  append_("Containers", {
    id, 
    name: c.name, 
    title: c.title, 
    description: c.description || "", 
    date: c.date || "", 
    category: c.category || "General", 
    tags: c.tags || "", 
    folderId: folder.getId(), 
    createdAt: new Date().toISOString(), 
    createdBy: u.email, 
    deleted: false
  });
  return { id, name: c.name };
}

function getContainer_(id){
  const c = rows_("Containers").find(x => x.id === id && !x.deleted);
  if(!c) throw new Error("Container not found.");
  const files = rows_("Files").filter(f => f.containerId === id && !f.deleted).map(f => {
    let fileObj = DriveApp.getFileById(f.driveFileId);
    return {
      id: f.id, 
      name: f.name, 
      mimeType: f.mimeType, 
      size: formatSize_(Number(f.size || 0)), 
      uploadedAt: f.uploadedAt, 
      url: fileObj.getDownloadUrl()
    };
  });
  return { 
    container: { id: c.id, name: c.name, title: c.title, description: c.description, date: c.date, category: c.category }, 
    files 
  };
}

function uploadFile_(containerId, f, u){
  const c = rows_("Containers").find(x => x.id === containerId && !x.deleted);
  if(!c) throw new Error("Container not found.");
  if(!f || !f.base64 || !f.name) throw new Error("Invalid file.");
  const bytes = Utilities.base64Decode(f.base64);
  if(bytes.length > CONFIG.MAX_FILE_BYTES) throw new Error("File exceeds 20 MB limit.");
  const blob = Utilities.newBlob(bytes, f.mimeType || "application/octet-stream", f.name);
  let folder = DriveApp.getFolderById(c.folderId);
  const df = folder.createFile(blob);
  const id = Utilities.getUuid();
  append_("Files", {
    id, 
    containerId, 
    name: f.name, 
    mimeType: f.mimeType || "application/octet-stream", 
    size: bytes.length, 
    driveFileId: df.getId(), 
    uploadedAt: new Date().toISOString(), 
    uploadedBy: u.email, 
    deleted: false
  });
  return { id };
}

function zipContainer_(id){
  const c = rows_("Containers").find(x => x.id === id && !x.deleted);
  if(!c) throw new Error("Container not found.");
  const blobs = rows_("Files").filter(f => f.containerId === id && !f.deleted).map(f => DriveApp.getFileById(f.driveFileId).getBlob().setName(f.name));
  if(!blobs.length) throw new Error("This container has no files.");
  const zip = Utilities.zip(blobs, c.name + ".zip"), file = root_().createFile(zip);
  return { url: file.getDownloadUrl() };
}

function trashFile_(id, u){
  const f = rows_("Files").find(x => x.id === id && !x.deleted);
  if(!f) throw new Error("File not found.");
  DriveApp.getFileById(f.driveFileId).setTrashed(true);
  update_("Files", id, { deleted: true });
  append_("Trash", { id, type: "File", name: f.name, parentId: f.containerId, driveId: f.driveFileId, deletedAt: new Date().toISOString(), deletedBy: u.email });
  return {};
}

function trashContainer_(id, u){
  const c = rows_("Containers").find(x => x.id === id && !x.deleted);
  if(!c) throw new Number("Container not found.");
  DriveApp.getFolderById(c.folderId).setTrashed(true);
  update_("Containers", id, { deleted: true });
  append_("Trash", { id, type: "Container", name: c.name, parentId: "", driveId: c.folderId, deletedAt: new Date().toISOString(), deletedBy: u.email });
  rows_("Files").filter(f => f.containerId === id && !f.deleted).forEach(f => update_("Files", f.id, { deleted: true }));
  return {};
}

function listTrash_(){
  return rows_("Trash").map(x => ({ id: x.id, type: x.type, name: x.name, deletedAt: x.deletedAt }));
}

function restoreItem_(id, type){
  const t = rows_("Trash").find(x => x.id === id && x.type === type);
  if(!t) throw new Error("Recycle-bin item not found.");
  DriveApp.getFileById(t.driveId).setTrashed(false);
  if(type === "Container"){
    update_("Containers", id, { deleted: false });
    rows_("Files").filter(f => f.containerId === id).forEach(f => update_("Files", f.id, { deleted: false }));
  } else {
    update_("Files", id, { deleted: false });
  }
  const s = sh_("Trash"), r = findRow(s, 1, id);
  if(r) s.deleteRow(r);
  return {};
}

function findRow(sheet, col, value){ 
  const vals = sheet.getDataRange().getValues(); 
  for(let i = 1; i < vals.length; i++) {
    if(String(vals[i][col-1]).toLowerCase() === String(value).toLowerCase()) return i+1;
  }
  return 0; 
}

function formatSize_(n){
  if(n < 1024) return n + " B";
  if(n < 1048576) return (n / 1024).toFixed(1) + " KB";
  return (n / 1048576).toFixed(2) + " MB";
}