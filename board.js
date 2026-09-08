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
    physicianFilter: document.getElementById("physicianFilter"),
    treatmentFilter: document.getElementById("treatmentFilter"),
    sort: document.getElementById("sortSelect"),
    resultCount: document.getElementById("resultCount"),
    patientDialog: document.getElementById("patientDialog"),
    paymentDialog: document.getElementById("paymentDialog"),
    detailsDialog: document.getElementById("detailsDialog"),
    outcomeDialog: document.getElementById("outcomeDialog"),
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
    setSelectOptions(elements.physicianFilter, unique("physician"), "All physicians");
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

  function urgencyRank(patient) {
    const status = D.effectiveStatus(patient);
    const attention = D.attentionStatus(patient);
    if (attention === "Overdue") return status === "Payment Plan" ? 1 : 0;
    if (attention === "Due Today") return status === "Payment Plan" ? 3 : 2;
    if (attention === "Grace Period") return 4;
    if (status === "Upcoming Collection") return 5;
    if (status === "Partially Paid") return 6;
    if (status === "Payment Plan") return 7;
    if (status === "Paid in Full") return 8;
    return 9;
  }

  function sortValue(patient, key) {
    if (key === "status") return urgencyRank(patient);
    if (key === "actionDate") return D.nextActionDate(patient);
    if (key === "owed") return D.amountOwed(patient);
    if (key === "responsibility") return Number(patient.responsibility || 0);
    if (key === "collected") return D.netCollected(patient);
    if (key === "planProgress") return D.planSummary(patient)?.progressPercent ?? 101;
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
    const status = D.effectiveStatus(patient);
    const attention = D.attentionStatus(patient);
    if (selected === "Partial Overdue") return status === "Partially Paid" && attention === "Overdue";
    if (selected === "Partial Due Today") return status === "Partially Paid" && attention === "Due Today";
    if (selected === "Plan Overdue") return status === "Payment Plan" && attention === "Overdue";
    if (selected === "Plan Due Today") return status === "Payment Plan" && attention === "Due Today";
    if (selected === "Plan Grace Period") return status === "Payment Plan" && attention === "Grace Period";
    if (selected === "Plan On Schedule") return status === "Payment Plan" && attention === "Plan On Schedule";
    if (selected === "Overdue") return attention === "Overdue";
    if (selected === "Due Today") return attention === "Due Today";
    return status === selected;
  }

  function positivePaymentsOnDate(patient, date) {
    return D.normalizedPayments(patient).filter((payment) => payment.date === date && D.transactionEffect(payment) > 0);
  }

  function matchesQuickFilter(patient) {
    if (!quickFilter) return true;
    const status = D.effectiveStatus(patient);
    const attention = D.attentionStatus(patient);
    if (quickFilter === "Due Today") return attention === "Due Today";
    if (quickFilter === "Overdue") return attention === "Overdue";
    if (quickFilter === "Plan Attention") return status === "Payment Plan" && ["Overdue", "Due Today", "Grace Period"].includes(attention);
    if (quickFilter === "Partial Overdue") return status === "Partially Paid" && attention === "Overdue";
    if (quickFilter === "Collected Today") return positivePaymentsOnDate(patient, D.todayIso()).length > 0;
    if (quickFilter === "Outcomes Today") return (patient.outcomes || []).some((outcome) => outcome.date === D.todayIso());
    if (quickFilter === "Follow Up") {
      const followUp = D.currentFollowUp(patient);
      return Boolean(followUp && followUp.followUpDate <= D.todayIso());
    }
    return true;
  }

  function filteredPatients() {
    const query = elements.search.value.trim().toLowerCase();
    return patients
      .filter((patient) => {
        if (patient.archived) return false;
        const searchable = [patient.name, patient.mrn, patient.physician, patient.location, patient.treatment, patient.insurance]
          .join(" ").toLowerCase();
        return (!query || searchable.includes(query))
          && matchesStatusFilter(patient, elements.statusFilter.value)
          && matchesQuickFilter(patient)
          && (elements.locationFilter.value === "all" || patient.location === elements.locationFilter.value)
          && (elements.physicianFilter.value === "all" || patient.physician === elements.physicianFilter.value)
          && (elements.treatmentFilter.value === "all" || patient.treatment === elements.treatmentFilter.value);
      })
      .sort(comparePatients);
  }

  function statusPillsHtml(patient, clickable = false) {
    const status = D.effectiveStatus(patient);
    const meta = D.statusMeta(status);
    const primary = clickable
      ? `<button class="status-pill ${meta.pill} status-action" data-action="timeline" data-id="${D.escapeHtml(patient.id)}" type="button" title="Open activity timeline">${D.escapeHtml(status)}</button>`
      : `<span class="status-pill ${meta.pill}">${D.escapeHtml(status)}</span>`;
    const pills = [primary];

    if (status === "Payment Plan") {
      const plan = D.planSummary(patient);
      if (plan?.attention === "Overdue") {
        pills.push(`<span class="status-pill overdue">${plan.overdueCount} ${plan.overdueCount === 1 ? "Installment" : "Installments"} Overdue</span>`);
      } else if (plan?.attention === "Due Today") {
        pills.push('<span class="status-pill due">Installment Due Today</span>');
      } else if (plan?.attention === "Grace Period") {
        pills.push(`<span class="status-pill grace">In ${plan.graceDays}-Day Grace Period</span>`);
      } else if (plan?.attention === "Plan On Schedule") {
        pills.push('<span class="status-pill current">Plan On Schedule</span>');
      }
      if (plan?.repeatedMisses) pills.push('<span class="status-pill overdue">Repeated Misses</span>');
      if (plan?.promiseToPayDate && plan.promiseToPayDate >= D.todayIso()) {
        pills.push(`<span class="status-pill promise">Promise ${D.formatDate(plan.promiseToPayDate)}</span>`);
      }
    } else if (status === "Partially Paid") {
      const attention = D.attentionStatus(patient);
      if (attention === "Overdue") pills.push('<span class="status-pill overdue">Remaining Balance Overdue</span>');
      else if (attention === "Due Today") pills.push('<span class="status-pill due">Remaining Balance Due Today</span>');
    }
    return `<div class="status-stack">${pills.join("")}</div>`;
  }

  function actionButtons(patient, owed) {
    const direct = [];
    if (owed > D.EPSILON) direct.push(`<button class="btn btn-primary btn-small" data-action="payment" data-id="${D.escapeHtml(patient.id)}" type="button">Pay</button>`);
    direct.push(`<button class="btn btn-secondary btn-small" data-action="outcome" data-id="${D.escapeHtml(patient.id)}" type="button">Outcome</button>`);
    direct.push(`<button class="btn btn-documents btn-small" data-action="documents" data-id="${D.escapeHtml(patient.id)}" type="button">Docs<span class="doc-count" data-doc-count-for="${D.escapeHtml(patient.id)}" hidden></span></button>`);
    direct.push(`<button class="btn btn-ghost btn-small" data-action="details" data-id="${D.escapeHtml(patient.id)}" type="button">View Details</button>`);
    return direct.join("");
  }

  function planProgressHtml(patient) {
    const plan = D.planSummary(patient);
    if (!plan) return "";
    const onTimeText = plan.onTimeRate === null ? "No installments due yet" : `${plan.onTimeRate.toFixed(0)}% within grace period`;
    return `
      <div class="plan-progress-block">
        <div class="plan-progress-label"><span>${plan.completedCount} of ${plan.totalCount} payments complete</span><strong>${plan.progressPercent.toFixed(0)}%</strong></div>
        <div class="progress-track"><div class="progress-fill plan-fill" style="width:${Math.min(100, plan.progressPercent).toFixed(2)}%"></div></div>
        <div class="plan-progress-subtext">${D.escapeHtml(onTimeText)}${plan.renegotiationCount ? ` · ${plan.renegotiationCount} plan change${plan.renegotiationCount === 1 ? "" : "s"}` : ""}</div>
      </div>
    `;
  }

  function dueCellHtml(patient) {
    if (D.effectiveStatus(patient) === "Payment Plan") {
      const plan = D.planSummary(patient);
      if (!plan?.nextDue) return '<div class="date-main">Plan complete</div><div class="date-relative">No installment remains</div>';
      return `
        <div class="date-kicker">Payment ${plan.nextDue.number} of ${plan.totalCount}</div>
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
      const meta = D.statusMeta(status);
      const owed = D.amountOwed(patient);
      const collected = D.netCollected(patient);
      const adjustments = D.adjustmentTotal(patient);
      const tr = document.createElement("tr");
      tr.className = meta.row;
      tr.innerHTML = `
        <td data-label="Status">${statusPillsHtml(patient, true)}</td>
        <td data-label="Patient"><button class="patient-link" type="button" data-action="details" data-id="${D.escapeHtml(patient.id)}">${D.escapeHtml(patient.name)}</button><div class="mrn">${D.escapeHtml(patient.mrn)}</div><div class="cell-tertiary">Updated ${D.escapeHtml(D.formatDateTime(patient.updatedAt || patient.createdAt))}</div></td>
        <td data-label="Care"><div class="cell-primary">${D.escapeHtml(patient.physician)}</div><div class="cell-secondary">${D.escapeHtml(patient.treatment)}</div></td>
        <td data-label="Site & Insurance"><div class="cell-primary">${D.escapeHtml(patient.location)}</div><div class="cell-secondary">${D.escapeHtml(patient.insurance)}</div></td>
        <td data-label="Financials / Plan">
          <div class="financial-stack">
            <div class="financial-line"><span>Responsibility</span><strong>${D.currency.format(patient.responsibility)}</strong></div>
            <div class="financial-line"><span>Collected</span><strong>${D.currency.format(collected)}</strong></div>
            ${adjustments > D.EPSILON ? `<div class="financial-line"><span>Adjustments</span><strong>${D.currency.format(adjustments)}</strong></div>` : ""}
            <div class="financial-line balance"><span>Still owed</span><strong>${D.currency.format(owed)}</strong></div>
          </div>
          ${planProgressHtml(patient)}
        </td>
        <td data-label="Next Due">${dueCellHtml(patient)}</td>
        <td class="actions-cell" data-label="Actions"><div class="actions">${actionButtons(patient, owed)}</div></td>
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
    const dueToday = active.filter((patient) => D.attentionStatus(patient) === "Due Today");
    const overdue = active.filter((patient) => D.attentionStatus(patient) === "Overdue");
    const planAttention = active.filter((patient) => D.effectiveStatus(patient) === "Payment Plan" && ["Overdue", "Due Today", "Grace Period"].includes(D.attentionStatus(patient)));
    const planInstallmentsDue = planAttention.reduce((sum, patient) => {
      const plan = D.planSummary(patient);
      return sum + Number(plan?.overdueCount || 0) + Number(plan?.dueTodayCount || 0) + Number(plan?.graceCount || 0);
    }, 0);
    const partialOverdue = active.filter((patient) => D.effectiveStatus(patient) === "Partially Paid" && D.attentionStatus(patient) === "Overdue");
    const paymentsToday = active.flatMap((patient) => positivePaymentsOnDate(patient, today));
    const outcomesToday = active.flatMap((patient) => (patient.outcomes || []).filter((outcome) => outcome.date === today));
    const followUps = active.filter((patient) => {
      const followUp = D.currentFollowUp(patient);
      return Boolean(followUp && followUp.followUpDate <= today);
    });
    return { active, dueToday, overdue, planAttention, planInstallmentsDue, partialOverdue, paymentsToday, outcomesToday, followUps };
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
    document.getElementById("opsOutcomesToday").textContent = ops.outcomesToday.length;
    document.getElementById("opsFollowUps").textContent = ops.followUps.length;

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
      physician: elements.physicianFilter.value,
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
    elements.statusFilter.value = [...elements.statusFilter.options].some((option) => option.value === settings.status) ? settings.status : "all";
    elements.locationFilter.value = [...elements.locationFilter.options].some((option) => option.value === settings.location) ? settings.location : "all";
    elements.physicianFilter.value = [...elements.physicianFilter.options].some((option) => option.value === settings.physician) ? settings.physician : "all";
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
    return [...elements.planScheduleBody.querySelectorAll("tr")].map((row, index) => ({
      id: row.dataset.installmentId || D.uid(`installment-${index + 1}`),
      dueDate: row.querySelector("input[data-plan-field='dueDate']")?.value || "",
      originalDueDate: row.dataset.originalDueDate || row.querySelector("input[data-plan-field='dueDate']")?.value || "",
      amount: Number(row.querySelector("input[data-plan-field='amount']")?.value || 0),
      skipped: Boolean(row.querySelector("input[data-plan-field='skipped']")?.checked),
      skipReason: row.querySelector("input[data-plan-field='skipReason']")?.value.trim() || "",
      rescheduledAt: row.dataset.rescheduledAt || ""
    }));
  }

  function planSnapshot(planData) {
    return JSON.stringify({
      graceDays: Number(planData.graceDays || 0),
      promiseToPayDate: planData.promiseToPayDate || "",
      installments: (planData.installments || []).map((item) => ({
        id: item.id, dueDate: item.dueDate, amount: Number(item.amount || 0).toFixed(2), skipped: Boolean(item.skipped), skipReason: item.skipReason || ""
      }))
    });
  }

  function renderPlanEditor() {
    elements.planScheduleBody.innerHTML = "";
    elements.planScheduleEmpty.hidden = editingPlanSchedule.length > 0;
    editingPlanSchedule.forEach((installment, index) => {
      const paid = editingPlanPaidMap.get(installment.id) || 0;
      const locked = paid >= Number(installment.amount || 0) - D.EPSILON && paid > D.EPSILON;
      const row = document.createElement("tr");
      row.dataset.installmentId = installment.id;
      row.dataset.originalDueDate = installment.originalDueDate || installment.dueDate;
      row.dataset.rescheduledAt = installment.rescheduledAt || "";
      row.innerHTML = `
        <td><strong>Payment ${index + 1}</strong>${locked ? '<span class="locked-label">Paid / locked</span>' : ""}</td>
        <td><input type="date" data-plan-field="dueDate" value="${D.escapeHtml(installment.dueDate)}" aria-label="Payment ${index + 1} due date" ${locked ? "disabled" : ""}></td>
        <td><div class="money-input"><span>$</span><input type="number" min="${Math.max(0.01, paid).toFixed(2)}" step="0.01" data-plan-field="amount" value="${Number(installment.amount || 0).toFixed(2)}" aria-label="Payment ${index + 1} amount" ${locked ? "disabled" : ""}></div></td>
        <td><div class="installment-editor-progress"><strong>${D.currency.format(paid)}</strong><span>paid</span></div></td>
        <td>
          <label class="skip-control"><input type="checkbox" data-plan-field="skipped" ${installment.skipped ? "checked" : ""} ${paid > D.EPSILON ? "disabled" : ""}> Skip</label>
          <input class="skip-reason" data-plan-field="skipReason" maxlength="160" placeholder="Reason required" value="${D.escapeHtml(installment.skipReason || "")}" ${installment.skipped ? "" : "hidden"} ${paid > D.EPSILON ? "disabled" : ""}>
        </td>
      `;
      elements.planScheduleBody.appendChild(row);
    });
    updatePlanEditorSummary();
  }

  function updatePlanEditorSummary() {
    if (elements.planScheduleBody.children.length) editingPlanSchedule = readPlanScheduleFromDom();
    const target = planTargetAmount();
    const total = editingPlanSchedule.filter((item) => !item.skipped).reduce((sum, installment) => sum + Number(installment.amount || 0), 0);
    const difference = Math.round((total - target) * 100) / 100;
    const opening = Number(document.getElementById("planOpeningCollected").value || 0);
    const skipped = editingPlanSchedule.filter((item) => item.skipped).length;
    elements.planTargetNote.textContent = `Schedule target: ${D.currency.format(target)} · Collected before plan: ${D.currency.format(opening)} · Grace: ${Number(document.getElementById("planGraceDays").value || 0)} days`;
    const balanced = Math.abs(difference) <= 0.01 && editingPlanSchedule.filter((item) => !item.skipped).length >= 2;
    elements.planScheduleSummary.className = `plan-total-row${balanced ? " balanced" : " unbalanced"}`;
    elements.planScheduleSummary.innerHTML = `<span>${editingPlanSchedule.length} rows${skipped ? ` · ${skipped} skipped` : ""}</span><span>Active schedule total: <strong>${D.currency.format(total)}</strong></span><span>${balanced ? "Balanced" : `Difference: ${D.currency.format(difference)}`}</span>`;
  }

  function lockedPlanInstallments() {
    return editingPlanSchedule.filter((installment) => (editingPlanPaidMap.get(installment.id) || 0) > D.EPSILON);
  }

  function buildPlanSchedule() {
    const requestedCount = Math.max(2, Math.min(24, Math.floor(Number(document.getElementById("planInstallmentCount").value || 4))));
    const firstDate = document.getElementById("planFirstDueDate").value || D.todayIso();
    const frequency = document.getElementById("planFrequency").value;
    if (!validOperationalDate(firstDate, "First due date")) return;
    if (!editingExistingPlan) {
      document.getElementById("planOpeningCollected").value = String(Math.max(0, Number(document.getElementById("patientCollected").value || 0)));
    }

    const locked = lockedPlanInstallments();
    const unlockedCount = Math.max(2, requestedCount - locked.length);
    const lockedTotal = locked.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const generatedTotal = Math.max(0, planTargetAmount() - lockedTotal);
    const generated = D.makePlanSchedule(generatedTotal, unlockedCount, firstDate, frequency);
    editingPlanSchedule = [...locked, ...generated].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    document.getElementById("patientDate").value = editingPlanSchedule.find((item) => !item.skipped)?.dueDate || firstDate;
    renderPlanEditor();
  }

  function rebalancePlanAmounts() {
    if (!editingPlanSchedule.length) return buildPlanSchedule();
    editingPlanSchedule = readPlanScheduleFromDom();
    const active = editingPlanSchedule.filter((item) => !item.skipped);
    const locked = active.filter((item) => (editingPlanPaidMap.get(item.id) || 0) >= Number(item.amount || 0) - D.EPSILON && (editingPlanPaidMap.get(item.id) || 0) > D.EPSILON);
    const unlocked = active.filter((item) => !locked.includes(item));
    if (!unlocked.length) return showToast("There are no unpaid installments to rebalance.", "error");
    const lockedTotal = locked.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const amounts = D.splitAmount(Math.max(0, planTargetAmount() - lockedTotal), unlocked.length);
    unlocked.forEach((item, index) => { item.amount = Math.max(editingPlanPaidMap.get(item.id) || 0, amounts[index]); });
    renderPlanEditor();
  }

  function redistributeRemaining() {
    if (!editingPlanSchedule.length) return buildPlanSchedule();
    editingPlanSchedule = readPlanScheduleFromDom();
    const active = editingPlanSchedule.filter((item) => !item.skipped);
    const fullyPaid = active.filter((item) => {
      const paid = editingPlanPaidMap.get(item.id) || 0;
      return paid >= Number(item.amount || 0) - D.EPSILON && paid > D.EPSILON;
    });
    const open = active.filter((item) => !fullyPaid.includes(item));
    if (!open.length) return showToast("There are no unpaid installments to redistribute.", "error");
    const fixedTotal = fullyPaid.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const paidInOpen = open.reduce((sum, item) => sum + (editingPlanPaidMap.get(item.id) || 0), 0);
    const remainingToSchedule = Math.max(0, planTargetAmount() - fixedTotal - paidInOpen);
    const shares = D.splitAmount(remainingToSchedule, open.length);
    open.forEach((item, index) => { item.amount = Math.round(((editingPlanPaidMap.get(item.id) || 0) + shares[index]) * 100) / 100; });
    renderPlanEditor();
    showToast("Remaining balance redistributed across unpaid installments.");
  }

  function shiftUnpaidDates() {
    if (!editingPlanSchedule.length) return showToast("Build a schedule first.", "error");
    const days = Number(document.getElementById("planShiftDays").value || 0);
    if (!Number.isInteger(days) || days === 0 || Math.abs(days) > 365) return showToast("Enter a whole-number shift between -365 and 365 days.", "error");
    editingPlanSchedule = readPlanScheduleFromDom().map((item) => {
      const paid = editingPlanPaidMap.get(item.id) || 0;
      if (item.skipped || paid >= item.amount - D.EPSILON) return item;
      return { ...item, dueDate: D.addDays(item.dueDate, days), rescheduledAt: D.todayIso() };
    });
    renderPlanEditor();
    showToast(`Unpaid installment dates shifted ${days > 0 ? "forward" : "back"} ${Math.abs(days)} days.`);
  }

  function toggleArrangementSection({ autoBuild = false } = {}) {
    const arrangement = document.getElementById("patientArrangement").value;
    const isPlan = arrangement === "Payment Plan";
    const noResponsibility = arrangement === "No Responsibility";
    elements.paymentPlanSection.hidden = !isPlan;
    document.getElementById("noResponsibilityReasonField").hidden = !noResponsibility;
    document.getElementById("noResponsibilityReason").required = noResponsibility;
    document.getElementById("collectionDateHint").textContent = isPlan
      ? "For payment plans, this is synchronized with the first active installment."
      : "Used for standard collection accounts.";
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
    document.getElementById("patientPhysician").value = patient?.physician || "";
    document.getElementById("patientLocation").value = patient?.location || "Jacksonville";
    document.getElementById("patientTreatment").value = patient?.treatment || "Proton Therapy";
    document.getElementById("patientInsurance").value = patient?.insurance || "";
    document.getElementById("patientResponsibility").value = patient?.responsibility ?? "";
    document.getElementById("patientCollected").value = patient ? D.netCollected(patient) : 0;
    document.getElementById("patientCollected").disabled = isEditing;
    document.getElementById("collectedHint").textContent = isEditing ? "Use Pay or the financial ledger to change collected dollars." : "Optional opening payment. Later changes use Pay.";
    document.getElementById("patientDate").value = patient?.collectionDate || D.todayIso();
    document.getElementById("patientArrangement").value = patient ? D.arrangementFromLegacy(patient) : "Standard Collection";
    document.getElementById("noResponsibilityReason").value = patient?.noResponsibilityReason || "";
    document.getElementById("patientNotes").value = patient?.notes || "";

    editingExistingPlan = Boolean(patient?.paymentPlan);
    const planSummary = patient?.paymentPlan ? D.planSummary(patient) : null;
    editingPlanPaidMap = new Map((planSummary?.installments || []).map((installment) => [installment.id, installment.paidAmount]));
    editingPlanSchedule = patient?.paymentPlan?.installments ? D.deepCopy(patient.paymentPlan.installments) : [];
    document.getElementById("planOpeningCollected").value = String(patient?.paymentPlan?.openingCollected ?? (patient ? D.netCollected(patient) : 0));
    document.getElementById("planInstallmentCount").value = String(editingPlanSchedule.length || 4);
    document.getElementById("planFirstDueDate").value = editingPlanSchedule.find((item) => !item.skipped)?.dueDate || patient?.collectionDate || D.todayIso();
    document.getElementById("planFrequency").value = "monthly";
    document.getElementById("planGraceDays").value = String(patient?.paymentPlan?.graceDays || 0);
    document.getElementById("planPromiseDate").value = patient?.paymentPlan?.promiseToPayDate || "";
    document.getElementById("planShiftDays").value = "30";
    document.getElementById("planChangeReason").value = "";
    document.getElementById("planChangeReasonField").hidden = !editingExistingPlan;
    originalPlanSnapshot = patient?.paymentPlan ? planSnapshot(patient.paymentPlan) : "";
    renderPlanEditor();
    toggleArrangementSection();

    elements.patientDialog.showModal();
    document.getElementById("patientName").focus();
  }

  // Payment, outcome, adjustment, and transaction dialogs ------------------
  function openPaymentDialog(patient) {
    const balance = D.amountOwed(patient);
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
    if (plan?.nextDue) {
      context.hidden = false;
      context.innerHTML = `<span class="status-pill plan">Payment Plan</span><div><strong>Next scheduled payment:</strong> Payment ${plan.nextDue.number} of ${plan.totalCount}, ${D.currency.format(plan.nextDue.remaining)} due ${D.formatDate(plan.nextDue.dueDate)} (${D.escapeHtml(dateRelativeText(plan.nextDue.dueDate))}).</div>`;
      document.getElementById("paymentAmount").value = Math.min(balance, plan.nextDue.remaining).toFixed(2);
    } else {
      context.hidden = true;
      context.innerHTML = "";
    }
    elements.paymentDialog.showModal();
    document.getElementById("paymentAmount").focus();
  }

  function openOutcomeDialog(patient) {
    document.getElementById("outcomePatientId").value = patient.id;
    document.getElementById("outcomePatientLabel").textContent = `${patient.name} · ${patient.mrn}`;
    document.getElementById("outcomeType").value = "Follow-up Required";
    document.getElementById("outcomeDate").value = D.todayIso();
    document.getElementById("outcomeLocation").value = patient.location;
    document.getElementById("outcomeFollowUpDate").value = "";
    document.getElementById("outcomePromiseDate").value = "";
    document.getElementById("outcomeNote").value = "";
    elements.outcomeDialog.showModal();
    document.getElementById("outcomeType").focus();
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

  function outcomesHtml(patient) {
    const outcomes = (patient.outcomes || []).slice().sort((a, b) => `${b.date}|${b.createdAt}`.localeCompare(`${a.date}|${a.createdAt}`));
    if (!outcomes.length) return '<div class="notes-box">No collection outcomes have been recorded.</div>';
    return `<div class="outcome-list">${outcomes.map((outcome) => `
      <article class="outcome-item">
        <div><strong>${D.escapeHtml(outcome.outcome)}</strong><span>${D.formatDate(outcome.date)} · ${D.escapeHtml(outcome.location)}</span></div>
        <p>${D.escapeHtml(outcome.note || "No note entered.")}</p>
        <div class="outcome-meta">
          ${outcome.followUpDate ? `<span class="status-pill ${outcome.followUpCompleted ? "paid" : outcome.followUpDate <= D.todayIso() ? "overdue" : "ready"} compact">Follow-up ${D.formatDate(outcome.followUpDate)}${outcome.followUpCompleted ? " · Complete" : ""}</span>` : ""}
          ${outcome.promiseToPayDate ? `<span class="status-pill promise compact">Promise ${D.formatDate(outcome.promiseToPayDate)}</span>` : ""}
          ${outcome.followUpDate && !outcome.followUpCompleted ? `<button class="btn btn-ghost btn-small" type="button" data-detail-action="followup-complete" data-outcome-id="${D.escapeHtml(outcome.id)}">Mark Follow-up Complete</button>` : ""}
        </div>
      </article>`).join("")}</div>`;
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
      <div class="detail-section">
        <div class="detail-section-heading"><div><h3>Payment Plan Performance</h3><p>Payments are allocated to the oldest unpaid installment first. Grace-period days count toward on-time performance.</p></div>${statusPillsHtml(patient)}</div>
        <div class="details-summary plan-summary-cards">
          <div class="mini-card"><span>Installments paid</span><strong>${summary.completedCount} of ${summary.totalCount}</strong></div>
          <div class="mini-card"><span>Plan progress</span><strong>${summary.progressPercent.toFixed(1)}%</strong></div>
          <div class="mini-card"><span>On-time rate</span><strong>${onTimeText}</strong></div>
          <div class="mini-card"><span>Past due</span><strong>${D.currency.format(summary.overdueAmount)}</strong></div>
          <div class="mini-card"><span>Grace period</span><strong>${summary.graceDays} days</strong></div>
          <div class="mini-card"><span>Renegotiations</span><strong>${summary.renegotiationCount}</strong></div>
        </div>
        ${summary.promiseToPayDate ? `<div class="plan-promise-callout"><strong>Promise to pay:</strong> ${D.formatDate(summary.promiseToPayDate)}</div>` : ""}
        ${summary.repeatedMisses ? '<div class="plan-risk-callout"><strong>Repeated missed installments:</strong> two or more installments are currently overdue.</div>' : ""}
        <div class="plan-detail-progress"><div class="progress-track"><div class="progress-fill plan-fill" style="width:${summary.progressPercent.toFixed(2)}%"></div></div></div>
        <div class="history-wrap"><table class="history-table plan-history-table"><thead><tr><th>Payment</th><th>Due date</th><th>Scheduled</th><th>Paid</th><th>Remaining</th><th>Days late</th><th>Status</th></tr></thead><tbody>${summary.installments.map((installment) => {
          const mappedStatus = installment.status === "Upcoming" ? "Upcoming Collection" : installment.status;
          const meta = D.statusMeta(mappedStatus);
          return `<tr><td><strong>${installment.number}</strong></td><td>${D.formatDate(installment.dueDate)}</td><td>${D.currency.format(installment.amount)}</td><td>${D.currency.format(installment.paidAmount)}</td><td>${D.currency.format(installment.remaining)}</td><td>${installment.daysLate || "-"}</td><td><span class="status-pill ${meta.pill} compact">${D.escapeHtml(installment.status)}${installment.status === "Paid" && installment.onTime ? " · On time" : ""}</span>${installment.skipReason ? `<div class="cell-secondary">${D.escapeHtml(installment.skipReason)}</div>` : ""}</td></tr>`;
        }).join("")}</tbody></table></div>
      </div>`;
  }

  async function openDetailsDialog(patient, focus = "overview") {
    detailsPatientId = patient.id;
    detailsFocus = focus;
    const status = D.effectiveStatus(patient);
    const owed = D.amountOwed(patient);
    const followUp = D.currentFollowUp(patient);
    document.getElementById("detailsTitle").textContent = patient.name;
    document.getElementById("detailsSubtitle").textContent = `${patient.mrn} · ${status}`;
    document.getElementById("detailsBody").innerHTML = `
      <div class="details-summary four-up">
        <div class="mini-card"><span>Responsibility</span><strong>${D.currency.format(patient.responsibility)}</strong></div>
        <div class="mini-card"><span>Net collected</span><strong>${D.currency.format(D.netCollected(patient))}</strong></div>
        <div class="mini-card"><span>Adjustments</span><strong>${D.currency.format(D.adjustmentTotal(patient))}</strong></div>
        <div class="mini-card"><span>Still owed</span><strong>${D.currency.format(owed)}</strong></div>
      </div>
      <div class="detail-section">
        <h3>Account Overview</h3>
        <div class="detail-grid">
          <div class="detail-item"><span>Status</span><strong>${statusPillsHtml(patient)}</strong></div>
          <div class="detail-item"><span>Arrangement</span><strong>${D.escapeHtml(D.arrangementFromLegacy(patient))}</strong></div>
          <div class="detail-item"><span>Next due / collection date</span><strong>${D.formatDate(D.nextActionDate(patient))} (${D.escapeHtml(dateRelativeText(D.nextActionDate(patient)))})</strong></div>
          <div class="detail-item"><span>Physician</span><strong>${D.escapeHtml(patient.physician)}</strong></div>
          <div class="detail-item"><span>Treatment type</span><strong>${D.escapeHtml(patient.treatment)}</strong></div>
          <div class="detail-item"><span>Treatment site</span><strong>${D.escapeHtml(patient.location)}</strong></div>
          <div class="detail-item"><span>Insurance</span><strong>${D.escapeHtml(patient.insurance)}</strong></div>
          <div class="detail-item"><span>Open follow-up</span><strong>${followUp ? `${D.formatDate(followUp.followUpDate)} · ${D.escapeHtml(followUp.outcome)}` : "None"}</strong></div>
          <div class="detail-item"><span>Account created</span><strong>${D.escapeHtml(D.formatDateTime(patient.createdAt))}</strong></div>
          <div class="detail-item"><span>Last updated</span><strong>${D.escapeHtml(D.formatDateTime(patient.updatedAt || patient.createdAt))}</strong></div>
        </div>
      </div>
      ${planDetailsHtml(patient)}
      <div class="detail-section"><h3>Finance Note</h3><div class="notes-box">${D.escapeHtml(patient.notes || "No finance note entered.")}</div>${patient.noResponsibilityReason ? `<div class="notes-box"><strong>No-responsibility reason:</strong> ${D.escapeHtml(patient.noResponsibilityReason)}</div>` : ""}</div>
      <div class="detail-section" id="outcomesSection"><div class="detail-section-heading"><div><h3>Collection Outcomes</h3><p>Attempts, disputes, promises, and follow-up dates. Use the Outcome button in the patient row to add a new entry.</p></div></div>${outcomesHtml(patient)}</div>
      <div class="detail-section"><div class="detail-section-heading"><div><h3>Payment Ledger</h3><p>Corrections create new reversal/refund entries; original transactions remain visible.</p></div></div>${paymentHistoryHtml(patient)}</div>
      <div class="detail-section"><div class="detail-section-heading"><div><h3>Adjustments</h3><p>Adjustments reduce the amount owed without increasing collected dollars.</p></div><button class="btn btn-secondary btn-small" type="button" data-detail-action="add-adjustment">Add Adjustment</button></div>${adjustmentHistoryHtml(patient)}</div>
      <div class="detail-section activity-section" id="activityTimelineSection"><div class="detail-section-heading"><div><h3>Activity Timeline</h3><p>Chronological history of account, payment, plan, outcome, document, and completion activity.</p></div></div>${activityTimelineHtml(patient)}</div>
    `;

    document.getElementById("detailsPaymentButton").hidden = owed <= D.EPSILON;
    document.getElementById("detailsCompleteButton").hidden = !(owed <= D.EPSILON || status === "No Responsibility");
    document.getElementById("detailsDocumentsButton").textContent = "Documents";
    if (Docs) {
      try {
        const count = await Docs.count(patient.id);
        document.getElementById("detailsDocumentsButton").textContent = count ? `Documents (${count})` : "Documents";
      } catch (error) { console.warn(error); }
    }
    elements.detailsDialog.showModal();
    if (focus === "timeline") requestAnimationFrame(() => document.getElementById("activityTimelineSection")?.scrollIntoView({ block: "start" }));
    if (focus === "outcomes") requestAnimationFrame(() => document.getElementById("outcomesSection")?.scrollIntoView({ block: "start" }));
  }

  function completePatient(patient) {
    const status = D.effectiveStatus(patient);
    if (D.amountOwed(patient) > D.EPSILON && status !== "No Responsibility") return showToast("This account still has a balance and cannot be completed.", "error");
    if (status === "No Responsibility" && !patient.noResponsibilityReason) return showToast("Enter a no-responsibility reason before completing the account.", "error");
    patient.archived = true;
    patient.completedAt = D.todayIso();
    D.addActivity(patient, { type: "completion", title: "Account completed and archived", detail: "Moved from the active work queue to Completed Patients.", date: D.todayIso() });
    D.savePatients(patients);
    if (elements.detailsDialog.open) elements.detailsDialog.close();
    render();
    showToast(`${patient.name} moved to Completed Patients.`);
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
    if (arrangement !== "Payment Plan" && !validOperationalDate(collectionDateInput, "Collection date")) return;
    const noResponsibilityReason = document.getElementById("noResponsibilityReason").value.trim();
    if (arrangement === "No Responsibility" && !noResponsibilityReason) return showToast("A reason is required for No Patient Responsibility.", "error");

    let paymentPlan = null;
    let collectionDate = collectionDateInput;
    let planChanged = false;
    if (arrangement === "Payment Plan") {
      editingPlanSchedule = readPlanScheduleFromDom();
      const planOpeningCollected = Number(document.getElementById("planOpeningCollected").value || 0);
      const activeSchedule = editingPlanSchedule.filter((item) => !item.skipped);
      const scheduleTotal = activeSchedule.reduce((sum, installment) => sum + Number(installment.amount || 0), 0);
      const target = planTargetAmount();
      const invalidInstallment = editingPlanSchedule.some((installment) => {
        if (installment.skipped) return !installment.skipReason;
        const paid = editingPlanPaidMap.get(installment.id) || 0;
        return !installment.dueDate || !Number.isFinite(installment.amount) || installment.amount <= 0 || installment.amount + D.EPSILON < paid || !validOperationalDate(installment.dueDate, "Installment due date", false);
      });
      if (editingPlanSchedule.length < 2 || activeSchedule.length < 2 || invalidInstallment) return showToast("The payment plan needs at least two active valid installments. Skipped installments require a reason.", "error");
      if (Math.abs(scheduleTotal - target) > 0.01) return showToast(`The active payment plan must total ${D.currency.format(target)}. Use Rebalance All or Redistribute Unpaid.`, "error");

      paymentPlan = {
        createdDate: existing?.paymentPlan?.createdDate || D.todayIso(),
        openingCollected: planOpeningCollected,
        graceDays: Math.max(0, Math.min(30, Math.floor(Number(document.getElementById("planGraceDays").value || 0)))),
        promiseToPayDate: document.getElementById("planPromiseDate").value,
        renegotiationCount: existing?.paymentPlan?.renegotiationCount || 0,
        history: D.deepCopy(existing?.paymentPlan?.history || []),
        installments: editingPlanSchedule.sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      };
      collectionDate = paymentPlan.installments.find((item) => !item.skipped)?.dueDate || collectionDateInput;
      planChanged = Boolean(existing?.paymentPlan && planSnapshot(paymentPlan) !== originalPlanSnapshot);
      if (planChanged) {
        const reason = document.getElementById("planChangeReason").value.trim();
        if (!reason) return showToast("Enter a reason for changing the existing payment plan.", "error");
        paymentPlan.renegotiationCount += 1;
        paymentPlan.history.push({ id: D.uid("plan-history"), date: D.todayIso(), reason, detail: `${paymentPlan.installments.length} schedule rows; ${paymentPlan.graceDays}-day grace period.`, createdAt: new Date().toISOString() });
      }
    }

    const record = {
      id: id || D.uid("patient"),
      name: document.getElementById("patientName").value.trim(),
      mrn: document.getElementById("patientMrn").value.trim().toUpperCase(),
      physician: document.getElementById("patientPhysician").value.trim(),
      location: document.getElementById("patientLocation").value,
      treatment: document.getElementById("patientTreatment").value,
      insurance: document.getElementById("patientInsurance").value.trim(),
      responsibility,
      collected: existing ? D.netCollected(existing) : 0,
      collectionDate,
      status: arrangement,
      arrangement,
      noResponsibilityReason,
      notes: document.getElementById("patientNotes").value.trim(),
      archived: existing ? existing.archived : false,
      completedAt: existing ? existing.completedAt : "",
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: existing?.updatedAt || new Date().toISOString(),
      paymentPlan,
      payments: existing ? D.deepCopy(existing.payments || []) : [],
      adjustments: existing ? D.deepCopy(existing.adjustments || []) : [],
      outcomes: existing ? D.deepCopy(existing.outcomes || []) : [],
      activity: existing ? D.deepCopy(existing.activity || []) : []
    };

    if (!record.name || !record.mrn || !record.physician || !record.insurance || !record.collectionDate) return showToast("Complete all required fields.", "error");
    if (patients.some((patient) => patient.mrn.toLowerCase() === record.mrn.toLowerCase() && patient.id !== record.id)) return showToast("That MRN already exists in the prototype.", "error");

    if (existing && Math.abs(Number(existing.responsibility || 0) - responsibility) > D.EPSILON && (existing.payments || []).length) {
      if (!window.confirm("This account already has payment history. Confirm the patient responsibility change.")) return;
    }
    if (existing?.paymentPlan && arrangement !== "Payment Plan" && D.planPaymentEvents(existing).some((payment) => D.transactionEffect(payment) > 0)) {
      if (!window.confirm("This patient has payment-plan transactions. Remove the active plan schedule and keep the transaction history?")) return;
    }

    if (!existing) {
      D.addActivity(record, { type: "account", title: "Patient account created", detail: `${arrangement} account with ${D.currency.format(responsibility)} responsibility.`, date: D.todayIso() });
      if (openingCollected > D.EPSILON) D.addPaymentTransaction(record, { type: "Payment", amount: openingCollected, date: collectionDate, location: record.location, method: "Previously Collected", note: "Opening payment entered with the patient record.", appliesToPlan: false });
    } else {
      const changes = [];
      ["name", "mrn", "physician", "location", "treatment", "insurance", "collectionDate", "notes"].forEach((key) => {
        if (String(existing[key] || "") !== String(record[key] || "")) changes.push(key);
      });
      if (Math.abs(existing.responsibility - record.responsibility) > D.EPSILON) changes.push("responsibility");
      if (D.arrangementFromLegacy(existing) !== arrangement) changes.push("arrangement");
      if (changes.length) D.addActivity(record, { type: "account", title: "Account details updated", detail: `Changed: ${changes.join(", ")}.`, date: D.todayIso() });
      if (planChanged) D.addActivity(record, { type: "plan", title: "Payment plan renegotiated", detail: document.getElementById("planChangeReason").value.trim(), date: D.todayIso() });
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
    const balance = D.amountOwed(patient);
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

  document.getElementById("outcomeForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const patient = findPatient(document.getElementById("outcomePatientId").value);
    if (!patient) return;
    const date = document.getElementById("outcomeDate").value;
    const followUpDate = document.getElementById("outcomeFollowUpDate").value;
    const promiseToPayDate = document.getElementById("outcomePromiseDate").value;
    if (!validOperationalDate(date, "Outcome date")) return;
    if (followUpDate && (!validOperationalDate(followUpDate, "Follow-up date") || followUpDate < date)) return showToast("Follow-up date cannot be before the outcome date.", "error");
    if (promiseToPayDate && (!validOperationalDate(promiseToPayDate, "Promise-to-pay date") || promiseToPayDate < date)) return showToast("Promise-to-pay date cannot be before the outcome date.", "error");
    const note = document.getElementById("outcomeNote").value.trim();
    if (!note) return showToast("Enter an outcome note.", "error");
    D.addOutcome(patient, {
      outcome: document.getElementById("outcomeType").value, date,
      location: document.getElementById("outcomeLocation").value,
      followUpDate, promiseToPayDate, note
    });
    D.savePatients(patients);
    elements.outcomeDialog.close();
    render();
    if (elements.detailsDialog.open) openDetailsDialog(patient, "outcomes");
    showToast(`Collection outcome recorded for ${patient.name}.`);
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
    if (button.dataset.action === "outcome") openOutcomeDialog(patient);
    if (button.dataset.action === "edit") openPatientDialog(patient);
    if (button.dataset.action === "adjustment") openAdjustmentDialog(patient);
    if (button.dataset.action === "complete") completePatient(patient);
    if (button.dataset.action === "documents" && Docs) Docs.open(patient);
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
    if (button.dataset.detailAction === "followup-complete") {
      const outcome = (patient.outcomes || []).find((item) => item.id === button.dataset.outcomeId);
      if (!outcome) return;
      outcome.followUpCompleted = true;
      D.addActivity(patient, { type: "outcome", title: "Follow-up completed", detail: `${outcome.outcome} follow-up marked complete.`, date: D.todayIso() });
      D.savePatients(patients);
      render();
      openDetailsDialog(patient, "outcomes");
      showToast("Follow-up marked complete.");
    }
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
    if (patient) completePatient(patient);
  });
  document.getElementById("detailsDocumentsButton").addEventListener("click", () => {
    const patient = findPatient(detailsPatientId);
    if (patient && Docs) Docs.open(patient);
  });

  document.getElementById("addPatientButton").addEventListener("click", () => openPatientDialog());
  document.getElementById("patientArrangement").addEventListener("change", () => toggleArrangementSection({ autoBuild: true }));
  document.getElementById("buildPlanButton").addEventListener("click", buildPlanSchedule);
  document.getElementById("rebalancePlanButton").addEventListener("click", rebalancePlanAmounts);
  document.getElementById("redistributeRemainingButton").addEventListener("click", redistributeRemaining);
  document.getElementById("shiftPlanButton").addEventListener("click", shiftUnpaidDates);
  elements.planScheduleBody.addEventListener("input", (event) => {
    if (event.target.matches("input[data-plan-field='skipped']")) {
      const row = event.target.closest("tr");
      const reason = row.querySelector("input[data-plan-field='skipReason']");
      reason.hidden = !event.target.checked;
      if (!event.target.checked) reason.value = "";
      editingPlanSchedule = readPlanScheduleFromDom();
      if (event.target.checked) redistributeRemaining();
      return;
    }
    updatePlanEditorSummary();
  });
  ["patientResponsibility", "planGraceDays"].forEach((id) => document.getElementById(id).addEventListener("input", updatePlanEditorSummary));
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
  document.querySelectorAll("dialog").forEach((dialog) => dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); }));

  [elements.search, elements.statusFilter, elements.locationFilter, elements.physicianFilter, elements.treatmentFilter]
    .forEach((control) => control.addEventListener("input", () => { quickFilter = ""; render(); }));
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
    elements.search.value = ""; elements.statusFilter.value = "all"; elements.locationFilter.value = "all"; elements.physicianFilter.value = "all"; elements.treatmentFilter.value = "all"; quickFilter = ""; render();
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
    const headers = ["Status", "Payment Attention", "Patient Name", "MRN", "Physician", "Treatment Site", "Treatment Type", "Insurance", "Responsibility", "Net Collected", "Adjustments", "Amount Owed", "Next Due Date", "Plan Payments", "Plan Payments Completed", "Plan On-Time Rate", "Latest Outcome", "Follow-up Date", "Account Created", "Last Updated"];
    const rows = visiblePatients.map((patient) => {
      const plan = D.planSummary(patient);
      const latest = D.latestOutcome(patient);
      const followUp = D.currentFollowUp(patient);
      return [D.effectiveStatus(patient), D.attentionStatus(patient), patient.name, patient.mrn, patient.physician, patient.location, patient.treatment, patient.insurance, patient.responsibility, D.netCollected(patient), D.adjustmentTotal(patient), D.amountOwed(patient), D.nextActionDate(patient), plan?.totalCount || 0, plan?.completedCount || 0, plan?.onTimeRate === null || !plan ? "" : `${plan.onTimeRate.toFixed(1)}%`, latest?.outcome || "", followUp?.followUpDate || "", patient.createdAt || "", patient.updatedAt || ""];
    });
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `ackerman-active-current-view-${D.todayIso()}.csv`; link.click(); URL.revokeObjectURL(url);
    showToast(`${rows.length} visible ${rows.length === 1 ? "record" : "records"} exported.`);
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
