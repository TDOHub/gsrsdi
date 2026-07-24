// Detect mobile and tablet devices by user agent
if (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
  document.body.innerHTML = `
    <div style="
      display:flex;
      justify-content:center;
      align-items:center;
      height:100vh; 
      font-family:sans-serif;
      text-align:center;
      padding:20px;
    ">
      <h2 style="font-size:clamp(1rem, 5vw, 2rem); color:#d32f2f;">
        Content is accessible only on desktop (PC).
      </h2>
    </div>
  `;
}

// Info popover initialization
document.addEventListener("DOMContentLoaded", function () {
  const infoBtn = document.getElementById("infoBtn");

  const popover = new bootstrap.Popover(infoBtn, {
    html: true,
    content: "<small>Ready to validate smarter? <br> Click <b>Start</b> to begin.</small>",
  });

  function updatePopoverMessage(newMessage) {
    popover.setContent({
      '.popover-body': newMessage
    });
  }

  window.updatePopoverMessage = updatePopoverMessage;
});

// ─── Active button helper ─────────────────────────────────────────────────────
function setActiveButton(activeId) {
  const diBtn             = document.getElementById("diBtn");
  const mgIrtBtn          = document.getElementById("mgIrtBtn");
  const mgIrtDownloadItem = document.getElementById("mgIrtDownloadItem");

  if (activeId === "diBtn") {
    diBtn.classList.add("active");
    mgIrtBtn.classList.remove("active");
    document.getElementById("mainContent").style.display = "block";
    document.getElementById("mgIrtContent").style.display = "none";
    document.getElementById("issueCount").innerHTML = `
      <span class="material-icons-outlined me-1" style="font-size:20px;">upload_file</span>
      <span>Upload DI file</span>
    `;
    updatePopoverMessage(`<b><i class="bi bi-info-circle-fill"></i> Severity Guide <br></b><small>🔴 High Severity<br>🟡 Medium Severity</small>`);
  } else {
    mgIrtBtn.classList.add("active");
    diBtn.classList.remove("active");
    document.getElementById("mainContent").style.display = "none";
    document.getElementById("mgIrtContent").style.display = "block";
    document.getElementById("issueCount").innerHTML = `
      <span class="material-icons-outlined me-1" style="font-size:20px;">upload_file</span>
      <span>Upload DI & MG/IRT files</span>
    `;
    updatePopoverMessage(`<small><b>MG IRT</b> list can be downloaded from <br><b>"More Options"</b> below.</small>`);
  }

  // Keep toggle visible after start
  document.getElementById("xlsxToggleWrapper").style.display = "flex";
}

document.getElementById("diBtn").addEventListener("click", () => setActiveButton("diBtn"));
document.getElementById("mgIrtBtn").addEventListener("click", () => setActiveButton("mgIrtBtn"));

// ─── Global storage ───────────────────────────────────────────────────────────
let defectLogs   = [];
let groupedErrors = {};

// ─── Tab Order ───────────────────────────────────────────────────────────
const TAB_ORDER = [
    "Verification Date",
    "Verification Source",
    "Incorrect Status",
    "Banner Rule",
    "Address Quality",
    "Address Rule",
    "Phone",
    "Store Number",
    "Null Keyfacts",
    "BWL State Law",
    "Food Type",
    "Null Supplier",
    "MG/Banner Mismatch",
    "Incorrect Trade",
    "Incorrect Exception",
    "Incorrect Supplier",
    "Cannabis State Law"
  ];

// ─── Shared render function ───────────────────────────────────────────────────
function renderResults() {
  document.getElementById("diCardHead").classList.remove("bg-secondary");
  document.getElementById("diCardHead").classList.add("bg-primary");

  const totalIssues = defectLogs.length;

  document.getElementById("diIssueCount").innerHTML = `
    <span class="material-icons-outlined me-1" style="font-size:20px;">error_outline</span>
    <span>Total Issues: ${totalIssues}</span>
  `;

  let nav = `
    <div class="tabs-wrapper">
      <button id="scrollLeft" class="scroll-btn">
        <span class="material-icons">chevron_left</span>
      </button>
      <ul id="errorTabs" class="nav nav-pills flex-nowrap" role="tablist">
  `;

  let content = `<div class="tab-content" id="errorTabsContent">`;
  let first = true;

  TAB_ORDER.forEach((ruleName, idx) => {
    if (!groupedErrors[ruleName] || groupedErrors[ruleName].length === 0) return;

    const tabId = `tab-${idx}`;
    nav += `
      <li class="nav-item" role="presentation">
        <button class="nav-link rounded-pill d-flex align-items-center gap-1 ${first ? "active" : ""}"
                id="${tabId}-tab"
                data-bs-toggle="tab"
                data-bs-target="#${tabId}"
                type="button" role="tab">
          ${ruleName} <span class="badge rounded-circle">${groupedErrors[ruleName].length}</span>
        </button>
      </li>
    `;

    let extraHeaders = "";
    if (ruleName === "Verification Date")        extraHeaders = "<th>Verification Date</th>";
    else if (ruleName === "Verification Source") extraHeaders = "<th>Verification Source</th>";
    else if (ruleName === "Store Number")        extraHeaders = "<th>Store Number</th>";
    else if (ruleName === "Address Rule")        extraHeaders = "<th>Address Quality</th>";
    else if (ruleName === "Phone")               extraHeaders = "<th>Local Trade Channel</th>";

    content += `
      <div class="tab-pane fade ${first ? "show active" : ""}" id="${tabId}" role="tabpanel">
        <table class="table table-bordered table-striped mt-3">
          <thead class="table-light">
            <tr>
              <th>Message</th>
              <th>Local Code</th>
              <th>Store Status</th>
              <th>Name</th>
              <th>Address</th>
              <th>City</th>
              <th>State</th>
              <th>Postal Code</th>
              <th>Area Code</th>
              <th>Phone Number</th>
              ${extraHeaders}
            </tr>
          </thead>
          <tbody>
    `;

    groupedErrors[ruleName]
      .sort((a, b) => ({ FAIL: 1, WARN: 2, PASS: 3 }[a.status] - { FAIL: 1, WARN: 2, PASS: 3 }[b.status]))
      .forEach((err) => {
        const r = err.rowData;
        const statusClass =
          err.status === "FAIL" ? "table-danger" :
          err.status === "WARN" ? "table-warning" : "";

        let extraCells = "";
        if (ruleName === "Verification Date")        extraCells = `<td>${r["Verification Date"] || ""}</td>`;
        else if (ruleName === "Verification Source") extraCells = `<td>${r["Verification Source"] || ""}</td>`;
        else if (ruleName === "Store Number")        extraCells = `<td>${r["Store Number"] || ""}</td>`;
        else if (ruleName === "Address Rule")        extraCells = `<td>${r["Address Quality"] || ""}</td>`;
        else if (ruleName === "Phone")               extraCells = `<td>${r["Local Trade Channel"] || ""}</td>`;

        content += `
          <tr class="${statusClass}">
            <td>${err.message}</td>
            <td>${r["Local Code"] || ""}</td>
            <td>${r["Status"] || ""}</td>
            <td>${r["Name"] || ""}</td>
            <td>${r["Address"] || ""}</td>
            <td>${r["City"] || ""}</td>
            <td>${r["State"] || ""}</td>
            <td>${r["Postal Code"] || ""}</td>
            <td>${r["Area Code"] || ""}</td>
            <td>${r["Phone"] || ""}</td>
            ${extraCells}
          </tr>
        `;
      });

    content += `</tbody></table></div>`;
    first = false;
  });

  nav += `
      </ul>
      <button id="scrollRight" class="scroll-btn">
        <span class="material-icons">chevron_right</span>
      </button>
    </div>
  `;
  content += `</div>`;

  document.getElementById("results").innerHTML = nav + content;

  // Scroll button logic
  const errorTabs   = document.getElementById("errorTabs");
  const scrollLeft  = document.getElementById("scrollLeft");
  const scrollRight = document.getElementById("scrollRight");

  function updateScrollButtons() {
    const maxScrollLeft = errorTabs.scrollWidth - errorTabs.clientWidth;
    const atStart = errorTabs.scrollLeft <= 0;
    const atEnd   = errorTabs.scrollLeft >= maxScrollLeft - 1;

    scrollLeft.disabled  = atStart;
    scrollRight.disabled = atEnd;

    errorTabs.classList.remove("fade-both", "fade-left", "fade-right");
    if (!atStart && !atEnd)     errorTabs.classList.add("fade-both");
    else if (atStart && !atEnd) errorTabs.classList.add("fade-right");
    else if (!atStart && atEnd) errorTabs.classList.add("fade-left");
  }

  if (errorTabs && scrollLeft && scrollRight) {
    updateScrollButtons();
    errorTabs.addEventListener("scroll", updateScrollButtons);
    scrollLeft.addEventListener("click", () => {
      errorTabs.scrollBy({ left: -200, behavior: "smooth" });
      setTimeout(updateScrollButtons, 300);
    });
    scrollRight.addEventListener("click", () => {
      errorTabs.scrollBy({ left: 200, behavior: "smooth" });
      setTimeout(updateScrollButtons, 300);
    });
  }
  document.getElementById("copyCodesBtn").classList.remove("d-none");
}

function showLoader() {
  document.getElementById("results").innerHTML = `
    <div style="display:flex; justify-content:center; align-items:center; height:50px;">
      <div class="spinner-border text-primary" role="status" style="width:1.5rem; height:1.5rem;">
        <span class="visually-hidden">Loading...</span>
      </div>
      <span class="ms-3">Validating file, please wait...</span>
    </div>
  `;
}

// ─── Row normalizer ───────────────────────────────────────────────────────────
function normalizeRowKeys(row) {
  const booleanFields = ["Beer", "Wine", "Liquor"];
  const codeFields    = ["Local Code"];
  const stringFields  = ["Store Number"];

  const normalized = {};
  for (const key in row) {
    const cleanKey = key.trim();
    let val = row[key];

    // Normalize booleans
    if (booleanFields.includes(cleanKey)) {
      if (val === true || val === "true" || val === "TRUE" || val === 1 || val === "1" || val === "Yes") {
        val = "[Y] Yes";
      } else if (val === false || val === "false" || val === "FALSE" || val === 0 || val === "0" || val === "No") {
        val = "[N] No";
      }
    }

    // Force Store Number to string (preserve leading zeros)
    if (stringFields.includes(cleanKey) && val !== undefined && val !== null) {
      val = String(val).trim();
    }

    // Convert numbers to strings
    if (typeof val === "number") val = val.toString();

    // Trim strings
    if (typeof val === "string") val = val.trim();

    val = val ?? "";

    // Pad code fields to 6 digits
    if (codeFields.includes(cleanKey) && val !== "") {
      val = val.padStart(7, "0");
    }

    normalized[cleanKey] = val;
  }
  return normalized;
}

const REQUIRED_HEADERS = [
  "Local Code",
  "Store Number",
  "Status",
  "Name",
  "Address",
  "City",
  "State",
  "Postal Code",
  "Area Code",
  "Phone"
];

function validateHeaders(data) {
  if (!data || data.length === 0) return false;
  const firstRow = data[0];
  const keys = Object.keys(firstRow).map(k => k.trim());

  const missing = REQUIRED_HEADERS.filter(h => !keys.includes(h));
  if (missing.length > 0) {
    alert("⚠️ Invalid DI file. Missing required columns." );
    document.getElementById("results").innerHTML = "Upload DI file to display defects";
    document.getElementById("csvFile").value = "";
    document.getElementById("diCardHead").classList.remove("bg-primary");
    document.getElementById("diCardHead").classList.add("bg-secondary");
    document.getElementById("diIssueCount").innerHTML = "";
    return false;
  }
  return true;
}

// ─── Row processor (shared by CSV and Excel paths) ────────────────────────────
function processRows(data) {

  groupedErrors = {};
  defectLogs    = [];

  data.forEach((rawRow) => {
    const row = normalizeRowKeys(rawRow);
    rules.forEach((rule) => {
      const r = rule(row);
      if (r.status !== "PASS") {
        if (!groupedErrors[r.rule]) groupedErrors[r.rule] = [];
        groupedErrors[r.rule].push({
          status:  r.status,
          message: r.message,
          rowData: row,
        });

        defectLogs.push({
          Rule:            r.rule,
          Status:          r.status,
          Message:         r.message,
          "Local Code":    row["Local Code"] || "",
          "Store Status":  row["Status"] || "",
          Name:            row["Name"] || "",
          Address:         row["Address"] || "",
          City:            row["City"] || "",
          State:           row["State"] || "",
          "Postal Code":   row["Postal Code"] || "",
          "Area Code":     row["Area Code"] || "",
          "Phone Number":  row["Phone"] || "",
          ...(r.rule === "Verification Date"
            ? { "Verification Date": row["Verification Date"] || "" }
            : {}),
          ...(r.rule === "Verification Source"
            ? { "Verification Source": row["Verification Source"] || "" }
            : {}),
          ...(r.rule === "Address Rule"
            ? { "Address Quality": row["Address Quality"] || "" }
            : {}),
          ...(r.rule === "Phone"
            ? { "Phone Number": row["Local Trade Channel"] || "" }
            : {}),
        });
      }
    });
  });

  if (defectLogs.length === 0) {
    document.getElementById("diCardHead").classList.remove("bg-secondary");
    document.getElementById("diCardHead").classList.add("bg-primary");
    document.getElementById("copyCodesBtn").classList.add("d-none");

    const totalIssues = defectLogs.length;

    document.getElementById("diIssueCount").innerHTML = `
      <span class="material-icons-outlined me-1" style="font-size:20px;">error_outline</span>
      <span>Total Issues: ${totalIssues}</span>
    `;
    document.getElementById("results").innerHTML =
      '<div class="alert alert-success mt-3 text-center">No defects found 🎉</div>';
    return;
  }

  renderResults();
}

// ─── CSV validation ───────────────────────────────────────────────────────────
function runValidation(file) {
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    complete: function (results) {
      const data = results.data;
      if (!validateHeaders(data)) {
        return;
      }
      showLoader();
      setTimeout(() => {
        processRows(results.data);
      }, 500);
    },
  });
}

// ─── Excel validation ─────────────────────────────────────────────────────────
function runXlsxValidation(file) {
  const reader = new FileReader();
  reader.onload = function (e) {
    const wb   = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

    if (!rows || rows.length === 0) {
      document.getElementById("results").innerHTML =
        '<div class="alert alert-warning mt-3">No data found in the Excel file.</div>';
      return;
    }

    if (!validateHeaders(rows)) {
      return;
    }

    showLoader();
    setTimeout(() => {
      processRows(rows);
    }, 500);
  };
  reader.readAsArrayBuffer(file);
}

// ─── File input change handler ────────────────────────────────────────────────
document.getElementById("csvFile").addEventListener("change", function (e) {
  const file = e.target.files[0];
  if (!file) return;

  const isXlsx = document.getElementById("xlsxToggle").checked;

  if (isXlsx) {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      alert("XLSX Mode is on. Please upload an Excel file (.xlsx or .xls).");
      this.value = "";
      return;
    }
    runXlsxValidation(file);
  } else {
    if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
      alert("Invalid file type. Please upload a CSV file.");
      this.value = "";
      return;
    }
    runValidation(file);
  }
});

// ─── Export button ────────────────────────────────────────────────────────────
document.getElementById("exportBtn").addEventListener("click", function () {
  function safeSheetName(name) {
    return name.replace(/[:\\/?*\[\]]/g, "_").substring(0, 31);
  }

  if (!groupedErrors || Object.keys(groupedErrors).length === 0) {
    alert("No defect logs to export!");
    return;
  }

  const workbook = XLSX.utils.book_new();

  Object.keys(groupedErrors).forEach((ruleName) => {
    const rows = groupedErrors[ruleName].map((err) => {
      const r = err.rowData;
      return {
        Message:               err.message,
        "Local Code":          r["Local Code"] || "",
        "Store Status":        r["Status"] || "",
        Name:                  r["Name"] || "",
        Address:               r["Address"] || "",
        City:                  r["City"] || "",
        State:                 r["State"] || "",
        "Postal Code":         r["Postal Code"] || "",
        "Area Code":           r["Area Code"] || "",
        "Phone Number":        r["Phone"] || "",
        "Verification Date":   r["Verification Date"] || "",
        "Verification Source": r["Verification Source"] || "",
      };
    });

    if (rows.length > 0) {
      const worksheet = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName(ruleName));
    }
  });

  if (workbook.SheetNames.length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([["No defects found"]]);
    XLSX.utils.book_append_sheet(workbook, ws, "Summary");
  }

  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  XLSX.writeFile(workbook, `DI_DefectLogs_${dateStr}.xlsx`);
});

// ─── Clear button ─────────────────────────────────────────────────────────────
document.getElementById("clearBtn").addEventListener("click", function () {
  document.getElementById("csvFile").value = "";
  document.getElementById("diCardHead").classList.remove("bg-primary");
  document.getElementById("diCardHead").classList.add("bg-secondary");
  document.getElementById("results").innerHTML = "Upload DI file to display defects";
  document.getElementById("diIssueCount").innerHTML = "";

  defectLogs    = [];
  groupedErrors = {};

  // Reset label to match current toggle state
  const isXlsx = document.getElementById("xlsxToggle").checked;
  document.getElementById("fileInputLabel").textContent = isXlsx ? "Upload DI File (Excel)" : "Upload DI File";
});

// ─── Start button ─────────────────────────────────────────────────────────────
document.getElementById("startBtn").addEventListener("click", function () {
  document.getElementById("slideshow").classList.add("hidden");

  document.getElementById("issueCount").innerHTML = `
    <span class="material-icons-outlined me-1" style="font-size:20px;">upload_file</span>
    <span>Upload DI file</span>
  `;

  this.style.display = "none";

  document.getElementById("diBtn").style.display    = "inline-block";
  document.getElementById("mgIrtBtn").style.display = "inline-block";
  document.getElementById("xlsxToggleWrapper").style.display = "flex";

  setActiveButton("diBtn");

  document.querySelectorAll(".card").forEach(card => {
    card.classList.add("show");
  });
});

// ─── XLSX toggle ──────────────────────────────────────────────────────────────
document.getElementById("xlsxToggle").addEventListener("change", function () {
  this.blur();
  const isXlsx = this.checked;

  // ── DI Validation inputs ──
  const csvInput = document.getElementById("csvFile");
  const label    = document.getElementById("fileInputLabel");

  csvInput.value = "";
  groupedErrors  = {};
  defectLogs     = [];

  if (isXlsx) {
    csvInput.setAttribute("accept", ".xlsx,.xls");
    label.textContent = "Upload DI File (Excel)";
    document.getElementById("results").innerHTML = "Upload DI Excel file to display defects";
  } else {
    csvInput.setAttribute("accept", ".csv");
    label.textContent = "Upload DI File";
    document.getElementById("results").innerHTML = "Upload DI file to display defects";
  }

  document.getElementById("diCardHead").classList.remove("bg-primary");
  document.getElementById("diCardHead").classList.add("bg-secondary");
  document.getElementById("diIssueCount").innerHTML = "";

  // ── MG & IRT inputs ──
  const mgDiInput  = document.getElementById("diFile");
  const mgIrtInput = document.getElementById("mgIrtFile");
  const mgDiLabel  = document.getElementById("mgDiFileLabel");

  mgDiInput.value  = "";
  mgIrtInput.value = "";

  if (isXlsx) {
    mgDiInput.setAttribute("accept", ".xlsx,.xls");
    mgIrtInput.setAttribute("accept", ".csv,.xlsx,.xls");
    mgDiLabel.textContent = "Upload DI File (Excel)";
  } else {
    mgDiInput.setAttribute("accept", ".csv");
    mgIrtInput.setAttribute("accept", ".csv,.xlsx,.xls");
    mgDiLabel.textContent = "Upload DI File";
  }

  document.getElementById("validationResults").innerHTML = "Upload DI file and click validate to display matches";
  document.getElementById("mgIssueCount").innerHTML = "";
  document.getElementById("mgIrtCardHead").classList.remove("bg-primary");
  document.getElementById("mgIrtCardHead").classList.add("bg-secondary");
});

// Copy button handler
const copyBtn = document.getElementById("copyCodesBtn");
const toastEl = document.getElementById("copyToast");
const toastMessage = document.getElementById("copyToastMessage");

copyBtn.addEventListener("click", function () {
  const activeTab = document.querySelector("#errorTabs .nav-link.active");
  if (!activeTab) return;

  const tabId = activeTab.getAttribute("data-bs-target").replace("#", "");
  const idx = parseInt(tabId.split("-")[1], 10);
  const ruleName = TAB_ORDER[idx];

  const codes = (groupedErrors[ruleName] || [])
    .map(err => err.rowData["Local Code"])
    .filter(code => code && code.trim() !== "")
    .join(",");

  if (codes) {
    navigator.clipboard.writeText(codes).then(() => {
      toastMessage.innerHTML = `Local Codes for <strong>${ruleName}</strong> copied successfully!`;
      new bootstrap.Toast(toastEl, { delay: 2000 }).show();
    });
  } else {
    toastMessage.innerHTML = `No Local Codes found for <strong>${ruleName}</strong>.`;
    new bootstrap.Toast(toastEl, { delay: 2000 }).show();
  }
});
