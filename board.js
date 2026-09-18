(function () {
  "use strict";

  const D = window.AckermanData;
  const Docs = window.AckermanDocuments;
  if (!D) throw new Error("AckermanData failed to load.");

  let patients = D.loadPatients();
  let sortState = { key: "actionDate", direction: "asc" };
  let detailsPatientId = null;
  let detailsFocus = "overview";
  let editingPlanSchedule = [];
  let editingPlanPaidMap = new Map();
  let editingExistingPlan = false;
  let editingPatientId = "";
  let originalPlanSnapshot = "";
  let quickFilter = "";

  const elements = {
    tbody: document.getElementById("patientTableBody"),
    emptyState: document.getElementById("emptyState"),
    search: document.getElementById("searchInput"),
    statusFilter: document.getElementById("statusFilter"),
    locationFilter: document.getElementById("locationFilter"),
    treatmentFilter: document.getElementById("treatmentFilter"),
    sort: document.getElementById("sortSelect"),
    resultCount: document.getElementById("resultCount"),
    patientDialog: document.getElementById("patientDialog"),
    paymentDialog: document.getElementById("paymentDialog"),
    detailsDialog: document.getElementById("detailsDialog"),
    completionDialog: document.getElementById("completionDialog"),
    adjustmentDialog: document.getElementById("adjustmentDialog"),
    transactionDialog: document.getElementById("transactionDialog"),
    paymentPlanSection: document.getElementById("paymentPlanSection"),
    planScheduleBody: document.getElementById("planScheduleBody"),
    planScheduleEmpty: document.getElementById("planScheduleEmpty"),
    planScheduleSummary: document.getElementById("planScheduleSummary"),
    planTargetNote: document.getElementById("planTargetNote"),
    savedViewSelect: document.getElementById("savedViewSelect"),
    savedViewName: document.getElementById("savedViewName"),
    toastRegion: document.getElementById("toastRegion")
  };

  function findPatient(id) {
    return patients.find((patient) => patient.id === id);
  }

  function setSelectOptions(select, values, allLabel) {
    const previous = select.value;
    select.innerHTML = `<option value="all">${D.escapeHtml(allLabel)}</option>`;
    values.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
    select.value = values.includes(previous) ? previous : "all";
  }

  function populateFilters() {
    const unique = (key) => [...new Set(patients.map((patient) => patient[key]).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));
    setSelectOptions(elements.locationFilter, unique("location"), "All sites");
    setSelectOptions(elements.treatmentFilter, unique("treatment"), "All treatments");
  }

  function showToast(message, type = "success") {
    const toast = document.createElement("div");
    toast.className = `toast${type === "error" ? " error" : ""}`;
    toast.textContent = message;
    elements.toastRegion.appendChild(toast);
    window.setTimeout(() => toast.remove(), 4600);
  }

  function dateRelativeText(isoDate) {
    if (!isoDate) return "";
    const days = D.daysBetween(D.todayIso(), isoDate);
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    if (days === -1) return "Yesterday";
    if (days > 1) return `In ${days} days`;
    return `${Math.abs(days)} days overdue`;
  }

  function validOperationalDate(isoDate, label, allowBlank = false) {
    if (!isoDate && allowBlank) return true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(isoDate || ""))) {
      showToast(`${label} is required.`, "error");
      return false;
    }
    const distance = Math.abs(D.daysBetween(D.todayIso(), isoDate));
    if (distance > 3650) {
      showToast(`${label} must be within 10 years of today.`, "error");
      return false;
    }
    return true;
  }

  function parseSortValue(value) {
    const [key, direction] = value.split(":");
    return { key, direction: direction === "desc" ? "desc" : "asc" };
  }

  function frontPageStatus(patient) {
    const arrangement = D.arrangementFromLegacy(patient);
    const owed = D.amountOwed(patient);
    if (arrangement === "No Responsibility" || Number(patient.responsibility || 0) <= 0) return "No Responsibility";
    if (owed <= D.EPSILON) return "Paid in Full";

    const plan = planForPatient(patient);
    if (plan) {
      if ((plan.overdueCount || 0) > 0) return "Overdue";
      if ((plan.dueTodayCount || 0) > 0) return "Due Today";
      return "Upcoming Collection";
    }

    const dueDate = String(patient.collectionDate || "");
    const today = D.todayIso();
    if (dueDate && dueDate < today) return "Overdue";
    if (dueDate === today) return "Due Today";
    return "Upcoming Collection";
  }

  function urgencyRank(patient) {
    const status = frontPageStatus(patient);
    if (status === "Overdue") return 0;
    if (status === "Due Today") return 1;
    const plan = planForPatient(patient);
    if ((plan?.ufCheckDueCount || 0) > 0) return 2;
    if (status === "Upcoming Collection") return 3;
    if (status === "Paid in Full") return 4;
    if (status === "No Responsibility") return 5;
    return 6;
  }

  function sortValue(patient, key) {
    if (key === "status") return urgencyRank(patient);
    if (key === "actionDate") return D.nextActionDate(patient);
    if (key === "owed") return D.amountOwed(patient);
    if (key === "responsibility") return Number(patient.responsibility || 0);
    if (key === "collected") return D.netCollected(patient);
    if (key === "planProgress") return D.planSummary(patient)?.progressPercent ?? 101;
    if (key === "ufCheckAge") return D.planSummary(patient)?.oldestUfCheckDays ?? -1;
    return String(patient[key] || "").toLowerCase();
  }

  function comparePatients(a, b) {
    const aValue = sortValue(a, sortState.key);
    const bValue = sortValue(b, sortState.key);
    let result;
    if (typeof aValue === "number" && typeof bValue === "number") result = aValue - bValue;
    else result = String(aValue).localeCompare(String(bValue), undefined, { numeric: true, sensitivity: "base" });
    if (result === 0) result = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    return sortState.direction === "desc" ? -result : result;
  }

  function matchesStatusFilter(patient, selected) {
    if (selected === "all") return true;
    if (selected === "Overdue or Due Today") {
      const status = frontPageStatus(patient);
      return status === "Overdue" || status === "Due Today";
    }
    if (selected === "UF Check Due") return (planForPatient(patient)?.ufCheckDueCount || 0) > 0;
    if (selected === "Payment Plans") return D.arrangementFromLegacy(patient) === "Payment Plan";
    return frontPageStatus(patient) === selected;
  }

  function positivePaymentsOnDate(patient, date) {
    return D.normalizedPayments(patient).filter((payment) => payment.date === date && D.transactionEffect(payment) > 0);
  }

  function matchesQuickFilter(patient) {
    if (!quickFilter) return true;
    const status = D.effectiveStatus(patient);
    const attention = D.attentionStatus(patient);
    const plan = status === "Payment Plan" ? D.planSummary(patient) : null;
    if (quickFilter === "Due Today") return attention === "Due Today" || (plan?.dueTodayCount || 0) > 0;
    if (quickFilter === "Overdue") return attention === "Overdue" || (plan?.overdueCount || 0) > 0;
    if (quickFilter === "Plan Attention") return status === "Payment Plan" && ((plan?.overdueCount || 0) > 0 || (plan?.dueTodayCount || 0) > 0 || (plan?.ufCheckDueCount || 0) > 0);
    if (quickFilter === "Partial Overdue") return status === "Partially Paid" && attention === "Overdue";
    if (quickFilter === "Collected Today") return positivePaymentsOnDate(patient, D.todayIso()).length > 0;
    if (quickFilter === "UF Check") return status === "Payment Plan" && (plan?.ufCheckDueCount || 0) > 0;
    return true;
  }

  function filteredPatients() {
    const query = elements.search.value.trim().toLowerCase();
    return patients
      .filter((patient) => {
        if (patient.archived) return false;
        const searchable = [patient.name, patient.mrn, patient.location, patient.treatment, patient.insurance, patient.statusNote]
          .join(" ").toLowerCase();
        return (!query || searchable.includes(query))
          && matchesStatusFilter(patient, elements.statusFilter.value)
          && matchesQuickFilter(patient)
          && (elements.locationFilter.value === "all" || patient.location === elements.locationFilter.value)
          && (elements.treatmentFilter.value === "all" || patient.treatment === elements.treatmentFilter.value);
      })
      .sort(comparePatients);
  }

  function statusPillsHtml(patient, clickable = false) {
    const status = frontPageStatus(patient);
    const health = D.patientHealth(patient);
    const primary = clickable
      ? `<button class="status-pill ${health.pill} status-action" data-action="timeline" data-id="${D.escapeHtml(patient.id)}" type="button" title="Open activity timeline">${D.escapeHtml(status)}</button>`
      : `<span class="status-pill ${health.pill}">${D.escapeHtml(status)}</span>`;
    const pills = [primary];

    const plan = planForPatient(patient);
    const overdueCount = plan?.overdueCount || (status === "Overdue" ? 1 : 0);
    if (overdueCount > 0) {
      const overdueClass = overdueCount >= 2 ? "health-red" : "health-yellow";
      const overdueAmount = plan?.overdueAmount ?? D.amountOwed(patient);
      pills.push(`<span class="status-pill status-subline ${overdueClass}">${overdueCount} ${overdueCount === 1 ? "payment" : "payments"} overdue</span>`);
      pills.push(`<span class="status-overdue-amount">Past due: <strong>${D.currency.format(overdueAmount)}</strong></span>`);
    } else if (status === "Due Today") {
      const dueTodayAmount = plan?.dueTodayAmount ?? D.amountOwed(patient);
      if (dueTodayAmount > D.EPSILON) {
        pills.push(`<span class="status-due-amount">Due today: <strong>${D.currency.format(dueTodayAmount)}</strong></span>`);
      }
    }
    if ((plan?.ufCheckDueCount || 0) > 0) {
      const ufLabel = `⚑ Check UF${plan.ufCheckDueCount > 1 ? ` (${plan.ufCheckDueCount})` : ""}`;
      pills.push(clickable
        ? `<button class="status-pill uf-flag uf-flag-action" data-action="uf-check" data-id="${D.escapeHtml(patient.id)}" type="button" title="Open UF payment verification">${D.escapeHtml(ufLabel)}</button>`
        : `<span class="status-pill uf-flag">${D.escapeHtml(ufLabel)}</span>`);
      if (plan.oldestUfCheckDays > 0) {
        pills.push(`<span class="status-pill status-subline uf-age">Oldest ${plan.oldestUfCheckDays} day${plan.oldestUfCheckDays === 1 ? "" : "s"} past due</span>`);
      }
    }

    return `<div class="status-stack">${pills.join("")}</div>`;
  }

  function planForPatient(patient) {
    return D.arrangementFromLegacy(patient) === "Payment Plan" && patient.paymentPlan ? D.planSummary(patient) : null;
  }

  function collectableAmount(patient) {
    const plan = planForPatient(patient);
    return plan ? plan.ackermanOwed : D.amountOwed(patient);
  }

  function actionButtons(patient) {
    const id = D.escapeHtml(patient.id);
    const canPay = collectableAmount(patient) > D.EPSILON;
    return [
      `<button class="btn btn-primary board-action-btn" data-action="payment" data-id="${id}" type="button"${canPay ? "" : ' disabled title="No Ackerman balance to collect"'}>Pay</button>`,
      `<button class="btn btn-documents board-action-btn" data-action="documents" data-id="${id}" type="button">Docs<span class="doc-count" data-doc-count-for="${id}" hidden></span></button>`,
      `<button class="btn btn-ghost board-action-btn" data-action="details" data-id="${id}" type="button">View Details</button>`,
      `<button class="btn btn-success board-action-btn" data-action="complete" data-id="${id}" type="button">Complete</button>`
    ].join("");
  }

  function planProgressHtml(patient) {
    const plan = D.planSummary(patient);
    if (!plan) return "";
    const onTimeText = plan.onTimeRate === null ? "No Ackerman installments due yet" : `${plan.onTimeRate.toFixed(0)}% paid by due date`;
    return `
      <div class="plan-progress-block">
        <div class="plan-progress-label"><span>${plan.completedCount} of ${plan.totalCount} payments complete / verified</span><strong>${plan.progressPercent.toFixed(0)}%</strong></div>
        <div class="progress-track"><div class="progress-fill health-progress" style="width:${Math.min(100, plan.progressPercent).toFixed(2)}%"></div></div>
        <div class="plan-progress-amounts"><span>${D.currency.format(plan.totalOwed)} still outstanding</span><strong>${plan.remainingPercent.toFixed(0)}% remaining</strong></div>
        <div class="plan-progress-subtext">${D.escapeHtml(onTimeText)}${plan.ufCheckDueCount ? ` · ⚑ ${plan.ufCheckDueCount} UF check${plan.ufCheckDueCount === 1 ? "" : "s"} due` : ""}</div>
      </div>
    `;
  }

  function financialPlanHtml(patient, collected, adjustments) {
    const plan = planForPatient(patient);
    if (!plan) {
      return `
        <div class="financial-stack">
          <div class="financial-line"><span>Responsibility</span><strong>${D.currency.format(patient.responsibility)}</strong></div>
          <div class="financial-line"><span>Collected</span><strong>${D.currency.format(collected)}</strong></div>
          ${adjustments > D.EPSILON ? `<div class="financial-line"><span>Adjustments</span><strong>${D.currency.format(adjustments)}</strong></div>` : ""}
          <div class="financial-line balance"><span>Still owed</span><strong>${D.currency.format(D.amountOwed(patient))}</strong></div>
        </div>`;
    }
    return `
      <div class="financial-stack plan-financial-stack">
        <div class="financial-line"><span>Total responsible</span><strong>${D.currency.format(patient.responsibility)}</strong></div>
        <div class="financial-line"><span>Ackerman owes</span><strong>${D.currency.format(plan.ackermanOwed)}</strong></div>
        <div class="financial-line"><span>UF owes</span><strong>${D.currency.format(plan.ufOwed)}</strong></div>
        <div class="financial-line balance"><span>Total outstanding</span><strong>${D.currency.format(plan.totalOwed)}</strong></div>
        <div class="financial-line"><span>Still remaining</span><strong>${plan.remainingPercent.toFixed(1)}%</strong></div>
        <div class="financial-line"><span>Ackerman collected</span><strong>${D.currency.format(collected)}</strong></div>
      </div>`;
  }

  function dueCellHtml(patient) {
    if (D.effectiveStatus(patient) === "Payment Plan") {
      const plan = D.planSummary(patient);
      if (!plan?.nextDue) return '<div class="date-main">Plan complete</div><div class="date-relative">No installment remains</div>';
      return `
        <div class="date-kicker">Payment ${plan.nextDue.number} of ${plan.totalCount} · ${D.escapeHtml(plan.nextDue.responsibilityParty)}</div>
        <div class="date-main">${D.formatDate(plan.nextDue.dueDate)}</div>
        <div class="date-relative">${D.escapeHtml(dateRelativeText(plan.nextDue.dueDate))} · ${D.currency.format(plan.nextDue.remaining)}</div>
      `;
    }
    return `<div class="date-main">${D.formatDate(patient.collectionDate)}</div><div class="date-relative">${D.escapeHtml(dateRelativeText(patient.collectionDate))}</div>`;
  }

  function renderRows() {
    const rows = filteredPatients();
    elements.tbody.innerHTML = "";
    elements.emptyState.hidden = rows.length > 0;
    document.querySelector(".payment-table").hidden = rows.length === 0;

    rows.forEach((patient) => {
      const status = D.effectiveStatus(patient);
      const health = D.patientHealth(patient);
      const owed = D.amountOwed(patient);
      const collected = D.netCollected(patient);
      const adjustments = D.adjustmentTotal(patient);
      const tr = document.createElement("tr");
      tr.className = health.row;
      tr.innerHTML = `
        <td data-label="Status">${statusPillsHtml(patient, true)}<input class="status-note-input" data-status-note-id="${D.escapeHtml(patient.id)}" maxlength="120" value="${D.escapeHtml(patient.statusNote || "")}" placeholder="Quick note (e.g. Call patient)" aria-label="Quick status note for ${D.escapeHtml(patient.name)}"></td>
        <td data-label="Patient"><button class="patient-link" type="button" data-action="details" data-id="${D.escapeHtml(patient.id)}">${D.escapeHtml(patient.name)}</button><div class="mrn">${D.escapeHtml(patient.mrn)}</div><div class="cell-tertiary">Updated ${D.escapeHtml(D.formatDateTime(patient.updatedAt || patient.createdAt))}</div></td>
        <td data-label="Treatment"><div class="cell-primary">${D.escapeHtml(patient.treatment)}</div></td>
        <td data-label="Site & Insurance"><div class="cell-primary">${D.escapeHtml(patient.location)}</div><div class="cell-secondary">${D.escapeHtml(patient.insurance)}</div></td>
        <td data-label="Financials / Plan">
          ${financialPlanHtml(patient, collected, adjustments)}
          ${planProgressHtml(patient)}
        </td>
        <td data-label="Next Due">${dueCellHtml(patient)}</td>
        <td class="actions-cell" data-label="Actions"><div class="actions">${actionButtons(patient)}</div></td>
      `;
      elements.tbody.appendChild(tr);
    });

    const quickText = quickFilter ? ` · quick filter: ${quickFilter}` : "";
    elements.resultCount.textContent = `${rows.length} ${rows.length === 1 ? "record" : "records"}${quickText}`;
    updateDocumentCounts(rows);
  }

  async function updateDocumentCounts(rows = patients.filter((patient) => !patient.archived)) {
    if (!Docs) return;
    await Promise.all(rows.map(async (patient) => {
      try {
        const value = await Docs.count(patient.id);
        document.querySelectorAll(`[data-doc-count-for="${CSS.escape(patient.id)}"]`).forEach((badge) => {
          badge.textContent = value;
          badge.hidden = value === 0;
        });
      } catch (error) {
        console.warn("Could not count prototype documents.", error);
      }
    }));
  }

  function operationalData() {
    const active = patients.filter((patient) => !patient.archived);
    const today = D.todayIso();
    const dueToday = active.filter((patient) => {
      const plan = D.effectiveStatus(patient) === "Payment Plan" ? D.planSummary(patient) : null;
      return D.attentionStatus(patient) === "Due Today" || (plan?.dueTodayCount || 0) > 0;
    });
    const overdue = active.filter((patient) => {
      const plan = D.effectiveStatus(patient) === "Payment Plan" ? D.planSummary(patient) : null;
      return D.attentionStatus(patient) === "Overdue" || (plan?.overdueCount || 0) > 0;
    });
    const planAttention = active.filter((patient) => {
      if (D.effectiveStatus(patient) !== "Payment Plan") return false;
      const plan = D.planSummary(patient);
      return (plan?.overdueCount || 0) > 0 || (plan?.dueTodayCount || 0) > 0 || (plan?.ufCheckDueCount || 0) > 0;
    });
    const planInstallmentsDue = planAttention.reduce((sum, patient) => {
      const plan = D.planSummary(patient);
      return sum + Number(plan?.overdueCount || 0) + Number(plan?.dueTodayCount || 0) + Number(plan?.ufCheckDueCount || 0);
    }, 0);
    const partialOverdue = active.filter((patient) => D.effectiveStatus(patient) === "Partially Paid" && D.attentionStatus(patient) === "Overdue");
    const paymentsToday = active.flatMap((patient) => positivePaymentsOnDate(patient, today));
    const ufChecks = active.filter((patient) => D.effectiveStatus(patient) === "Payment Plan" && (D.planSummary(patient)?.ufCheckDueCount || 0) > 0);
    return { active, dueToday, overdue, planAttention, planInstallmentsDue, partialOverdue, paymentsToday, ufChecks };
  }

  function renderSummary() {
    const ops = operationalData();
    const eligible = ops.active.filter((patient) => D.effectiveStatus(patient) !== "No Responsibility");
    const outstanding = ops.active.reduce((sum, patient) => sum + D.amountOwed(patient), 0);
    const responsibility = eligible.reduce((sum, patient) => sum + Number(patient.responsibility || 0), 0);
    const collected = eligible.reduce((sum, patient) => sum + D.netCollected(patient), 0);
    const planPatients = ops.active.filter((patient) => D.effectiveStatus(patient) === "Payment Plan");
    const receivedToday = ops.paymentsToday.reduce((sum, payment) => sum + payment.amount, 0);
    const rate = responsibility > 0 ? Math.min(100, (collected / responsibility) * 100) : 0;

    document.getElementById("activeCount").textContent = ops.active.length.toLocaleString();
    document.getElementById("activeSubtext").textContent = `${ops.dueToday.length} due today`;
    document.getElementById("outstandingAmount").textContent = D.currency.format(outstanding);
    document.getElementById("planCount").textContent = planPatients.length.toLocaleString();
    document.getElementById("planAttention").textContent = `${ops.planAttention.length} needing attention`;
    document.getElementById("collectionRate").textContent = `${rate.toFixed(1)}%`;

    document.getElementById("opsDueToday").textContent = ops.dueToday.length;
    document.getElementById("opsOverdue").textContent = ops.overdue.length;
    document.getElementById("opsOverdueAmount").textContent = `${D.currency.format(ops.overdue.reduce((sum, patient) => sum + D.amountOwed(patient), 0))} exposed`;
    document.getElementById("opsPlanAttention").textContent = ops.planInstallmentsDue;
    document.getElementById("opsPlanAttentionContext").textContent = `across ${ops.planAttention.length} ${ops.planAttention.length === 1 ? "payment plan" : "payment plans"}`;
    document.getElementById("opsPartialOverdue").textContent = ops.partialOverdue.length;
    document.getElementById("opsCollectedToday").textContent = D.currency.format(receivedToday);
    document.getElementById("opsTransactionCount").textContent = `${ops.paymentsToday.length} transactions`;
    document.getElementById("opsUfChecks").textContent = ops.ufChecks.length;
    const oldestUfDays = ops.ufChecks.reduce((max, patient) => Math.max(max, D.planSummary(patient)?.oldestUfCheckDays || 0), 0);
    document.getElementById("opsUfChecksContext").textContent = oldestUfDays > 0
      ? `Oldest UF check is ${oldestUfDays} day${oldestUfDays === 1 ? "" : "s"} past due`
      : "UF-responsible payments whose due date has passed";

    document.querySelectorAll("[data-quick-filter]").forEach((button) => {
      button.classList.toggle("active", button.dataset.quickFilter === quickFilter);
    });
  }

  function updateSortIndicators() {
    document.querySelectorAll(".sort-button").forEach((button) => {
      const indicator = button.querySelector(".sort-indicator");
      const active = button.dataset.sortKey === sortState.key;
      indicator.textContent = active ? (sortState.direction === "asc" ? "▲" : "▼") : "";
    });
  }

  function render() {
    renderRows();
    renderSummary();
    updateSortIndicators();
    const refreshed = document.getElementById("boardRefreshedAt");
    if (refreshed) refreshed.textContent = `Browser data refreshed ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date())}`;
  }

  // Saved views -------------------------------------------------------------
  function captureViewSettings() {
    return {
      search: elements.search.value,
      status: elements.statusFilter.value,
      location: elements.locationFilter.value,
      treatment: elements.treatmentFilter.value,
      sort: elements.sort.value,
      quickFilter
    };
  }

  function renderSavedViews(selectedId = "") {
    const views = D.loadSavedViews("board");
    elements.savedViewSelect.innerHTML = '<option value="">Choose a saved view</option>';
    views.forEach((view) => {
      const option = document.createElement("option");
      option.value = view.id;
      option.textContent = view.name;
      elements.savedViewSelect.appendChild(option);
    });
    elements.savedViewSelect.value = views.some((view) => view.id === selectedId) ? selectedId : "";
    document.getElementById("deleteViewButton").disabled = !elements.savedViewSelect.value;
  }

  function applyViewSettings(settings) {
    elements.search.value = settings.search || "";
    const migratedStatus = settings.status === "Overdue and Due Today" ? "Overdue or Due Today" : settings.status;
    elements.statusFilter.value = [...elements.statusFilter.options].some((option) => option.value === migratedStatus) ? migratedStatus : "all";
    elements.locationFilter.value = [...elements.locationFilter.options].some((option) => option.value === settings.location) ? settings.location : "all";
    elements.treatmentFilter.value = [...elements.treatmentFilter.options].some((option) => option.value === settings.treatment) ? settings.treatment : "all";
    elements.sort.value = [...elements.sort.options].some((option) => option.value === settings.sort) ? settings.sort : "actionDate:asc";
    sortState = parseSortValue(elements.sort.value);
    quickFilter = settings.quickFilter || "";
    render();
  }

  // Payment plan editor -----------------------------------------------------
  function editingPatient() {
    return editingPatientId ? findPatient(editingPatientId) : null;
  }

  function planTargetAmount() {
    const responsibility = Math.max(0, Number(document.getElementById("patientResponsibility").value || 0));
    const openingCollected = Math.max(0, Number(document.getElementById("planOpeningCollected").value || 0));
    const adjustments = editingPatient() ? D.adjustmentTotal(editingPatient()) : 0;
    return Math.max(0, Math.round((responsibility - openingCollected - adjustments) * 100) / 100);
  }

  function readPlanScheduleFromDom() {
    return [...elements.planScheduleBody.querySelectorAll("tr")].map((row, index) => {
      const selectedParty = row.querySelector("input[data-plan-field='responsibilityParty']:checked")?.value || "";
      const ufVerifiedInput = row.querySelector("input[data-plan-field='ufVerified']");
      const priorVerifiedAt = row.dataset.ufVerifiedAt || "";
      const ufVerified = selectedParty === "UF" && Boolean(ufVerifiedInput?.checked);
      return {
        id: row.dataset.installmentId || D.uid(`installment-${index + 1}`),
        dueDate: row.querySelector("input[data-plan-field='dueDate']")?.value || "",
        originalDueDate: row.dataset.originalDueDate || row.querySelector("input[data-plan-field='dueDate']")?.value || "",
        amount: Number(row.querySelector("input[data-plan-field='amount']")?.value || 0),
        responsibilityParty: selectedParty === "UF" ? "UF" : "Ackerman",
        ufVerified,
        ufVerifiedAt: ufVerified ? (priorVerifiedAt || D.todayIso()) : "",
        rescheduledAt: row.dataset.rescheduledAt || ""
      };
    });
  }

  function planSnapshot(planData) {
    return JSON.stringify({
      installments: (planData.installments || []).map((item) => ({
        id: item.id,
        dueDate: item.dueDate,
        amount: Number(item.amount || 0).toFixed(2),
        responsibilityParty: item.responsibilityParty === "UF" ? "UF" : "Ackerman",
        ufVerified: Boolean(item.ufVerified)
      }))
    });
  }

  function ufCheckIsDue(installment) {
    return installment.responsibilityParty === "UF"
      && !installment.ufVerified
      && Boolean(installment.dueDate)
      && installment.dueDate < D.todayIso();
  }

  function renderPlanEditor() {
    elements.planScheduleBody.innerHTML = "";
    elements.planScheduleEmpty.hidden = editingPlanSchedule.length > 0;

    editingPlanSchedule.forEach((installment, index) => {
      const paid = editingPlanPaidMap.get(installment.id) || 0;
      const party = installment.responsibilityParty === "UF" ? "UF" : "Ackerman";
      const ufVerified = party === "UF" && Boolean(installment.ufVerified);
      const ufCheckDue = ufCheckIsDue({ ...installment, responsibilityParty: party, ufVerified });
      const row = document.createElement("tr");
      row.dataset.installmentId = installment.id;
      row.dataset.originalDueDate = installment.originalDueDate || installment.dueDate;
      row.dataset.rescheduledAt = installment.rescheduledAt || "";
      row.dataset.ufVerifiedAt = installment.ufVerifiedAt || "";
      row.innerHTML = `
        <td><strong>Payment ${index + 1}</strong></td>
        <td><input type="date" data-plan-field="dueDate" value="${D.escapeHtml(installment.dueDate)}" aria-label="Payment ${index + 1} due date"></td>
        <td><div class="money-input"><span>$</span><input type="number" min="0.01" step="0.01" data-plan-field="amount" value="${Number(installment.amount || 0).toFixed(2)}" aria-label="Payment ${index + 1} amount"></div></td>
        <td><div class="installment-editor-progress"><strong>${D.currency.format(paid)}</strong><span>recorded</span></div></td>
        <td>
          <div class="responsibility-choice" role="group" aria-label="Payment ${index + 1} responsibility">
            <label class="responsibility-option"><input type="radio" name="responsibility-${index}" data-plan-field="responsibilityParty" value="Ackerman" ${party === "Ackerman" ? "checked" : ""}> <span>Ackerman responsible</span></label>
            <label class="responsibility-option"><input type="radio" name="responsibility-${index}" data-plan-field="responsibilityParty" value="UF" ${party === "UF" ? "checked" : ""}> <span>UF responsible</span></label>
          </div>
          <label class="uf-verify-control" ${party === "UF" ? "" : "hidden"}>
            <input type="checkbox" data-plan-field="ufVerified" ${ufVerified ? "checked" : ""}>
            <span>UF payment checked / went through</span>
          </label>
          <div class="uf-check-flag" ${ufCheckDue ? "" : "hidden"}>⚑ Check UF — ${ufCheckDue ? `${Math.max(1, D.daysBetween(installment.dueDate, D.todayIso()))} day${Math.max(1, D.daysBetween(installment.dueDate, D.todayIso())) === 1 ? "" : "s"} past due` : "due date has passed"}</div>
        </td>
      `;
      elements.planScheduleBody.appendChild(row);
    });
    updatePlanEditorSummary();
  }

  function updatePlanEditorSummary() {
    if (elements.planScheduleBody.children.length) editingPlanSchedule = readPlanScheduleFromDom();
    const target = planTargetAmount();
    const total = editingPlanSchedule.reduce((sum, installment) => sum + Number(installment.amount || 0), 0);
    const difference = Math.round((total - target) * 100) / 100;
    const opening = Number(document.getElementById("planOpeningCollected").value || 0);
    const ackermanCount = editingPlanSchedule.filter((item) => item.responsibilityParty !== "UF").length;
    const ufCount = editingPlanSchedule.filter((item) => item.responsibilityParty === "UF").length;
    elements.planTargetNote.textContent = `Reference target: ${D.currency.format(target)} · Collected before plan: ${D.currency.format(opening)} · Manual schedule total: ${D.currency.format(total)}`;
    elements.planScheduleSummary.className = "plan-total-row manual";
    elements.planScheduleSummary.innerHTML = `<span>${editingPlanSchedule.length} payments · ${ackermanCount} Ackerman · ${ufCount} UF</span><span>Difference from reference target: <strong>${D.currency.format(difference)}</strong></span><span>Informational only — manual schedules can still be saved.</span>`;
  }

  function buildPlanSchedule() {
    const requestedCount = Math.max(1, Math.min(24, Math.floor(Number(document.getElementById("planInstallmentCount").value || 1))));
    const firstDate = document.getElementById("planFirstDueDate").value || D.todayIso();
    const frequency = document.getElementById("planFrequency").value;
    if (!validOperationalDate(firstDate, "First due date")) return;
    if (editingExistingPlan && editingPlanSchedule.length && !window.confirm("Replace the current payment schedule with a newly generated schedule?")) return;
    if (!editingExistingPlan) {
      document.getElementById("planOpeningCollected").value = String(Math.max(0, Number(document.getElementById("patientCollected").value || 0)));
    }

    editingPlanSchedule = D.makePlanSchedule(planTargetAmount(), requestedCount, firstDate, frequency);
    document.getElementById("patientDate").value = editingPlanSchedule[0]?.dueDate || firstDate;
    renderPlanEditor();
    showToast("Payment schedule generated. Due dates, amounts, and responsibility can now be edited manually.");
  }

  function toggleArrangementSection({ autoBuild = false } = {}) {
    const arrangement = document.getElementById("patientArrangement").value;
    const isPlan = arrangement === "Payment Plan";
    const noResponsibility = arrangement === "No Responsibility";
    elements.paymentPlanSection.hidden = !isPlan;
    document.getElementById("noResponsibilityReasonField").hidden = !noResponsibility;
    document.getElementById("noResponsibilityReason").required = noResponsibility;
    document.getElementById("collectionDateHint").textContent = isPlan
      ? "For payment plans, this follows the first scheduled payment."
      : "Not used when there is no payment responsibility.";
    if (noResponsibility) {
      document.getElementById("patientResponsibility").value = "0";
      document.getElementById("patientResponsibility").disabled = true;
    } else {
      document.getElementById("patientResponsibility").disabled = false;
    }
    if (isPlan && autoBuild && !editingPlanSchedule.length) buildPlanSchedule();
    if (isPlan) updatePlanEditorSummary();
  }

  function openPatientDialog(patient = null) {
    const isEditing = Boolean(patient);
    editingPatientId = patient?.id || "";
    document.getElementById("patientDialogTitle").textContent = isEditing ? "Edit Patient Account" : "Add Patient";
    document.getElementById("patientId").value = patient?.id || "";
    document.getElementById("patientName").value = patient?.name || "";
    document.getElementById("patientMrn").value = patient?.mrn || "";
    document.getElementById("patientLocation").value = patient?.location || "Jacksonville";
    document.getElementById("patientTreatment").value = D.normalizeTreatmentType(patient?.treatment || "Proton");
    document.getElementById("patientInsurance").value = patient?.insurance || "";
    document.getElementById("patientResponsibility").value = patient?.responsibility ?? "";
    document.getElementById("patientCollected").value = patient ? D.netCollected(patient) : 0;
    document.getElementById("patientCollected").disabled = isEditing;
    document.getElementById("collectedHint").textContent = isEditing ? "Use Pay or the financial ledger to change collected dollars." : "Optional opening payment. Later changes use Pay.";
    document.getElementById("patientDate").value = patient?.collectionDate || D.todayIso();
    document.getElementById("patientArrangement").value = patient ? D.arrangementFromLegacy(patient) : "Payment Plan";
    document.getElementById("patientStatusNote").value = patient?.statusNote || "";
    document.getElementById("noResponsibilityReason").value = patient?.noResponsibilityReason || "";
    document.getElementById("patientNotes").value = patient?.notes || "";

    editingExistingPlan = Boolean(patient?.paymentPlan);
    const planSummary = patient?.paymentPlan ? D.planSummary(patient) : null;
    editingPlanPaidMap = new Map((planSummary?.installments || []).map((installment) => [installment.id, installment.responsibilityParty === "Ackerman" ? installment.paidAmount : 0]));
    editingPlanSchedule = patient?.paymentPlan?.installments ? D.deepCopy(patient.paymentPlan.installments) : [];
    document.getElementById("planOpeningCollected").value = String(patient?.paymentPlan?.openingCollected ?? (patient ? D.netCollected(patient) : 0));
    document.getElementById("planInstallmentCount").value = String(editingPlanSchedule.length || 1);
    document.getElementById("planFirstDueDate").value = editingPlanSchedule[0]?.dueDate || patient?.collectionDate || D.todayIso();
    document.getElementById("planFrequency").value = "monthly";
    originalPlanSnapshot = patient?.paymentPlan ? planSnapshot(patient.paymentPlan) : "";
    renderPlanEditor();
    toggleArrangementSection();

    elements.patientDialog.showModal();
    document.getElementById("patientName").focus();
  }

  // Payment, adjustment, and transaction dialogs ------------------
  function openPaymentDialog(patient) {
    const balance = collectableAmount(patient);
    document.getElementById("paymentPatientId").value = patient.id;
    document.getElementById("paymentPatientName").textContent = patient.name;
    document.getElementById("paymentPatientMrn").textContent = patient.mrn;
    document.getElementById("paymentBalance").textContent = D.currency.format(balance);
    document.getElementById("paymentAmount").value = "";
    document.getElementById("paymentAmount").max = String(balance);
    document.getElementById("paymentDate").value = D.todayIso();
    document.getElementById("paymentLocation").value = patient.location;
    document.getElementById("paymentMethod").value = "Credit/Debit Card";
    document.getElementById("paymentNote").value = "";

    const context = document.getElementById("paymentPlanContext");
    const plan = D.effectiveStatus(patient) === "Payment Plan" ? D.planSummary(patient) : null;
    if (plan?.nextAckermanDue) {
      context.hidden = false;
      context.innerHTML = `<span class="status-pill health-green">Payment Plan</span><div><strong>Next Ackerman-responsible payment:</strong> Payment ${plan.nextAckermanDue.number} of ${plan.totalCount}, ${D.currency.format(plan.nextAckermanDue.remaining)} due ${D.formatDate(plan.nextAckermanDue.dueDate)} (${D.escapeHtml(dateRelativeText(plan.nextAckermanDue.dueDate))}).</div>`;
      document.getElementById("paymentAmount").value = Math.min(balance, plan.nextAckermanDue.remaining).toFixed(2);
    } else {
      context.hidden = true;
      context.innerHTML = "";
    }
    elements.paymentDialog.showModal();
    document.getElementById("paymentAmount").focus();
  }

  function openAdjustmentDialog(patient) {
    const balance = D.amountOwed(patient);
    document.getElementById("adjustmentPatientId").value = patient.id;
    document.getElementById("adjustmentPatientLabel").textContent = `${patient.name} · ${patient.mrn}`;
    document.getElementById("adjustmentBalance").textContent = D.currency.format(balance);
    document.getElementById("adjustmentExisting").textContent = D.currency.format(D.adjustmentTotal(patient));
    document.getElementById("adjustmentAfter").textContent = D.currency.format(balance);
    document.getElementById("adjustmentType").value = "Adjustment";
    document.getElementById("adjustmentAmount").value = "";
    document.getElementById("adjustmentAmount").max = String(balance);
    document.getElementById("adjustmentDate").value = D.todayIso();
    document.getElementById("adjustmentNote").value = "";
    elements.adjustmentDialog.showModal();
    document.getElementById("adjustmentAmount").focus();
  }

  function openTransactionDialog(patient, transaction) {
    const available = D.reversibleAmount(patient, transaction.id);
    document.getElementById("transactionPatientId").value = patient.id;
    document.getElementById("transactionId").value = transaction.id;
    document.getElementById("transactionPatientLabel").textContent = `${patient.name} · ${D.formatDate(transaction.date)} · ${transaction.method}`;
    document.getElementById("transactionOriginal").textContent = D.currency.format(transaction.amount);
    document.getElementById("transactionAvailable").textContent = D.currency.format(available);
    document.getElementById("transactionBalance").textContent = D.currency.format(D.amountOwed(patient));
    document.getElementById("transactionAction").value = "Reversal";
    document.getElementById("transactionAmount").value = available.toFixed(2);
    document.getElementById("transactionAmount").max = String(available);
    document.getElementById("transactionDate").value = D.todayIso();
    document.getElementById("correctedAmount").value = available.toFixed(2);
    document.getElementById("correctedMethod").value = transaction.method;
    document.getElementById("transactionReason").value = "";
    toggleCorrectionFields();
    elements.transactionDialog.showModal();
  }

  function toggleCorrectionFields() {
    const correction = document.getElementById("transactionAction").value === "Correction";
    document.querySelectorAll(".correction-field").forEach((field) => { field.hidden = !correction; });
    document.getElementById("correctedAmount").required = correction;
    document.getElementById("correctedMethod").required = correction;
  }

  // Details and timeline ----------------------------------------------------
  function paymentHistoryHtml(patient) {
    const payments = D.normalizedPayments(patient).sort((a, b) => `${b.date}|${b.createdAt}`.localeCompare(`${a.date}|${a.createdAt}`));
    if (!payments.length) return '<div class="notes-box">No payment transactions have been recorded.</div>';
    return `<div class="history-wrap"><table class="history-table"><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Site</th><th>Method</th><th>Note</th><th></th></tr></thead><tbody>${payments.map((payment) => {
      const effect = D.transactionEffect(payment);
      const reversible = effect > 0 ? D.reversibleAmount(patient, payment.id) : 0;
      return `<tr>
        <td>${D.formatDate(payment.date)}</td>
        <td><span class="ledger-type ${effect < 0 ? "negative" : "positive"}">${D.escapeHtml(payment.type)}</span></td>
        <td><strong class="${effect < 0 ? "negative-money" : ""}">${effect < 0 ? "−" : ""}${D.currency.format(payment.amount)}</strong></td>
        <td>${D.escapeHtml(payment.location)}</td><td>${D.escapeHtml(payment.method)}</td><td>${D.escapeHtml(payment.note || "-")}</td>
        <td>${reversible > D.EPSILON ? `<button class="btn btn-ghost btn-small" type="button" data-detail-action="transaction" data-transaction-id="${D.escapeHtml(payment.id)}">Correct</button>` : ""}</td>
      </tr>`;
    }).join("")}</tbody></table></div>`;
  }

  function adjustmentHistoryHtml(patient) {
    const adjustments = D.normalizedAdjustments(patient).sort((a, b) => `${b.date}|${b.createdAt}`.localeCompare(`${a.date}|${a.createdAt}`));
    if (!adjustments.length) return '<div class="notes-box">No adjustments, write-offs, or financial-assistance entries.</div>';
    return `<div class="history-wrap"><table class="history-table"><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Reason</th></tr></thead><tbody>${adjustments.map((entry) => `<tr><td>${D.formatDate(entry.date)}</td><td>${D.escapeHtml(entry.type)}</td><td><strong>${D.currency.format(entry.amount)}</strong></td><td>${D.escapeHtml(entry.note)}</td></tr>`).join("")}</tbody></table></div>`;
  }

  function activityTimelineHtml(patient) {
    const activities = (patient.activity || []).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (!activities.length) return '<div class="notes-box">No activity has been recorded.</div>';
    return `<div class="activity-timeline">${activities.map((activity) => `
      <article class="activity-entry activity-${D.escapeHtml(activity.type)}">
        <div class="activity-marker" aria-hidden="true"></div>
        <div class="activity-content"><div class="activity-heading"><strong>${D.escapeHtml(activity.title)}</strong><time>${D.formatDateTime(activity.createdAt)}</time></div><p>${D.escapeHtml(activity.detail || "No additional detail.")}</p><span>${D.escapeHtml(activity.actor)}</span></div>
      </article>`).join("")}</div>`;
  }

  function planDetailsHtml(patient) {
    const summary = D.planSummary(patient);
    if (!summary) return "";
    const onTimeText = summary.onTimeRate === null ? "Not measured yet" : `${summary.onTimeRate.toFixed(1)}%`;
    return `
      <div class="detail-section" id="paymentPlanDetailsSection">
        <div class="detail-section-heading"><div><h3>Payment Plan Performance</h3><p>Ackerman-responsible payments drive the red / yellow / green overdue status. UF-responsible rows can be checked here after Finance confirms the UF payment went through.</p></div>${statusPillsHtml(patient)}</div>
        <div class="details-summary plan-summary-cards plan-balance-cards">
          <div class="mini-card"><span>Ackerman overdue</span><strong>${summary.overdueCount}</strong></div>
          <div class="mini-card"><span>Due today</span><strong>${summary.dueTodayCount}</strong></div>
          <div class="mini-card"><span>UF checks due</span><strong>${summary.ufCheckDueCount}</strong></div>
          <div class="mini-card"><span>Ackerman on-time</span><strong>${onTimeText}</strong></div>
        </div>
        ${summary.ufCheckDueCount ? `<div class="uf-verification-callout"><strong>⚑ Check UF:</strong> ${summary.ufCheckDueCount} UF-responsible payment${summary.ufCheckDueCount === 1 ? " needs" : "s need"} Finance verification. Oldest check is <strong>${summary.oldestUfCheckDays} day${summary.oldestUfCheckDays === 1 ? "" : "s"} past due</strong>.</div>` : ""}
        <div class="plan-detail-progress">
          <div class="plan-progress-heading"><span>${D.currency.format(summary.totalOwed)} still outstanding</span><strong>${summary.remainingPercent.toFixed(1)}% remaining</strong></div>
          <div class="progress-track"><div class="progress-fill health-progress" style="width:${summary.progressPercent.toFixed(2)}%"></div></div>
        </div>
        <div class="history-wrap"><table class="history-table plan-history-table"><thead><tr><th>Payment</th><th>Due date</th><th>Responsible</th><th>Scheduled</th><th>Paid / verified</th><th>Remaining</th><th>UF check</th><th>Status</th></tr></thead><tbody>${summary.installments.map((installment) => {
          const mappedStatus = installment.status === "Upcoming" ? "Upcoming Collection" : installment.status;
          const meta = D.statusMeta(mappedStatus);
          const paidLabel = installment.responsibilityParty === "UF"
            ? (installment.ufVerified ? "Verified" : "-")
            : D.currency.format(installment.paidAmount);
          const ufControl = installment.responsibilityParty === "UF"
            ? `<label class="detail-uf-check ${installment.ufCheckDue ? "attention" : ""}"><input type="checkbox" data-detail-uf-verify data-installment-id="${D.escapeHtml(installment.id)}" ${installment.ufVerified ? "checked" : ""}><span>${installment.ufVerified ? "Checked" : "Check UF"}</span></label>${installment.ufCheckDue ? `<div class="uf-check-inline-flag">⚑ ${installment.daysLate} day${installment.daysLate === 1 ? "" : "s"} past due</div>` : ""}`
            : '<span class="cell-secondary">—</span>';
          return `<tr><td><strong>${installment.number}</strong></td><td>${D.formatDate(installment.dueDate)}</td><td><strong>${D.escapeHtml(installment.responsibilityParty)}</strong></td><td>${D.currency.format(installment.amount)}</td><td>${D.escapeHtml(paidLabel)}</td><td>${D.currency.format(installment.remaining)}</td><td>${ufControl}</td><td><span class="status-pill ${meta.pill} compact">${D.escapeHtml(installment.status)}${installment.status === "Paid" && installment.onTime ? " · On time" : ""}</span>${installment.responsibilityParty === "UF" && installment.ufVerifiedAt ? `<div class="cell-secondary">Checked ${D.formatDate(installment.ufVerifiedAt)}</div>` : ""}</td></tr>`;
        }).join("")}</tbody></table></div>
      </div>`;
  }

  async function openDetailsDialog(patient, focus = "overview") {
    detailsPatientId = patient.id;
    detailsFocus = focus;
    const status = D.effectiveStatus(patient);
    const plan = planForPatient(patient);
    const owed = plan ? plan.totalOwed : D.amountOwed(patient);
    const ackermanCollectable = plan ? plan.ackermanOwed : owed;
    const financialCards = plan
      ? `
        <div class="details-summary plan-account-summary simplified-financial-summary">
          <div class="mini-card"><span>Total responsibility</span><strong>${D.currency.format(patient.responsibility)}</strong></div>
          <div class="mini-card"><span>Ackerman outstanding</span><strong>${D.currency.format(plan.ackermanOwed)}</strong></div>
          <div class="mini-card"><span>UF outstanding</span><strong>${D.currency.format(plan.ufOwed)}</strong></div>
          <div class="mini-card"><span>Total outstanding</span><strong>${D.currency.format(plan.totalOwed)}</strong></div>
          <div class="mini-card"><span>Complete</span><strong>${plan.progressPercent.toFixed(1)}%</strong></div>
          <div class="mini-card"><span>Remaining</span><strong>${plan.remainingPercent.toFixed(1)}%</strong></div>
        </div>`
      : `
        <div class="details-summary four-up">
          <div class="mini-card"><span>Responsibility</span><strong>${D.currency.format(patient.responsibility)}</strong></div>
          <div class="mini-card"><span>Net collected</span><strong>${D.currency.format(D.netCollected(patient))}</strong></div>
          <div class="mini-card"><span>Adjustments</span><strong>${D.currency.format(D.adjustmentTotal(patient))}</strong></div>
          <div class="mini-card"><span>Still owed</span><strong>${D.currency.format(owed)}</strong></div>
        </div>`;
    document.getElementById("detailsTitle").textContent = patient.name;
    document.getElementById("detailsSubtitle").textContent = `${patient.mrn} · ${status}`;
    document.getElementById("detailsBody").innerHTML = `
      ${financialCards}
      <div class="detail-section">
        <h3>Account Overview</h3>
        <div class="detail-grid">
          <div class="detail-item"><span>Status</span><strong>${statusPillsHtml(patient)}</strong></div>
          <div class="detail-item"><span>Status / action note</span><strong>${D.escapeHtml(patient.statusNote || "-")}</strong></div>
          <div class="detail-item"><span>Arrangement</span><strong>${D.escapeHtml(D.arrangementFromLegacy(patient))}</strong></div>
          <div class="detail-item"><span>Next due / collection date</span><strong>${D.formatDate(D.nextActionDate(patient))} (${D.escapeHtml(dateRelativeText(D.nextActionDate(patient)))})</strong></div>
          <div class="detail-item"><span>Treatment type</span><strong>${D.escapeHtml(patient.treatment)}</strong></div>
          <div class="detail-item"><span>Treatment site</span><strong>${D.escapeHtml(patient.location)}</strong></div>
          <div class="detail-item"><span>Insurance</span><strong>${D.escapeHtml(patient.insurance)}</strong></div>
          <div class="detail-item"><span>Account created</span><strong>${D.escapeHtml(D.formatDateTime(patient.createdAt))}</strong></div>
          <div class="detail-item"><span>Last updated</span><strong>${D.escapeHtml(D.formatDateTime(patient.updatedAt || patient.createdAt))}</strong></div>
        </div>
      </div>
      ${planDetailsHtml(patient)}
      <div class="detail-section"><h3>Finance Note</h3><div class="notes-box">${D.escapeHtml(patient.notes || "No finance note entered.")}</div>${patient.noResponsibilityReason ? `<div class="notes-box"><strong>No-responsibility reason:</strong> ${D.escapeHtml(patient.noResponsibilityReason)}</div>` : ""}</div>
      <div class="detail-section"><div class="detail-section-heading"><div><h3>Payment Ledger</h3><p>Corrections create new reversal/refund entries; original transactions remain visible.</p></div></div>${paymentHistoryHtml(patient)}</div>
      <div class="detail-section"><div class="detail-section-heading"><div><h3>Adjustments</h3><p>Adjustments reduce the amount owed without increasing collected dollars.</p></div><button class="btn btn-secondary btn-small" type="button" data-detail-action="add-adjustment">Add Adjustment</button></div>${adjustmentHistoryHtml(patient)}</div>
      <div class="detail-section activity-section" id="activityTimelineSection"><div class="detail-section-heading"><div><h3>Activity Timeline</h3><p>Chronological history of account, payment, plan, document, and completion activity.</p></div></div>${activityTimelineHtml(patient)}</div>
    `;

    document.getElementById("detailsPaymentButton").hidden = ackermanCollectable <= D.EPSILON;
    document.getElementById("detailsCompleteButton").hidden = false;
    document.getElementById("detailsDocumentsButton").textContent = "Documents";
    if (Docs) {
      try {
        const count = await Docs.count(patient.id);
        document.getElementById("detailsDocumentsButton").textContent = count ? `Documents (${count})` : "Documents";
      } catch (error) { console.warn(error); }
    }
    if (!elements.detailsDialog.open) elements.detailsDialog.showModal();
    if (focus === "timeline") requestAnimationFrame(() => document.getElementById("activityTimelineSection")?.scrollIntoView({ block: "start" }));
    if (focus === "plan") requestAnimationFrame(() => document.getElementById("paymentPlanDetailsSection")?.scrollIntoView({ block: "start" }));
  }

  function openCompletionDialog(patient) {
    const plan = planForPatient(patient);
    const outstanding = plan ? plan.totalOwed : D.amountOwed(patient);
    document.getElementById("completionPatientId").value = patient.id;
    document.getElementById("completionPatientLabel").textContent = `${patient.name} · ${patient.mrn}`;
    document.getElementById("completionReason").value = "";
    document.getElementById("completionNote").value = "";
    const callout = document.getElementById("completionBalanceCallout");
    callout.innerHTML = outstanding > D.EPSILON
      ? `<strong>${D.currency.format(outstanding)} remains outstanding.</strong> Completing the patient will remove them from the active board without changing the balance.`
      : `<strong>Balance is satisfied.</strong> Completing the patient will move them to Completed Patients.`;
    callout.classList.toggle("has-balance", outstanding > D.EPSILON);
    elements.completionDialog.showModal();
  }

  function completePatient(patient, reason, note = "") {
    const plan = planForPatient(patient);
    const outstanding = plan ? plan.totalOwed : D.amountOwed(patient);
    patient.archived = true;
    patient.completedAt = D.todayIso();
    patient.completionReason = String(reason || "");
    patient.completionNote = String(note || "");
    const balanceNote = outstanding > D.EPSILON
      ? ` Archived with ${D.currency.format(outstanding)} still outstanding.`
      : "";
    const noteText = note ? ` Note: ${note}` : "";
    D.addActivity(patient, {
      type: "completion",
      title: "Account completed and archived",
      detail: `Reason: ${reason}.${balanceNote}${noteText}`,
      date: D.todayIso()
    });
    D.savePatients(patients);
    if (elements.detailsDialog.open) elements.detailsDialog.close();
    if (elements.completionDialog.open) elements.completionDialog.close();
    render();
    showToast(`${patient.name} moved to Completed Patients${outstanding > D.EPSILON ? ` with ${D.currency.format(outstanding)} outstanding` : ""}.`);
  }

  // Form submissions --------------------------------------------------------
  document.getElementById("patientForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const id = document.getElementById("patientId").value;
    const existing = id ? findPatient(id) : null;
    const arrangement = document.getElementById("patientArrangement").value;
    let responsibility = Number(document.getElementById("patientResponsibility").value || 0);
    const openingCollected = existing ? D.netCollected(existing) : Number(document.getElementById("patientCollected").value || 0);

    if (!Number.isFinite(responsibility) || responsibility < 0 || !Number.isFinite(openingCollected) || openingCollected < 0) return showToast("Responsibility and opening payment must be valid nonnegative numbers.", "error");
    if (arrangement === "No Responsibility") responsibility = 0;
    if (arrangement === "No Responsibility" && existing && D.netCollected(existing) > D.EPSILON) return showToast("An account with payment history cannot be changed to No Patient Responsibility.", "error");
    if (openingCollected > responsibility && arrangement !== "No Responsibility") return showToast("Opening payment cannot exceed patient responsibility.", "error");

    const collectionDateInput = document.getElementById("patientDate").value;
    if (arrangement === "Payment Plan" && !validOperationalDate(collectionDateInput, "Collection date")) return;
    const noResponsibilityReason = document.getElementById("noResponsibilityReason").value.trim();
    if (arrangement === "No Responsibility" && !noResponsibilityReason) return showToast("A reason is required for No Patient Responsibility.", "error");

    let paymentPlan = null;
    let collectionDate = collectionDateInput;
    let planChanged = false;
    if (arrangement === "Payment Plan") {
      editingPlanSchedule = readPlanScheduleFromDom();
      const planOpeningCollected = Number(document.getElementById("planOpeningCollected").value || 0);
      const invalidInstallment = editingPlanSchedule.some((installment) =>
        !installment.dueDate
        || !Number.isFinite(installment.amount)
        || installment.amount <= 0
        || !["Ackerman", "UF"].includes(installment.responsibilityParty)
        || !validOperationalDate(installment.dueDate, "Installment due date", false)
      );
      if (editingPlanSchedule.length < 1 || invalidInstallment) {
        return showToast("The payment plan needs at least one valid payment with a due date, amount, and Ackerman or UF responsibility selected.", "error");
      }

      paymentPlan = {
        createdDate: existing?.paymentPlan?.createdDate || D.todayIso(),
        openingCollected: planOpeningCollected,
        promiseToPayDate: existing?.paymentPlan?.promiseToPayDate || "",
        renegotiationCount: existing?.paymentPlan?.renegotiationCount || 0,
        history: D.deepCopy(existing?.paymentPlan?.history || []),
        installments: editingPlanSchedule.sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      };
      collectionDate = paymentPlan.installments[0]?.dueDate || collectionDateInput;
      planChanged = Boolean(existing?.paymentPlan && planSnapshot(paymentPlan) !== originalPlanSnapshot);
      if (planChanged) {
        paymentPlan.renegotiationCount += 1;
        const ackermanCount = paymentPlan.installments.filter((item) => item.responsibilityParty !== "UF").length;
        const ufCount = paymentPlan.installments.filter((item) => item.responsibilityParty === "UF").length;
        paymentPlan.history.push({
          id: D.uid("plan-history"),
          date: D.todayIso(),
          reason: "Manual schedule update",
          detail: `${paymentPlan.installments.length} payment rows · ${ackermanCount} Ackerman responsible · ${ufCount} UF responsible.`,
          createdAt: new Date().toISOString()
        });
      }
    }

    const record = {
      id: id || D.uid("patient"),
      name: document.getElementById("patientName").value.trim(),
      mrn: document.getElementById("patientMrn").value.trim().toUpperCase(),
      location: document.getElementById("patientLocation").value,
      treatment: document.getElementById("patientTreatment").value,
      insurance: document.getElementById("patientInsurance").value.trim(),
      responsibility,
      collected: existing ? D.netCollected(existing) : 0,
      collectionDate,
      status: arrangement,
      arrangement,
      noResponsibilityReason,
      statusNote: document.getElementById("patientStatusNote").value.trim(),
      notes: document.getElementById("patientNotes").value.trim(),
      archived: existing ? existing.archived : false,
      completedAt: existing ? existing.completedAt : "",
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: existing?.updatedAt || new Date().toISOString(),
      paymentPlan,
      payments: existing ? D.deepCopy(existing.payments || []) : [],
      adjustments: existing ? D.deepCopy(existing.adjustments || []) : [],
      activity: existing ? D.deepCopy(existing.activity || []) : []
    };

    if (!record.name || !record.mrn || !record.insurance || !record.collectionDate) return showToast("Complete all required fields.", "error");
    if (patients.some((patient) => patient.mrn.toLowerCase() === record.mrn.toLowerCase() && patient.id !== record.id)) return showToast("That MRN already exists in the prototype.", "error");

    if (existing && Math.abs(Number(existing.responsibility || 0) - responsibility) > D.EPSILON && (existing.payments || []).length) {
      if (!window.confirm("This account already has payment history. Confirm the patient responsibility change.")) return;
    }
    if (!existing) {
      D.addActivity(record, { type: "account", title: "Patient account created", detail: `${arrangement} account with ${D.currency.format(responsibility)} responsibility.`, date: D.todayIso() });
      if (openingCollected > D.EPSILON) D.addPaymentTransaction(record, { type: "Payment", amount: openingCollected, date: collectionDate, location: record.location, method: "Previously Collected", note: "Opening payment entered with the patient record.", appliesToPlan: false });
    } else {
      const changes = [];
      ["name", "mrn", "location", "treatment", "insurance", "collectionDate", "statusNote", "notes"].forEach((key) => {
        if (String(existing[key] || "") !== String(record[key] || "")) changes.push(key);
      });
      if (Math.abs(existing.responsibility - record.responsibility) > D.EPSILON) changes.push("responsibility");
      if (D.arrangementFromLegacy(existing) !== arrangement) changes.push("arrangement");
      if (changes.length) D.addActivity(record, { type: "account", title: "Account details updated", detail: `Changed: ${changes.join(", ")}.`, date: D.todayIso() });
      if (planChanged) D.addActivity(record, { type: "plan", title: "Payment plan schedule updated", detail: "Due dates, amounts, responsibility assignments, or UF verification status were changed.", date: D.todayIso() });
    }

    const normalized = D.normalizePatient(record);
    const index = patients.findIndex((patient) => patient.id === normalized.id);
    if (index >= 0) patients[index] = normalized; else patients.push(normalized);
    D.savePatients(patients);
    populateFilters();
    elements.patientDialog.close();
    render();
    showToast(existing ? `${record.name} updated.` : `${record.name} added to the board.`);
  });

  document.getElementById("paymentForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const patient = findPatient(document.getElementById("paymentPatientId").value);
    if (!patient) return showToast("The selected patient could not be found.", "error");
    const amount = Number(document.getElementById("paymentAmount").value);
    const balance = collectableAmount(patient);
    const date = document.getElementById("paymentDate").value;
    if (!validOperationalDate(date, "Payment date")) return;
    if (!Number.isFinite(amount) || amount <= 0 || amount > balance + D.EPSILON) return showToast(`Enter a payment between $0.01 and ${D.currency.format(balance)}.`, "error");

    const appliesToPlan = D.effectiveStatus(patient) === "Payment Plan" && Boolean(patient.paymentPlan);
    D.addPaymentTransaction(patient, {
      type: "Payment", amount, date,
      location: document.getElementById("paymentLocation").value,
      method: document.getElementById("paymentMethod").value,
      note: document.getElementById("paymentNote").value.trim(), appliesToPlan
    });
    D.savePatients(patients);
    elements.paymentDialog.close();
    render();
    showToast(`${D.currency.format(amount)} recorded for ${patient.name}${appliesToPlan ? " and applied to the payment plan" : ""}.`);
  });


  document.getElementById("adjustmentForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const patient = findPatient(document.getElementById("adjustmentPatientId").value);
    if (!patient) return;
    const amount = Number(document.getElementById("adjustmentAmount").value);
    const balance = D.amountOwed(patient);
    const date = document.getElementById("adjustmentDate").value;
    const note = document.getElementById("adjustmentNote").value.trim();
    if (!validOperationalDate(date, "Adjustment date")) return;
    if (!Number.isFinite(amount) || amount <= 0 || amount > balance + D.EPSILON) return showToast(`Adjustment must be between $0.01 and ${D.currency.format(balance)}.`, "error");
    if (!note) return showToast("A reason is required for every financial adjustment.", "error");
    D.addAdjustment(patient, { type: document.getElementById("adjustmentType").value, amount, date, note });
    D.savePatients(patients);
    elements.adjustmentDialog.close();
    render();
    if (elements.detailsDialog.open) openDetailsDialog(patient);
    showToast(`${D.currency.format(amount)} ${document.getElementById("adjustmentType").value.toLowerCase()} recorded for ${patient.name}.`);
  });

  document.getElementById("transactionForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const patient = findPatient(document.getElementById("transactionPatientId").value);
    const original = patient && D.normalizedPayments(patient).find((transaction) => transaction.id === document.getElementById("transactionId").value);
    if (!patient || !original) return showToast("The selected transaction could not be found.", "error");
    const action = document.getElementById("transactionAction").value;
    const amount = Number(document.getElementById("transactionAmount").value);
    const available = D.reversibleAmount(patient, original.id);
    const date = document.getElementById("transactionDate").value;
    const reason = document.getElementById("transactionReason").value.trim();
    if (!validOperationalDate(date, "Correction date")) return;
    if (!Number.isFinite(amount) || amount <= 0 || amount > available + D.EPSILON) return showToast(`Enter an amount between $0.01 and ${D.currency.format(available)}.`, "error");
    if (!reason) return showToast("A reason is required.", "error");

    if (action === "Correction") {
      const correctedAmount = Number(document.getElementById("correctedAmount").value);
      const maxCorrected = D.amountOwed(patient) + amount;
      if (!Number.isFinite(correctedAmount) || correctedAmount <= 0 || correctedAmount > maxCorrected + D.EPSILON) return showToast(`Corrected payment must be between $0.01 and ${D.currency.format(maxCorrected)}.`, "error");
      D.addPaymentTransaction(patient, { type: "Correction Reversal", amount, date, location: original.location, method: original.method, note: reason, appliesToPlan: original.appliesToPlan, relatedTransactionId: original.id }, false);
      D.addPaymentTransaction(patient, { type: "Correction Payment", amount: correctedAmount, date, location: original.location, method: document.getElementById("correctedMethod").value, note: `Correction: ${reason}`, appliesToPlan: original.appliesToPlan, relatedTransactionId: original.id }, false);
      D.addActivity(patient, { type: "payment", title: "Payment corrected", detail: `${D.currency.format(amount)} reversed and replaced with ${D.currency.format(correctedAmount)} · ${reason}`, date });
    } else {
      D.addPaymentTransaction(patient, { type: action, amount, date, location: original.location, method: original.method, note: reason, appliesToPlan: original.appliesToPlan, relatedTransactionId: original.id });
    }
    D.savePatients(patients);
    elements.transactionDialog.close();
    render();
    openDetailsDialog(patient);
    showToast(`${action === "Correction" ? "Correction" : action} recorded for ${patient.name}.`);
  });

  // Event handlers ----------------------------------------------------------
  elements.tbody.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const patient = findPatient(button.dataset.id);
    if (!patient) return;
    if (button.dataset.action === "payment") openPaymentDialog(patient);
    if (button.dataset.action === "details") openDetailsDialog(patient);
    if (button.dataset.action === "timeline") openDetailsDialog(patient, "timeline");
    if (button.dataset.action === "uf-check") openDetailsDialog(patient, "plan");
    if (button.dataset.action === "edit") openPatientDialog(patient);
    if (button.dataset.action === "adjustment") openAdjustmentDialog(patient);
    if (button.dataset.action === "complete") openCompletionDialog(patient);
    if (button.dataset.action === "documents" && Docs) Docs.open(patient);
  });

  elements.tbody.addEventListener("change", (event) => {
    const input = event.target.closest("input[data-status-note-id]");
    if (!input) return;
    const patient = findPatient(input.dataset.statusNoteId);
    if (!patient) return;
    const nextNote = input.value.trim();
    if (patient.statusNote === nextNote) return;
    patient.statusNote = nextNote;
    D.addActivity(patient, { type: "account", title: "Status note updated", detail: nextNote || "Status note cleared.", date: D.todayIso() });
    D.savePatients(patients);
    showToast(`Status note saved for ${patient.name}.`);
  });

  document.getElementById("detailsBody").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-detail-action]");
    if (!button) return;
    const patient = findPatient(detailsPatientId);
    if (!patient) return;
    if (button.dataset.detailAction === "add-adjustment") return openAdjustmentDialog(patient);
    if (button.dataset.detailAction === "transaction") {
      const transaction = D.normalizedPayments(patient).find((item) => item.id === button.dataset.transactionId);
      if (transaction) openTransactionDialog(patient, transaction);
    }
  });

  document.getElementById("detailsBody").addEventListener("change", (event) => {
    const checkbox = event.target.closest("input[data-detail-uf-verify]");
    if (!checkbox) return;
    const patient = findPatient(detailsPatientId);
    if (!patient?.paymentPlan) return;
    const installment = patient.paymentPlan.installments.find((item) => item.id === checkbox.dataset.installmentId);
    if (!installment || installment.responsibilityParty !== "UF") return;

    installment.ufVerified = checkbox.checked;
    installment.ufVerifiedAt = checkbox.checked ? (installment.ufVerifiedAt || D.todayIso()) : "";
    D.addActivity(patient, {
      type: "plan",
      title: checkbox.checked ? "UF payment verified" : "UF verification cleared",
      detail: `UF-responsible payment due ${D.formatDate(installment.dueDate)} for ${D.currency.format(installment.amount)} was ${checkbox.checked ? "confirmed as received" : "returned to pending verification"}.`,
      date: D.todayIso()
    });
    D.savePatients(patients);
    render();
    openDetailsDialog(patient, "plan");
    showToast(checkbox.checked ? "UF payment marked checked / went through." : "UF payment returned to pending verification.");
  });

  document.getElementById("detailsEditButton").addEventListener("click", () => {
    const patient = findPatient(detailsPatientId);
    if (!patient) return;
    elements.detailsDialog.close();
    openPatientDialog(patient);
  });
  document.getElementById("detailsPaymentButton").addEventListener("click", () => {
    const patient = findPatient(detailsPatientId);
    if (!patient) return;
    elements.detailsDialog.close();
    openPaymentDialog(patient);
  });
  async function printSummary(patient) {
    let documents = [];
    if (Docs) {
      try { documents = await Docs.list(patient.id); }
      catch (error) { console.warn("Could not load document metadata for printing.", error); }
    }
    const opened = D.printPatientSummary(patient, documents);
    if (!opened) showToast("Allow pop-ups for this site to print the patient summary.", "error");
  }

  document.getElementById("detailsPrintButton").addEventListener("click", () => {
    const patient = findPatient(detailsPatientId);
    if (patient) printSummary(patient);
  });
  document.getElementById("detailsFinancialButton").addEventListener("click", () => {
    const patient = findPatient(detailsPatientId);
    if (patient) openAdjustmentDialog(patient);
  });
  document.getElementById("detailsCompleteButton").addEventListener("click", () => {
    const patient = findPatient(detailsPatientId);
    if (patient) openCompletionDialog(patient);
  });
  document.getElementById("detailsDocumentsButton").addEventListener("click", () => {
    const patient = findPatient(detailsPatientId);
    if (patient && Docs) Docs.open(patient);
  });

  document.getElementById("completionForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const patient = findPatient(document.getElementById("completionPatientId").value);
    if (!patient) return showToast("The selected patient could not be found.", "error");
    const reason = document.getElementById("completionReason").value;
    const note = document.getElementById("completionNote").value.trim();
    if (!reason) return showToast("Choose a completion reason.", "error");
    if (reason === "Other" && !note) return showToast("Add a short completion note when Other is selected.", "error");
    completePatient(patient, reason, note);
  });
  document.getElementById("cancelCompletionButton").addEventListener("click", () => elements.completionDialog.close());

  document.getElementById("addPatientButton").addEventListener("click", () => openPatientDialog());
  document.getElementById("patientArrangement").addEventListener("change", () => toggleArrangementSection({ autoBuild: true }));
  document.getElementById("buildPlanButton").addEventListener("click", buildPlanSchedule);
  elements.planScheduleBody.addEventListener("input", (event) => {
    const row = event.target.closest("tr");
    if (!row) return;

    if (event.target.matches("input[data-plan-field='responsibilityParty']")) {
      const isUf = event.target.value === "UF" && event.target.checked;
      const verifyControl = row.querySelector(".uf-verify-control");
      const verified = row.querySelector("input[data-plan-field='ufVerified']");
      verifyControl.hidden = !isUf;
      if (!isUf) {
        verified.checked = false;
        row.dataset.ufVerifiedAt = "";
      }
    }

    if (event.target.matches("input[data-plan-field='ufVerified']")) {
      row.dataset.ufVerifiedAt = event.target.checked ? (row.dataset.ufVerifiedAt || D.todayIso()) : "";
    }

    const party = row.querySelector("input[data-plan-field='responsibilityParty']:checked")?.value || "Ackerman";
    const dueDate = row.querySelector("input[data-plan-field='dueDate']")?.value || "";
    const ufVerified = Boolean(row.querySelector("input[data-plan-field='ufVerified']")?.checked);
    const flag = row.querySelector(".uf-check-flag");
    const checkDue = party === "UF" && !ufVerified && dueDate && D.addDays(dueDate, 2) <= D.todayIso();
    if (flag) flag.hidden = !checkDue;

    updatePlanEditorSummary();
  });
  document.getElementById("patientResponsibility").addEventListener("input", updatePlanEditorSummary);
  document.getElementById("patientCollected").addEventListener("input", () => {
    if (!editingExistingPlan && document.getElementById("patientArrangement").value === "Payment Plan") document.getElementById("planOpeningCollected").value = document.getElementById("patientCollected").value || "0";
    updatePlanEditorSummary();
  });

  document.getElementById("adjustmentAmount").addEventListener("input", () => {
    const patient = findPatient(document.getElementById("adjustmentPatientId").value);
    const amount = Number(document.getElementById("adjustmentAmount").value || 0);
    document.getElementById("adjustmentAfter").textContent = D.currency.format(Math.max(0, (patient ? D.amountOwed(patient) : 0) - amount));
  });
  document.getElementById("transactionAction").addEventListener("change", toggleCorrectionFields);

  document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => document.getElementById(button.dataset.close).close()));
  document.querySelectorAll("dialog").forEach((dialog) => dialog.addEventListener("click", (event) => {
    if (event.target === dialog && dialog.id !== "patientDialog") dialog.close();
  }));
  elements.patientDialog.addEventListener("cancel", (event) => event.preventDefault());

  [elements.search, elements.locationFilter, elements.treatmentFilter]
    .forEach((control) => control.addEventListener("input", () => { quickFilter = ""; render(); }));
  elements.statusFilter.addEventListener("input", () => {
    quickFilter = "";
    if (elements.statusFilter.value === "UF Check Due") {
      elements.sort.value = "ufCheckAge:desc";
      sortState = parseSortValue(elements.sort.value);
    }
    render();
  });
  elements.sort.addEventListener("change", () => { sortState = parseSortValue(elements.sort.value); render(); });
  document.querySelectorAll(".sort-button").forEach((button) => button.addEventListener("click", () => {
    const key = button.dataset.sortKey;
    if (sortState.key === key) sortState.direction = sortState.direction === "asc" ? "desc" : "asc";
    else { sortState.key = key; sortState.direction = ["owed", "responsibility", "collected", "planProgress"].includes(key) ? "desc" : "asc"; }
    const value = `${sortState.key}:${sortState.direction}`;
    if ([...elements.sort.options].some((item) => item.value === value)) elements.sort.value = value;
    render();
  }));

  document.querySelectorAll("[data-quick-filter]").forEach((button) => button.addEventListener("click", () => {
    quickFilter = quickFilter === button.dataset.quickFilter ? "" : button.dataset.quickFilter;
    render();
    document.getElementById("workQueueHeading").scrollIntoView({ behavior: "smooth", block: "start" });
  }));
  document.getElementById("clearQuickFilterButton").addEventListener("click", () => { quickFilter = ""; render(); });

  document.getElementById("clearFiltersButton").addEventListener("click", () => {
    elements.search.value = ""; elements.statusFilter.value = "all"; elements.locationFilter.value = "all"; elements.treatmentFilter.value = "all"; quickFilter = ""; render();
  });

  elements.savedViewSelect.addEventListener("change", () => {
    const view = D.loadSavedViews("board").find((item) => item.id === elements.savedViewSelect.value);
    document.getElementById("deleteViewButton").disabled = !view;
    if (view) { elements.savedViewName.value = view.name; applyViewSettings(view.settings); }
  });
  document.getElementById("saveViewButton").addEventListener("click", () => {
    const name = elements.savedViewName.value.trim();
    if (!name) return showToast("Enter a name for the saved view.", "error");
    const existingId = elements.savedViewSelect.value;
    const record = D.saveSavedView("board", { id: existingId || undefined, name, settings: captureViewSettings() });
    renderSavedViews(record.id);
    showToast(`Saved view “${name}”.`);
  });
  document.getElementById("deleteViewButton").addEventListener("click", () => {
    const id = elements.savedViewSelect.value;
    if (!id) return;
    const name = elements.savedViewSelect.selectedOptions[0]?.textContent || "this view";
    if (!window.confirm(`Delete saved view "${name}"?`)) return;
    D.deleteSavedView("board", id);
    elements.savedViewName.value = "";
    renderSavedViews();
    showToast("Saved view deleted.");
  });

  document.getElementById("exportButton").addEventListener("click", () => {
    const visiblePatients = filteredPatients();
    if (!visiblePatients.length) return showToast("No visible records to export.", "error");
    if (!window.AckermanExcel) return showToast("Excel export could not be loaded.", "error");

    const headers = ["Status", "Payment Attention", "Status Note", "Patient Name", "MRN", "Treatment Site", "Treatment Type", "Insurance", "Responsibility", "Net Collected", "Adjustments", "Amount Owed", "Ackerman Owes", "UF Owes", "Plan Remaining %", "Next Due Date", "Plan Payments", "Plan Payments Completed / Verified", "Ackerman Overdue Payments", "UF Checks Due", "Oldest UF Check Days", "Plan On-Time Rate", "Account Created", "Last Updated"];
    const rows = visiblePatients.map((patient) => {
      const plan = D.planSummary(patient);
      return [
        frontPageStatus(patient),
        D.attentionStatus(patient),
        patient.statusNote || "",
        patient.name,
        patient.mrn,
        patient.location,
        patient.treatment,
        patient.insurance,
        patient.responsibility,
        D.netCollected(patient),
        D.adjustmentTotal(patient),
        D.amountOwed(patient),
        plan?.ackermanOwed ?? "",
        plan?.ufOwed ?? "",
        plan ? plan.remainingPercent / 100 : "",
        D.nextActionDate(patient),
        plan?.totalCount || 0,
        plan?.completedCount || 0,
        plan?.overdueCount || 0,
        plan?.ufCheckDueCount || 0,
        plan?.oldestUfCheckDays || 0,
        plan?.onTimeRate === null || !plan ? "" : plan.onTimeRate / 100,
        patient.createdAt || "",
        patient.updatedAt || ""
      ];
    });

    const types = [
      "text", "text", "wrap", "text", "text", "text", "text", "text",
      "currency", "currency", "currency", "currency", "currency", "currency", "percent", "date",
      "integer", "integer", "integer", "integer", "integer", "percent", "datetime", "datetime"
    ];
    const now = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date());
    window.AckermanExcel.exportWorkbook({
      filename: `ackerman-active-current-view-${D.todayIso()}.xlsx`,
      sheetName: "Active Patients",
      title: "Ackerman Patient Payment Board - Active Patients",
      subtitle: `${rows.length} visible ${rows.length === 1 ? "record" : "records"} · Exported ${now}`,
      headers, rows, types, statusColumn: 0, flagColumns: [19]
    });
    showToast(`${rows.length} visible ${rows.length === 1 ? "record" : "records"} exported to Excel.`);
  });

  document.addEventListener("ackerman-docs-changed", (event) => {
    const patientId = event.detail?.patientId;
    if (!patientId) return;
    document.querySelectorAll(`[data-doc-count-for="${CSS.escape(patientId)}"]`).forEach((badge) => {
      const count = Number(event.detail?.count || 0); badge.textContent = count; badge.hidden = count === 0;
    });
  });
  document.addEventListener("ackerman-document-event", (event) => {
    const patient = findPatient(event.detail?.patientId);
    if (!patient) return;
    const action = event.detail.action === "deleted" ? "Document deleted" : "Document attached";
    D.addActivity(patient, { type: "document", title: action, detail: event.detail.name || "Document", date: D.todayIso() });
    D.savePatients(patients);
    if (elements.detailsDialog.open && detailsPatientId === patient.id) openDetailsDialog(patient, detailsFocus);
  });

  window.addEventListener("storage", (event) => {
    if (event.key === D.STORAGE_KEY) { patients = D.loadPatients(); populateFilters(); render(); }
    if (event.key === D.SAVED_VIEWS_KEY) renderSavedViews();
  });

  populateFilters();
  renderSavedViews();
  render();
})();
