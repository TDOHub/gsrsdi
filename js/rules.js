function isNull(val) {
  return val === null || val === undefined || val.toString().trim() === "";
}

// Incorrect Verification Date
function checkVerificationDate(row) {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const raw = (row["Verification Date"] || "").trim();
  if (raw === "") {
    return { status: "PASS", rule: "Verification Date", message: "" }; // skip empty
  }
  const date = raw.replace(/-/g, "");
  if (date !== today) {
    return {
      status: "FAIL",
      rule: "Verification Date",
      message: "Update Verification date",
    };
  }
  return { status: "PASS", rule: "Verification Date", message: "" };
}

// Incorrect VSS
function checkVerificationSource(row, team) {
  const status = (row["Status"] || "").trim();
  const source = (row["Verification Source"] || "").trim();
  const allowed = {
    "[OP] Open, Operating": [
      "[2] Telephone, Direct",
      "[23] Telephone, Indirect",
      "[40] Web Sites, Other",
      "[42] Web Lookup",
    ],
    "[FO] Future Opening": [
      "[2] Telephone, Direct",
      "[23] Telephone, Indirect",
      "[40] Web Sites, Other",  
      "[42] Web Lookup",
    ],
    "[NA] Inactive/Not Verified": ["[13] Special Projects"],
    "[TC] Closed": [
      "[2] Telephone, Direct",
      "[23] Telephone, Indirect",
      "[40] Web Sites, Other",
      "[42] Web Lookup",
      "[34] Attempted Contact Failed",
    ],
    "[UV] Unverifiable": ["[34] Attempted Contact Failed"],
    "[DUP] Duplicate": ["[13] Special Projects", "[40] Web Sites, Other"],
  };

  if (allowed[status] && !allowed[status].includes(source)) {
    return {
      status: "FAIL",
      rule: "Verification Source",
      message: "Incorrect VSS",
    };
  }
  return { status: "PASS", rule: "Verification Source", message: "" };
}

// Incorrect Status
function checkIncorrectStatus(row) {
  const trade = (row["Local Trade Channel"] || "").trim();
  const subChannel = (row["Local Sub Channel"] || "").trim();
  const status = (row["Status"] || "").trim();

  if (row["Status"] === "[DUP] Duplicate" ) return { status: "PASS", rule: "Duplicate", message: "" }; // skip duplicate

  // ✅ Rule: If trade is [09] or [59], status must not be FO
  if ((trade === "[09] Unknown Retailers" || trade === "[59] Unknown On-Premise")
    && status === "[FO] Future Opening") {
    return {
      status: "FAIL",
      rule: "Incorrect Status",
      message: `Trade ${trade} cannot have status ${status}`
    };
  }

  if ((subChannel === "[K] Client Internal" || subChannel === "[N] Special Event")
    && status !== "[NA] Inactive/Not Verified") {
    return {
      status: "FAIL",
      rule: "Incorrect Status",
      message: `${subChannel} should have status [NA] Inactive/Not Verified`
    };
  }
  return { status: "PASS", rule: "Incorrect Status", message: "" };
}

// Incorrect Trade
function incorrectTrade(row) {
  const trade = (row["Local Trade Channel"] || "").trim();
  const subChannel = (row["Local Sub Channel"] || "").trim();
  const name = (row["Name"] || "").toLowerCase().trim();
  const status = (row["Status"] || "").trim();

  if (row["Status"] === "[DUP] Duplicate" ) return { status: "PASS", rule: "Duplicate", message: "" }; // skip duplicate
  
  // Client Internal banner and trade name mismatch
  if (subChannel === "[K] Client Internal" && name !== "client internal" || name === "client internal" && subChannel !== "[K] Client Internal") {
    return {
      status: "FAIL",
      rule: "Incorrect Trade",
      message: `Trade ${subChannel} & Banner ${name} mismatch`
    };
  }

  // Special Event banner and trade name mismatch
  if (subChannel === "[N] Special Event" && name !== "special event" || name === "special event" && subChannel !== "[N] Special Event") {
    return {
      status: "FAIL",
      rule: "Incorrect Trade",
      message: `Trade ${subChannel} & Banner ${name} mismatch`
    };
  }

  // House Account banner and trade name mismatch
  if (subChannel === "[P] House Account" && name !== "house account") {
    return {
      status: "FAIL",
      rule: "Incorrect Trade",
      message: `Trade ${subChannel} & Banner ${name} mismatch`
    };
  }

  // UV trade
  if (status === "[UV] Unverifiable") {
    if (!(trade === "[09] Unknown Retailers" &&
      subChannel === "[X] Retail Other")) {
      return {
        status: "FAIL",
        rule: "Incorrect Trade",
        message: "UV must be [09] Unknown Retailers / [X] Retail Other"
      };
    }
  }

  return { status: "PASS", rule: "Incorrect Trade", message: "" };

}

// Incorrect Exception
function incorrectException(row) {
  const trade = row["Local Trade Channel"] || "";
  const subChannel = row["Local Sub Channel"] || "";
  const mgName = row["MG Name"] || "";
  const exception = row["Exception Code"] || "";
  const validExceptions = ["777798Z", "777794Z", "777793Z", "777791Z"];

  // Valid Exceptions Check
  if (exception && !validExceptions.includes(exception)) {
    return {
      status: "FAIL",
      rule: "Incorrect Exception",
      message: `Invalid Exception Code: ${exception}`
    };
  }

  // Exception for Inactive/Not Verified
  if (row["Status"] === "[NA] Inactive/Not Verified") {
    if (exception !== "777798Z") {
      return {
        status: "FAIL",
        rule: "Incorrect Exception",
        message: "Inactive must have Exception Code 98Z"
      };
    }
  }

  // Exception for Small grocery
  if (subChannel === "[B] Small Grocery" && exception !== "777791Z") {
    return {
      status: "FAIL",
      rule: "Incorrect Exception",
      message: "Small Grocery must have Exception Code 91Z"
    }
  }

  if (subChannel !== "[B] Small Grocery" && exception === "777791Z") {
    return {
      status: "FAIL",
      rule: "Incorrect Exception",
      message: "Only Small Grocery can have Exception Code 91Z"
    }
  }

  // Exception for Unverifiable
  if (row["Status"] === "[UV] Unverifiable") {
    if (exception !== "777793Z")
      return {
        status: "FAIL",
        rule: "Incorrect Exception",
        message: "UV must have Exception Code 93Z",
      };
  }

  if (exception === "777793Z" && row["Status"] !== "[UV] Unverifiable") {
    return {
      status: "FAIL",
      rule: "Incorrect Exception",
      message: "Exception Code 93Z can only be used for UV status"
    };
  }

  //Exception for /EM MG
  if (trade === "[59] Unknown On-Premise") {
    if (mgName.endsWith("/EM")) {
      if (exception !== "777794Z") {
        return {
          status: "FAIL",
          rule: "Incorrect Exception",
          message: `/EM MG must have Exception Code 94Z`
        };
      }
    }
  }

  // Exception for Retail Trade & Non-EM MG
  if (exception === "777794Z") {
    if (trade !== "[59] Unknown On-Premise") {
      return {
        status: "FAIL",
        rule: "Incorrect Exception",
        message: `Retail Trade cannot have Exception Code 94Z`
      }
    } else if (!mgName.endsWith("/EM")) {
      return {
        status: "FAIL",
        rule: "Incorrect Exception",
        message: `Only /EM MG can have Exception Code 94Z`
      }
    }
  }
  
  return { status: "PASS", rule: "Exception Code", message: "" };
}

// Pharmacy Flag

function checkPharmacy(row) {

  const status = row["Status"] || "";
  const tradeChannel = row["Local Trade Channel"] || "";
  const subChannel = row["Local Sub Channel"] || "";
  const pharmacyFlag = row["Pharmacy"] || "";

  const validTradeChannels = [
    "[08] Mass Merchandise Stores",
    "[07] Convenience Stores",
    "[05] Grocery Stores",
    "[03] Drug Stores and Pharmacies",
    "[01] WholeSale Clubs"
  ];

  const validSubChannels = [];

  if (validTradeChannels.includes(tradeChannel)) {

    // Null Check
    if (isNull(pharmacyFlag)) {
      if (status === "[OP] Open, Operating" || status === "[FO] Future Opening") {
        return {
          status: "FAIL",
          rule: "Pharmacy Flag",
          message: `Pharmacy Flag is missing for ${tradeChannel}`
        };
      } else {
        return {
          status: "WARN",
          rule: "Pharmacy Flag",
          message: `Pharmacy Flag is missing for ${tradeChannel}`
        };
      }
    }

    // Drug Stores & Pharmacies must be Y
    if (
      tradeChannel === "[03] Drug Stores and Pharmacies" &&
      pharmacyFlag !== "Y"
    ) {
      return {
        status: "FAIL",
        rule: "Pharmacy Flag",
        message: `Pharmacy Flag should be 'Y' for ${tradeChannel}`
      };
    }

    // Convenience Stores must be N
    if (
      tradeChannel === "[07] Convenience Stores" &&
      pharmacyFlag !== "N"
    ) {
      return {
        status: "FAIL",
        rule: "Pharmacy Flag",
        message: `Pharmacy Flag should be 'N' for ${tradeChannel}`
      };
    }
  }

  return {
    status: "PASS",
    rule: "Pharmacy Flag",
    message: ""
  };
}

// Null Food Type
function checkFoodType(row) {

  const status = row["Status"] || "";
  const tradeChannel = row["Local Trade Channel"] || "";
  const subChannel = row["Local Sub Channel"] || "";
  const foodType = row["Food Type"];

  const validTradeChannels = ["[50] Dining", "[51] Bar/Nightclub", "[55] Caterers"];
  const validSubChannels = ["[H] Restaurant NA", "[C] Concessionaire NA", "[P] Coffee/Tea Shop"];

  if (validTradeChannels.includes(tradeChannel) || validSubChannels.includes(subChannel)) {
    if (isNull(foodType)) {
      if (status === "[OP] Open, Operating" || status === "[FO] Future Opening") {
        return { status: "FAIL", rule: "Food Type", message: "Food Type missing for On Premise TD" };
      } else {
        return { status: "WARN", rule: "Food Type", message: "Food Type missing for On Premise TD" };
      }
    }
  }

  return { status: "PASS", rule: "Food Type", message: "" };
}

// null ph
function checkPhone(row) {
  const status = row["Status"];
  const phone = row["Phone"];
  const areaCode = row["Area Code"];
  const trade = row["Local Trade Channel"];

  if (!phone && areaCode) {
    return {
      status: "FAIL",
      rule: "Phone",
      message: "Remove area code if Ph# is not populated"
    };
  }

  if (trade === "[09] Unknown Retailers") {
    return { status: "PASS", rule: "Phone", message: "" };
  }

  if (status === "[OP] Open, Operating" && isNull(phone)) {
    return {
      status: "FAIL",
      rule: "Phone",
      message: "Open TD must have a Ph#"
    };
  }

  if (status === "[FO] Future Opening" && isNull(phone)) {
    return {
      status: "WARN", 
      rule: "Phone",
      message: "Please verify if Ph# is available"
    };
  }

  return { status: "PASS", rule: "Phone", message: "" };
}

// Address Quality
function checkAddress(row) {
  if (row["Address Quality"] === "Non Standardized")
    return {
      status: "WARN",
      rule: "Address Quality",
      message: "Address not standardized",
    };
  return { status: "PASS", rule: "Address Quality", message: "" };
}

// Full names → required abbreviations
const POSTAL_ABBREVIATIONS = {
  "Boulevard": "Blvd",
  "Building": "Bldg",
  "Business Highway": "Bus Hwy",
  "Bypass": "Byp",
  "Causeway": "Cswy",
  "Circle": "Cir",
  "County Road": "Co Rd",
  "Court": "Ct",
  "Drive": "Dr",
  "Expressway": "Expy",
  "Extension": "Ext",
  "Farm To Market": "FM",
  "Freeway": "Fwy",
  "Highway": "Hwy",
  "Interstate": "I",
  "Lane": "Ln",
  "Mount": "Mt",
  "Parkway": "Pkwy",
  "Pike": "Pke",
  "Place": "Pl",
  "Plaza": "Plz",
  "Point": "Pt",
  "Port": "Pt",
  "Road": "Rd",
  "Route": "Rte",
  "Rural Route": "RR",
  "Square": "Sq",
  "State Highway": "St Hwy",
  "State Hwy": "St Hwy",
  "State Route": "St Rte",
  "State Rte": "St Rte",
  "State Road": "St Rd",
  "State Rd": "St Rd",
  "Street": "St",
  "Terrace": "Ter",
  "Trail": "Trl",
  "Turnpike": "Tpke",
  "US Highway": "US Hwy"
};

// Full directionals → required abbreviations
const DIRECTIONALS = {
  "North": "N",
  "South": "S",
  "East": "E",
  "West": "W",
  "Northeast": "NE",
  "Southeast": "SE",
  "Northwest": "NW",
  "Southwest": "SW"
};

// Words that need position-sensitive handling
const POSITIONAL_SUFFIXES = {
  "Avenue": "Ave",
  "Lake": "Lk",
  "Center": "Ctr",
  "Park": "Pk"
};

// Unit designators that can appear at the end
const UNIT_DESIGNATORS = ["Ste", "Suite", "Apt", "Unit", "Fl", "Rm", "Bldg", "Dept"];

const ORDINAL_REGEX = /^\d+(st|nd|rd|th)$/i;

function checkCasing(parts) {
  const errors = [];
  const DIRECTIONAL_EXCEPTIONS = ["N","S","E","W","NE","NW","SE","SW"];
  const NAME_PREFIXES = ["Mc"];
  const ACRONYM_WHITELIST = [
    "US","FM",
    "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
    "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
    "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
    "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
    "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"
  ];

  for (let i = 0; i < parts.length; i++) {
    const word = parts[i];

    if (DIRECTIONAL_EXCEPTIONS.includes(word)) {
      continue; // valid directional, exact match
    }
    if (DIRECTIONAL_EXCEPTIONS.includes(word.toUpperCase())) {
      errors.push(`Directional must be uppercase: ${word}`);
      continue;
    }

    // Skip unit codes (after Ste/Suite/Apt/Unit)
    if (i > 0 && ["Ste","Suite","Apt","Unit"].includes(parts[i-1])) {
      continue;
    }

    // Skip whitelisted acronyms
    if (ACRONYM_WHITELIST.includes(word)) {
      continue;
    }

    // Skip ordinals (like 1st, 2nd, 34th)
    if (ORDINAL_REGEX.test(word)) {
      continue;
    }

    // Handle alphanumeric tokens (e.g., 998A, 12B, A45)
    if (/^[0-9]+[A-Za-z]+$/.test(word) || /^[A-Za-z]+[0-9]+$/.test(word)) {
      if (/[a-z]/.test(word)) {
        errors.push(`Alphanumeric token must use uppercase letters: ${word}`);
      }
      continue;
    }

    // handle McDonald, MacArthur, etc. — allow mixed-case names with "Mc" prefix
    if (NAME_PREFIXES.some(prefix => word.startsWith(prefix))) {
      continue; // allow mixed-case names like McDonald, MacArthur
    }

    if (word.length > 1) {
      const first = word[0];
      const rest = word.slice(1);
      if (!(first === first.toUpperCase() && rest === rest.toLowerCase())) {
        errors.push(`Improper casing: ${word}`);
      }
    } else if (word.length === 1 && word !== word.toUpperCase()) {
      errors.push(`Single letter must be uppercase: ${word}`);
    }
  }
  return errors;
}

function isValidUnitDesignator(parts, index) {
  const word = parts[index];
  const next = parts[index + 1] || "";

  // Allow Ste/Suite/Apt/Unit followed by alphanumeric (letters+numbers)
  if (["Ste","Suite","Apt","Unit"].includes(word)) {
    return /^[A-Za-z0-9]+$/.test(next);
  }

  // Other designators must be at the end
  return UNIT_DESIGNATORS.includes(word);
}

function validateUnitDesignators(parts) {
  let errors = [];
  for (let i = 0; i < parts.length; i++) {
    if (UNIT_DESIGNATORS.includes(parts[i])) {
      if (!isValidUnitDesignator(parts, i)) {
        errors.push(`Invalid unit designator usage: ${parts[i]}`);
      }
      if (i < parts.length - 2) {
        errors.push(`"${parts[i]}" should only appear at the end of the address`);
      }
    }
  }
  return errors;
}

function checkDirectionalAbbreviations(parts) {
  const errors = [];
  const suffixes = [
    "Street","St",
    "Avenue","Ave",
    "Boulevard","Blvd",
    "Road","Rd",
    "Drive","Dr",
    "Lane","Ln",
    "Terrace","Ter",
    "Parkway","Pkwy",
    "Place","Pl",
    "Court","Ct"
  ];
  for (const [full, abbr] of Object.entries(DIRECTIONALS)) {
    const idx = parts.findIndex(p => p.toLowerCase() === full.toLowerCase());
    if (idx !== -1) {
      const next = parts[idx + 1] || "";
      // If next is a suffix → treat as street name, allow full word
      if (suffixes.includes(next)) {
        continue;
      }
      // Otherwise enforce abbreviation
      errors.push(`"${full}" should be abbreviated as "${abbr}"`);
    }
  }
  return errors;
}

function checkBareDirectionalStreet(parts) {
  const errors = [];
  const directionals = ["N","S","E","W","NE","NW","SE","SW"];
  const suffixes = ["St","Ave","Blvd","Rd","Dr","Ln","Ter","Pkwy","Pl","Ct"];
  for (let i = 0; i < parts.length - 1; i++) {
    if (directionals.includes(parts[i]) && suffixes.includes(parts[i+1])) {
      errors.push(`"${parts[i]} ${parts[i+1]}" may be a street name or abbreviation. Please confirm`);
    }
  }
  return errors;
}

function checkDirectionalPosition(parts) {
  const physicalSuffixes = ["Rd","Dr","Ln","Ave","Pkwy","St","Blvd","Ter"];
  const highwaySuffixes = ["Hwy","Rte","St Rte","US Hwy","State Hwy", "St Hwy", "Interstate","I"];
  const directionals = ["N","S","E","W","NE","NW","SE","SW"];
  let errors = [];

  const lastWord = parts[parts.length - 1];
  const hasHighway = parts.some(p => highwaySuffixes.includes(p));
  const hasPhysical = !hasHighway && parts.some(p => physicalSuffixes.includes(p));
  const hasDirectional = parts.some(p => directionals.includes(p));

  // Find first non-numeric token
  const firstNonNumeric = parts.find(p => !/^\d+$/.test(p));

  if (hasPhysical && hasDirectional && !directionals.includes(firstNonNumeric)) {
    errors.push("For physical addresses, directionals must appear in the front");
  }
  if (hasHighway && hasDirectional && !directionals.includes(lastWord)) {
    errors.push("For highway addresses, directionals must appear at the end");
  }
  return errors;
}

function ordinalToNumber(word) {
  const ordinals = {
    "first": 1, "second": 2, "third": 3, "fourth": 4, "fifth": 5,
    "sixth": 6, "seventh": 7, "eighth": 8, "ninth": 9, "tenth": 10,
    "eleventh": 11, "twelfth": 12, "thirteenth": 13, "fourteenth": 14,
    "fifteenth": 15, "sixteenth": 16, "seventeenth": 17, "eighteenth": 18,
    "nineteenth": 19, "twentieth": 20
  };
  return ordinals[word.toLowerCase()] || null;
}

function numberSuffix(num) {
  if (num % 100 >= 11 && num % 100 <= 13) return num + "th";
  switch (num % 10) {
    case 1: return num + "st";
    case 2: return num + "nd";
    case 3: return num + "rd";
    default: return num + "th";
  }
}

function checkNumberedStreets(parts) {
  let errors = [];
  for (const word of parts) {
    const num = ordinalToNumber(word);
    if (num) {
      errors.push(`"${word}" should be "${numberSuffix(num)}"`);
    }
  }
  return errors;
}

function checkAddressRules(row) {
  const address = row["Address"] || "";
  const quality = row["Address Quality"] || "";
  let errors = [];
  const parts = address.trim().split(/\s+/);

  // Always check casing + special characters
  const specialCharRegex = /[^A-Za-z0-9\s]/;
  if (specialCharRegex.test(address)) {
    errors.push("Address contains special characters (only letters, numbers, and spaces allowed)");
  }

  errors.push(...checkCasing(parts));

  // If Certified/Standardized → stop here
  if (quality !== "Non Standardized") {
    if (errors.length > 0) {
      return { status: "WARN", rule: "Address Rule", message: errors.join("; ") };
    }
    return { status: "PASS", rule: "Address Rule", message: "" };
  }

  // If Non Standardized → run full USPS rules
  errors.push(...checkDirectionalPosition(parts));
  errors.push(...validateUnitDesignators(parts));
  errors.push(...checkNumberedStreets(parts));
  errors.push(...checkDirectionalAbbreviations(parts));
  errors.push(...checkBareDirectionalStreet(parts));

  for (const [full, abbr] of Object.entries(POSTAL_ABBREVIATIONS)) {
    if (POSITIONAL_SUFFIXES[full]) continue;
    const regex = new RegExp(`\\b${full}\\b`, "i");
    if (regex.test(address)) {
      errors.push(`"${full}" should be "${abbr}"`);
    }
  }

  if (errors.length > 0) {
    return { status: "FAIL", rule: "Address Rule", message: errors.join("; ") };
  }
  return { status: "PASS", rule: "Address Rule", message: "" };
}

// Banner Rule
function checkNameFormat(row) {
  const name = (row["Name"] || "").trim();
  if (!name) return { status: "PASS", rule: "Banner Rule", message: "" };

  // Allowed acronyms whitelist
  const ACRONYMS = new Set([
    "AAFES", "ABC",
    "BBQ", "BP", "CVS", 
    "LLC", "HMS", "IGA", 
    "SD", "MN", "BK",
    "TA", "MTN", "USA",
    "XO"
  ]);

  // Check for special characters — allow only letters, numbers, spaces and &
  if (/[^a-zA-Z0-9\s&]/.test(name)) {
    return {
      status: "FAIL",
      rule: "Banner Rule",
      message: `Name contains special characters: "${name}"`
    };
  }

  // Check for multiple consecutive spaces
  if (/\s{2,}/.test(name)) {
    return {
      status: "FAIL",
      rule: "Banner Rule",
      message: `Name contains extra spaces: "${name}"`
    };
  }

  const words = name.split(" ");

  for (let word of words) {

    // "and" in any casing → must be "&"
    if (word.toLowerCase() === "and") {
      return {
        status: "WARN",
        rule: "Banner Rule",
        message: `"${word}" should be "&". Please verify signboard`
      };
    }

    if (word.toLowerCase() === "distribution" || word.toLowerCase() === "distributors" || word.toLowerCase === "distributor") {
      return {
        status: "WARN",
        rule: "Banner Rule",
        message: `Please verify signboard. "${word}" should be Distributing`
      }
    }

    // "&" is always valid
    if (word === "&") continue;

    // Pure numbers are valid (7, 76, 365)
    if (/^\d+$/.test(word)) continue;

    // Whitelisted acronyms
    if (ACRONYMS.has(word)) continue;

    // McDonald's format — Mc + Capital + lowercase
    if (/^Mc[A-Z][a-z]+$/.test(word)) continue;

    // Any remaining all-caps word — FAIL
    if (word === word.toUpperCase() && word.length > 1) {
      return {
        status: "WARN",
        rule: "Banner Rule",
        message:  `Please check casing for "${word} in the banner"`
      };
    }

    // Single letter must be uppercase
    if (word.length === 1) {
      if (word !== word.toUpperCase()) {
        return {
          status: "FAIL",
          rule: "Banner Rule",
          message: `Single letter must be uppercase"`
        };
      }
      continue;
    }

    // Title case — first letter caps, rest lowercase
    if (
      word[0] !== word[0].toUpperCase() ||
      word.slice(1) !== word.slice(1).toLowerCase()
    ) {
      return {
        status: "FAIL",
        rule: "Banner Rule",
        message: `Please check "${word}" in "${name}"`
      };
    }
  }

  return { status: "PASS", rule: "Banner Rule", message: "" };
}


function nullStoreNumber(row) {
  const irt = (row["IRT Local Code"] || "").trim();
  const mg = (row["MG Local Code"] || "").trim();
  const storeNum = (row["Store Number"] || "").trim();

  // Case 1: Store Number is all zeros → FAIL (always)
  if (/^0+$/.test(storeNum)) {
    return {
      status: "FAIL",
      rule: "Store Number",
      message: "Store Number cannot be all zeros"
    };
  }

  // Case 2: Both MG and IRT are missing
  if (!mg && !irt && storeNum) {
    return {
      status: "FAIL",
      rule: "Store Number",
      message: "Please verify if Store Number is needed"
    };
  }

  // Case 3: MG/IRT exists but Store Number is empty → FAIL
  if (mg && irt && !storeNum) {
    return {
      status: "FAIL",
      rule: "Store Number",
      message: "Store Number is missing while MG and IRT code is present"
    };
  }

  // Case 4: MG/IRT exists and Store Number is valid → PASS
  return { status: "PASS", rule: "Store Number", message: "" };
}


// supplier list - c-store = Grocery Supplier & Confection Supplier || mass merchandise = Grocery supplier, confection supplier, GM supplier and HBC Supplier ||
// Grocery = all suppliers

function nullSupplier(row) {
  const grocerysupp = (row["Grocery Supplier Number"] || "").trim();
  const confectionsupp = (row["Confection Supplier Number"] || "").trim();
  const gmsupp = (row["GM Supplier Number"] || "").trim();
  const hbcsupp = (row["HBC Supplier Number"] || "").trim();
  const frozensupp = (row["Frozen Supplier Number"] || "").trim();
  const trade = (row["Local Trade Channel"] || "").trim();
  const channel = (row["Local Sub Channel"] || "").trim();

  const mgLocalCode = (row["MG Local Code"] || "").trim();
  const irtLocalCode = (row["IRT Local Code"] || "").trim();

  // ✅ Guard clause: only run if at least one of MG or IRT Local Code is present
  if (!mgLocalCode && !irtLocalCode) {
    return { status: "PASS", rule: "Null Supplier", message: "" };
  }

  // Helper: check if a supplier field is empty
  const isEmpty = (val) => !val;
  
  switch (channel) {

    case "[7] Convenience Stores":
      if (isEmpty(grocerysupp) || isEmpty(confectionsupp)) {
        return {
          status: "FAIL",
          rule: "Null Supplier",
          message: "Convenience Stores require Grocery & Confection suppliers",
        };
      }
      break;

    case "[1] Pet Super Store":
      if (isEmpty(grocerysupp)) {
        return {
          status: "WARN",
          rule: "Null Supplier",
          message: "Please verify if supplier is available",
        };
      }   
      break;

    case "[2] Neighborhood Pet":
      if (isEmpty(grocerysupp)) {
        return {
          status: "WARN",
          rule: "Null Supplier",
          message: "Please verify if supplier is available",
        };
      }   
      break;

    default:
      return { status: "PASS", rule: "Null Supplier", message: "" };
  }

  switch (trade) {
    case "[11] Pet":
      if (isEmpty(grocerysupp)) {
        return {
          status: "WARN",
          rule: "Null Supplier",
          message: "Please verify ",
        };
      }
      break;

    case "[08] Mass Merchandise Stores":
      if (
        isEmpty(grocerysupp) ||
        isEmpty(confectionsupp) ||
        isEmpty(gmsupp) ||
        isEmpty(hbcsupp)
      ) {
        return {
          status: "FAIL",
          rule: "Null Supplier",
          message:
            "Mass Merchandise requires Grocery, Confection, GM & HBC suppliers",
        };
      }
      break;

    case "[05] Grocery Stores":
      if (
        isEmpty(grocerysupp) ||
        isEmpty(confectionsupp) ||
        isEmpty(gmsupp) ||
        isEmpty(hbcsupp) ||
        isEmpty(frozensupp)
      ) {
        return {
          status: "FAIL",
          rule: "Null Supplier",
          message: "Grocery Stores require all supplier fields",
        };
      }
      break;

    case "[03] Drug Stores and Pharmacies":
      if (
        isEmpty(grocerysupp) ||
        isEmpty(confectionsupp) ||
        isEmpty(gmsupp) ||
        isEmpty(hbcsupp)
      ) {
        return {
          status: "FAIL",
          rule: "Null Supplier",
          message: "Pharmacy requires Grocery, Confection, GM & HBC suppliers",
        };
      }
      break;

    case "[01] Wholesale Clubs":
      if (
        isEmpty(grocerysupp) ||
        isEmpty(confectionsupp) ||
        isEmpty(gmsupp) ||
        isEmpty(hbcsupp) ||
        isEmpty(frozensupp)
      ) {
        return {
          status: "FAIL",
          rule: "Null Supplier",
          message: "Wholesale Clubs require all supplier fields",
        };
      }
      break;

    default:
      return { status: "PASS", rule: "Null Supplier", message: "" };
  }

  return { status: "PASS", rule: "Null Supplier", message: "" };
}

function incorrectSupplier(row) {
  const grocerysupp    = (row["Grocery Supplier Number"] || "").trim();
  const confectionsupp = (row["Confection Supplier Number"] || "").trim();
  const gmsupp         = (row["GM Supplier Number"] || "").trim();
  const hbcsupp        = (row["HBC Supplier Number"] || "").trim();
  const frozensupp     = (row["Frozen Supplier Number"] || "").trim();

  const irt     = (row["IRT Local Code"] || "").trim();
  const mg      = (row["MG Local Code"] || "").trim();
  const trade   = (row["Local Trade Channel"] || "").trim();
  const channel = (row["Local Sub Channel"] || "").trim();
  const status  = (row["Status"] || "").trim();

  const hasSupplier =
    grocerysupp || confectionsupp || gmsupp || hbcsupp || frozensupp;

  // Allowed trades
  const allowedTrades = [
    "[01] Wholesale Clubs",
    "[05] Grocery Stores",
    "[07] Convenience Stores",
    "[08] Mass Merchandise Stores",
    "[11] Pet",
    "[03] Drug Stores and Pharmacies"
  ];

  // Allowed sub‑channels for Pet
  const allowedPetChannel = "[1] Pet Super Store";

  // --- Step 1: IRT/MG rule ---
  if (!irt && !mg) {
    if (hasSupplier) {
      return {
        status: status === "[TC] Closed" ? "WARN" : "FAIL",
        rule: "Incorrect Supplier",
        message: "Suppliers must not be populated when both IRT and MG are empty",
      };
    }
    return { status: "PASS", rule: "Incorrect Supplier", message: "" };
  }

  // --- Step 2: Trade/Channel rule ---
  if (trade === "[09] Pet Stores") {
    if (channel !== allowedPetChannel && hasSupplier) {
      return {
        status: status === "[TC] Closed" ? "WARN" : "FAIL",
        rule: "Incorrect Supplier",
        message: `Pet Stores with channel ${channel} should not have supplier fields populated`,
      };
    }
  } else if (!allowedTrades.includes(trade) && hasSupplier) {
    return {
      status: status === "[TC] Closed" ? "WARN" : "FAIL",
      rule: "Incorrect Supplier",
      message: `Trade ${trade} should not have supplier fields populated`,
    };
  }

  // --- Step 3: Extra supplier checks for required trades ---
  switch (trade) {
    case "[07] Convenience Stores":
      // Only Grocery + Confection allowed
      if (gmsupp || hbcsupp || frozensupp) {
        return {
          status: status === "[TC] Closed" ? "WARN" : "FAIL",
          rule: "Incorrect Supplier",
          message: "Convenience Stores must not have GM, HBC, or Frozen suppliers",
        };
      }
      break;

    case "[08] Mass Merchandise Stores":
      // Grocery + Confection + GM + HBC allowed, Frozen not allowed
      if (frozensupp) {
        return {
          status: status === "[TC] Closed" ? "WARN" : "FAIL",
          rule: "Incorrect Supplier",
          message: "Mass Merchandise must not have Frozen suppliers",
        };
      }
      break;

    case "[05] Grocery Stores":
      // All five required, so no extras to check
      break;

    case "[03] Drug Stores and Pharmacies":
      // Grocery + Confection + GM + HBC allowed, Frozen not allowed
      if (frozensupp) {
        return {
          status: status === "[TC] Closed" ? "WARN" : "FAIL",
          rule: "Incorrect Supplier",
          message: "Pharmacies must not have Frozen suppliers",
        };
      }
      break;

    case "[01] Wholesale Clubs":
      // All five required, so no extras to check
      break;
  }

  return { status: "PASS", rule: "Incorrect Supplier", message: "" };
}



// BWL State Law
// trade channels

const wholesale = "[01] Wholesale Clubs"
const liq = "[02] Liquor, Wine and Beer Stores"
const drug = "[03] Drug Stores and Pharmacies"
const cigarette = "[04] Cigarette Outlets"
const grocery = "[05] Grocery Stores"
const catkiller = "[06] Category Killers"
const cstore = "[07] Convenience Stores"
const mass = "[08] Mass Merchandise Stores"
const cannabis = "[14] Cannabis"


// Restrictive states only
const stateAlcoholRules = {
  AK: {
    beer: [liq],
    wine: [liq],
    liquor: [liq]
  },

  AL: {
    beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    liquor: [liq]
  },

  AR: {
    beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [cigarette, grocery, cstore, mass, liq],
    liquor: [cigarette, liq]
  },

  CO: {
    beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    liquor: [grocery, drug, liq]
  },

  CT: {
    beer: [wholesale, drug, cstore, grocery, liq],
    wine: [drug, liq],
    liquor: [drug, liq]
  },

  DC: {
    beer: [wholesale, drug, grocery, catkiller, cstore, mass, liq],
    wine: [wholesale, drug, grocery, catkiller, cstore, mass, liq],
    liquor: [wholesale, liq]
  },

  DE: {
    beer: [liq],
    wine: [liq],
    liquor: [liq]
  },

  FL: {
    beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    liquor: [cigarette, catkiller, cstore, liq]
  },

  GA: {
    beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    liquor: [liq]
  },

  HI: {
    beer: [wholesale, drug, grocery, catkiller, cstore, mass, liq],
    wine: [wholesale, drug, grocery, catkiller, cstore, mass, liq],
    liquor: [wholesale, drug, grocery, cstore, mass, liq]
  },

  IA: {
      beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
      wine: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
      liquor: [wholesale, drug, cigarette, grocery, catkiller,cstore, mass, liq]
  },

  ID: {
    beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    liquor: [liq, cstore]
  },

  IN: {
    beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    liquor: [wholesale, drug, cigarette, grocery, cstore, mass, liq]
  },

  KS: {
    beer: [wholesale, drug, cigarette, grocery, cstore, mass, liq],
    wine: [liq, cigarette],
    liquor: [liq, cigarette]
  },

  KY: {
    beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [wholesale, drug, cigarette, catkiller, liq, mass],
    liquor: [drug, cigarette, liq]
  },

  MA: {
    beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    liquor: [wholesale, drug, cigarette, grocery, cstore, mass, liq]
  },

  MD: {
    beer: [wholesale, drug, cigarette, grocery, mass, liq],
    wine: [wholesale, drug, cigarette, grocery, mass, liq],
    liquor: [wholesale, drug, cigarette, grocery, mass, liq]
  },

  ME: {
    beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    liquor: [drug, cigarette, grocery, cstore, liq]
  },

  MN: {
    beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [cigarette, catkiller, liq],
    liquor: [liq, cigarette]
  },

  MO: {
    beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    liquor: [wholesale, drug, cigarette, grocery, cstore, catkiller, liq]
  },

  MS: {
    beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [liq, drug, cigarette, catkiller],
    liquor: [liq, cigarette]
  },

  MT: {
    beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [wholesale, drug, grocery, catkiller, cstore, mass, liq],
    liquor: [liq]
  },

  NC: {
    beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    liquor: [liq]
  },

  ND: {
    beer: [wholesale, grocery, catkiller, cstore, mass, liq],
    wine: [wholesale, grocery, cstore, mass, liq],
    liquor: [wholesale, grocery, cstore, liq]
  },

  NE: {
    beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    liquor: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq]
  },

  NH: {
    beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    liquor: [liq]
  },

  NJ: {
    beer: [wholesale, drug, cigarette, grocery, cstore, mass, liq],
    wine: [wholesale, drug, cigarette, grocery, cstore, mass, liq],
    liquor: [wholesale, drug, cigarette, grocery, cstore, mass, liq]
  },

  NM: {
    beer: [wholesale, drug, grocery, catkiller, cstore, mass, liq],
    wine: [wholesale, drug, grocery, catkiller, cstore, mass, liq],
    liquor: [wholesale, drug, grocery, catkiller, cstore, mass, liq]
  },

  NY: {
    beer: [drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [liq, cigarette, grocery, cstore],
    liquor: [liq]
  },

  OH: {
    beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    liquor: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq]
  },

  OK: {
    beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [wholesale, drug, cigarette, grocery, cstore, mass, liq],
    liquor: [liq]
  },

  OR: {
    beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    liquor: [liq]
  },

  PA: {
    beer: [liq , grocery, cstore],
    wine: [liq , grocery, cstore],
    liquor: [liq , grocery, cstore]
  },

  RI: {
    beer: [liq],
    wine: [liq],
    liquor: [liq]
  },

  SC: {
    beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    liquor: [cstore, cigarette, liq]
  },

  TN: {
    beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [wholesale, cigarette, grocery, catkiller, cstore, mass, liq],
    liquor: [liq]
  },

  TX: {
    beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    liquor: [liq]
  },

  UT: {
    beer: [wholesale, drug, cigarette, grocery, cstore, mass, liq],
    wine: [liq],
    liquor: [liq]
  },

  VA: {
    beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    liquor: [cstore, liq]
  },

  VT: {
    beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    liquor: [liq]
  },

  WV: {
    beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    liquor: [wholesale, drug, cigarette, grocery, cstore, liq]
  },

  WY: {
    beer: [wholesale, drug, cigarette, grocery, cstore, mass, liq],
    wine: [wholesale, drug, cigarette, grocery, cstore, mass, liq],
    liquor: [wholesale, drug, cigarette, grocery, cstore, mass, liq]
  }
};


function checkStateAlcoholLaw(row) {
  function getStateCode(stateField) {
    const match = (stateField || "").match(/\[(\w{2})\]/);
    return match ? match[1] : null;
  }

  const status = (row["Status"] || "").trim();
  const stateCode = getStateCode(row["State"]);
  const trade = (row["Local Trade Channel"] || "").trim();
  const beerFlag = row["Beer"] === "[Y] Yes";
  const wineFlag = row["Wine"] === "[Y] Yes";
  const liquorFlag = row["Liquor"] === "[Y] Yes";

  // ✅ Only check these trades
  const tradesToCheck = [
    "[01] Wholesale Clubs",
    "[02] Liquor, Wine and Beer Stores",
    "[03] Drug Stores and Pharmacies",
    "[04] Cigarette Outlets",
    "[05] Grocery Stores",
    "[06] Category Killers",
    "[07] Convenience Stores",
    "[08] Mass Merchandise Stores",
    "[14] Cannabis"
  ];

  const nullFactsTrades = [
    "[01] Wholesale Clubs",
    "[02] Liquor, Wine and Beer Stores",
    "[03] Drug Stores and Pharmacies",
    "[04] Cigarette Outlets",
    "[05] Grocery Stores",
    "[06] Category Killers",
    "[07] Convenience Stores",
    "[08] Mass Merchandise Stores",
    "[50] Dining",
    "[51] Bar/Nightclub",
    "[52] Lodging",
    "[53] Recreation",
    "[54] Transportation",
    "[55] Caterers",
    "[57] Military"
  ];

  if (status === "[OP] Open, Operating" || status === "[TC] Closed" || status === "[FO] Future Opening") {
    const beer = (row["Beer"] || "").trim();
    const wine = (row["Wine"] || "").trim();
    const liquor = (row["Liquor"] || "").trim();

    console.log(`Checking BWL for ${stateCode} in ${trade} with beer=${beer}, wine=${wine}, liquor=${liquor}`);

    if (nullFactsTrades.includes(trade)) {
      if (!beer || !wine || !liquor) {
        return {
          status: "FAIL",
          rule: "Null Keyfacts",
          message: "Beer, Wine, and Liquor must each be marked Yes or No"
        };
      }
    }
  }

  if (!tradesToCheck.includes(trade)) {
    return { status: "PASS", rule: "BWL State Law", message: "Trade not subject to alcohol law check" };
  }

  if (!stateCode) {
    return { status: "PASS", rule: "BWL State Law", message: "No state code found" };
  }

  // --- Simplified New York Rule ---
  const liqspecialStates = ["NY", "SC", "NH", "NC", "VA", "OR", "OH", "ME", "ID"];
  if (liqspecialStates.includes(stateCode) && trade === "[02] Liquor, Wine and Beer Stores") {
    if (beerFlag && wineFlag && liquorFlag) {
      return {
        status: "FAIL",
        rule: "BWL State Law",
        message: `${stateCode} liquor stores cannot sell BWL together`
      };
    }
    return { status: "PASS", rule: "BWL State Law", message: "" };
  }


  // --- Generic state rules ---
  const rules = stateAlcoholRules[stateCode];
  if (!rules) {
    return { status: "PASS", rule: "BWL State Law", message: `No rules defined for ${stateCode}` };
  }

  let violations = [];
  if (beerFlag && !rules.beer.includes(trade)) {
    violations.push(`Beer not allowed in ${trade} for ${stateCode}`);
  }
  if (wineFlag && !rules.wine.includes(trade)) {
    violations.push(`Wine not allowed in ${trade} for ${stateCode}`);
  }
  if (liquorFlag && !rules.liquor.includes(trade)) {
    violations.push(`Liquor not allowed in ${trade} for ${stateCode}`);
  }

  if (violations.length > 0) {
    return {
      status: "FAIL",
      rule: "BWL State Law",
      message: violations.join("; ")
    };
  }

  return { status: "PASS", rule: "BWL State Law", message: "" };
}

const stateCannabisRules = {
  AK: "Combination", AL: "Medical", AR: "Medical", AZ: "Combination", CA: "Combination",
  CO: "Combination", CT: "Combination", DC: "Medical", DE: "Medical", FL: "Medical",
  GA: "No", HI: "Medical", IA: "Medical", ID: "No", IL: "Combination",
  IN: "No", KS: "No", KY: "No", LA: "Medical", MA: "Combination",
  MD: "Combination", ME: "Combination", MI: "Combination", MN: "Combination", MO: "Combination",
  MS: "Medical", MT: "Combination", NC: "No", ND: "Medical", NE: "No",
  NH: "Medical", NJ: "Combination", NM: "Combination", NV: "Combination", NY: "Combination",
  OH: "Combination", OK: "Medical", OR: "Combination", PA: "Medical", RI: "Combination",
  SC: "No", SD: "Medical", TN: "No", TX: "Medical", UT: "Medical",
  VA: "Medical", VT: "Combination", WA: "Combination", WI: "No", WV: "Medical",
  WY: "No"
};

// Check Cannabis State Law
function checkCannabisSubChannel(row) {
  // Helper: extract state code from "[XX] StateName"
  function getStateCode(stateField) {
    const match = (stateField || "").match(/\[(\w{2})\]/);
    return match ? match[1] : null;
  }

  const stateCode = getStateCode(row["State"]);
  const trade = (row["Local Trade Channel"] || "").trim();
  let subChannel = (row["Local Sub Channel"] || "").trim();

  // ✅ Only run cannabis check if trade is [14] Cannabis
  if (trade !== "[14] Cannabis") {
    return { status: "PASS", rule: "Cannabis State Law", message: "" };
  }

  if (!stateCode) {
    return { status: "PASS", rule: "Cannabis State Law", message: "" };
  }

  const expectedRule = stateCannabisRules[stateCode];
  if (!expectedRule) {
    return { status: "PASS", rule: "Cannabis State Law", message: "" };
  }

  // 🔑 Normalize DI value (remove [number] prefix like "[2] Recreational")
  subChannel = subChannel.replace(/^\[\d+\]\s*/, "");

  // Special case: Combination states allow Medical, Recreational, or Combination
  if (expectedRule === "Combination" &&
    (subChannel === "Medical" || subChannel === "Recreational" || subChannel === "Combination")) {
    return {
      status: "PASS",
      rule: "Cannabis State Law",
      message: ""
    };
  }

  // Standard comparison for other states
  if (subChannel !== expectedRule) {
    const msg = expectedRule === "No"
      ? `${stateCode} does not allow cannabis, but found ${subChannel.toLowerCase()}`
      : `${stateCode} allows only ${expectedRule.toLowerCase()}, found ${subChannel.toLowerCase()}`;
    return { status: "FAIL", rule: "Cannabis State Law", message: msg };
  }

  return {
    status: "PASS",
    rule: "Cannabis State Law",
    message: ""
  };
}

function checkClientInternalSpecialEvent(row) {
  const subchannel = (row["Local Sub Channel"] || "").trim();
  const name = (row["Name"] || "").toLowerCase().trim();

  if (subchannel === "[K] Client Internal" && name !== "client internal") {
    console.log(`Subchannel: "${subchannel}", Name: "${name}"`);
    return {
      status: "FAIL",
      rule: "Name/Trade Mismatch",
      message: `Sub Channel is Client Internal, name should be "Client Internal"`
    };
  }

  if (subchannel === "[N] Special Event" && name !== "special event") {
    console.log(`Subchannel: "${subchannel}", Name: "${name}"`);
    return {
      status: "FAIL",
      rule: "Name/Trade Mismatch",
      message: `Sub Channel is Special Event, name should be "Special Event"`
    };
  }

  if (name === "client internal" && subchannel !== "[K] Client Internal") {
    console.log(`Subchannel: "${subchannel}", Name: "${name}"`);
    return {
      status: "FAIL",
      rule: "Name/Trade Mismatch",
      message: `Banner is Client Internal, channel should be "[K] Client Internal"`
    };
  }

  if (name === "special event" && subchannel !== "[N] Special Event") {
    console.log(`Subchannel: "${subchannel}", Name: "${name}"`);
    return {
      status: "FAIL",
      rule: "Name/Trade Mismatch",
      message: `Banner is Special Event, channel should be "[N] Special Event"`
    };
  }

  return {
    status: "PASS",
    rule: "Client Internal Name Check",
    message: ""
  };
}

function mgBannerMismatch(row) {
  const mgRaw = (row["MG Name"] || "").trim().toLowerCase();
  const banner = (row["Name"] || "").trim().toLowerCase();

  if (mgRaw && banner) {
    // Normalize MG root (remove suffixes like /EM)
    const mgRoot = mgRaw.split("/")[0];

    // Check if banner contains MG root
    if (banner.includes(mgRoot)) {
      return {
        status: "PASS",
        rule: "MG/Banner Mismatch",
        message: ""
      };
    }

    return {
      status: "FAIL",
      rule: "MG/Banner Mismatch",
      message: `MG Name is "${row["MG Name"]}", but Banner Name is "${row["Name"]}"`
    };
  }

  return {
    status: "PASS",
    rule: "MG/Banner Mismatch",
    message: ""
  };
}


// Export rules
window.rules = [
  checkVerificationDate,
  checkVerificationSource,
  checkIncorrectStatus,
  checkPharmacy,
  checkFoodType,
  checkNameFormat,
  checkAddressRules,
  checkAddress,
  checkPhone,
  nullStoreNumber,
  nullSupplier,
  incorrectTrade,
  incorrectSupplier,
  incorrectException,
  checkStateAlcoholLaw,
  checkCannabisSubChannel,
  checkClientInternalSpecialEvent,
  mgBannerMismatch
];
