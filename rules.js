window.addEventListener("DOMContentLoaded", async () => {
  const statusEl           = document.getElementById("mgStatus");
  const mgIrtFileInput     = document.getElementById("mgIrtFile");
  const runValidationBtn   = document.getElementById("runValidation");
  const clearValidationBtn = document.getElementById("mgIrtclearBtn");
  const clearCacheBtn      = document.getElementById("clearCacheBtn");
  const resultsContainer   = document.getElementById("validationResults");

  // ─── IndexedDB helpers ────────────────────────────────────────────────────────
  const DB_NAME    = "gsrsdi";
  const DB_VERSION = 1;
  const STORE_NAME = "mgirt";

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        e.target.result.createObjectStore(STORE_NAME);
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  async function saveToDB(data) {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(data, "mgirt_data");
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror    = (e) => reject(e.target.error);
    });
  }

  async function loadFromDB() {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    return new Promise((resolve, reject) => {
      const req = tx.objectStore(STORE_NAME).get("mgirt_data");
      req.onsuccess = (e) => resolve(e.target.result || null);
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  async function clearDB() {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete("mgirt_data");
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror    = (e) => reject(e.target.error);
    });
  }

  // ─── Required headers ─────────────────────────────────────────────────────────
    const REQUIRED_DI_HEADERS     = ["Local Code", "Name", "Address", "City", "Postal Code", "Area Code", "Phone", "State", "Status", "MG Local Code", "IRT Local Code"];
    const REQUIRED_MGIRT_HEADERS  = ["ACCOUNT_NAME", "TDLINX_ACCOUNT_CODE", "ACC_IMMEDIATE_REPORT_TO"];

    // ─── Header validator ─────────────────────────────────────────────────────────
    function validateHeaders(actualHeaders, requiredHeaders) {
      const trimmed = actualHeaders.map(h => h.trim());
      const missing = requiredHeaders.filter(r => !trimmed.includes(r));
      return missing;
    }

    async function reloadMgIrtData() {
      try {
        const cached = await loadFromDB();
        if (cached && cached.length > 0) {
          mgIrtData = cached;
          statusEl.innerHTML = `<span class="badge badge-custom-success rounded-pill"><i class="bi bi-check-circle-fill me-1"></i>MG & IRT loaded from cache (${mgIrtData.length} records)</span>`;
          document.getElementById("clearCacheItem").style.display = "block";
        } else {
          statusEl.innerHTML = `<span class="badge bg-warning text-dark rounded-pill"><i class="bi bi-arrow-up-circle-fill me-1"></i>Please upload MG & IRT file</span>`;
        }
      } catch (err) {
        console.error("IndexedDB load error:", err);
        statusEl.innerHTML = `<span class="badge bg-warning text-dark rounded-pill"><i class="bi bi-upload me-1"></i>Please upload MG & IRT file</span>`;
      }
    }

  // ─── Normalizers ──────────────────────────────────────────────────────────────
  function normalizeNameBase(name) {
    return (name || "")
      .replace(/\/[A-Z]{2}$/, "") // strip state/EM suffix e.g. /NM /KS /EM
      .toLowerCase()
      .replace(/\s*&\s*/g, " and ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeCode(code) {
    return (code || "").toString().trim();
  }

  // ─── Row normalizer ───────────────────────────────────────────────────────────
  function normalizeRow(row) {
    const sixDigitFields = [
      "TDLINX_ACCOUNT_CODE",
      "ACC_IMMEDIATE_REPORT_TO",
      "MG Local Code",
      "IRT Local Code",
      "Local Code"
    ];

    const sevenDigitFields = [
      "Local Code"
    ];

    const normalized = {};
    for (const key in row) {
      const cleanKey = key.trim();
      let val = row[key];
      if (typeof val === "number") val = val.toString();
      if (typeof val === "string") val = val.trim();
      if (val === null || val === undefined) val = "";

      // Pad code fields to 6 digits
      if (sixDigitFields.includes(cleanKey) && val !== "") {
        val = val.padStart(6, "0");
      }

      // Pad code fields to 7 digits
      if (sevenDigitFields.includes(cleanKey) && val !== "") {
        val = val.padStart(7, "0");
      }
      
      normalized[cleanKey] = val;
    }
    return normalized;
  }

  // ─── Load from IndexedDB on startup ──────────────────────────────────────────
  let mgIrtData = null;
  statusEl.innerHTML = `<span class="badge bg-secondary rounded-pill"><i class="bi bi-hourglass-split me-1"></i>Loading MG & IRT data...</span>`;

  try {
    const cached = await loadFromDB();
    if (cached && cached.length > 0) {
      mgIrtData = cached;
      statusEl.innerHTML = `<span class="badge badge-custom-success rounded-pill"><i class="bi bi-check-circle-fill me-1"></i>MG & IRT loaded from cache (${mgIrtData.length} records)</span>`;
      document.getElementById("clearCacheItem").style.display = "block";
    } else {
      statusEl.innerHTML = `<span class="badge bg-warning text-dark rounded-pill"><i class="bi bi-arrow-up-circle-fill me-1"></i>Please upload MG & IRT file</span>`;
    }
  } catch (err) {
    console.error("IndexedDB load error:", err);
    statusEl.innerHTML = `<span class="badge bg-warning text-dark rounded-pill"><i class="bi bi-arrow-up-circle-fill me-1"></i>Please upload MG & IRT file</span>`;
  }

  // ─── MG/IRT file upload (CSV or Excel) ───────────────────────────────────────
  mgIrtFileInput.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const isExcel = /\.(xlsx|xls)$/i.test(file.name);

    if (isExcel) {
      statusEl.innerHTML = `<span class="badge bg-secondary rounded-pill"><i class="bi bi-hourglass-split me-1"></i>Reading Excel file...</span>`;
      const reader = new FileReader();
      reader.onload = function (e) {
        setTimeout(() => {
          const wb = XLSX.read(new Uint8Array(e.target.result), {
            type:        "array",
            cellFormula: false,
            cellHTML:    false,
            cellStyles:  false,
            cellDates:   false,
            sheetStubs:  false,
          });
          const ws  = wb.Sheets[wb.SheetNames[0]];
          mgIrtData = XLSX.utils.sheet_to_json(ws, { defval: "" });
          if (mgIrtData.length === 0) {
            alert("☹️ No data found in the MG & IRT file. Please check the file and try again.");
            mgIrtFileInput.value = "";
            reloadMgIrtData();
            return;
          }

          const missing = validateHeaders(Object.keys(mgIrtData[0]), REQUIRED_MGIRT_HEADERS);
          if (missing.length > 0) {
            alert(`❗ Invalid MG & IRT file. Please check the file and try again.`);
            mgIrtFileInput.value = "";
            reloadMgIrtData();
            return;
          }

          saveToDB(mgIrtData).catch(err => console.error("IndexedDB save error:", err));
          document.getElementById("clearCacheItem").style.display = "none";
          statusEl.innerHTML = `<span class="badge badge-custom-success rounded-pill"><i class="bi bi-check-circle-fill me-1"></i>Using uploaded MG & IRT file (${mgIrtData.length} records)</span>`;
        }, 50);
      };
      reader.readAsArrayBuffer(file);
    } else {
      statusEl.innerHTML = `<span class="badge bg-secondary rounded-pill"><i class="bi bi-hourglass-split me-1"></i>Reading CSV file...</span>`;
      Papa.parse(file, {
        header: true,
        complete: (r) => {
          if (!r.data || r.data.length === 0) {
            alert("☹️ No data found in the MG & IRT file. Please check the file and try again.");
            mgIrtFileInput.value = "";
            reloadMgIrtData();
            return;
          }

          const missing = validateHeaders(r.meta.fields || [], REQUIRED_MGIRT_HEADERS);
          if (missing.length > 0) {
            alert(`❗ Invalid MG & IRT file. Please check the file and try again.`);
            mgIrtFileInput.value = "";
            reloadMgIrtData();
            return;
          }

          mgIrtData = r.data;
          saveToDB(mgIrtData).catch(err => console.error("IndexedDB save error:", err));
          document.getElementById("clearCacheItem").style.display = "none";
          statusEl.innerHTML = `<span class="badge badge-custom-success rounded-pill"><i class="bi bi-check-circle-fill me-1"></i>Using uploaded MG & IRT file (${mgIrtData.length} records)</span>`;
        },
      });
    }
  });

  // ─── Clear cache button ───────────────────────────────────────────────────────
  clearCacheBtn.addEventListener("click", (e) => {
    e.preventDefault();
    clearDB().then(() => {
      mgIrtData = null;
      document.getElementById("clearCacheItem").style.display = "none";
      statusEl.innerHTML = `<span class="badge bg-warning text-dark rounded-pill"><i class="bi bi-arrow-up-circle-fill me-1"></i>Please upload MG & IRT file</span>`;
    }).catch(err => {
      console.error("Error clearing cache:", err);
    });
  });

  // Partial Match
  function findMgCandidatesByPartialName(diNameNorm, mgMapByName) {
    let candidates = mgMapByName.get(diNameNorm);
    if (candidates) return candidates;

    // fallback: search keys for substring match
    for (let [mgNameNorm, mgRows] of mgMapByName.entries()) {
      if (diNameNorm.includes(mgNameNorm) || mgNameNorm.includes(diNameNorm)) {
        return mgRows;
      }
    }
    return null;
  }

  // ─── Best MG entry picker (state + EM aware) ──────────────────────────────────
  function pickBestMgEntry(candidates, diState, diTrade) {
    if (!candidates || candidates.length === 0) return null;

    const emTrades = ["[09] Unknown Retailers", "[59] Unknown On-Premise"];

    // If trade is EM-eligible, try /EM first
    if (emTrades.includes(diTrade)) {
      const emMatch = candidates.find(c => c.stateSuffix === "EM");
      if (emMatch) return emMatch.row;
    }

    // Try state-specific match
    if (diState) {
      const stateMatch = candidates.find(c => c.stateSuffix === diState);
      if (stateMatch) return stateMatch.row;
    }

    // Fall back to first match
    return candidates[0].row;
  }

  // ─── Shared matching logic ────────────────────────────────────────────────────
  function processMgIrtMatches(diData, mgIrtData, resultsContainer) {
    let matches = [];

    const mgMapByName = new Map();
    const mgMapByCode = new Map();

    // Build reference maps
    mgIrtData.forEach((rawRow) => {
      const row      = normalizeRow(rawRow);
      const fullName = (row["ACCOUNT_NAME"] || "").trim();
      const normCode = normalizeCode(row["TDLINX_ACCOUNT_CODE"]);

      // Extract state/EM suffix e.g. "Pic Quick/NM" → "NM", "Store/EM" → "EM"
      const stateSuffixMatch = fullName.match(/\/([A-Z]{2})$/);
      const stateSuffix      = stateSuffixMatch ? stateSuffixMatch[1] : null;
      const baseName         = normalizeNameBase(fullName);

      // Group by base name with suffix info
      if (!mgMapByName.has(baseName)) mgMapByName.set(baseName, []);
      mgMapByName.get(baseName).push({ row, stateSuffix });

      if (normCode) mgMapByCode.set(normCode, row);
    });

    // Match DI rows
    diData.forEach((rawRow) => {
      const diRow           = normalizeRow(rawRow);
      const diName          = (diRow["Name"] || "").trim();
      const diNameNorm      = normalizeNameBase(diName);
      const mgLocalCodeNorm = normalizeCode(diRow["MG Local Code"]);
      const irtLocalCode    = (diRow["IRT Local Code"] || "").trim();
      const diTrade         = (diRow["Local Trade Channel"] || "").trim();

      // Extract state code from DI state field e.g. "[NM] New Mexico" → "NM"
      const diStateMatch = (diRow["State"] || "").match(/\[([A-Z]{2})\]/);
      const diState      = diStateMatch ? diStateMatch[1] : null;

      if (!mgLocalCodeNorm && !irtLocalCode && diNameNorm && mgMapByName.has(diNameNorm)) {
        // Strategy 1: name match with state + EM aware selection
        const candidates = findMgCandidatesByPartialName(diNameNorm, mgMapByName);
        const mgRow      = pickBestMgEntry(candidates, diState, diTrade);
        if (mgRow) {
          matches.push({
            diId:     diRow["Local Code"],
            diName,
            diStatus: diRow["Status"],
            mgName:   mgRow["ACCOUNT_NAME"],
            mgId:     mgRow["TDLINX_ACCOUNT_CODE"],
            irtId:    mgRow["ACC_IMMEDIATE_REPORT_TO"],
          });
        }
      } else if (mgLocalCodeNorm && !irtLocalCode) {
        // Strategy 2: MG code match (fallback to name)
        const mgRowByCode = mgMapByCode.get(mgLocalCodeNorm);
        const candidates  = findMgCandidatesByPartialName(diNameNorm, mgMapByName);
        const mgRowByName = pickBestMgEntry(candidates, diState, diTrade);
        const mgRow       = mgRowByCode || mgRowByName;
        if (mgRow && mgRow["ACC_IMMEDIATE_REPORT_TO"]) {
          matches.push({
            diId:     diRow["Local Code"],
            diName,
            diStatus: diRow["Status"],
            mgName:   mgRow["ACCOUNT_NAME"],
            mgId:     mgRow["TDLINX_ACCOUNT_CODE"],
            irtId:    mgRow["ACC_IMMEDIATE_REPORT_TO"],
          });
        }
      } else if (!mgLocalCodeNorm && irtLocalCode) {
        // Strategy 3: IRT present, MG missing — match by name
        const candidates  = findMgCandidatesByPartialName(diNameNorm, mgMapByName);
        const mgRowByName = pickBestMgEntry(candidates, diState, diTrade);
        if (mgRowByName) {
          matches.push({
            diId:     diRow["Local Code"],
            diName,
            diStatus: diRow["Status"],
            mgName:   mgRowByName["ACCOUNT_NAME"] || "Missing MG",
            mgId:     mgRowByName["TDLINX_ACCOUNT_CODE"] || "Missing MG",
            irtId:    irtLocalCode,
          });
        }
      }
    });

      resultsContainer.innerHTML = buildResultsTable(matches);

      document.getElementById("mgIssueCount").innerHTML = `
        <span class="material-icons-outlined me-1" style="font-size:20px;">error_outline</span>
        <span>Total Matches: ${matches.length}</span>
      `;

  }

  // ─── Validate button ──────────────────────────────────────────────────────────
  runValidationBtn.addEventListener("click", async () => {
    const diFile  = document.getElementById("diFile").files[0];
    if (!diFile) {
      alert("Please upload the DI file.");
      return;
    }

    const isExcelFile = /\.(xlsx|xls)$/i.test(diFile.name);
    const isCsvFile   = /\.csv$/i.test(diFile.name) || diFile.type === "text/csv";
    const isXlsx      = document.getElementById("xlsxToggle").checked;

    // File type guards
    if (isExcelFile && !isXlsx) {
      alert("Please turn on XLSX Mode to upload an Excel file.");
      return;
    }
    if (isCsvFile && isXlsx) {
      alert("XLSX Mode is on. Please upload an Excel file (.xlsx or .xls).");
      return;
    }
    if (!isExcelFile && !isCsvFile) {
      alert("Invalid file type. Please upload a CSV or Excel (.xlsx) file.");
      return;
    }

    if (!mgIrtData) {
      alert("MG & IRT data not available. Please upload your MG & IRT file. Get the file from 'More Options' below");
      return;
    }

    // Setup loader
    function showLoader() {
      document.getElementById("validationResults").innerHTML = `
        <div style="display:flex; justify-content:center; align-items:center; height:50px;">
          <div class="spinner-border text-primary" role="status" style="width:1.5rem; height:1.5rem;">
            <span class="visually-hidden">Loading...</span>
          </div>
          <span class="ms-3">Matching DI file against MG/IRT data...</span>
        </div>
      `;
    }

    function showNotificationToast() {
      const statusBar = document.getElementById("statusBar"); // your bar element
      const toastContainer = document.getElementById("notifyContainer");

      if (statusBar && toastContainer) {
        const barHeight = statusBar.offsetHeight;
        toastContainer.style.bottom = `${barHeight + 16}px`; // 16px gap above bar
      }

      const toastEl = document.getElementById("notifyToast");
      const toast = new bootstrap.Toast(toastEl, { autohide: true, delay: 3000 });
      toast.show();
    }

    // Parse DI file and run matching
    if (isExcelFile) {
      const reader = new FileReader();
      reader.onload = function (e) {
        setTimeout(() => {
          const wb     = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
          const ws     = wb.Sheets[wb.SheetNames[0]];
          const diData = XLSX.utils.sheet_to_json(ws, { defval: "" });

          if (diData.length === 0) {
            alert("☹️ No data found in the DI file. Please check the file and try again.");
            document.getElementById("diFile").value = "";
            return;
          }

          const missing = validateHeaders(Object.keys(diData[0]), REQUIRED_DI_HEADERS);
          if (missing.length > 0) {
            alert(`❗ Invalid DI file. Please check the file and try again.`);
            document.getElementById("diFile").value = "";
            return;
          }

          showLoader();
          setTimeout(() => {
            showNotificationToast();
            processMgIrtMatches(diData, mgIrtData, resultsContainer);
          }, 450);
        }, 50);
      };
      reader.readAsArrayBuffer(diFile);
    } else {
      
      Papa.parse(diFile, {
        header: true,
        complete: (r) => {
          if (!r.data || r.data.length === 0) {
            alert("No data found in the DI file. Please check the file and try again.");
            document.getElementById("diFile").value = "";
            return;
          }

          const missing = validateHeaders(r.meta.fields || [], REQUIRED_DI_HEADERS);
          if (missing.length > 0) {
            alert(`❗ Invalid DI file. Please check the file and try again.`);
            document.getElementById("diFile").value = "";
            return;
          }

          showLoader();
          setTimeout(() => {
            showNotificationToast();
            processMgIrtMatches(r.data, mgIrtData, resultsContainer);
          }, 500);
        },
      });
    }
  });

  // ─── Clear button ─────────────────────────────────────────────────────────────
  clearValidationBtn.addEventListener("click", async () => {
    resultsContainer.innerHTML = "Upload DI file and click validate to display matches";
    document.getElementById("mgIssueCount").innerHTML = "";
    document.getElementById("diFile").value = "";
    mgIrtFileInput.value = "";
    try {
    const cached = await loadFromDB();
    if (cached && cached.length > 0) {
      mgIrtData = cached;
      statusEl.innerHTML = `<span class="badge badge-custom-success rounded-pill"><i class="bi bi-check-circle-fill me-1"></i>MG & IRT loaded from cache (${mgIrtData.length} records)</span>`;
      document.getElementById("clearCacheItem").style.display = "block";
    } else {
      statusEl.innerHTML = `<span class="badge bg-warning text-dark rounded-pill"><i class="bi bi-arrow-up-circle-fill me-1"></i>Please upload MG & IRT file</span>`;
    }
  } catch (err) {
    console.error("IndexedDB load error:", err);
    statusEl.innerHTML = `<span class="badge bg-warning text-dark rounded-pill"><i class="bi bi-upload me-1"></i>Please upload MG & IRT file</span>`;
  }
    document.getElementById("mgIrtCardHead").classList.remove("bg-primary");
    document.getElementById("mgIrtCardHead").classList.add("bg-secondary");
  });

  // ─── Results table builder ────────────────────────────────────────────────────
  function buildResultsTable(matches) {
    document.getElementById("mgIrtCardHead").classList.remove("bg-secondary");
    document.getElementById("mgIrtCardHead").classList.add("bg-primary");

    if (matches.length === 0) {
      document.getElementById("mgIssueCount").innerHTML = `
        <span class="material-icons-outlined me-1" style="font-size:20px;">error_outline</span>
        <span>Total Matches: 0</span>
      `;
      return `
        <div class="alert alert-success mt-3 text-center">
          No matches found!
        </div>
      `;
    }

    return `
      <table class="table table-bordered table-striped mt-3">
        <thead class="table-light">
          <tr>
            <th>Store Status</th>
            <th>Local Code (DI)</th>
            <th>Name (DI)</th>
            <th>MG Account ID</th>
            <th>IRT Account ID</th>
            <th>MG Account Name</th>
          </tr>
        </thead>
        <tbody>
          ${matches.map(m => `
            <tr class="table-warning">
              <td>${m.diStatus}</td>
              <td>${m.diId}</td>
              <td>${m.diName}</td>
              <td>${m.mgId}</td>
              <td>${m.irtId}</td>
              <td>${m.mgName}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    `;
  }
});
