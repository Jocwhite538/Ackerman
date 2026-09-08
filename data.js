(function () {
  "use strict";

  const STORAGE_KEY = "ackermanPaymentPrototypeV4";
  const LEGACY_STORAGE_KEYS = ["ackermanPaymentPrototypeV3", "ackermanPaymentPrototypeV2", "ackermanPaymentPrototypeV1"];
  const SAVED_VIEWS_KEY = "ackermanPaymentSavedViewsV4";
  const EPSILON = 0.005;

  const currency = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  });

  function toIsoLocal(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function todayIso() {
    return toIsoLocal(new Date());
  }

  function parseIsoDate(isoDate) {
    const parts = String(isoDate || "").split("-").map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
    return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0);
  }

  function dateOffset(days) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + days);
    return toIsoLocal(date);
  }

  function addDays(isoDate, days) {
    const date = parseIsoDate(isoDate) || new Date();
    date.setDate(date.getDate() + Number(days || 0));
    return toIsoLocal(date);
  }

  function addMonths(isoDate, months) {
    const source = parseIsoDate(isoDate) || new Date();
    const originalDay = source.getDate();
    source.setDate(1);
    source.setMonth(source.getMonth() + Number(months || 0));
    const lastDay = new Date(source.getFullYear(), source.getMonth() + 1, 0).getDate();
    source.setDate(Math.min(originalDay, lastDay));
    return toIsoLocal(source);
  }

  function daysBetween(fromIso, toIso) {
    const from = parseIsoDate(fromIso);
    const to = parseIsoDate(toIso);
    if (!from || !to) return 0;
    return Math.round((to - from) / 86400000);
  }

  function deepCopy(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function uid(prefix = "patient") {
    const random = window.crypto && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `${prefix}-${random}`;
  }

  function splitAmount(total, count) {
    const safeCount = Math.max(1, Math.floor(Number(count || 1)));
    const cents = Math.max(0, Math.round(Number(total || 0) * 100));
    const base = Math.floor(cents / safeCount);
    let remainder = cents - (base * safeCount);
    return Array.from({ length: safeCount }, () => {
      const amount = base + (remainder > 0 ? 1 : 0);
      remainder = Math.max(0, remainder - 1);
      return amount / 100;
    });
  }

  function scheduleDate(firstDate, index, frequency) {
    if (frequency === "weekly") return addDays(firstDate, index * 7);
    if (frequency === "biweekly") return addDays(firstDate, index * 14);
    if (frequency === "quarterly") return addMonths(firstDate, index * 3);
    return addMonths(firstDate, index);
  }

  function makePlanSchedule(total, count, firstDate, frequency = "monthly") {
    const amounts = splitAmount(total, count);
    const start = firstDate || todayIso();
    return amounts.map((amount, index) => {
      const dueDate = scheduleDate(start, index, frequency);
      return {
        id: uid("installment"),
        dueDate,
        originalDueDate: dueDate,
        amount,
        skipped: false,
        skipReason: "",
        rescheduledAt: ""
      };
    });
  }

  function planRecord(total, count, firstDate, frequency, openingCollected = 0, createdDate = todayIso()) {
    return {
      createdDate,
      openingCollected: Math.max(0, Number(openingCollected || 0)),
      graceDays: 0,
      promiseToPayDate: "",
      renegotiationCount: 0,
      history: [],
      installments: makePlanSchedule(total, count, firstDate, frequency)
    };
  }

  function seedPatients() {
    const sofiaPlan = planRecord(300, 3, dateOffset(-30), "monthly", 0, dateOffset(-35));
    sofiaPlan.installments[0].dueDate = dateOffset(-30);
    sofiaPlan.installments[1].dueDate = dateOffset(0);
    sofiaPlan.installments[2].dueDate = dateOffset(30);
    const masonPlan = planRecord(900, 6, dateOffset(-60), "monthly", 0, dateOffset(-70));
    const benPlan = planRecord(2000, 10, dateOffset(-120), "monthly", 0, dateOffset(-130));
    const chloePlan = planRecord(600, 4, dateOffset(10), "monthly", 0, dateOffset(-2));
    const jamesPlan = planRecord(1100, 5, dateOffset(-150), "monthly", 0, dateOffset(-160));

    return [
      {
        id: "demo-1001",
        name: "Ava Mercer",
        mrn: "DEMO-1001",
        physician: "Dr. Jordan Lee",
        location: "Jacksonville",
        treatment: "Proton Therapy",
        insurance: "Fictional Health Plan",
        responsibility: 850,
        collected: 250,
        collectionDate: dateOffset(-5),
        status: "Partially Paid",
        notes: "Fictional sample record. Patient plans to pay the balance at the next visit.",
        archived: false,
        completedAt: "",
        paymentPlan: null,
        payments: [
          { id: uid("payment"), amount: 150, date: dateOffset(-45), location: "Jacksonville", method: "Credit/Debit Card", note: "First fictional payment.", appliesToPlan: false },
          { id: uid("payment"), amount: 100, date: dateOffset(-4), location: "Jacksonville", method: "Credit/Debit Card", note: "Second fictional payment.", appliesToPlan: false }
        ]
      },
      {
        id: "demo-1002",
        name: "Liam Brooks",
        mrn: "DEMO-1002",
        physician: "Dr. Morgan Ellis",
        location: "Orange Park",
        treatment: "Radiation Therapy",
        insurance: "Example Choice Insurance",
        responsibility: 420,
        collected: 0,
        collectionDate: dateOffset(0),
        status: "Ready for Collection",
        notes: "Collect at today's fictional visit.",
        archived: false,
        completedAt: "",
        paymentPlan: null,
        payments: []
      },
      {
        id: "demo-1003",
        name: "Sofia Patel",
        mrn: "DEMO-1003",
        physician: "Dr. Taylor Reed",
        location: "St. Augustine",
        treatment: "Imaging",
        insurance: "SampleCare PPO",
        responsibility: 300,
        collected: 100,
        collectionDate: sofiaPlan.installments[0].dueDate,
        status: "Payment Plan",
        notes: "Three-payment fictional plan. The second installment is due today.",
        archived: false,
        completedAt: "",
        paymentPlan: sofiaPlan,
        payments: [
          { id: uid("payment"), amount: 100, date: dateOffset(-31), location: "St. Augustine", method: "Check", note: "First installment paid early.", appliesToPlan: true }
        ]
      },
      {
        id: "demo-1004",
        name: "Noah Bennett",
        mrn: "DEMO-1004",
        physician: "Dr. Casey Monroe",
        location: "Amelia Island",
        treatment: "Consultation",
        insurance: "Demo Mutual",
        responsibility: 175,
        collected: 175,
        collectionDate: dateOffset(-10),
        status: "Paid in Full",
        notes: "Ready to move to Completed.",
        archived: false,
        completedAt: "",
        paymentPlan: null,
        payments: [
          { id: uid("payment"), amount: 175, date: dateOffset(-7), location: "Amelia Island", method: "Online Portal", note: "Paid in full.", appliesToPlan: false }
        ]
      },
      {
        id: "demo-1005",
        name: "Mia Thompson",
        mrn: "DEMO-1005",
        physician: "Dr. Jordan Lee",
        location: "Jacksonville",
        treatment: "Proton Therapy",
        insurance: "Fictional Health Plan",
        responsibility: 0,
        collected: 0,
        collectionDate: dateOffset(8),
        status: "No Responsibility",
        notes: "Fictional no-responsibility example.",
        archived: false,
        completedAt: "",
        paymentPlan: null,
        payments: []
      },
      {
        id: "demo-1006",
        name: "Ethan Rivera",
        mrn: "DEMO-1006",
        physician: "Dr. Morgan Ellis",
        location: "Orange Park",
        treatment: "Radiation Therapy",
        insurance: "Example Choice Insurance",
        responsibility: 1200,
        collected: 0,
        collectionDate: dateOffset(-18),
        status: "Ready for Collection",
        notes: "Past fictional collection date.",
        archived: false,
        completedAt: "",
        paymentPlan: null,
        payments: []
      },
      {
        id: "demo-1007",
        name: "Olivia Chen",
        mrn: "DEMO-1007",
        physician: "Dr. Casey Monroe",
        location: "Amelia Island",
        treatment: "Imaging",
        insurance: "SampleCare PPO",
        responsibility: 680,
        collected: 340,
        collectionDate: dateOffset(7),
        status: "Partially Paid",
        notes: "Fictional partial-payment example.",
        archived: false,
        completedAt: "",
        paymentPlan: null,
        payments: [
          { id: uid("payment"), amount: 200, date: dateOffset(-75), location: "Amelia Island", method: "Online Portal", note: "Initial payment.", appliesToPlan: false },
          { id: uid("payment"), amount: 140, date: dateOffset(-2), location: "Amelia Island", method: "Credit/Debit Card", note: "Second payment.", appliesToPlan: false }
        ]
      },
      {
        id: "demo-1008",
        name: "Mason Clark",
        mrn: "DEMO-1008",
        physician: "Dr. Taylor Reed",
        location: "St. Augustine",
        treatment: "Proton Therapy",
        insurance: "Demo Mutual",
        responsibility: 900,
        collected: 150,
        collectionDate: masonPlan.installments[0].dueDate,
        status: "Payment Plan",
        notes: "Six fictional monthly installments. One installment is overdue.",
        archived: false,
        completedAt: "",
        paymentPlan: masonPlan,
        payments: [
          { id: uid("payment"), amount: 150, date: dateOffset(-62), location: "St. Augustine", method: "Check", note: "First installment paid early.", appliesToPlan: true }
        ]
      },
      {
        id: "demo-1009",
        name: "Harper Wilson",
        mrn: "DEMO-1009",
        physician: "Dr. Jordan Lee",
        location: "Jacksonville",
        treatment: "Radiation Therapy",
        insurance: "Fictional Health Plan",
        responsibility: 550,
        collected: 550,
        collectionDate: dateOffset(-125),
        status: "Paid in Full",
        notes: "Completed fictional account.",
        archived: true,
        completedAt: dateOffset(-25),
        paymentPlan: null,
        payments: [
          { id: uid("payment"), amount: 200, date: dateOffset(-120), location: "Jacksonville", method: "Credit/Debit Card", note: "Payment one.", appliesToPlan: false },
          { id: uid("payment"), amount: 200, date: dateOffset(-60), location: "Jacksonville", method: "Credit/Debit Card", note: "Payment two.", appliesToPlan: false },
          { id: uid("payment"), amount: 150, date: dateOffset(-25), location: "Jacksonville", method: "Check", note: "Final payment.", appliesToPlan: false }
        ]
      },
      {
        id: "demo-1010",
        name: "Lucas Martin",
        mrn: "DEMO-1010",
        physician: "Dr. Morgan Ellis",
        location: "Orange Park",
        treatment: "Consultation",
        insurance: "Example Choice Insurance",
        responsibility: 760,
        collected: 200,
        collectionDate: dateOffset(-30),
        status: "Partially Paid",
        notes: "Follow-up is needed for the fictional remaining balance.",
        archived: false,
        completedAt: "",
        paymentPlan: null,
        payments: [
          { id: uid("payment"), amount: 200, date: dateOffset(-50), location: "Orange Park", method: "Cash", note: "Partial payment.", appliesToPlan: false }
        ]
      },
      {
        id: "demo-1011",
        name: "Emma Davis",
        mrn: "DEMO-1011",
        physician: "Dr. Casey Monroe",
        location: "Amelia Island",
        treatment: "Radiation Therapy",
        insurance: "Demo Mutual",
        responsibility: 390,
        collected: 0,
        collectionDate: dateOffset(15),
        status: "Ready for Collection",
        notes: "Fictional future collection request.",
        archived: false,
        completedAt: "",
        paymentPlan: null,
        payments: []
      },
      {
        id: "demo-1012",
        name: "James King",
        mrn: "DEMO-1012",
        physician: "Dr. Taylor Reed",
        location: "St. Augustine",
        treatment: "Proton Therapy",
        insurance: "SampleCare PPO",
        responsibility: 1100,
        collected: 1100,
        collectionDate: jamesPlan.installments[0].dueDate,
        status: "Paid in Full",
        notes: "Completed fictional payment plan.",
        archived: true,
        completedAt: dateOffset(-25),
        paymentPlan: jamesPlan,
        payments: [
          { id: uid("payment"), amount: 220, date: dateOffset(-152), location: "St. Augustine", method: "Online Portal", note: "Installment 1.", appliesToPlan: true },
          { id: uid("payment"), amount: 220, date: dateOffset(-121), location: "St. Augustine", method: "Credit/Debit Card", note: "Installment 2.", appliesToPlan: true },
          { id: uid("payment"), amount: 220, date: dateOffset(-90), location: "St. Augustine", method: "Online Portal", note: "Installment 3.", appliesToPlan: true },
          { id: uid("payment"), amount: 220, date: dateOffset(-60), location: "St. Augustine", method: "Credit/Debit Card", note: "Installment 4.", appliesToPlan: true },
          { id: uid("payment"), amount: 220, date: dateOffset(-25), location: "St. Augustine", method: "Online Portal", note: "Final installment paid late.", appliesToPlan: true }
        ]
      },
      {
        id: "demo-1013",
        name: "Zoe Ramirez",
        mrn: "DEMO-1013",
        physician: "Dr. Jordan Lee",
        location: "Jacksonville",
        treatment: "Imaging",
        insurance: "Example Choice Insurance",
        responsibility: 250,
        collected: 0,
        collectionDate: dateOffset(-1),
        status: "Ready for Collection",
        notes: "Fictional account became overdue yesterday.",
        archived: false,
        completedAt: "",
        paymentPlan: null,
        payments: []
      },
      {
        id: "demo-1014",
        name: "Benjamin Scott",
        mrn: "DEMO-1014",
        physician: "Dr. Morgan Ellis",
        location: "Orange Park",
        treatment: "Proton Therapy",
        insurance: "Fictional Health Plan",
        responsibility: 2000,
        collected: 600,
        collectionDate: benPlan.installments[0].dueDate,
        status: "Payment Plan",
        notes: "Ten-payment fictional plan. The plan is currently behind schedule.",
        archived: false,
        completedAt: "",
        paymentPlan: benPlan,
        payments: [
          { id: uid("payment"), amount: 200, date: dateOffset(-122), location: "Orange Park", method: "Credit/Debit Card", note: "Installment 1 paid early.", appliesToPlan: true },
          { id: uid("payment"), amount: 200, date: dateOffset(-91), location: "Orange Park", method: "Credit/Debit Card", note: "Installment 2 paid early.", appliesToPlan: true },
          { id: uid("payment"), amount: 200, date: dateOffset(-50), location: "Orange Park", method: "Credit/Debit Card", note: "Installment 3 paid late.", appliesToPlan: true }
        ]
      },
      {
        id: "demo-1015",
        name: "Chloe Anderson",
        mrn: "DEMO-1015",
        physician: "Dr. Casey Monroe",
        location: "Amelia Island",
        treatment: "Radiation Therapy",
        insurance: "SampleCare PPO",
        responsibility: 600,
        collected: 0,
        collectionDate: chloePlan.installments[0].dueDate,
        status: "Payment Plan",
        notes: "Four-payment fictional plan beginning next month.",
        archived: false,
        completedAt: "",
        paymentPlan: chloePlan,
        payments: []
      },
      {
        id: "demo-1016",
        name: "Daniel Foster",
        mrn: "DEMO-1016",
        physician: "Dr. Jordan Lee",
        location: "Jacksonville",
        treatment: "Consultation",
        insurance: "Demo Mutual",
        responsibility: 225,
        collected: 225,
        collectionDate: dateOffset(-18),
        status: "Paid in Full",
        notes: "Completed fictional same-day collection.",
        archived: true,
        completedAt: dateOffset(-18),
        paymentPlan: null,
        payments: [
          { id: uid("payment"), amount: 225, date: dateOffset(-18), location: "Jacksonville", method: "Credit/Debit Card", note: "Paid at visit.", appliesToPlan: false }
        ]
      }
    ];
  }


  function arrangementFromLegacy(patient) {
    const explicit = String(patient.arrangement || "");
    if (["Standard Collection", "Payment Plan", "No Responsibility"].includes(explicit)) return explicit;
    if (patient.status === "Payment Plan" || patient.paymentPlan) return "Payment Plan";
    if (patient.status === "No Responsibility" || Number(patient.responsibility || 0) <= 0) return "No Responsibility";
    return "Standard Collection";
  }

  function normalizeTransactionType(value) {
    const type = String(value || "Payment");
    const allowed = ["Payment", "Reversal", "Refund", "Correction Reversal", "Correction Payment"];
    return allowed.includes(type) ? type : "Payment";
  }

  function transactionEffect(payment) {
    const type = normalizeTransactionType(payment?.type);
    const amount = Math.max(0, Number(payment?.amount || 0));
    return ["Reversal", "Refund", "Correction Reversal"].includes(type) ? -amount : amount;
  }

  function normalizePayment(payment, patient) {
    const rawAmount = Number(payment.amount || 0);
    let type = normalizeTransactionType(payment.type);
    if (rawAmount < 0 && type === "Payment") type = "Reversal";
    return {
      id: String(payment.id || uid("payment")),
      type,
      amount: Math.max(0, Math.abs(rawAmount)),
      date: String(payment.date || patient.collectionDate || todayIso()),
      location: String(payment.location || patient.location || "Not entered"),
      method: String(payment.method || "Other"),
      note: String(payment.note || ""),
      appliesToPlan: Boolean(payment.appliesToPlan || payment.planPayment),
      relatedTransactionId: String(payment.relatedTransactionId || ""),
      createdAt: String(payment.createdAt || `${payment.date || patient.collectionDate || todayIso()}T12:00:00`)
    };
  }

  function normalizeAdjustment(adjustment) {
    const allowed = ["Adjustment", "Write-off", "Financial Assistance", "Insurance Reallocation"];
    const type = allowed.includes(String(adjustment.type || "")) ? String(adjustment.type) : "Adjustment";
    return {
      id: String(adjustment.id || uid("adjustment")),
      type,
      amount: Math.max(0, Number(adjustment.amount || 0)),
      date: String(adjustment.date || todayIso()),
      note: String(adjustment.note || ""),
      createdAt: String(adjustment.createdAt || `${adjustment.date || todayIso()}T12:00:00`)
    };
  }

  function normalizeOutcome(outcome) {
    return {
      id: String(outcome.id || uid("outcome")),
      outcome: String(outcome.outcome || "Follow-up Required"),
      date: String(outcome.date || todayIso()),
      location: String(outcome.location || "Not entered"),
      note: String(outcome.note || ""),
      followUpDate: String(outcome.followUpDate || ""),
      promiseToPayDate: String(outcome.promiseToPayDate || ""),
      followUpCompleted: Boolean(outcome.followUpCompleted),
      createdAt: String(outcome.createdAt || `${outcome.date || todayIso()}T12:00:00`)
    };
  }

  function normalizeActivity(activity) {
    const requestedCreatedAt = String(activity.createdAt || `${activity.date || todayIso()}T12:00:00`);
    const requestedTime = new Date(requestedCreatedAt).getTime();
    const createdAt = Number.isFinite(requestedTime) && requestedTime <= Date.now() + 60000
      ? requestedCreatedAt
      : new Date().toISOString();
    return {
      id: String(activity.id || uid("activity")),
      type: String(activity.type || "account"),
      title: String(activity.title || "Account activity"),
      detail: String(activity.detail || ""),
      date: String(activity.date || todayIso()),
      createdAt,
      actor: String(activity.actor || "Prototype user")
    };
  }

  function normalizePlan(plan) {
    if (!plan || !Array.isArray(plan.installments) || plan.installments.length === 0) return null;
    const installments = plan.installments
      .map((installment, index) => {
        const dueDate = String(installment.dueDate || todayIso());
        return {
          id: String(installment.id || uid(`installment-${index + 1}`)),
          dueDate,
          originalDueDate: String(installment.originalDueDate || dueDate),
          amount: Math.max(0, Number(installment.amount || 0)),
          skipped: Boolean(installment.skipped),
          skipReason: String(installment.skipReason || ""),
          rescheduledAt: String(installment.rescheduledAt || "")
        };
      })
      .filter((installment) => installment.amount > EPSILON || installment.skipped)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    if (!installments.length) return null;
    return {
      createdDate: String(plan.createdDate || todayIso()),
      openingCollected: Math.max(0, Number(plan.openingCollected || 0)),
      graceDays: Math.max(0, Math.min(30, Math.floor(Number(plan.graceDays || 0)))),
      promiseToPayDate: String(plan.promiseToPayDate || ""),
      renegotiationCount: Math.max(0, Math.floor(Number(plan.renegotiationCount || 0))),
      history: Array.isArray(plan.history) ? plan.history.map((entry) => ({
        id: String(entry.id || uid("plan-history")),
        date: String(entry.date || todayIso()),
        reason: String(entry.reason || "Plan schedule updated"),
        detail: String(entry.detail || ""),
        createdAt: String(entry.createdAt || `${entry.date || todayIso()}T12:00:00`)
      })) : [],
      installments
    };
  }

  function defaultMigratedPlan(patient) {
    const remaining = Math.max(0, Number(patient.responsibility || 0) - Number(patient.collected || 0));
    if (remaining <= EPSILON) return null;
    const firstDate = String(patient.collectionDate || todayIso());
    return planRecord(remaining, 4, firstDate, "monthly", Number(patient.collected || 0), todayIso());
  }

  function inferCompletionDate(patient, payments) {
    if (!patient.archived) return "";
    if (patient.completedAt) return String(patient.completedAt);
    const dates = payments.map((payment) => payment.date).filter(Boolean).sort();
    return dates[dates.length - 1] || String(patient.collectionDate || todayIso());
  }

  function paymentTitle(payment) {
    if (payment.type === "Reversal") return "Payment reversed";
    if (payment.type === "Refund") return "Payment refunded";
    if (payment.type === "Correction Reversal") return "Original payment corrected";
    if (payment.type === "Correction Payment") return "Corrected payment recorded";
    return "Payment recorded";
  }

  function buildInitialActivities(patient) {
    const activities = [];
    const push = (entry) => activities.push(normalizeActivity(entry));
    const createdDate = patient.paymentPlan?.createdDate || patient.collectionDate || todayIso();
    push({
      id: `activity-${patient.id}-created`,
      type: "account",
      title: "Patient account created",
      detail: `${patient.arrangement} account with ${currency.format(patient.responsibility)} responsibility.`,
      date: createdDate,
      createdAt: `${createdDate}T08:00:00`
    });
    patient.payments.forEach((payment) => push({
      id: `activity-${payment.id}`,
      type: "payment",
      title: paymentTitle(payment),
      detail: `${currency.format(payment.amount)} · ${payment.method}${payment.note ? ` · ${payment.note}` : ""}`,
      date: payment.date,
      createdAt: payment.createdAt
    }));
    patient.adjustments.forEach((adjustment) => push({
      id: `activity-${adjustment.id}`,
      type: "adjustment",
      title: `${adjustment.type} recorded`,
      detail: `${currency.format(adjustment.amount)}${adjustment.note ? ` · ${adjustment.note}` : ""}`,
      date: adjustment.date,
      createdAt: adjustment.createdAt
    }));
    patient.outcomes.forEach((outcome) => push({
      id: `activity-${outcome.id}`,
      type: "outcome",
      title: outcome.outcome,
      detail: [outcome.note, outcome.followUpDate ? `Follow-up ${formatDate(outcome.followUpDate)}` : "", outcome.promiseToPayDate ? `Promise to pay ${formatDate(outcome.promiseToPayDate)}` : ""].filter(Boolean).join(" · "),
      date: outcome.date,
      createdAt: outcome.createdAt
    }));
    if (patient.archived && patient.completedAt) push({
      id: `activity-${patient.id}-completed`,
      type: "completion",
      title: "Account completed and archived",
      detail: "Moved from the active work queue to Completed Patients.",
      date: patient.completedAt,
      createdAt: `${patient.completedAt}T17:00:00`
    });
    return activities.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  function normalizePatient(patient) {
    const arrangement = arrangementFromLegacy(patient);
    const base = {
      id: String(patient.id || uid("patient")),
      name: String(patient.name || ""),
      mrn: String(patient.mrn || ""),
      physician: String(patient.physician || "Unassigned"),
      location: String(patient.location || "Jacksonville"),
      treatment: String(patient.treatment || "Other"),
      insurance: String(patient.insurance || "Not entered"),
      responsibility: Math.max(0, Number(patient.responsibility || 0)),
      collected: Math.max(0, Number(patient.collected || 0)),
      ledgerInitialized: true,
      collectionDate: String(patient.collectionDate || todayIso()),
      status: String(patient.status || "Upcoming Collection"),
      arrangement,
      noResponsibilityReason: String(patient.noResponsibilityReason || (arrangement === "No Responsibility" ? patient.notes || "No patient responsibility" : "")),
      notes: String(patient.notes || ""),
      archived: Boolean(patient.archived),
      completedAt: "",
      createdAt: String(patient.createdAt || ""),
      updatedAt: String(patient.updatedAt || ""),
      paymentPlan: null,
      payments: [],
      adjustments: [],
      outcomes: [],
      activity: []
    };

    base.payments = Array.isArray(patient.payments)
      ? patient.payments.map((payment) => normalizePayment(payment, base))
      : [];

    const ledgerTotal = base.payments.reduce((sum, payment) => sum + transactionEffect(payment), 0);
    const missingOpening = base.collected - ledgerTotal;
    // Reconcile the legacy summary field only once during migration. Once a
    // transaction ledger is initialized, reversals/refunds must not be
    // silently replaced by a synthetic opening payment.
    if (patient.ledgerInitialized !== true && missingOpening > EPSILON) {
      base.payments.push(normalizePayment({
        id: uid("payment-opening"),
        type: "Payment",
        amount: missingOpening,
        date: base.collectionDate,
        location: base.location,
        method: "Previously Collected",
        note: "Opening amount recorded before detailed payment history.",
        appliesToPlan: false
      }, base));
    }

    base.adjustments = Array.isArray(patient.adjustments)
      ? patient.adjustments.map(normalizeAdjustment).filter((entry) => entry.amount > EPSILON)
      : [];
    base.outcomes = Array.isArray(patient.outcomes)
      ? patient.outcomes.map(normalizeOutcome)
      : [];
    base.paymentPlan = normalizePlan(patient.paymentPlan);
    if (!base.paymentPlan && arrangement === "Payment Plan") base.paymentPlan = defaultMigratedPlan(base);
    base.collected = Math.max(0, Math.round(base.payments.reduce((sum, payment) => sum + transactionEffect(payment), 0) * 100) / 100);
    base.completedAt = inferCompletionDate(patient, base.payments);
    base.activity = Array.isArray(patient.activity) && patient.activity.length
      ? patient.activity.map(normalizeActivity).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      : buildInitialActivities(base);

    const isUsableTimestamp = (value) => {
      const time = new Date(value).getTime();
      return Boolean(value) && Number.isFinite(time) && time <= Date.now() + 60000;
    };
    const activityTimes = base.activity.map((entry) => entry.createdAt).filter(isUsableTimestamp).sort();
    const fallbackDateCandidate = base.paymentPlan?.createdDate || base.collectionDate || todayIso();
    const fallbackDate = fallbackDateCandidate > todayIso() ? todayIso() : fallbackDateCandidate;
    const fallbackCreatedAt = `${fallbackDate}T08:00:00`;
    const createdCandidates = [base.createdAt, activityTimes[0], fallbackCreatedAt].filter(isUsableTimestamp).sort();
    const updatedCandidates = [base.updatedAt, ...activityTimes, fallbackCreatedAt].filter(isUsableTimestamp).sort();
    base.createdAt = createdCandidates[0] || fallbackCreatedAt;
    base.updatedAt = updatedCandidates.at(-1) || base.createdAt;
    return base;
  }

  function savePatients(patients) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(patients.map(normalizePatient)));
    } catch (error) {
      console.warn("Prototype changes will remain in memory for this browser tab only.", error);
    }
  }

  function loadPatients() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored).map(normalizePatient);

      for (const key of LEGACY_STORAGE_KEYS) {
        const legacy = localStorage.getItem(key);
        if (!legacy) continue;
        const migrated = JSON.parse(legacy).map(normalizePatient);
        savePatients(migrated);
        return migrated;
      }
    } catch (error) {
      console.warn("Could not load stored prototype data.", error);
    }

    const seeded = seedPatients().map(normalizePatient);
    savePatients(seeded);
    return seeded;
  }

  function resetPatients() {
    const patients = seedPatients().map(normalizePatient);
    savePatients(patients);
    return patients;
  }

  function normalizedPayments(patient) {
    const base = {
      collectionDate: patient.collectionDate || todayIso(),
      location: patient.location || "Not entered"
    };
    const payments = Array.isArray(patient.payments)
      ? patient.payments.map((payment) => normalizePayment(payment, base)).filter((payment) => payment.amount > EPSILON)
      : [];
    const ledgerTotal = payments.reduce((sum, payment) => sum + transactionEffect(payment), 0);
    const legacyCollected = Math.max(0, Number(patient.collected || 0));
    const missing = legacyCollected - ledgerTotal;
    if (patient.ledgerInitialized !== true && missing > EPSILON) {
      payments.push(normalizePayment({
        id: uid("payment-opening"), amount: missing, type: "Payment",
        date: patient.collectionDate || todayIso(), location: patient.location || "Not entered",
        method: "Previously Collected", note: "Opening amount recorded before detailed payment history.", appliesToPlan: false
      }, base));
    }
    return payments.sort((a, b) => `${a.date}|${a.createdAt}`.localeCompare(`${b.date}|${b.createdAt}`));
  }

  function netCollected(patient) {
    return Math.max(0, Math.round(normalizedPayments(patient).reduce((sum, payment) => sum + transactionEffect(payment), 0) * 100) / 100);
  }

  function normalizedAdjustments(patient) {
    return Array.isArray(patient.adjustments)
      ? patient.adjustments.map(normalizeAdjustment).filter((entry) => entry.amount > EPSILON)
      : [];
  }

  function adjustmentTotal(patient) {
    return Math.round(normalizedAdjustments(patient).reduce((sum, adjustment) => sum + adjustment.amount, 0) * 100) / 100;
  }

  function amountOwed(patient) {
    if (arrangementFromLegacy(patient) === "No Responsibility") return 0;
    return Math.max(0, Math.round((Number(patient.responsibility || 0) - netCollected(patient) - adjustmentTotal(patient)) * 100) / 100);
  }

  function syncFinancials(patient) {
    patient.collected = netCollected(patient);
    return patient;
  }

  function addActivity(patient, entry) {
    patient.activity = Array.isArray(patient.activity) ? patient.activity : [];
    const activity = normalizeActivity({ ...entry, createdAt: entry.createdAt || new Date().toISOString() });
    patient.activity.push(activity);
    patient.activity.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    patient.createdAt = patient.createdAt || activity.createdAt;
    patient.updatedAt = activity.createdAt;
    return activity;
  }

  function addPaymentTransaction(patient, payment, activity = true) {
    patient.payments = Array.isArray(patient.payments) ? patient.payments : [];
    const transaction = normalizePayment({ ...payment, createdAt: payment.createdAt || new Date().toISOString() }, patient);
    patient.payments.push(transaction);
    syncFinancials(patient);
    if (activity) addActivity(patient, {
      type: "payment",
      title: paymentTitle(transaction),
      detail: `${currency.format(transaction.amount)} · ${transaction.method}${transaction.note ? ` · ${transaction.note}` : ""}`,
      date: transaction.date
    });
    return transaction;
  }

  function addAdjustment(patient, adjustment, activity = true) {
    patient.adjustments = Array.isArray(patient.adjustments) ? patient.adjustments : [];
    const normalized = normalizeAdjustment({ ...adjustment, createdAt: adjustment.createdAt || new Date().toISOString() });
    patient.adjustments.push(normalized);
    if (activity) addActivity(patient, {
      type: "adjustment",
      title: `${normalized.type} recorded`,
      detail: `${currency.format(normalized.amount)}${normalized.note ? ` · ${normalized.note}` : ""}`,
      date: normalized.date
    });
    return normalized;
  }

  function addOutcome(patient, outcome, activity = true) {
    patient.outcomes = Array.isArray(patient.outcomes) ? patient.outcomes : [];
    const normalized = normalizeOutcome({ ...outcome, createdAt: outcome.createdAt || new Date().toISOString() });
    patient.outcomes.push(normalized);
    if (normalized.promiseToPayDate && patient.paymentPlan) patient.paymentPlan.promiseToPayDate = normalized.promiseToPayDate;
    if (activity) addActivity(patient, {
      type: "outcome",
      title: normalized.outcome,
      detail: [normalized.note, normalized.followUpDate ? `Follow-up ${formatDate(normalized.followUpDate)}` : "", normalized.promiseToPayDate ? `Promise to pay ${formatDate(normalized.promiseToPayDate)}` : ""].filter(Boolean).join(" · "),
      date: normalized.date
    });
    return normalized;
  }

  function reversibleAmount(patient, transactionId) {
    const ledger = normalizedPayments(patient);
    const original = ledger.find((transaction) => transaction.id === transactionId);
    if (!original || transactionEffect(original) <= 0) return 0;
    const reversed = ledger
      .filter((transaction) => transaction.relatedTransactionId === transactionId && transactionEffect(transaction) < 0)
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    return Math.max(0, Math.round((original.amount - reversed) * 100) / 100);
  }

  function planPaymentEvents(patient) {
    if (!patient.paymentPlan) return [];
    const flagged = normalizedPayments(patient).filter((payment) => payment.appliesToPlan);
    const flaggedNet = flagged.reduce((sum, payment) => sum + transactionEffect(payment), 0);
    const inferredPlanPaid = Math.max(0, netCollected(patient) - Number(patient.paymentPlan.openingCollected || 0));
    const missing = inferredPlanPaid - flaggedNet;
    if (missing > EPSILON) {
      flagged.push(normalizePayment({
        id: uid("payment-plan-opening"),
        type: "Payment",
        amount: missing,
        date: patient.collectionDate || patient.paymentPlan.createdDate || todayIso(),
        location: patient.location || "Not entered",
        method: "Previously Collected",
        note: "Plan amount recorded before installment tracking was enabled.",
        appliesToPlan: true
      }, patient));
    }
    return flagged.sort((a, b) => `${a.date}|${a.createdAt}`.localeCompare(`${b.date}|${b.createdAt}`));
  }

  function planSummary(patient) {
    const plan = normalizePlan(patient.paymentPlan);
    if (!plan) return null;

    const installments = plan.installments.map((installment, index) => ({
      ...installment,
      number: index + 1,
      paidAmount: 0,
      remaining: installment.amount,
      allocations: [],
      paidDate: "",
      status: installment.skipped ? "Skipped" : "Upcoming",
      onTime: false,
      daysLate: 0,
      graceDeadline: addDays(installment.dueDate, plan.graceDays)
    }));

    const events = planPaymentEvents({ ...patient, paymentPlan: plan });
    let unallocatedPayment = 0;
    events.forEach((payment) => {
      let effect = transactionEffect(payment);
      if (effect > EPSILON) {
        for (const installment of installments) {
          if (effect <= EPSILON) break;
          if (installment.skipped || installment.amount <= EPSILON) continue;
          const needed = Math.max(0, installment.amount - installment.paidAmount);
          if (needed <= EPSILON) continue;
          const allocated = Math.min(needed, effect);
          installment.paidAmount += allocated;
          installment.allocations.push({ amount: allocated, date: payment.date, paymentId: payment.id, type: payment.type });
          effect -= allocated;
        }
        if (effect > EPSILON) unallocatedPayment += effect;
      } else if (effect < -EPSILON) {
        let debit = Math.abs(effect);
        for (let index = installments.length - 1; index >= 0 && debit > EPSILON; index -= 1) {
          const installment = installments[index];
          if (installment.paidAmount <= EPSILON) continue;
          const removed = Math.min(installment.paidAmount, debit);
          installment.paidAmount -= removed;
          installment.allocations.push({ amount: -removed, date: payment.date, paymentId: payment.id, type: payment.type });
          debit -= removed;
        }
      }
    });

    const today = todayIso();
    installments.forEach((installment) => {
      installment.paidAmount = Math.round(installment.paidAmount * 100) / 100;
      installment.remaining = Math.max(0, Math.round((installment.amount - installment.paidAmount) * 100) / 100);
      const positiveAllocations = installment.allocations.filter((allocation) => allocation.amount > 0);
      installment.paidDate = installment.remaining <= EPSILON && positiveAllocations.length
        ? positiveAllocations.map((allocation) => allocation.date).sort().at(-1)
        : "";
      if (installment.skipped) {
        installment.status = "Skipped";
      } else if (installment.remaining <= EPSILON) {
        installment.status = "Paid";
        installment.onTime = Boolean(installment.paidDate && installment.paidDate <= installment.graceDeadline);
        installment.daysLate = installment.paidDate ? Math.max(0, daysBetween(installment.dueDate, installment.paidDate)) : 0;
      } else if (installment.dueDate === today) {
        installment.status = "Due Today";
      } else if (installment.dueDate < today && today <= installment.graceDeadline) {
        installment.status = "Grace Period";
        installment.daysLate = Math.max(0, daysBetween(installment.dueDate, today));
      } else if (installment.graceDeadline < today) {
        installment.status = "Overdue";
        installment.daysLate = Math.max(0, daysBetween(installment.dueDate, today));
      } else if (installment.paidAmount > EPSILON) {
        installment.status = "Partially Paid";
      } else {
        installment.status = "Upcoming";
      }
    });

    const payable = installments.filter((installment) => !installment.skipped);
    const total = payable.reduce((sum, installment) => sum + installment.amount, 0);
    const paid = payable.reduce((sum, installment) => sum + installment.paidAmount, 0);
    const completed = payable.filter((installment) => installment.status === "Paid");
    const due = payable.filter((installment) => installment.dueDate <= today);
    const onTime = due.filter((installment) => installment.status === "Paid" && installment.onTime);
    const overdue = payable.filter((installment) => installment.status === "Overdue");
    const dueToday = payable.filter((installment) => installment.status === "Due Today");
    const grace = payable.filter((installment) => installment.status === "Grace Period");
    const nextDue = payable.find((installment) => installment.remaining > EPSILON) || null;
    const scheduledToDate = due.reduce((sum, installment) => sum + installment.amount, 0);
    const planPaid = Math.min(total, paid);
    const overdueAmount = overdue.reduce((sum, installment) => sum + installment.remaining, 0);
    const dueTodayAmount = dueToday.reduce((sum, installment) => sum + installment.remaining, 0);
    const graceAmount = grace.reduce((sum, installment) => sum + installment.remaining, 0);
    const attention = overdue.length > 0 ? "Overdue" : (dueToday.length > 0 ? "Due Today" : (grace.length > 0 ? "Grace Period" : (nextDue ? "Plan On Schedule" : "Complete")));

    return {
      plan,
      installments,
      total: Math.round(total * 100) / 100,
      paid: Math.round(planPaid * 100) / 100,
      remaining: Math.max(0, Math.round((total - planPaid) * 100) / 100),
      completedCount: completed.length,
      totalCount: payable.length,
      skippedCount: installments.filter((installment) => installment.skipped).length,
      dueCount: due.length,
      onTimeCount: onTime.length,
      overdueCount: overdue.length,
      dueTodayCount: dueToday.length,
      graceCount: grace.length,
      overdueAmount: Math.round(overdueAmount * 100) / 100,
      dueTodayAmount: Math.round(dueTodayAmount * 100) / 100,
      graceAmount: Math.round(graceAmount * 100) / 100,
      nextDue,
      attention,
      progressPercent: total > EPSILON ? Math.min(100, (planPaid / total) * 100) : 100,
      onTimeRate: due.length > 0 ? (onTime.length / due.length) * 100 : null,
      scheduledToDate: Math.round(scheduledToDate * 100) / 100,
      scheduleVariance: Math.round((planPaid - scheduledToDate) * 100) / 100,
      unallocatedPayment: Math.round(unallocatedPayment * 100) / 100,
      graceDays: plan.graceDays,
      promiseToPayDate: plan.promiseToPayDate,
      renegotiationCount: plan.renegotiationCount,
      repeatedMisses: overdue.length >= 2
    };
  }

  function effectiveStatus(patient) {
    const arrangement = arrangementFromLegacy(patient);
    const owed = amountOwed(patient);
    if (arrangement === "No Responsibility" || Number(patient.responsibility || 0) <= 0) return "No Responsibility";
    if (owed <= EPSILON) return "Paid in Full";
    if (arrangement === "Payment Plan" && patient.paymentPlan) return "Payment Plan";
    if (netCollected(patient) > EPSILON) return "Partially Paid";
    const today = todayIso();
    if (patient.collectionDate < today) return "Overdue";
    if (patient.collectionDate === today) return "Due Today";
    return "Upcoming Collection";
  }

  function attentionStatus(patient) {
    const status = effectiveStatus(patient);
    if (status === "Payment Plan") return planSummary(patient)?.attention || "Plan On Schedule";
    if (status === "Partially Paid") {
      const dueDate = String(patient.collectionDate || "");
      if (!dueDate) return "Upcoming";
      const today = todayIso();
      if (dueDate < today) return "Overdue";
      if (dueDate === today) return "Due Today";
      return "Upcoming";
    }
    return status;
  }

  function nextActionDate(patient) {
    if (effectiveStatus(patient) === "Payment Plan") {
      return planSummary(patient)?.nextDue?.dueDate || patient.collectionDate || "";
    }
    return patient.collectionDate || "";
  }

  function statusMeta(status) {
    const map = {
      "Upcoming Collection": { row: "status-ready", pill: "ready", short: "Upcoming" },
      "Ready for Collection": { row: "status-ready", pill: "ready", short: "Upcoming" },
      "Due Today": { row: "status-due", pill: "due", short: "Due Today" },
      Overdue: { row: "status-overdue", pill: "overdue", short: "Overdue" },
      "Partially Paid": { row: "status-partial", pill: "partial", short: "Partial" },
      "Payment Plan": { row: "status-plan", pill: "plan", short: "Plan" },
      "Paid in Full": { row: "status-paid", pill: "paid", short: "Paid" },
      "No Responsibility": { row: "status-none", pill: "none", short: "No Responsibility" },
      "Plan On Schedule": { row: "status-plan", pill: "current", short: "On Schedule" },
      Current: { row: "status-plan", pill: "current", short: "On Schedule" },
      "Grace Period": { row: "status-plan", pill: "grace", short: "Grace Period" },
      Complete: { row: "status-paid", pill: "paid", short: "Complete" },
      Skipped: { row: "status-none", pill: "none", short: "Skipped" }
    };
    return map[status] || map["Upcoming Collection"];
  }

  function latestOutcome(patient) {
    const outcomes = Array.isArray(patient.outcomes) ? patient.outcomes.map(normalizeOutcome) : [];
    return outcomes.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] || null;
  }

  function currentFollowUp(patient) {
    const outcomes = Array.isArray(patient.outcomes) ? patient.outcomes.map(normalizeOutcome) : [];
    return outcomes
      .filter((outcome) => outcome.followUpDate && !outcome.followUpCompleted)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] || null;
  }

  function loadSavedViews(page) {
    try {
      const all = JSON.parse(localStorage.getItem(SAVED_VIEWS_KEY) || "{}");
      return Array.isArray(all[page]) ? all[page] : [];
    } catch (error) {
      console.warn("Could not load saved prototype views.", error);
      return [];
    }
  }

  function saveSavedView(page, view) {
    const all = (() => {
      try { return JSON.parse(localStorage.getItem(SAVED_VIEWS_KEY) || "{}"); }
      catch { return {}; }
    })();
    const views = Array.isArray(all[page]) ? all[page] : [];
    const record = { id: String(view.id || uid("view")), name: String(view.name || "Saved View"), settings: view.settings || {} };
    const index = views.findIndex((item) => item.id === record.id);
    if (index >= 0) views[index] = record; else views.push(record);
    all[page] = views.sort((a, b) => a.name.localeCompare(b.name));
    localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(all));
    return record;
  }

  function deleteSavedView(page, id) {
    const all = (() => {
      try { return JSON.parse(localStorage.getItem(SAVED_VIEWS_KEY) || "{}"); }
      catch { return {}; }
    })();
    all[page] = (Array.isArray(all[page]) ? all[page] : []).filter((item) => item.id !== id);
    localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(all));
  }

  function formatDate(isoDate) {
    const date = parseIsoDate(isoDate);
    if (!date) return isoDate || "-";
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
  }

  function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value || "-";
    return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
  }

  function formatMonth(monthKey) {
    if (!/^\d{4}-\d{2}$/.test(monthKey)) return monthKey;
    const [year, month] = monthKey.split("-").map(Number);
    return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(year, month - 1, 1));
  }

  function formatFileSize(bytes) {
    const value = Math.max(0, Number(bytes || 0));
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function printPatientSummary(patient, documents = []) {
    const status = effectiveStatus(patient);
    const plan = planSummary(patient);
    const payments = normalizedPayments(patient).slice().sort((a, b) => `${a.date}|${a.createdAt}`.localeCompare(`${b.date}|${b.createdAt}`));
    const adjustments = normalizedAdjustments(patient).slice().sort((a, b) => `${a.date}|${a.createdAt}`.localeCompare(`${b.date}|${b.createdAt}`));
    const outcomes = (patient.outcomes || []).slice().sort((a, b) => `${a.date}|${a.createdAt}`.localeCompare(`${b.date}|${b.createdAt}`));
    const activities = (patient.activity || []).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const safeDocuments = Array.isArray(documents) ? documents : [];

    const tableRows = (rows, emptyText) => rows.length ? rows.join("") : `<tr><td colspan="99" class="empty">${escapeHtml(emptyText)}</td></tr>`;
    const statusText = plan ? `${status} - ${plan.attention}` : status;
    const generatedAt = formatDateTime(new Date().toISOString());

    const paymentRows = tableRows(payments.map((payment) => {
      const effect = transactionEffect(payment);
      return `<tr><td>${escapeHtml(formatDate(payment.date))}</td><td>${escapeHtml(payment.type)}</td><td class="num">${escapeHtml(currency.format(effect))}</td><td>${escapeHtml(payment.method)}</td><td>${escapeHtml(payment.location)}</td><td>${escapeHtml(payment.note || "-")}</td></tr>`;
    }), "No payment transactions recorded.");

    const adjustmentRows = tableRows(adjustments.map((entry) => `<tr><td>${escapeHtml(formatDate(entry.date))}</td><td>${escapeHtml(entry.type)}</td><td class="num">${escapeHtml(currency.format(entry.amount))}</td><td>${escapeHtml(entry.note || "-")}</td></tr>`), "No adjustments recorded.");

    const outcomeRows = tableRows(outcomes.map((outcome) => `<tr><td>${escapeHtml(formatDate(outcome.date))}</td><td>${escapeHtml(outcome.outcome)}</td><td>${escapeHtml(outcome.location)}</td><td>${escapeHtml(outcome.followUpDate ? formatDate(outcome.followUpDate) : "-")}</td><td>${escapeHtml(outcome.promiseToPayDate ? formatDate(outcome.promiseToPayDate) : "-")}</td><td>${escapeHtml(outcome.note || "-")}</td></tr>`), "No collection outcomes recorded.");

    const planSection = plan ? `
      <section>
        <h2>Payment Plan</h2>
        <div class="metrics">
          <div><span>Installments paid</span><strong>${plan.completedCount} of ${plan.totalCount}</strong></div>
          <div><span>Plan progress</span><strong>${plan.progressPercent.toFixed(1)}%</strong></div>
          <div><span>On-time rate</span><strong>${plan.onTimeRate === null ? "Not measured" : `${plan.onTimeRate.toFixed(1)}%`}</strong></div>
          <div><span>Past due</span><strong>${escapeHtml(currency.format(plan.overdueAmount))}</strong></div>
        </div>
        <table><thead><tr><th>#</th><th>Due date</th><th>Scheduled</th><th>Paid</th><th>Remaining</th><th>Result</th></tr></thead><tbody>
          ${plan.installments.map((item) => `<tr><td>${item.number}</td><td>${escapeHtml(formatDate(item.dueDate))}</td><td class="num">${escapeHtml(currency.format(item.amount))}</td><td class="num">${escapeHtml(currency.format(item.paidAmount))}</td><td class="num">${escapeHtml(currency.format(item.remaining))}</td><td>${escapeHtml(item.status)}${item.status === "Paid" ? (item.onTime ? " - On time" : " - Late") : ""}</td></tr>`).join("")}
        </tbody></table>
      </section>` : "";

    const documentRows = tableRows(safeDocuments.map((document) => `<tr><td>${escapeHtml(document.name || "Document")}</td><td>${escapeHtml(document.type || "-")}</td><td>${escapeHtml(formatFileSize(document.size || 0))}</td><td>${escapeHtml(formatDateTime(document.addedAt || ""))}</td></tr>`), "No documents attached in this browser.");

    const activityRows = activities.length
      ? activities.map((activity) => `<li><strong>${escapeHtml(activity.title)}</strong><span>${escapeHtml(formatDateTime(activity.createdAt))} - ${escapeHtml(activity.actor)}</span><p>${escapeHtml(activity.detail || "No additional detail.")}</p></li>`).join("")
      : `<li class="empty">No activity recorded.</li>`;

    const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(patient.name)} Account Summary</title>
<style>
  @page { size: letter; margin: 0.55in; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #172b3a; font-family: Arial, Helvetica, sans-serif; font-size: 10.5pt; line-height: 1.35; }
  header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; border-bottom: 3px solid #087f8c; padding-bottom: 12px; margin-bottom: 16px; }
  h1 { margin: 0 0 4px; color: #12324a; font-size: 21pt; }
  h2 { margin: 18px 0 8px; color: #12324a; font-size: 13pt; border-bottom: 1px solid #cfd9e0; padding-bottom: 4px; }
  p { margin: 4px 0; }
  .prototype { border: 1px solid #c78600; background: #fff8e7; padding: 7px 9px; font-weight: 700; color: #5d4300; }
  .meta { text-align: right; font-size: 9pt; color: #51616d; }
  .identity, .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .identity div, .metrics div { border: 1px solid #d9e1e7; border-radius: 5px; padding: 7px; min-width: 0; }
  .identity span, .metrics span { display: block; color: #5f6f7b; font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; }
  .identity strong, .metrics strong { display: block; margin-top: 2px; overflow-wrap: anywhere; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 8.5pt; page-break-inside: auto; }
  tr { page-break-inside: avoid; page-break-after: auto; }
  th, td { border: 1px solid #cfd9e0; padding: 5px 6px; text-align: left; vertical-align: top; }
  th { background: #eef4f7; color: #243c4c; }
  .num { text-align: right; white-space: nowrap; }
  .note { border: 1px solid #d9e1e7; background: #f7fafb; padding: 9px; white-space: pre-wrap; }
  .empty { color: #6a7780; font-style: italic; text-align: center; }
  .activity { margin: 0; padding-left: 20px; }
  .activity li { margin: 0 0 8px; padding-left: 3px; }
  .activity span { display: block; color: #5f6f7b; font-size: 8.5pt; }
  .activity p { margin: 2px 0 0; }
  footer { margin-top: 18px; border-top: 1px solid #cfd9e0; padding-top: 7px; color: #687680; font-size: 8pt; }
  @media print { .no-print { display: none !important; } }
</style></head><body>
<header><div><h1>Patient Account Summary</h1><p><strong>${escapeHtml(patient.name)}</strong> - ${escapeHtml(patient.mrn)}</p><div class="prototype">FICTIONAL DATA PROTOTYPE</div></div><div class="meta"><strong>Ackerman Patient Payment Board</strong><br>Generated ${escapeHtml(generatedAt)}<br>Last updated ${escapeHtml(formatDateTime(patient.updatedAt || patient.createdAt))}</div></header>
<section><h2>Account Overview</h2><div class="identity">
  <div><span>Status</span><strong>${escapeHtml(statusText)}</strong></div>
  <div><span>Arrangement</span><strong>${escapeHtml(arrangementFromLegacy(patient))}</strong></div>
  <div><span>Physician</span><strong>${escapeHtml(patient.physician)}</strong></div>
  <div><span>Treatment site</span><strong>${escapeHtml(patient.location)}</strong></div>
  <div><span>Treatment type</span><strong>${escapeHtml(patient.treatment)}</strong></div>
  <div><span>Insurance</span><strong>${escapeHtml(patient.insurance)}</strong></div>
  <div><span>Collection date</span><strong>${escapeHtml(formatDate(patient.collectionDate))}</strong></div>
  <div><span>${patient.archived ? "Completed" : "Next action"}</span><strong>${escapeHtml(formatDate(patient.archived ? patient.completedAt : nextActionDate(patient)))}</strong></div>
  <div><span>Created</span><strong>${escapeHtml(formatDateTime(patient.createdAt))}</strong></div>
  <div><span>Last updated</span><strong>${escapeHtml(formatDateTime(patient.updatedAt))}</strong></div>
</div></section>
<section><h2>Financial Summary</h2><div class="metrics">
  <div><span>Responsibility</span><strong>${escapeHtml(currency.format(patient.responsibility))}</strong></div>
  <div><span>Net collected</span><strong>${escapeHtml(currency.format(netCollected(patient)))}</strong></div>
  <div><span>Adjustments</span><strong>${escapeHtml(currency.format(adjustmentTotal(patient)))}</strong></div>
  <div><span>Still owed</span><strong>${escapeHtml(currency.format(amountOwed(patient)))}</strong></div>
</div></section>
${planSection}
<section><h2>Finance Note</h2><div class="note">${escapeHtml(patient.notes || "No finance note entered.")}${patient.noResponsibilityReason ? `\n\nNo-responsibility reason: ${escapeHtml(patient.noResponsibilityReason)}` : ""}</div></section>
<section><h2>Payment Ledger</h2><table><thead><tr><th>Date</th><th>Type</th><th>Net amount</th><th>Method</th><th>Location</th><th>Note</th></tr></thead><tbody>${paymentRows}</tbody></table></section>
<section><h2>Adjustments</h2><table><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Reason</th></tr></thead><tbody>${adjustmentRows}</tbody></table></section>
<section><h2>Collection Outcomes</h2><table><thead><tr><th>Date</th><th>Outcome</th><th>Location</th><th>Follow-up</th><th>Promise date</th><th>Note</th></tr></thead><tbody>${outcomeRows}</tbody></table></section>
<section><h2>Attached Document Index</h2><table><thead><tr><th>Document</th><th>Type</th><th>Size</th><th>Attached</th></tr></thead><tbody>${documentRows}</tbody></table></section>
<section><h2>Activity Timeline</h2><ol class="activity">${activityRows}</ol></section>
<footer>This summary is generated from fictional browser-only prototype data. It is not a clinical record, receipt, or official account statement.</footer>
<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},250);});<\/script>
</body></html>`;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return false;
    printWindow.opener = null;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    return true;
  }

  window.AckermanData = {
    STORAGE_KEY,
    LEGACY_STORAGE_KEYS,
    SAVED_VIEWS_KEY,
    EPSILON,
    currency,
    todayIso,
    toIsoLocal,
    dateOffset,
    addDays,
    addMonths,
    daysBetween,
    deepCopy,
    uid,
    splitAmount,
    makePlanSchedule,
    seedPatients,
    normalizePatient,
    loadPatients,
    savePatients,
    resetPatients,
    arrangementFromLegacy,
    transactionEffect,
    normalizedPayments,
    netCollected,
    normalizedAdjustments,
    adjustmentTotal,
    amountOwed,
    syncFinancials,
    addActivity,
    addPaymentTransaction,
    addAdjustment,
    addOutcome,
    reversibleAmount,
    planPaymentEvents,
    planSummary,
    effectiveStatus,
    attentionStatus,
    nextActionDate,
    statusMeta,
    latestOutcome,
    currentFollowUp,
    loadSavedViews,
    saveSavedView,
    deleteSavedView,
    formatDate,
    formatDateTime,
    formatMonth,
    formatFileSize,
    escapeHtml,
    printPatientSummary
  };
})();
