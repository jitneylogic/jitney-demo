// =========================================================================
// JITNEYLOGIC ENGINE — client-agnostic plumbing.
//
// This file is meant to be identical across every client deployment.
// Nothing in here should ever need to change when onboarding a new client.
// Client-specific values (Vault URL, package naming, pest facts, deposit
// rules) live in a JITNEYLOGIC_CONFIG object defined in each client's own
// HTML file, BEFORE this script is loaded.
//
// Expected shape of window.JITNEYLOGIC_CONFIG (set by the client HTML):
// {
//   vaultUrl: "https://...run.app/",
//   packageDisplayToVault: { "Client's Package Name": "Vault's Package Name", ... },
//   depositRules: [ { keywords: ["german roaches","rodent"], amount: 99 }, ... ],
//   defaultDeposit: 39
// }
// =========================================================================

let stats = {
    dayCalls: 0, daySold: 0, dayComm: 0.0, dayTcv: 0.0,
    weekCalls: 0, weekSold: 0, weekComm: 0.0, weekTcv: 0.0
};

let currentVaultPackage = "";
let currentVaultPricing = null;
let currentAddressComponents = null;

function getConfig() {
    if (!window.JITNEYLOGIC_CONFIG) {
        console.error("JITNEYLOGIC_CONFIG is not defined. Set it in the client HTML before loading jitneylogic-engine.js");
        return {};
    }
    return window.JITNEYLOGIC_CONFIG;
}

// =========================================================================
// VAULT CONNECTION
// =========================================================================
async function fetchVaultQuote(payload) {
    const config = getConfig();
    if (!config.vaultUrl) {
        console.error("JITNEYLOGIC_CONFIG.vaultUrl is not set.");
        return null;
    }
    try {
        const resp = await fetch(config.vaultUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await resp.json();
        if (!resp.ok || data.status !== "success") return null;
        return data;
    } catch (err) {
        console.error("Vault fetch failed:", err);
        return null;
    }
}

function evaluatePestCombinationMatrix() {
    const checkedNames = Array.from(document.querySelectorAll('.pest-checkbox:checked')).map(cb => cb.getAttribute('data-display'));
    const packageSelect = document.getElementById('package-select');

    if (checkedNames.length === 0) {
        packageSelect.value = "";
        runDynamicGuardrails();
        return;
    }

    fetchVaultQuote({ selectedPests: checkedNames }).then(data => {
        const config = getConfig();
        if (!data) {
            packageSelect.value = "";
            runDynamicGuardrails();
            return;
        }
        const vaultToDisplay = Object.fromEntries(
            Object.entries(config.packageDisplayToVault || {}).map(([display, vault]) => [vault, display])
        );
        const displayName = vaultToDisplay[data.package] || "";
        packageSelect.value = displayName;
        currentVaultPackage = displayName;
        currentVaultPricing = data.pricing;
        runDynamicGuardrails();
    });
}

function runDynamicGuardrails() {
    const config = getConfig();
    const currentTier = document.getElementById('package-select').value;
    const initialDropdown = document.getElementById('initial-price');
    const monthlyDropdown = document.getElementById('monthly-price');
    const packageTextEl = document.getElementById('inject-package-text');
    if (packageTextEl) packageTextEl.innerText = currentTier !== "" ? currentTier : "[package selection]";

    const clearDropdowns = () => {
        currentVaultPackage = "";
        currentVaultPricing = null;
        initialDropdown.innerHTML = '<option value="0">0.00</option>';
        monthlyDropdown.innerHTML = '<option value="0">0.00</option>';
        executeRealtimeCalculations();
    };

    if (!currentTier) return clearDropdowns();

    if (currentTier === currentVaultPackage && currentVaultPricing) {
        renderPriceDropdowns(currentVaultPricing);
        return;
    }

    const vaultPkgName = (config.packageDisplayToVault || {})[currentTier];
    if (!vaultPkgName) return clearDropdowns();

    fetchVaultQuote({ package: vaultPkgName }).then(data => {
        if (!data) return clearDropdowns();
        currentVaultPackage = currentTier;
        currentVaultPricing = data.pricing;
        renderPriceDropdowns(currentVaultPricing);
    });
}

function renderPriceDropdowns(pricing) {
    const initialDropdown = document.getElementById('initial-price');
    const monthlyDropdown = document.getElementById('monthly-price');
    initialDropdown.innerHTML = `
        <option value="${pricing.initial.starting}">Starting ($${pricing.initial.starting.toFixed(2)})</option>
        <option value="${pricing.initial.target}">Target ($${pricing.initial.target.toFixed(2)})</option>
        <option value="${pricing.initial.floor}">Floor ($${pricing.initial.floor.toFixed(2)})</option>
    `;
    monthlyDropdown.innerHTML = `
        <option value="${pricing.monthly.starting}">Starting ($${pricing.monthly.starting.toFixed(2)})</option>
        <option value="${pricing.monthly.target}">Target ($${pricing.monthly.target.toFixed(2)})</option>
        <option value="${pricing.monthly.floor}">Floor ($${pricing.monthly.floor.toFixed(2)})</option>
    `;
    executeRealtimeCalculations();
}

// =========================================================================
// DROPDOWN MECHANICS (generic multi-select checkbox widgets)
// =========================================================================
function toggleScriptDropdownWindow(event) {
    event.stopPropagation();
    const panel = document.getElementById('script-dropdown-checkbox-panel');
    const wrapper = document.getElementById('script-pest-dropdown-wrapper');
    if (panel.style.display === 'block') {
        panel.style.display = 'none';
        wrapper.classList.remove('active');
        parseScriptPestLogicHandshake();
    } else {
        panel.style.display = 'block';
        wrapper.classList.add('active');
    }
}

function updateScriptDisplayBoxText() {
    const checkedBoxes = Array.from(document.querySelectorAll('.script-pest-cb:checked')).map(cb => cb.value);
    const textDisplayNode = document.getElementById('display-script-selected-text');
    if (checkedBoxes.length > 0) {
        textDisplayNode.innerText = checkedBoxes.join(', ');
        textDisplayNode.style.color = '#333333';
    } else {
        textDisplayNode.innerText = '-- Select Active Infestations --';
        textDisplayNode.style.color = '#64748b';
    }
}

function toggleDropdownWindow(event) {
    event.stopPropagation();
    const panel = document.getElementById('dropdown-checkbox-panel');
    const wrapper = document.getElementById('pest-dropdown-wrapper');
    if (panel.style.display === 'block') {
        panel.style.display = 'none';
        wrapper.classList.remove('active');
        evaluatePestCombinationMatrix();
    } else {
        panel.style.display = 'block';
        wrapper.classList.add('active');
    }
}

function updateDisplayBoxText() {
    const checkedBoxes = Array.from(document.querySelectorAll('.pest-checkbox:checked')).map(cb => cb.getAttribute('data-display'));
    const textDisplayNode = document.getElementById('display-selected-text');
    if (checkedBoxes.length > 0) {
        textDisplayNode.innerText = checkedBoxes.join(', ');
        textDisplayNode.style.color = '#333333';
    } else {
        textDisplayNode.innerText = '-- Select Active Infestations --';
        textDisplayNode.style.color = '#64748b';
    }
}

window.addEventListener('click', function(event) {
    const dropdownWrapper = document.getElementById('pest-dropdown-wrapper');
    const dropdownPanel = document.getElementById('dropdown-checkbox-panel');
    const scriptWrapper = document.getElementById('script-pest-dropdown-wrapper');

    if (dropdownWrapper && !dropdownWrapper.contains(event.target)) {
        if (dropdownPanel.style.display === 'block') {
            dropdownPanel.style.display = 'none';
            dropdownWrapper.classList.remove('active');
            evaluatePestCombinationMatrix();
        }
    }
    if (scriptWrapper && !scriptWrapper.contains(event.target)) {
        const panel = document.getElementById('script-dropdown-checkbox-panel');
        if (panel && panel.style.display === 'block') {
            panel.style.display = 'none';
            scriptWrapper.classList.remove('active');
            parseScriptPestLogicHandshake();
        }
    }
});

function copyField(elementId) {
    const copyTarget = document.getElementById(elementId);
    copyTarget.select();
    copyTarget.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(copyTarget.value).catch(() => {
        console.log("Clipboard allocation block failure intercept.");
    });
}

// =========================================================================
// STANDARD CUSTOMER FIELD SYNCING — same fields collected for every client
// =========================================================================
function updateConsolidatedAppointmentNotes() {
    const firstName = document.getElementById('first-name').value.trim();
    const location = document.getElementById('script-location-input').value.trim();
    const duration = document.getElementById('script-duration-input').value.trim();
    const checkedScriptPests = Array.from(document.querySelectorAll('.script-pest-cb:checked')).map(cb => cb.value);

    if (!firstName && !location && !duration && checkedScriptPests.length === 0) {
        document.getElementById('appointment-notes-consolidated').value = "";
        return;
    }

    const pFirst = firstName || "[Customer first name]";
    const pLocation = location || "[location of infestation]";
    const pDuration = duration || "[duration of infestation]";
    const pestsString = checkedScriptPests.length > 0 ? checkedScriptPests.join(', ') : "[pests]";

    document.getElementById('appointment-notes-consolidated').value =
        `${pFirst} has been dealing with ${pestsString} in the ${pLocation} for ${pDuration}`;
}

function syncCustomerName(val) {
    document.getElementById('script-first-name').value = val;
    document.getElementById('first-name').value = val;
    document.querySelectorAll('.inject-script-name').forEach(el => { el.innerText = val !== "" ? val : "____"; });
    document.querySelectorAll('.inject-name-final').forEach(el => { el.innerText = val !== "" ? val : "Customer"; });
    updateConsolidatedAppointmentNotes();
}

function syncLastName(val) {
    document.getElementById('script-last-name').value = val;
    document.getElementById('last-name').value = val;
}

function syncEmailValue(val) {
    document.getElementById('script-email-input').value = val;
    document.getElementById('customer-email').value = val;
}

function parsePlaceComponents(place) {
    const get = (type) => {
        const comp = (place.addressComponents || []).find(c => c.types.includes(type));
        return comp ? comp.longText : "";
    };
    const streetNumber = get("street_number");
    const route = get("route");
    return {
        street: [streetNumber, route].filter(Boolean).join(" "),
        city: get("locality") || get("sublocality") || get("postal_town"),
        state: (place.addressComponents || []).find(c => c.types.includes("administrative_area_level_1"))?.shortText || "",
        zip: get("postal_code")
    };
}

let addressSessionToken = null;
let addressDebounceTimers = {};

function closeAddressDropdown(inputEl) {
    const existing = document.getElementById(inputEl.id + "-suggest-panel");
    if (existing) existing.remove();
}

function renderAddressSuggestions(inputEl, suggestions) {
    closeAddressDropdown(inputEl);
    if (!suggestions.length) return;

    const panel = document.createElement("div");
    panel.id = inputEl.id + "-suggest-panel";
    panel.style.cssText = "position:absolute; z-index:200; background:#fff; border:1px solid var(--color-sage-accent, #4C9170); border-radius:4px; box-shadow:0 10px 25px rgba(0,0,0,0.25); max-height:220px; overflow-y:auto; font-size:14px;";

    const rect = inputEl.getBoundingClientRect();
    panel.style.width = rect.width + "px";
    panel.style.left = (rect.left + window.scrollX) + "px";
    panel.style.top = (rect.bottom + window.scrollY + 2) + "px";

    suggestions.forEach(suggestion => {
        const row = document.createElement("div");
        row.textContent = suggestion.placePrediction.text.text;
        row.style.cssText = "padding:8px 10px; cursor:pointer; color:#1e293b;";
        row.addEventListener("mouseenter", () => row.style.background = "#f1f5f9");
        row.addEventListener("mouseleave", () => row.style.background = "#fff");
        row.addEventListener("click", async () => {
            const place = suggestion.placePrediction.toPlace();
            await place.fetchFields({ fields: ["addressComponents", "formattedAddress"] });
            currentAddressComponents = parsePlaceComponents(place);
            syncAddressValue(place.formattedAddress || suggestion.placePrediction.text.text);
            closeAddressDropdown(inputEl);
            addressSessionToken = null; // session ends on selection
        });
        panel.appendChild(row);
    });

    document.body.appendChild(panel);
}

async function handleAddressInput(inputEl) {
    const query = inputEl.value.trim();
    if (query.length < 4) {
        closeAddressDropdown(inputEl);
        return;
    }
    try {
        const { AutocompleteSuggestion, AutocompleteSessionToken } = await google.maps.importLibrary("places");
        if (!addressSessionToken) addressSessionToken = new AutocompleteSessionToken();

        const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: query,
            includedRegionCodes: ["us"],
            sessionToken: addressSessionToken
        });
        renderAddressSuggestions(inputEl, suggestions || []);
    } catch (err) {
        console.error("Address autocomplete request failed:", err);
    }
}

function initAddressAutocomplete() {
    ["script-address-input", "right-address"].forEach(id => {
        const inputEl = document.getElementById(id);
        if (!inputEl) return;
        inputEl.addEventListener("input", () => {
            clearTimeout(addressDebounceTimers[id]);
            addressDebounceTimers[id] = setTimeout(() => handleAddressInput(inputEl), 250);
        });
    });
    document.addEventListener("click", (event) => {
        ["script-address-input", "right-address"].forEach(id => {
            const inputEl = document.getElementById(id);
            const panel = document.getElementById(id + "-suggest-panel");
            if (panel && inputEl && !inputEl.contains(event.target) && !panel.contains(event.target)) {
                panel.remove();
            }
        });
    });
}
window.initAddressAutocomplete = initAddressAutocomplete;

function syncAddressValue(val) {
    document.getElementById('script-address-input').value = val;
    document.getElementById('right-address').value = val;
}

function syncDateValue(val) {
    document.getElementById('script-date-input').value = val;
    document.getElementById('appointment-date').value = val;
    syncScheduleDetails();
}

function syncWindowValue(val) {
    document.getElementById('script-window-input').value = val;
    document.getElementById('time-window').value = val;
    syncScheduleDetails();
}

function syncScheduleDetails() {
    const rawDate = document.getElementById('appointment-date').value;
    const rawWindow = document.getElementById('time-window').value;
    const scheduleTextEl = document.getElementById('inject-schedule-text');
    const finalWindowEl = document.getElementById('inject-final-window');
    if (scheduleTextEl) scheduleTextEl.innerText = rawDate !== "" ? rawDate : "(DATE)";
    if (finalWindowEl) finalWindowEl.innerText = (rawDate !== "" || rawWindow !== "") ? `${rawDate} (${rawWindow} Time Window)` : "(DAY & TIME WINDOW)";
}

// =========================================================================
// PRICING / DEPOSIT MATH — deposit tiers are config-driven per client
// =========================================================================
function executeRealtimeCalculations() {
    const config = getConfig();
    const initialValue = parseFloat(document.getElementById('initial-price').value) || 0;
    const monthlyValue = parseFloat(document.getElementById('monthly-price').value) || 0;
    const commissionPercentage = parseFloat(document.getElementById('commission-input').value) || 0;
    const currentPackage = document.getElementById('package-select').value;

    const totalContractValue = initialValue + (monthlyValue * 11);
    const calculatedPayoutValue = totalContractValue * (commissionPercentage / 100);

    document.getElementById('tcv-display').value = "$" + totalContractValue.toFixed(2);
    document.getElementById('payout-display').value = "$" + calculatedPayoutValue.toFixed(2);

    const setIfPresent = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.innerText = text;
    };

    setIfPresent('inject-initial-text', "$" + initialValue.toFixed(2));
    setIfPresent('inject-monthly-text', "$" + monthlyValue.toFixed(2));

    const normalInitialMarkup = initialValue + 150;
    setIfPresent('inject-pitch-normal', "$" + normalInitialMarkup.toFixed(2));
    setIfPresent('inject-pitch-monthly', "$" + monthlyValue.toFixed(2));
    setIfPresent('inject-pitch-discounted', "$" + initialValue.toFixed(2));

    let depositAmount = config.defaultDeposit ?? 39;
    const lowerPackageStr = currentPackage.toLowerCase();
    (config.depositRules || []).forEach(rule => {
        if (rule.keywords.some(kw => lowerPackageStr.includes(kw))) {
            depositAmount = rule.amount;
        }
    });

    const balanceRemaining = Math.max(0, initialValue - depositAmount);
    setIfPresent('inject-deposit-text', "$" + depositAmount);
    setIfPresent('inject-balance-text', "$" + balanceRemaining.toFixed(2));
}

// =========================================================================
// CREATE CUSTOMER — sends the account+lead payload to Ardenus (Stage 2 of
// the sales flow). Independent of final sale outcome; can be called on a
// call that never closes.
// =========================================================================
async function fireCreateCustomer() {
    const config = getConfig();
    const statusEl = document.getElementById('create-customer-status');
    const btn = document.getElementById('create-customer-btn');

    const requiredEls = {
        "First Name": document.getElementById('first-name').value.trim(),
        "Last Name": document.getElementById('last-name').value.trim(),
        "Phone": document.getElementById('phone').value.trim(),
        "Address": document.getElementById('right-address').value.trim(),
        "Package": document.getElementById('package-select').value
    };
    const missing = Object.entries(requiredEls).filter(([, v]) => !v).map(([k]) => k);
    if (missing.length > 0) {
        statusEl.style.color = "#f59e0b";
        statusEl.innerText = "Missing before creating customer: " + missing.join(", ");
        return;
    }

    if (!window.currentCallId) {
        window.currentCallId = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
    }

    const payload = {
        event_type: "create_account_and_lead",
        transaction_id: window.currentCallId,
        submitted_at: new Date().toISOString(),
        account: {
            first_name: document.getElementById('first-name').value.trim(),
            last_name: document.getElementById('last-name').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            email: document.getElementById('customer-email').value.trim() || null,
            address: currentAddressComponents || { street: document.getElementById('right-address').value.trim(), city: "", state: "", zip: "" }
        },
        lead: {
            package_type: document.getElementById('package-select').value,
            initial_price: parseFloat(document.getElementById('initial-price').value) || 0,
            monthly_price: parseFloat(document.getElementById('monthly-price').value) || 0,
            appointment_notes: document.getElementById('appointment-notes-consolidated').value
        }
    };

    btn.disabled = true;
    statusEl.style.color = "var(--color-mint-soft)";
    statusEl.innerText = "Creating customer in FieldRoutes...";

    try {
        const resp = await fetch(config.ardenusUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await resp.json();

        if (!resp.ok || data.status !== "success") {
            throw new Error(data.message || "Ardenus returned an error.");
        }

        document.getElementById('account-number').value = data.fieldroutes_account_number;
        window.currentFieldroutesAccountNumber = data.fieldroutes_account_number;
        statusEl.style.color = "#4ade80";
        statusEl.innerText = "Customer created — Account #" + data.fieldroutes_account_number;

    } catch (err) {
        console.error("Create Customer failed:", err);
        statusEl.style.color = "#ef4444";
        statusEl.innerText = "Failed to create customer: " + err.message;
    } finally {
        btn.disabled = false;
    }
}
window.fireCreateCustomer = fireCreateCustomer;


// =========================================================================
// REP IDENTITY — interim mechanism until real per-rep login exists (Phase 4).
// Persisted per-browser via localStorage so a rep testing on their own
// laptop keeps a stable identity across page reloads.
// =========================================================================
function getRepId() {
    return localStorage.getItem('jitney_rep_id') || 'UNASSIGNED';
}
function getRepName() {
    return localStorage.getItem('jitney_rep_name') || 'Unassigned Rep';
}
function loadRepIdentity() {
    const nameEl = document.getElementById('rep-identity-name');
    const idEl = document.getElementById('rep-identity-id');
    if (nameEl) nameEl.value = localStorage.getItem('jitney_rep_name') || '';
    if (idEl) idEl.value = localStorage.getItem('jitney_rep_id') || '';
}
function saveRepIdentity() {
    const nameEl = document.getElementById('rep-identity-name');
    const idEl = document.getElementById('rep-identity-id');
    if (nameEl) localStorage.setItem('jitney_rep_name', nameEl.value.trim());
    if (idEl) localStorage.setItem('jitney_rep_id', idEl.value.trim());
}
window.loadRepIdentity = loadRepIdentity;
window.saveRepIdentity = saveRepIdentity;

// =========================================================================
// LIVE LEADERBOARD — Firestore realtime listener. Reads only; all writes
// go through jitneylogger's Admin SDK, which is the only thing with
// permission to write under the locked-down firestore.rules.
// =========================================================================
function getLocalDateKey(d, timeZone) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
    const map = {};
    parts.forEach(p => { map[p.type] = p.value; });
    return `${map.year}-${map.month}-${map.day}`;
}

function dateKeysForToday() {
    const config = getConfig();
    const timeZone = config.businessTimezone || "America/Denver";
    const d = new Date();
    const daily = getLocalDateKey(d, timeZone);

    // Build a UTC-equivalent Date from the LOCAL calendar date, so week-number
    // math (which needs a stable Date object) is based on Utah's calendar day,
    // not whatever UTC day happens to be at this exact instant.
    const [y, m, day] = daily.split('-').map(Number);
    const localAsUtc = new Date(Date.UTC(y, m - 1, day));

    const target = new Date(localAsUtc.valueOf());
    const dayNr = (localAsUtc.getUTCDay() + 6) % 7;
    target.setUTCDate(target.getUTCDate() - dayNr + 3);
    const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
    const weekNr = 1 + Math.round(((target - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
    const weekly = `${target.getUTCFullYear()}-W${String(weekNr).padStart(2, "0")}`;
    return { daily, weekly };
}

function renderPersonalStats(prefix, statsDoc) {
    const repBreakdown = (statsDoc && statsDoc.rep_breakdown && statsDoc.rep_breakdown[getRepId()]) || {};
    const callsTaken = repBreakdown.calls_taken || 0;
    const callsSold = repBreakdown.calls_sold || 0;
    const revenue = repBreakdown.revenue || 0;

    const setText = (id, text) => { const el = document.getElementById(id); if (el) el.innerText = text; };
    setText(`${prefix}-calls`, callsTaken);
    setText(`${prefix}-sold`, callsSold);
    setText(`${prefix}-rate`, callsTaken > 0 ? ((callsSold / callsTaken) * 100).toFixed(1) + "%" : "0.0%");
    setText(`${prefix}-tcv`, "$" + revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    setText(`${prefix}-acv`, callsSold > 0 ? "$" + (revenue / callsSold).toFixed(2) : "$0.00");
    setText(`${prefix}-rpc`, callsTaken > 0 ? "$" + (revenue / callsTaken).toFixed(2) : "$0.00");
    // Commission isn't tracked server-side (rate varies per deal) — leaving
    // day-comm/week-comm at whatever the last local calculation showed.
}

function renderLeaderboard(dailyStatsDoc) {
    const container = document.getElementById('leaderboard-grid');
    if (!container) return;

    const repBreakdown = (dailyStatsDoc && dailyStatsDoc.rep_breakdown) || {};
    const rows = Object.entries(repBreakdown)
        .map(([repId, data]) => ({
            repId,
            displayName: data.display_name || repId,
            revenue: data.revenue || 0
        }))
        .sort((a, b) => b.revenue - a.revenue);

    if (rows.length === 0) {
        container.innerHTML = `<div class="leaderboard-row"><span style="opacity:0.6;">Waiting for today's activity...</span></div>`;
        return;
    }

    const currentRepId = getRepId();
    container.innerHTML = rows.map((row, index) => {
        const isUser = row.repId === currentRepId;
        const rankClass = index === 0 ? "rank-1" : "";
        const userClass = isUser ? "user-row" : "";
        const label = isUser ? `${row.displayName} (You)` : row.displayName;
        return `
            <div class="leaderboard-row ${rankClass} ${userClass}">
                <div><span class="rep-rank-badge">${index + 1}</span>${label}</div>
                <span class="metrics-val ${isUser ? 'val-highlight' : ''}">$${row.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
        `;
    }).join('');
}

function initLiveLeaderboard() {
    const config = getConfig();
    if (!config.firebaseConfig || !window.firebase) {
        console.error("Firebase config missing or Firebase SDK not loaded — live leaderboard disabled.");
        return;
    }

    if (!firebase.apps.length) {
        firebase.initializeApp(config.firebaseConfig);
    }
    const db = firebase.firestore();
    const { daily, weekly } = dateKeysForToday();

    db.collection('daily_stats').doc(daily).onSnapshot(doc => {
        const data = doc.data();
        renderPersonalStats('day', data);
        renderLeaderboard(data);
    }, err => console.error("Daily stats listener error:", err));

    db.collection('weekly_stats').doc(weekly).onSnapshot(doc => {
        renderPersonalStats('week', doc.data());
    }, err => console.error("Weekly stats listener error:", err));
}
window.initLiveLeaderboard = initLiveLeaderboard;

// =========================================================================
// EXECUTIVE DASHBOARD — same Firestore data as the cockpit leaderboard,
// different presentation (office-wide department cards + a full rep table,
// no "current user" concept since an executive isn't any one rep).
// =========================================================================
function renderDepartmentCard(prefix, statsDoc) {
    const callsTaken = (statsDoc && statsDoc.calls_taken) || 0;
    const callsSold = (statsDoc && statsDoc.calls_sold) || 0;
    const revenue = (statsDoc && statsDoc.total_revenue) || 0;

    const setText = (id, text) => { const el = document.getElementById(id); if (el) el.innerText = text; };
    setText(`${prefix}-calls`, callsTaken);
    setText(`${prefix}-closed`, callsSold);
    setText(`${prefix}-rate`, callsTaken > 0 ? ((callsSold / callsTaken) * 100).toFixed(1) + "%" : "0.0%");
    setText(`${prefix}-rev`, "$" + revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    setText(`${prefix}-rpc`, callsTaken > 0 ? "$" + (revenue / callsTaken).toFixed(2) : "$0.00");
}

function renderRepStandingsTable(statsDoc) {
    const tbody = document.getElementById('rep-standings-tbody');
    if (!tbody) return;

    const repBreakdown = (statsDoc && statsDoc.rep_breakdown) || {};
    const rows = Object.entries(repBreakdown)
        .map(([repId, data]) => ({
            repId,
            displayName: data.display_name || repId,
            callsTaken: data.calls_taken || 0,
            callsSold: data.calls_sold || 0,
            revenue: data.revenue || 0
        }))
        .sort((a, b) => b.revenue - a.revenue);

    if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; opacity:0.6;">Waiting for today's activity...</td></tr>`;
        return;
    }

    tbody.innerHTML = rows.map((row, index) => {
        const rate = row.callsTaken > 0 ? ((row.callsSold / row.callsTaken) * 100).toFixed(1) + "%" : "0.0%";
        const rpc = row.callsTaken > 0 ? "$" + (row.revenue / row.callsTaken).toFixed(2) : "$0.00";
        const rankClass = index === 0 ? "rank-row-1" : (index === 1 ? "rank-row-2" : "");
        return `
            <tr class="${rankClass}">
                <td><span class="rank-badge">${index + 1}</span>${row.displayName}</td>
                <td class="monospaced-cell">${row.callsTaken}</td>
                <td class="monospaced-cell">${row.callsSold}</td>
                <td class="monospaced-cell">${rate}</td>
                <td class="monospaced-cell" style="color:#4ade80;">$${row.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td class="monospaced-cell">${rpc}</td>
            </tr>
        `;
    }).join('');
}

function initExecutiveDashboard() {
    const config = getConfig();
    if (!config.firebaseConfig || !window.firebase) {
        console.error("Firebase config missing or Firebase SDK not loaded — executive dashboard disabled.");
        return;
    }

    if (!firebase.apps.length) {
        firebase.initializeApp(config.firebaseConfig);
    }
    const db = firebase.firestore();
    const { daily, weekly } = dateKeysForToday();

    db.collection('daily_stats').doc(daily).onSnapshot(doc => {
        const data = doc.data();
        renderDepartmentCard('global-today', data);
        renderRepStandingsTable(data);
    }, err => console.error("Daily stats listener error:", err));

    db.collection('weekly_stats').doc(weekly).onSnapshot(doc => {
        renderDepartmentCard('global-week', doc.data());
    }, err => console.error("Weekly stats listener error:", err));
}
window.initExecutiveDashboard = initExecutiveDashboard;



function fireRevenuePipelineTracking(event) {
    event.preventDefault();

    const outcome = document.getElementById('call-outcome').value;
    const assignedPackage = document.getElementById('package-select').value || "No Package Mapped";
    const currentTcvValue = parseFloat(document.getElementById('tcv-display').value.replace('$', '')) || 0;
    const commissionEarned = parseFloat(document.getElementById('payout-display').value.replace('$', '')) || 0;
    const initialValue = parseFloat(document.getElementById('initial-price').value) || 0;
    const monthlyValue = parseFloat(document.getElementById('monthly-price').value) || 0;

    const clientFirst = document.getElementById('first-name').value.trim() || "Unknown";
    const clientLast = document.getElementById('last-name').value.trim() || "Client";
    const clientAccount = document.getElementById('account-number').value.trim() || "N/A";

    if (!window.currentCallId) {
        window.currentCallId = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
    }

    const loggerPayload = {
        call_id: window.currentCallId,
        rep_id: getRepId(),
        rep_name: getRepName(),
        pest_type: Array.from(document.querySelectorAll('.pest-checkbox:checked')).map(cb => cb.getAttribute('data-display')).join(', ') || null,
        zip_code: (currentAddressComponents && currentAddressComponents.zip) || null,
        package_quoted: assignedPackage,
        agreement_length_quoted: null,
        initial_price_quoted: initialValue,
        monthly_price_quoted: monthlyValue,
        lead_source: document.getElementById('lead-source') ? document.getElementById('lead-source').value : null,
        outcome: outcome,
        fieldroutes_account_number: window.currentFieldroutesAccountNumber || null
    };

    const config = getConfig();
    if (config.loggerUrl) {
        fetch(config.loggerUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(loggerPayload)
        }).catch(err => console.error("jitneylogger POST failed:", err));
        // Not awaited on purpose — the realtime listener will reflect the
        // write within a moment; we don't want to block form reset on it.
    }

    const logTableBody = document.getElementById('tracker-log-tbody');
    if (logTableBody) {
        const timestampString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const resultStyleBadge = outcome === "Sold" ? "color:#4ade80; font-weight:bold;" : (outcome === "Scheduled Callback" ? "color:#f59e0b;" : "color:#ef4444;");

        logTableBody.insertAdjacentHTML('afterbegin', `
            <tr>
                <td>${timestampString}</td>
                <td><strong>${clientFirst} ${clientLast}</strong></td>
                <td style="font-family:monospace;">${clientAccount}</td>
                <td>${assignedPackage}</td>
                <td style="font-weight:bold;">$${currentTcvValue.toFixed(2)}</td>
                <td style="color:var(--color-mint-soft); font-weight:bold;">$${commissionEarned.toFixed(2)}</td>
                <td style="${resultStyleBadge}">${outcome}</td>
            </tr>
        `);
    }

    document.getElementById('closer-portal-form').reset();
    document.getElementById('script-location-input').value = "";
    document.getElementById('script-duration-input').value = "";
    document.getElementById('script-address-input').value = "";
    document.getElementById('script-date-input').value = "";
    document.getElementById('script-window-input').value = "AT";

    document.getElementById('display-selected-text').innerText = '-- Select Active Infestations --';
    document.getElementById('display-selected-text').style.color = '#64748b';
    document.getElementById('display-script-selected-text').innerText = '-- Select Active Infestations --';
    document.getElementById('display-script-selected-text').style.color = '#64748b';

    document.querySelectorAll('.script-pest-cb, .pest-checkbox').forEach(cb => cb.checked = false);

    syncCustomerName("");
    syncLastName("");
    syncEmailValue("");
    syncAddressValue("");
    currentAddressComponents = null;
    document.getElementById('account-number').value = "";
    document.getElementById('create-customer-status').innerText = "";
    window.currentCallId = null;
    window.currentFieldroutesAccountNumber = null;
    syncScheduleDetails();
    runDynamicGuardrails();
    parseScriptPestLogicHandshake();
}
