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
        const comp = (place.address_components || []).find(c => c.types.includes(type));
        return comp ? comp.long_name : "";
    };
    const streetNumber = get("street_number");
    const route = get("route");
    return {
        street: [streetNumber, route].filter(Boolean).join(" "),
        city: get("locality") || get("sublocality") || get("postal_town"),
        state: (place.address_components || []).find(c => c.types.includes("administrative_area_level_1"))?.short_name || "",
        zip: get("postal_code")
    };
}

function initAddressAutocomplete() {
    const options = { types: ["address"], componentRestrictions: { country: "us" } };
    ["script-address-input", "right-address"].forEach(id => {
        const inputEl = document.getElementById(id);
        if (!inputEl || !window.google) return;
        const autocomplete = new google.maps.places.Autocomplete(inputEl, options);
        autocomplete.addListener("place_changed", () => {
            const place = autocomplete.getPlace();
            if (!place || !place.address_components) return;
            currentAddressComponents = parsePlaceComponents(place);
            syncAddressValue(place.formatted_address || inputEl.value);
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
    document.getElementById('inject-initial-text').innerText = "$" + initialValue.toFixed(2);
    document.getElementById('inject-monthly-text').innerText = "$" + monthlyValue.toFixed(2);

    const normalInitialMarkup = initialValue + 150;
    document.getElementById('inject-pitch-normal').innerText = "$" + normalInitialMarkup.toFixed(2);
    document.getElementById('inject-pitch-monthly').innerText = "$" + monthlyValue.toFixed(2);
    document.getElementById('inject-pitch-discounted').innerText = "$" + initialValue.toFixed(2);

    let depositAmount = config.defaultDeposit ?? 39;
    const lowerPackageStr = currentPackage.toLowerCase();
    (config.depositRules || []).forEach(rule => {
        if (rule.keywords.some(kw => lowerPackageStr.includes(kw))) {
            depositAmount = rule.amount;
        }
    });

    const balanceRemaining = Math.max(0, initialValue - depositAmount);
    document.getElementById('inject-deposit-text').innerText = "$" + depositAmount;
    document.getElementById('inject-balance-text').innerText = "$" + balanceRemaining.toFixed(2);
}

// =========================================================================
// CALL SUBMISSION / LEADERBOARD TRACKING
// =========================================================================
function fireRevenuePipelineTracking(event) {
    event.preventDefault();

    const outcome = document.getElementById('call-outcome').value;
    const assignedPackage = document.getElementById('package-select').value || "No Package Mapped";
    const currentTcvValue = parseFloat(document.getElementById('tcv-display').value.replace('$', '')) || 0;
    const commissionEarned = parseFloat(document.getElementById('payout-display').value.replace('$', '')) || 0;

    const clientFirst = document.getElementById('first-name').value.trim() || "Unknown";
    const clientLast = document.getElementById('last-name').value.trim() || "Client";
    const clientAccount = document.getElementById('account-number').value.trim() || "N/A";

    stats.dayCalls += 1; stats.weekCalls += 1;
    if (outcome === "Sold") {
        stats.daySold += 1; stats.weekSold += 1;
        stats.dayTcv += currentTcvValue; stats.weekTcv += currentTcvValue;
        stats.dayComm += commissionEarned; stats.weekComm += commissionEarned;
    }

    document.getElementById('day-calls').innerText = stats.dayCalls;
    document.getElementById('day-sold').innerText = stats.daySold;
    document.getElementById('day-rate').innerText = stats.dayCalls > 0 ? ((stats.daySold / stats.dayCalls) * 100).toFixed(1) + "%" : "0.0%";
    document.getElementById('day-tcv').innerText = "$" + stats.dayTcv.toFixed(2);
    document.getElementById('day-acv').innerText = stats.daySold > 0 ? "$" + (stats.dayTcv / stats.daySold).toFixed(2) : "$0.00";
    document.getElementById('day-rpc').innerText = stats.dayCalls > 0 ? "$" + (stats.dayTcv / stats.dayCalls).toFixed(2) : "$0.00";
    document.getElementById('day-comm').innerText = "$" + stats.dayComm.toFixed(2);

    document.getElementById('week-calls').innerText = stats.weekCalls;
    document.getElementById('week-sold').innerText = stats.weekSold;
    document.getElementById('week-rate').innerText = stats.weekCalls > 0 ? ((stats.weekSold / stats.weekCalls) * 100).toFixed(1) + "%" : "0.0%";
    document.getElementById('week-tcv').innerText = "$" + stats.weekTcv.toFixed(2);
    document.getElementById('week-acv').innerText = stats.weekSold > 0 ? "$" + (stats.weekTcv / stats.weekSold).toFixed(2) : "$0.00";
    document.getElementById('week-rpc').innerText = stats.weekCalls > 0 ? "$" + (stats.weekTcv / stats.weekCalls).toFixed(2) : "$0.00";
    document.getElementById('week-comm').innerText = "$" + stats.weekComm.toFixed(2);

    document.getElementById('leader-val-user').innerText = "$" + stats.dayTcv.toFixed(2);
    if (stats.dayTcv > 2840.50) {
        const rank1Row = document.getElementById('leader-rank-1');
        const userRow = document.getElementById('leader-rank-user');
        userRow.parentNode.insertBefore(userRow, rank1Row);
        userRow.querySelector('.rep-rank-badge').innerText = "1";
        userRow.querySelector('.rep-rank-badge').style.background = "#d97706";
        rank1Row.querySelector('.rep-rank-badge').innerText = "2";
        rank1Row.querySelector('.rep-rank-badge').style.background = "var(--color-sage-accent)";
    }

    const logTableBody = document.getElementById('tracker-log-tbody');
    if (stats.dayCalls === 1) { logTableBody.innerHTML = ""; }

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

    // TODO: this is also where the jitneylogger call-log POST and the
    // conditional Ardenus "Save Customer" payload get wired in — not yet
    // built as of this version of the engine.

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
    syncScheduleDetails();
    runDynamicGuardrails();
    parseScriptPestLogicHandshake();
}
