const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzp0FvmgnTY5kfstLEBfYKkRiwnhzTuHsxr3W38PzfRjI2k2W5TrLyAiOm1wnuVfhJ9Qw/exec"; 
let containers = [], activeContainer = null, activeFiles = [];
const $ = id => document.getElementById(id);
const modal = id => bootstrap.Modal.getOrCreateInstance($(id));

const call = async (action, payload={}) => {
  if (!WEB_APP_URL.startsWith("https://script.google.com/")) throw new Error("Please configure WEB_APP_URL in script.js first.");
  const response = await fetch(WEB_APP_URL, {
    method: "POST",
    headers: {"Content-Type": "text/plain;charset=utf-8"},
    body: JSON.stringify({ action, ...payload })
  });
  const data = await response.json(); 
  if(!data.ok) throw new Error(data.error || "Request failed"); 
  return data;
};

function busy(on){ $("loadingOverlay").classList.toggle("d-none", !on); }

function toast(message, type="success"){
  const id = "t" + Date.now();
  $("toastHost").insertAdjacentHTML("beforeend", `<div id="${id}" class="toast text-bg-${type} border-0 shadow" role="alert"><div class="d-flex"><div class="toast-body">${esc(message)}</div><button class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div></div>`);
  const el = $(id);
  const t = new bootstrap.Toast(el, {delay: 3500});
  t.show();
  el.addEventListener("hidden.bs.toast", () => el.remove());
}

function esc(s=""){ return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function niceDate(s){ if(!s) return ""; const d = new Date(s); return isNaN(d) ? s : d.toLocaleDateString("en-GB"); }

async function init(){ 
  $("containerDate").value = new Date().toISOString().slice(0, 10); 
  $("docDate").value = new Date().toISOString().slice(0, 10); 
  $("containerForm").onsubmit = createContainer; 
  $("applyFilters").onclick = renderContainers; 
  $("refreshBtn").onclick = loadContainers;
  
  $("clearFilters").onclick = () => {
    ["searchInput", "yearFilter", "monthFilter", "categoryFilter", "startDate", "endDate"].forEach(id => $(id).value = "");
    renderContainers();
  };
  
  $("searchInput").oninput = renderContainers; 
  ["yearFilter", "monthFilter", "categoryFilter", "startDate", "endDate"].forEach(id => $(id).onchange = renderContainers);
  
  $("recycleBtn").onclick = showRecycle; 
  await loadContainers();
}

async function loadContainers(){
  try {
    busy(true);
    const r = await call("listContainers");
    containers = r.containers || [];
    populateFilters();
    renderContainers();
  } catch(e) {
    toast(e.message, "danger");
  } finally {
    busy(false);
  }
}

function populateFilters(){
  const years = [...new Set(containers.map(x => (x.date || "").slice(0, 4)).filter(Boolean))].sort().reverse();
  $("yearFilter").innerHTML = '<option value="">All Years</option>' + years.map(y => `<option>${esc(y)}</option>`).join("");
  
  const cats = [...new Set(containers.map(x => x.category).filter(Boolean))].sort();
  $("categoryFilter").innerHTML = '<option value="">All Categories</option>' + cats.map(c => `<option>${esc(c)}</option>`).join("");
  
  $("monthFilter").innerHTML = '<option value="">All Months</option>' + Array.from({length: 12}, (_, i) => `<option value="${String(i+1).padStart(2,"0")}">${new Date(2000, i, 1).toLocaleString("en", {month: "long"})}</option>`).join("");
}

function renderContainers(){
  const q = $("searchInput").value.toLowerCase(), yr = $("yearFilter").value, mo = $("monthFilter").value, cat = $("categoryFilter").value, sd = $("startDate").value, ed = $("endDate").value;
  const filtered = containers.filter(c => {
    const hay = [c.name, c.title, c.description, c.tags, c.category].join(" ").toLowerCase(), d = c.date || "";
    return (!q || hay.includes(q)) && (!yr || d.startsWith(yr)) && (!mo || d.slice(5, 7) === mo) && (!cat || c.category === cat) && (!sd || d >= sd) && (!ed || d <= ed);
  });
  
  $("containerCount").textContent = filtered.length;
  $("emptyState").classList.toggle("d-none", filtered.length > 0);
  $("containerList").innerHTML = filtered.map(c => `
    <div class="col-12"><article class="container-card">
      <div class="d-flex gap-3 align-items-start">
        <div class="pt-1" style="cursor:pointer;" onclick="openContainer('${c.id}')"><i class="fa-solid fa-folder folder-icon"></i></div>
        <div class="flex-grow-1 min-w-0">
          <div class="d-flex justify-content-between align-items-center gap-2">
            <a class="container-title text-decoration-none" href="javascript:void(0)" onclick="openContainer('${c.id}')">${esc(c.name)}</a>
            <div class="d-flex gap-2 align-items-center">
              <span class="category-badge">${esc(c.category || "General")}</span>
              <button class="icon-btn" title="Move to recycle bin" onclick="deleteContainer('${c.id}')"><i class="fa-regular fa-trash-can"></i></button>
            </div>
          </div>
          <div class="small text-muted fw-medium mt-1">${esc(c.title || "")}</div>
          <p class="small text-secondary my-1">${esc(c.description || "")}</p>
          <div class="meta-line">
            <span><i class="fa-regular fa-calendar"></i>${niceDate(c.date)}</span>
            <span><i class="fa-solid fa-tag"></i>${esc(c.tags || "No tags")}</span>
            <span><i class="fa-regular fa-file"></i>${c.fileCount || 0} documents</span>
            <span><i class="fa-solid fa-database"></i>${esc(c.totalSize || "0 B")}</span>
          </div>
        </div>
      </div>
    </article></div>`).join("");
}

async function createContainer(e){
  e.preventDefault();
  try {
    busy(true);
    await call("createContainer", {container: {
      name: $("containerName").value,
      title: $("containerTitle").value,
      description: $("containerDescription").value,
      date: $("containerDate").value,
      category: $("containerCategory").value,
      tags: $("containerTags").value
    }});
    $("containerForm").reset();
    $("containerDate").value = new Date().toISOString().slice(0, 10);
    toast("Container created successfully!");
    await loadContainers();
  } catch(e) {
    toast(e.message, "danger");
  } finally {
    busy(false);
  }
}

async function openContainer(id){
  try {
    busy(true);
    const r = await call("getContainer", {id});
    activeContainer = r.container;
    activeFiles = r.files || []; // Store active files for duplicate checking
    
    $("mainDashboard").classList.add("d-none");
    $("detailView").classList.remove("d-none");
    
    $("detTitle").textContent = activeContainer.name;
    $("detDesc").textContent = (activeContainer.title || "") + (activeContainer.description ? " — " + activeContainer.description : "");
    $("detDate").innerHTML = `<i class="fa-regular fa-calendar me-1"></i>${niceDate(activeContainer.date)}`;
    $("detCategory").innerHTML = `<i class="fa-solid fa-tag me-1"></i>${activeContainer.category}`;
    $("detSize").innerHTML = `<i class="fa-solid fa-database me-1"></i>${activeFiles.length} documents`;
    $("detBadge").textContent = activeContainer.category;
    
    renderFiles(activeFiles);
  } catch(e) {
    toast(e.message, "danger");
  } finally {
    busy(false);
  }
}

function backToDashboard(){
  $("detailView").classList.add("d-none");
  $("mainDashboard").classList.remove("d-none");
  loadContainers();
}

function renderFiles(list){
  $("fileCountBadge").textContent = list.length;
  $("fileList").innerHTML = list.length ? list.map(f => `
    <div class="list-group-item d-flex align-items-center justify-content-between p-3">
      <div class="d-flex align-items-center gap-3">
        <i class="fa-solid fa-file-lines text-primary fs-4"></i>
        <div>
          <div class="fw-semibold text-dark">${esc(f.name)}</div>
          <div class="small text-muted">Size: ${esc(f.size || "")} · Uploaded: ${niceDate(f.uploadedAt)}</div>
        </div>
      </div>
      <div class="d-flex gap-2">
        <button class="btn btn-outline-primary btn-sm" onclick="previewFile('${f.id}','${encodeURIComponent(f.name)}','${encodeURIComponent(f.mimeType || "")}')"><i class="fa-regular fa-eye me-1"></i> View</button>
        <a href="${esc(f.url)}" target="_blank" class="btn btn-outline-secondary btn-sm"><i class="fa-solid fa-download me-1"></i> Download</a>
        <button class="btn btn-outline-danger btn-sm" onclick="deleteFile('${f.id}')"><i class="fa-regular fa-trash-can"></i></button>
      </div>
    </div>`).join("") : '<div class="text-center text-muted p-4">No documents uploaded in this container yet.</div>';
}

async function uploadFiles(){
  const fileInput = $("filePicker");
  const files = Array.from(fileInput.files);
  
  if(!files.length) {
    return toast("Please select one or more files to upload", "warning");
  }
  
  // Check for duplicate file names within the container
  const existingNames = activeFiles.map(f => f.name.toLowerCase());
  const duplicateFiles = files.filter(f => existingNames.includes(f.name.toLowerCase()));
  
  if(duplicateFiles.length > 0) {
    const dupNames = duplicateFiles.map(f => f.name).join(", ");
    toast(`Duplicate file(s) already exist: ${dupNames}`, "danger");
    return; // Stop upload if duplicate found
  }
  
  try {
    busy(true);
    for(const f of files){
      const base64 = await toBase64(f);
      await call("uploadFile", {
        containerId: activeContainer.id, 
        file: { 
          name: f.name, 
          mimeType: f.type || "application/octet-stream", 
          size: f.size, 
          base64 
        }
      });
    }
    
    toast(`${files.length} file(s) uploaded successfully!`);
    fileInput.value = ""; 
    await openContainer(activeContainer.id); 
  } catch(e) {
    toast(e.message, "danger");
  } finally {
    busy(false);
  }
}

async function previewFile(id, name, mime){
  try {
    busy(true);
    const r = await call("getFilePreview", {id});
    $("previewTitle").textContent = decodeURIComponent(name);
    const m = decodeURIComponent(mime);
    if(m === "application/pdf" || m.startsWith("image/")) {
      $("previewBody").innerHTML = `<iframe src="${esc(r.url)}" title="Preview"></iframe>`;
    } else {
      $("previewBody").innerHTML = `<div class="text-center p-5"><i class="fa-solid fa-file-arrow-down fa-3x text-warning mb-3"></i><p>Preview is not available for this file type.</p><a class="btn btn-primary mt-2" href="${esc(r.downloadUrl)}" target="_blank">Download File</a></div>`;
    }
    modal("previewModal").show();
  } catch(e) {
    toast(e.message, "danger");
  } finally {
    busy(false);
  }
}

function toBase64(file){
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

async function downloadZip(){
  try {
    busy(true);
    const r = await call("downloadContainerZip", {id: activeContainer.id});
    window.open(r.url, "_blank", "noopener");
  } catch(e) {
    toast(e.message, "danger");
  } finally {
    busy(false);
  }
}

async function deleteContainer(id){
  if(!confirm("Are you sure you want to move this container to the recycle bin?")) return;
  try {
    busy(true);
    await call("trashContainer", {id});
    toast("Moved to recycle bin");
    await loadContainers();
  } catch(e) {
    toast(e.message, "danger");
  } finally {
    busy(false);
  }
}

async function deleteFile(id){
  if(!confirm("Are you sure you want to move this document to the recycle bin?")) return;
  try {
    busy(true);
    await call("trashFile", {id});
    toast("Moved to recycle bin");
    await openContainer(activeContainer.id);
  } catch(e) {
    toast(e.message, "danger");
  } finally {
    busy(false);
  }
}

async function showRecycle(){
  try {
    busy(true);
    const r = await call("listTrash");
    $("recycleList").innerHTML = r.items.length ? r.items.map(x => `
      <div class="list-group-item d-flex justify-content-between align-items-center p-3">
        <div><strong>${esc(x.name)}</strong><div class="small text-muted">${esc(x.type)} · Deleted on ${niceDate(x.deletedAt)}</div></div>
        <button class="btn btn-success btn-sm shadow-sm" onclick="restoreItem('${x.id}','${x.type}')"><i class="fa-solid fa-rotate-left me-1"></i> Restore</button>
      </div>`).join("") : '<p class="text-muted text-center p-4">Recycle bin is empty.</p>';
    modal("recycleModal").show();
  } catch(e) {
    toast(e.message, "danger");
  } finally {
    busy(false);
  }
}

async function restoreItem(id, type){
  try {
    busy(true);
    await call("restoreItem", {id, type});
    toast("Item restored successfully!");
    await showRecycle();
    await loadContainers();
  } catch(e) {
    toast(e.message, "danger");
  } finally {
    busy(false);
  }
}

document.addEventListener("DOMContentLoaded", init);