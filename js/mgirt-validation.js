window.addEventListener("DOMContentLoaded", async () => {
  const statusEl = document.getElementById("mgStatus");
  const mgIrtFileInput = document.getElementById("mgIrtFile");
  const runValidationBtn = document.getElementById("runValidation");
  const clearValidationBtn = document.getElementById("mgIrtclearBtn");
  const clearCacheBtn = document.getElementById("clearCacheBtn");
  const resultsContainer = document.getElementById("validationResults");

  // ─── IndexedDB helpers ────────────────────────────────────────────────────────
  const DB_NAME = "gsrsdi";
  const DB_VERSION = 1;
  const STORE_NAME = "mgirt";

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        e.target.result.createObjectStore(STORE_NAME);
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async function saveToDB(data) {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(data, "mgirt_data");
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  async function loadFromDB() {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    return new Promise((resolve, reject) => {
      const req = tx.objectStore(STORE_NAME).get("mgirt_data");
      req.onsuccess = (e) => resolve(e.target.result || null);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async function clearDB() {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete("mgirt_data");
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  // ─── Required headers ─────────────────────────────────────────────────────────
  const REQUIRED_DI_HEADERS = [
    "Local Code",
    "Name",
    "Address",
    "City",
    "Postal Code",
    "Area Code",
    "Phone",
    "State",
    "Status",
    "MG Local Code",
    "IRT Local Code",
    "Local Trade Channel",
  ];
  const REQUIRED_MGIRT_HEADERS = [
    "ACCOUNT_NAME",
    "TDLINX_ACCOUNT_CODE",
    "ACC_IMMEDIATE_REPORT_TO",
  ];

  // ─── Header validator ─────────────────────────────────────────────────────────
  function validateHeaders(actualHeaders, requiredHeaders) {
    const trimmed = actualHeaders.map((h) => h.trim());
    const missing = requiredHeaders.filter((r) => !trimmed.includes(r));
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
      .replace(/\/[A-Z]{2}$/, "") // remove /EM /KS /NM etc
      .toLowerCase()
      .replace(/\s*&\s*/g, " and ")
      .replace(/\b(mini mart|food mart|convenience store)\b/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeCode(code) {
    return (code || "").toString().trim();
  }

  function getTradeType(diTradeChannel, diSubChannel) {
    if (!diTradeChannel) return null;

    // Bakery exception
    if ((diSubChannel || "").includes("[F] Meat/Fish/Fruit/Bakery")) {
      return "[50]";
    }

    const retailChannels = [
      "[01]",
      "[02]",
      "[03]",
      "[04]",
      "[05]",
      "[06]",
      "[07]",
      "[08]",
      "[09]",
      "[11]",
      "[13]",
      "[14]",
    ];

    if (retailChannels.some((code) => diTradeChannel.startsWith(code))) {
      return "[C]";
    }

    const onPremiseChannels = [
      "[50]",
      "[51]",
      "[52]",
      "[53]",
      "[54]",
      "[55]",
      "[57]",
      "[59]",
    ];

    if (onPremiseChannels.some((code) => diTradeChannel.startsWith(code))) {
      return "[P]";
    }

    return null;
  }

  // ─── Row normalizer ───────────────────────────────────────────────────────────
  function normalizeRow(row) {
    const sixDigitFields = [
      "TDLINX_ACCOUNT_CODE",
      "ACC_IMMEDIATE_REPORT_TO",
      "MG Local Code",
      "IRT Local Code",
    ];

    const sevenDigitFields = ["Local Code"];

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
            type: "array",
            cellFormula: false,
            cellHTML: false,
            cellStyles: false,
            cellDates: false,
            sheetStubs: false,
          });
          const ws = wb.Sheets[wb.SheetNames[0]];
          mgIrtData = XLSX.utils.sheet_to_json(ws, { defval: "" });
          if (mgIrtData.length === 0) {
            alert(
              "☹️ No data found in the MG & IRT file. Please check the file and try again.",
            );
            mgIrtFileInput.value = "";
            reloadMgIrtData();
            return;
          }

          const missing = validateHeaders(
            Object.keys(mgIrtData[0]),
            REQUIRED_MGIRT_HEADERS,
          );
          if (missing.length > 0) {
            alert(
              `❗ Invalid MG & IRT file. Please check the file and try again.`,
            );
            mgIrtFileInput.value = "";
            reloadMgIrtData();
            return;
          }

          saveToDB(mgIrtData).catch((err) =>
            console.error("IndexedDB save error:", err),
          );
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
            alert(
              "☹️ No data found in the MG & IRT file. Please check the file and try again.",
            );
            mgIrtFileInput.value = "";
            reloadMgIrtData();
            return;
          }

          const missing = validateHeaders(
            r.meta.fields || [],
            REQUIRED_MGIRT_HEADERS,
          );
          if (missing.length > 0) {
            alert(
              `❗ Invalid MG & IRT file. Please check the file and try again.`,
            );
            mgIrtFileInput.value = "";
            reloadMgIrtData();
            return;
          }

          mgIrtData = r.data;
          saveToDB(mgIrtData).catch((err) =>
            console.error("IndexedDB save error:", err),
          );
          document.getElementById("clearCacheItem").style.display = "none";
          statusEl.innerHTML = `<span class="badge badge-custom-success rounded-pill"><i class="bi bi-check-circle-fill me-1"></i>Using uploaded MG & IRT file (${mgIrtData.length} records)</span>`;
        },
      });
    }
  });

  // ─── Clear cache button ───────────────────────────────────────────────────────
  clearCacheBtn.addEventListener("click", (e) => {
    e.preventDefault();
    clearDB()
      .then(() => {
        mgIrtData = null;
        document.getElementById("clearCacheItem").style.display = "none";
        statusEl.innerHTML = `<span class="badge bg-warning text-dark rounded-pill"><i class="bi bi-arrow-up-circle-fill me-1"></i>Please upload MG & IRT file</span>`;
      })
      .catch((err) => {
        console.error("Error clearing cache:", err);
      });
  });

  // distance matching functions
  function levenshtein(a, b) {
    const m = [];
    for (let i = 0; i <= b.length; i++) {
      m[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      m[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        m[i][j] =
          b.charAt(i - 1) === a.charAt(j - 1)
            ? m[i - 1][j - 1]
            : Math.min(m[i - 1][j - 1] + 1, m[i][j - 1] + 1, m[i - 1][j] + 1);
      }
    }
    return m[b.length][a.length];
  }

  function similarityScore(a, b) {
    const distance = levenshtein(a.toLowerCase(), b.toLowerCase());
    const maxLen = Math.max(a.length, b.length);
    return 1 - distance / maxLen; // value between 0 and 1
  }

  function namesMatch(diName, mgName) {
    if (!diName || !mgName) return false;

    const a = diName.toLowerCase().trim();
    const b = mgName.toLowerCase().trim();

    if (a === b) return true;

    // Allow word-based brand match
    const normalizedA = a.replace(/^the\s+/, "");

    if (
      b.length >= 5 &&
      (normalizedA.startsWith(b + " ") || normalizedA === b)
    ) {
      return true;
    }

    return similarityScore(a, b) >= 0.9;
  }

  // Partial Match
  function findMgCandidatesByPartialName(diNameNorm, mgMapByName) {
    const candidates = [];

    for (const [mgNameNorm, mgRows] of mgMapByName.entries()) {
      if (mgNameNorm.length < 3) continue;

      if (namesMatch(diNameNorm, mgNameNorm)) {
        candidates.push(...mgRows);
      }
    }

    return candidates.length ? candidates : null;
  }

  // ─── Best MG entry picker (state + EM aware) ──────────────────────────────────
  function pickBestMgEntry(candidates, diState, diTrade, diSubChannel) {
    if (!candidates || candidates.length === 0) {
      return null;
    }

    let filtered = [...candidates];

    const emTrades = ["[09] Unknown Retailers", "[59] Unknown On-Premise"];

    // Prefer EM accounts
    if (emTrades.includes(diTrade)) {
      const emMatches = filtered.filter((c) => c.stateSuffix === "EM");

      if (emMatches.length) {
        filtered = emMatches;
      }
    }

    // Prefer state-specific accounts
    if (diState) {
      const stateMatches = filtered.filter((c) => c.stateSuffix === diState);

      if (stateMatches.length) {
        filtered = stateMatches;
      }
    }

    const expectedTradeType = getTradeType(diTrade, diSubChannel);

    const isBakery = (diSubChannel || "").includes(
      "[F] Meat/Fish/Fruit/Bakery",
    );

    if (expectedTradeType) {
      const tradeTypeMatches = filtered.filter((c) => {
        const mgTradeType = c.tradeType || "";

        const mgTradeChannel = c.tradeChannel || "";

        // Bakery can match Retail OR Dining
        if (isBakery) {
          return mgTradeType.startsWith("[C]") || mgTradeType.startsWith("[P]");
        }

        return mgTradeType.startsWith(expectedTradeType);
      });

      if (isBakery) {
        // Bakery can match either hierarchy
        if (tradeTypeMatches.length > 0) {
          filtered = tradeTypeMatches;
        }
      } else {
        // Non-bakery records MUST match hierarchy
        if (tradeTypeMatches.length === 0) {
          return null;
        }

        filtered = tradeTypeMatches;
      }
    }

    // Prefer matching trade channel
    // Prefer matching trade channel
    if (!isBakery && diTrade) {
      const tradeMatches = filtered.filter((c) => c.tradeChannel === diTrade);

      if (tradeMatches.length) {
        filtered = tradeMatches;
      }
    }

    if (!filtered || filtered.length === 0) {
      return null;
    }

    return filtered[0].row;
  }

  // ─── Shared matching logic ────────────────────────────────────────────────────
  function processMgIrtMatches(diData, mgIrtData, resultsContainer) {
    let matches = [];

    const mgMapByName = new Map();
    const mgMapByCode = new Map();

    // Build reference maps
    mgIrtData.forEach((rawRow) => {
      const row = normalizeRow(rawRow);
      // debug temp
      if ((row["ACCOUNT_NAME"] || "").toLowerCase().includes("daylight")) {
        console.log("DAYLIGHT MG ROW:", row);
      }
      const fullName = (row["ACCOUNT_NAME"] || "").trim();
      const normCode = normalizeCode(row["TDLINX_ACCOUNT_CODE"]);

      // DEBUG DAYLIGHT DONUTS
      if (normCode === "2670182" || normCode === "670182") {
        console.log("MG FILE ROW:", row);
      }

      // Extract state/EM suffix e.g. "Pic Quick/NM" → "NM", "Store/EM" → "EM"
      const stateSuffixMatch = fullName.match(/\/([A-Z]{2})$/);
      const stateSuffix = stateSuffixMatch ? stateSuffixMatch[1] : null;
      const baseName = normalizeNameBase(fullName);

      // Group by base name with suffix info
      if (!mgMapByName.has(baseName)) mgMapByName.set(baseName, []);
      mgMapByName.get(baseName).push({
        row,
        stateSuffix,
        tradeType: row["ACC_TDLINX_TRADE_TYPE"] || "",
        tradeChannel: row["ACC_TDLINX_TRADE_CHANNEL"] || "",
        subChannel: row["ACC_TDLINX_SUB_CHANNEL"] || "",
      });

      if (normCode) mgMapByCode.set(normCode, row);
    });

    // Match DI rows
    diData.forEach((rawRow) => {
      const diRow = normalizeRow(rawRow);
      const diName = (diRow["Name"] || "").trim();
      const diNameNorm = normalizeNameBase(diName);
      const mgLocalCodeNorm = normalizeCode(diRow["MG Local Code"]);
      const irtLocalCode = (diRow["IRT Local Code"] || "").trim();
      const diTrade = (diRow["Local Trade Channel"] || "").trim();
      const diStatus = (diRow["Status"] || "").trim();

      // Extract state code from DI state field e.g. "[NM] New Mexico" → "NM"
      const diStateMatch = (diRow["State"] || "").match(/\[([A-Z]{2})\]/);
      const diState = diStateMatch ? diStateMatch[1] : null;

      // Process Open and Future Opening stores only
      if (!diStatus.startsWith("[OP]") && !diStatus.startsWith("[FO]")) {
        return;
      }

      if (!mgLocalCodeNorm && !irtLocalCode && diNameNorm) {
        // Strategy 1
        const candidates = findMgCandidatesByPartialName(
          diNameNorm,
          mgMapByName,
        );

        const mgRow = pickBestMgEntry(
          candidates,
          diState,
          diTrade,
          diRow["Local Sub Channel"],
        );

        if (mgRow) {
          let missingType = "";

          if (
            mgRow["TDLINX_ACCOUNT_CODE"] &&
            mgRow["ACC_IMMEDIATE_REPORT_TO"]
          ) {
            missingType = "MG & IRT";
          } else if (mgRow["TDLINX_ACCOUNT_CODE"]) {
            missingType = "MG";
          } else if (mgRow["ACC_IMMEDIATE_REPORT_TO"]) {
            missingType = "IRT";
          }

          matches.push({
            diId: diRow["Local Code"],
            diName,
            diStatus: diRow["Status"],
            diChannel: diRow["Local Sub Channel"],
            mgName: mgRow["ACCOUNT_NAME"],
            mgChannel: mgRow["ACC_TDLINX_SUB_CHANNEL"] || "-",
            mgId: mgRow["TDLINX_ACCOUNT_CODE"],
            irtId: mgRow["ACC_IMMEDIATE_REPORT_TO"],
            missingType,
          });
        }
      } else if (mgLocalCodeNorm && !irtLocalCode) {
        // Strategy 2
        const mgRowByCode = mgMapByCode.get(mgLocalCodeNorm);

        if (mgRowByCode && mgRowByCode["ACC_IMMEDIATE_REPORT_TO"]) {
          matches.push({
            diId: diRow["Local Code"],
            diName,
            diStatus: diRow["Status"],
            diChannel: diRow["Local Sub Channel"],
            mgName: mgRowByCode["ACCOUNT_NAME"],
            mgChannel: mgRowByCode["ACC_TDLINX_SUB_CHANNEL"] || "-",
            mgId: mgRowByCode["TDLINX_ACCOUNT_CODE"],
            irtId: mgRowByCode["ACC_IMMEDIATE_REPORT_TO"],
            missingType: "IRT",
          });
        }
      } else if (!mgLocalCodeNorm && irtLocalCode) {
        // Strategy 3
        const candidates = findMgCandidatesByPartialName(
          diNameNorm,
          mgMapByName,
        );

        const mgRowByName = pickBestMgEntry(
          candidates,
          diState,
          diTrade,
          diRow["Local Sub Channel"],
        );

        if (mgRowByName) {
          const mgNameNorm = normalizeNameBase(mgRowByName["ACCOUNT_NAME"]);

          // if (
          //     diNameNorm.includes(mgNameNorm) ||
          //     mgNameNorm.includes(diNameNorm) ||
          //     similarityScore(diNameNorm, mgNameNorm) >= 0.85
          // ) {

          if (mgRowByName) {
            matches.push({
              diId: diRow["Local Code"],
              diName,
              diStatus: diRow["Status"],
              diChannel: diRow["Local Sub Channel"],
              mgName: mgRowByName["ACCOUNT_NAME"],
              mgChannel: mgRowByName["ACC_TDLINX_SUB_CHANNEL"] || "-",
              mgId: mgRowByName["TDLINX_ACCOUNT_CODE"],
              irtId: irtLocalCode,
              missingType: "MG",
            });
          }
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
    const diFile = document.getElementById("diFile").files[0];
    if (!diFile) {
      alert("Please upload the DI file.");
      return;
    }

    const isExcelFile = /\.(xlsx|xls)$/i.test(diFile.name);
    const isCsvFile = /\.csv$/i.test(diFile.name) || diFile.type === "text/csv";
    const isXlsx = document.getElementById("xlsxToggle").checked;

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
      alert(
        "MG & IRT data not available. Please upload your MG & IRT file. Get the file from 'More Options' below",
      );
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
      const toast = new bootstrap.Toast(toastEl, {
        autohide: true,
        delay: 3000,
      });
      toast.show();
    }

    // Parse DI file and run matching
    if (isExcelFile) {
      const reader = new FileReader();
      reader.onload = function (e) {
        setTimeout(() => {
          const wb = XLSX.read(new Uint8Array(e.target.result), {
            type: "array",
          });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const diData = XLSX.utils.sheet_to_json(ws, { defval: "" });

          if (diData.length === 0) {
            alert(
              "☹️ No data found in the DI file. Please check the file and try again.",
            );
            document.getElementById("diFile").value = "";
            return;
          }

          const missing = validateHeaders(
            Object.keys(diData[0]),
            REQUIRED_DI_HEADERS,
          );
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
            alert(
              "No data found in the DI file. Please check the file and try again.",
            );
            document.getElementById("diFile").value = "";
            return;
          }

          const missing = validateHeaders(
            r.meta.fields || [],
            REQUIRED_DI_HEADERS,
          );
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
    resultsContainer.innerHTML =
      "Upload DI file and click validate to display matches";
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
<div>

${matches
  .map(
    (m) => `

<div style="
    background:#ffffff;
    border:1px solid #dee2e6;
    border-left:5px solid #f0ad4e;
    border-radius:10px;
    margin-bottom:15px;
    overflow:hidden;
    box-shadow:0 3px 10px rgba(0,0,0,.08);
">

    <div style="
        background:#fff8e1;
        padding:12px 16px;
        border-bottom:1px solid #dee2e6;
        display:flex;
        flex-wrap:wrap;
        gap:20px;
        align-items:center;
        font-size:14px;
    ">

        <div>
            <strong>${m.diName}</strong>
        </div>

        <div>
            <strong>Local Code:</strong> ${m.diId}
        </div>

        <div>
            <strong>Status:</strong> ${m.diStatus}
        </div>

        <div>
            <strong>Sub Channel:</strong> ${m.diChannel || "-"}
        </div>

        <div>
            <strong>Missing:</strong>
            <span style="color:#dc3545;font-weight:600;">
                ${m.missingType}
            </span>
        </div>

    </div>

    <div style="padding:15px;">

        <div style="
    display:grid;
    grid-template-columns:repeat(4,1fr);
    gap:20px;
">

    <div>
        <small class="text-muted d-block">MG Account Name</small>
        <strong>${m.mgName || "-"}</strong>
    </div>

    <div>
        <small class="text-muted d-block">MG Sub Channel</small>
        <strong>${m.mgChannel || "-"}</strong>
    </div>

    <div>
        <small class="text-muted d-block">IRT Account ID</small>
        <strong>${m.irtId || "-"}</strong>
    </div>

    <div>
        <small class="text-muted d-block">MG Account ID</small>
        <strong>${m.mgId || "-"}</strong>
    </div>

</div>
    </div>

</div>

`,
  )
  .join("")}

</div>
`;
  }
});
