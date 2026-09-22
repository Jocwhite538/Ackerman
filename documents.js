(function () {
  "use strict";

  const D = window.AckermanData;
  const DB_NAME = "AckermanPaymentPrototypeDocumentsV1";
  const STORE_NAME = "documents";
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const MAX_FILES_PER_PATIENT = 20;

  let dbPromise = null;
  let currentPatient = null;
  let currentRecords = [];

  function openDatabase() {
    if (!window.indexedDB) {
      return Promise.reject(new Error("This browser does not support local document storage."));
    }
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("patientId", "patientId", { unique: false });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Could not open document storage."));
    });

    return dbPromise;
  }

  async function withStore(mode, callback) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      let result;
      try {
        result = callback(store);
      } catch (error) {
        reject(error);
        return;
      }
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error || new Error("Document storage operation failed."));
      transaction.onabort = () => reject(transaction.error || new Error("Document storage operation was cancelled."));
    });
  }

  async function list(patientId) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const index = transaction.objectStore(STORE_NAME).index("patientId");
      const request = index.getAll(IDBKeyRange.only(String(patientId)));
      request.onsuccess = () => {
        const records = request.result || [];
        records.sort((a, b) => String(b.addedAt).localeCompare(String(a.addedAt)));
        resolve(records);
      };
      request.onerror = () => reject(request.error || new Error("Could not read attached documents."));
    });
  }

  async function count(patientId) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const index = transaction.objectStore(STORE_NAME).index("patientId");
      const request = index.count(IDBKeyRange.only(String(patientId)));
      request.onsuccess = () => resolve(Number(request.result || 0));
      request.onerror = () => reject(request.error || new Error("Could not count attached documents."));
    });
  }

  async function add(patientId, file) {
    const record = {
      id: D?.uid ? D.uid("document") : `document-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      patientId: String(patientId),
      name: String(file.name || "document"),
      type: String(file.type || "application/octet-stream"),
      size: Number(file.size || 0),
      addedAt: new Date().toISOString(),
      blob: file
    };
    await withStore("readwrite", (store) => store.put(record));
    return record;
  }

  async function remove(id) {
    await withStore("readwrite", (store) => store.delete(String(id)));
  }

  function ensureDialog() {
    if (document.getElementById("documentsDialog")) return;
    const dialog = document.createElement("dialog");
    dialog.id = "documentsDialog";
    dialog.className = "documents-dialog";
    dialog.innerHTML = `
      <div class="modal-header">
        <div>
          <h2 id="documentsTitle">Patient Documents</h2>
          <p id="documentsSubtitle">-</p>
        </div>
        <button class="icon-button" id="documentsCloseTop" type="button" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body">
        <div class="document-warning">
          <strong>Prototype storage only.</strong> Attached files remain in this browser's IndexedDB and are not shared with another computer. Use fictional test files only.
        </div>
        <div class="document-upload-panel">
          <div class="field">
            <label for="documentFiles">Choose documents</label>
            <input id="documentFiles" type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.webp">
            <span class="field-hint">Up to 10 MB per file and 20 files per fictional patient.</span>
          </div>
          <button class="btn btn-primary" id="uploadDocumentsButton" type="button">Attach Selected Files</button>
        </div>
        <div class="document-list-heading">
          <h3>Attached Documents</h3>
          <span id="documentCountLabel">0 documents</span>
        </div>
        <div id="documentsList" class="documents-list"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="documentsCloseBottom" type="button">Close</button>
      </div>
    `;
    document.body.appendChild(dialog);

    const close = () => dialog.close();
    document.getElementById("documentsCloseTop").addEventListener("click", close);
    document.getElementById("documentsCloseBottom").addEventListener("click", close);
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    document.getElementById("uploadDocumentsButton").addEventListener("click", uploadSelected);
    document.getElementById("documentsList").addEventListener("click", handleListAction);
  }

  function message(text, type = "success") {
    let region = document.getElementById("toastRegion");
    if (!region) {
      region = document.createElement("div");
      region.id = "toastRegion";
      region.className = "toast-region";
      region.setAttribute("aria-live", "polite");
      document.body.appendChild(region);
    }
    const toast = document.createElement("div");
    toast.className = `toast${type === "error" ? " error" : ""}`;
    toast.textContent = text;
    region.appendChild(toast);
    window.setTimeout(() => toast.remove(), 4200);
  }

  function formatAddedAt(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
  }

  function fileTypeLabel(record) {
    const extension = record.name.includes(".") ? record.name.split(".").pop().toUpperCase() : "FILE";
    return extension.slice(0, 8);
  }

  async function renderList() {
    const container = document.getElementById("documentsList");
    if (!currentPatient) return;
    container.innerHTML = '<div class="document-loading">Loading attached documents...</div>';

    try {
      currentRecords = await list(currentPatient.id);
      const label = `${currentRecords.length} ${currentRecords.length === 1 ? "document" : "documents"}`;
      document.getElementById("documentCountLabel").textContent = label;
      if (!currentRecords.length) {
        container.innerHTML = `
          <div class="document-empty">
            <strong>No documents attached</strong>
            Select fictional test files above to demonstrate the attachment workflow.
          </div>
        `;
      } else {
        container.innerHTML = currentRecords.map((record) => `
          <article class="document-item">
            <div class="document-type">${D.escapeHtml(fileTypeLabel(record))}</div>
            <div class="document-info">
              <strong title="${D.escapeHtml(record.name)}">${D.escapeHtml(record.name)}</strong>
              <span>${D.formatFileSize(record.size)} · Attached ${D.escapeHtml(formatAddedAt(record.addedAt))}</span>
            </div>
            <div class="document-actions">
              <button class="btn btn-ghost btn-small" type="button" data-document-action="open" data-document-id="${D.escapeHtml(record.id)}">Open</button>
              <button class="btn btn-secondary btn-small" type="button" data-document-action="download" data-document-id="${D.escapeHtml(record.id)}">Download</button>
              <button class="btn btn-danger btn-small" type="button" data-document-action="delete" data-document-id="${D.escapeHtml(record.id)}">Delete</button>
            </div>
          </article>
        `).join("");
      }
      document.dispatchEvent(new CustomEvent("ackerman-docs-changed", { detail: { patientId: currentPatient.id, count: currentRecords.length } }));
    } catch (error) {
      container.innerHTML = `<div class="document-empty"><strong>Document storage unavailable</strong>${D.escapeHtml(error.message)}</div>`;
      message(error.message, "error");
    }
  }

  async function uploadSelected() {
    if (!currentPatient) return;
    const input = document.getElementById("documentFiles");
    const files = Array.from(input.files || []);
    if (!files.length) {
      message("Choose at least one fictional test file to attach.", "error");
      return;
    }

    let existingCount;
    try {
      existingCount = await count(currentPatient.id);
    } catch (error) {
      message(error.message, "error");
      return;
    }

    if (existingCount + files.length > MAX_FILES_PER_PATIENT) {
      message(`A patient can have no more than ${MAX_FILES_PER_PATIENT} prototype documents.`, "error");
      return;
    }

    const oversized = files.find((file) => file.size > MAX_FILE_SIZE);
    if (oversized) {
      message(`${oversized.name} exceeds the 10 MB prototype limit.`, "error");
      return;
    }

    const button = document.getElementById("uploadDocumentsButton");
    button.disabled = true;
    button.textContent = "Attaching...";
    try {
      for (const file of files) {
        const record = await add(currentPatient.id, file);
        document.dispatchEvent(new CustomEvent("ackerman-document-event", {
          detail: { patientId: currentPatient.id, action: "attached", name: record.name, documentId: record.id }
        }));
      }
      input.value = "";
      await renderList();
      message(`${files.length} ${files.length === 1 ? "document" : "documents"} attached to ${currentPatient.name}.`);
    } catch (error) {
      message(error.message || "Could not attach the selected documents.", "error");
    } finally {
      button.disabled = false;
      button.textContent = "Attach Selected Files";
    }
  }

  function getCurrentRecord(id) {
    return currentRecords.find((record) => record.id === id);
  }

  async function handleListAction(event) {
    const button = event.target.closest("button[data-document-action]");
    if (!button) return;
    const record = getCurrentRecord(button.dataset.documentId);
    if (!record) return;

    if (button.dataset.documentAction === "open") {
      const url = URL.createObjectURL(record.blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      return;
    }

    if (button.dataset.documentAction === "download") {
      const url = URL.createObjectURL(record.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = record.name;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      return;
    }

    if (button.dataset.documentAction === "delete") {
      if (!window.confirm(`Delete the prototype attachment "${record.name}"?`)) return;
      try {
        await remove(record.id);
        document.dispatchEvent(new CustomEvent("ackerman-document-event", {
          detail: { patientId: currentPatient.id, action: "deleted", name: record.name, documentId: record.id }
        }));
        await renderList();
        message(`${record.name} deleted from ${currentPatient.name}.`);
      } catch (error) {
        message(error.message || "Could not delete the attachment.", "error");
      }
    }
  }

  async function open(patient) {
    ensureDialog();
    currentPatient = patient;
    document.getElementById("documentsTitle").textContent = `${patient.name} Documents`;
    document.getElementById("documentsSubtitle").textContent = `${patient.mrn} · Local prototype attachments`;
    document.getElementById("documentFiles").value = "";
    document.getElementById("documentsDialog").showModal();
    await renderList();
  }

  async function clearAll() {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("Could not clear prototype documents."));
    });
  }

  ensureDialog();
  window.AckermanDocuments = { open, list, count, clearAll };
})();
