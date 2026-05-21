/**
 * Study Schedule Tracker — dashboard + check-in (localStorage).
 */
const STORAGE_KEY = "studyPlan.v2";
const LEGACY_KEY = "studyPlan.v1";
const MIN_DAILY_MINUTES = 10 * 60;
const MAX_BLOCK_MINUTES = 120;
const RING_C = 2 * Math.PI * 34;

const DOT_COLORS = ["#2563eb", "#8b5cf6", "#f59e0b", "#14b8a6", "#ec4899", "#64748b"];

function defaultCourses() {
  return [
    { id: crypto.randomUUID(), name: "Mathematics", minutes: 120, compulsory: true, order: 0 },
    { id: crypto.randomUUID(), name: "Science", minutes: 120, compulsory: true, order: 1 },
    { id: crypto.randomUUID(), name: "English / reading", minutes: 90, compulsory: true, order: 2 },
    { id: crypto.randomUUID(), name: "Second language", minutes: 90, compulsory: true, order: 3 },
    { id: crypto.randomUUID(), name: "History / social studies", minutes: 60, compulsory: false, order: 4 },
    { id: crypto.randomUUID(), name: "Review & homework", minutes: 120, compulsory: true, order: 5 },
  ];
}

/** @typedef {{ id: string, name: string, minutes: number, compulsory: boolean, order: number }} Course */

function migrateLegacy() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data.courses) return null;
    localStorage.removeItem(LEGACY_KEY);
    return {
      courses: data.courses,
      checks: data.checks || {},
      dayStart: "06:00",
    };
  } catch {
    return null;
  }
}

function loadState() {
  const migrated = migrateLegacy();
  if (migrated) {
    saveState(migrated);
    return migrated;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const courses = defaultCourses();
      return { courses, checks: {}, dayStart: "06:00" };
    }
    const data = JSON.parse(raw);
    if (!Array.isArray(data.courses)) data.courses = defaultCourses();
    if (!data.checks || typeof data.checks !== "object") data.checks = {};
    if (typeof data.dayStart !== "string" || !/^\d{2}:\d{2}$/.test(data.dayStart)) data.dayStart = "06:00";
    return data;
  } catch {
    return { courses: defaultCourses(), checks: {}, dayStart: "06:00" };
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function blocksForCourse(minutes) {
  const blocks = [];
  let left = Math.max(15, minutes);
  while (left > 0) {
    const m = Math.min(left, MAX_BLOCK_MINUTES);
    blocks.push(m);
    left -= m;
  }
  return blocks;
}

/** @param {Course[]} courses */
function buildSessions(courses) {
  const sorted = [...courses].sort((a, b) => a.order - b.order);
  const sessions = [];
  let idx = 0;
  for (const c of sorted) {
    const parts = blocksForCourse(c.minutes);
    for (const minutes of parts) {
      sessions.push({
        key: `${c.id}:${idx}`,
        courseId: c.id,
        name: c.name,
        minutes,
        compulsory: c.compulsory,
      });
      idx += 1;
    }
  }
  return sessions;
}

function parseTimeToMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 6 * 60;
  return Math.min(24 * 60 - 1, Math.max(0, h * 60 + m));
}

function formatClock(totalMinutes) {
  let m = Math.floor(totalMinutes) % (24 * 60);
  if (m < 0) m += 24 * 60;
  const h24 = Math.floor(m / 60);
  const min = m % 60;
  const suf = h24 < 12 ? "AM" : "PM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${String(h12).padStart(2, "0")}:${String(min).padStart(2, "0")} ${suf}`;
}

function attachTimes(sessions, dayStartStr) {
  let cursor = parseTimeToMinutes(dayStartStr);
  return sessions.map((s, i) => {
    const start = cursor;
    const end = Math.min(start + s.minutes, 24 * 60 - 1);
    const startLabel = formatClock(start);
    const endLabel = formatClock(end);
    cursor = end;
    return {
      ...s,
      index: i + 1,
      timeRange: `${startLabel} – ${endLabel}`,
      startMinutes: start,
      endMinutes: end,
    };
  });
}

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const ch of children) {
    if (typeof ch === "string") node.appendChild(document.createTextNode(ch));
    else if (ch) node.appendChild(ch);
  }
  return node;
}

const planDate = document.getElementById("planDate");
const dateLine = document.getElementById("dateLine");
const hoursAlert = document.getElementById("hoursAlert");
const heroHoursLabel = document.getElementById("heroHoursLabel");
const heroRemainLabel = document.getElementById("heroRemainLabel");
const heroBar = document.getElementById("heroBar");
const ringFg = document.getElementById("ringFg");
const ringPct = document.getElementById("ringPct");
const sumCompleted = document.getElementById("sumCompleted");
const sumRemaining = document.getElementById("sumRemaining");
const sumCompulsory = document.getElementById("sumCompulsory");
const motivateLine = document.getElementById("motivateLine");
const focusTag = document.getElementById("focusTag");
const breakTag = document.getElementById("breakTag");
const focusBar = document.getElementById("focusBar");
const breakBar = document.getElementById("breakBar");
const balanceTip = document.getElementById("balanceTip");
const scheduleTotal = document.getElementById("scheduleTotal");
const scheduleList = document.getElementById("scheduleList");
const emptySchedule = document.getElementById("emptySchedule");
const weekPct = document.getElementById("weekPct");
const weekBars = document.getElementById("weekBars");
const streakDays = document.getElementById("streakDays");
const nextReminderText = document.getElementById("nextReminderText");
const courseTableBody = document.getElementById("courseTableBody");
const addCourseForm = document.getElementById("addCourseForm");
const btnResetDay = document.getElementById("btnResetDay");
const btnMarkAll = document.getElementById("btnMarkAll");
const checkinList = document.getElementById("checkinList");
const emptyCheckin = document.getElementById("emptyCheckin");
const dayStartInput = document.getElementById("dayStart");

let state = loadState();

function selectedDate() {
  return planDate.value || new Date().toISOString().slice(0, 10);
}

function checksForDate(dateStr) {
  if (!state.checks[dateStr]) state.checks[dateStr] = {};
  return state.checks[dateStr];
}

function totalScheduledMinutes(courses) {
  return courses.reduce((s, c) => s + Math.max(0, c.minutes), 0);
}

function fmtHours(mins) {
  const h = mins / 60;
  const rounded = Math.round(h * 10) / 10;
  return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1);
}

function dateLabelLong(isoDate) {
  const d = new Date(isoDate + "T12:00:00");
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function sessionStats(dateStr) {
  const sessions = attachTimes(buildSessions(state.courses), state.dayStart);
  const checks = checksForDate(dateStr);
  let totalMinutes = 0;
  let doneMinutes = 0;
  let compTotal = 0;
  let compDone = 0;
  for (const s of sessions) {
    totalMinutes += s.minutes;
    const done = !!checks[s.key];
    if (done) doneMinutes += s.minutes;
    if (s.compulsory) {
      compTotal += 1;
      if (done) compDone += 1;
    }
  }
  const pct = totalMinutes ? Math.min(100, Math.round((doneMinutes / totalMinutes) * 100)) : 0;
  return { sessions, checks, totalMinutes, doneMinutes, compTotal, compDone, pct };
}

function dayCompletionRatio(dateStr) {
  const { totalMinutes, doneMinutes } = sessionStats(dateStr);
  if (!totalMinutes) return 0;
  return doneMinutes / totalMinutes;
}

function streakEndingAt(endIso) {
  let streak = 0;
  const d = new Date(endIso + "T12:00:00");
  for (let i = 0; i < 400; i++) {
    const cur = new Date(d);
    cur.setDate(cur.getDate() - i);
    const key = cur.toISOString().slice(0, 10);
    const ratio = dayCompletionRatio(key);
    const { totalMinutes } = sessionStats(key);
    if (!totalMinutes) break;
    if (ratio >= 0.8) streak += 1;
    else break;
  }
  return streak;
}

function weekConsistency(endIso) {
  const d = new Date(endIso + "T12:00:00");
  const pcts = [];
  for (let i = 6; i >= 0; i--) {
    const cur = new Date(d);
    cur.setDate(cur.getDate() - i);
    const key = cur.toISOString().slice(0, 10);
    const r = dayCompletionRatio(key);
    const { totalMinutes } = sessionStats(key);
    pcts.push(totalMinutes ? Math.round(r * 100) : 0);
  }
  const avg = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0;
  return { avg, pcts };
}

function renderHoursAlert() {
  const total = totalScheduledMinutes(state.courses);
  hoursAlert.hidden = false;
  if (total < MIN_DAILY_MINUTES) {
    hoursAlert.className = "alert-banner warn";
    hoursAlert.textContent = `Plan is under 10 hours — add about ${fmtHours(MIN_DAILY_MINUTES - total)} h more (courses below).`;
  } else {
    hoursAlert.className = "alert-banner ok";
    hoursAlert.textContent = "Daily plan meets the 10 hour goal. Nice structure.";
  }
}

function setRing(pct) {
  ringFg.setAttribute("stroke-dasharray", String(RING_C));
  ringFg.style.strokeDashoffset = String(RING_C * (1 - Math.min(100, pct) / 100));
  ringPct.textContent = `${pct}%`;
}

function balanceFromCompletion(pct) {
  const focus = pct;
  const br = Math.min(100, Math.round(35 + (100 - pct) * 0.65));
  return { focus, break: br };
}

function renderDashboard() {
  const dateStr = selectedDate();
  dateLine.textContent = dateLabelLong(dateStr);

  const { sessions, checks, totalMinutes, doneMinutes, compTotal, compDone, pct } = sessionStats(dateStr);
  const goalM = Math.max(MIN_DAILY_MINUTES, totalMinutes);
  const pctVsGoal = goalM ? Math.min(100, Math.round((doneMinutes / goalM) * 100)) : 0;

  heroHoursLabel.textContent = `${fmtHours(doneMinutes)} / ${fmtHours(goalM)} hours completed`;
  const remain = Math.max(0, goalM - doneMinutes);
  heroRemainLabel.textContent = `${fmtHours(remain)} hours remaining`;
  heroBar.style.width = `${pctVsGoal}%`;

  setRing(pctVsGoal);

  sumCompleted.textContent = `${fmtHours(doneMinutes)} h`;
  sumRemaining.textContent = `${fmtHours(remain)} h`;
  sumCompulsory.textContent = `${compDone} / ${compTotal}`;

  if (pct >= 100) motivateLine.textContent = "Great work — today’s plan is complete.";
  else if (pct >= 80) motivateLine.textContent = "Great progress! Keep it up.";
  else if (pct >= 40) motivateLine.textContent = "Solid start — finish compulsory blocks first.";
  else if (totalMinutes) motivateLine.textContent = "Let’s begin — tick blocks in Check-in as you finish.";
  else motivateLine.textContent = "Add courses below to build today’s plan.";

  const { focus, break: breakW } = balanceFromCompletion(pct);
  focusBar.style.width = `${focus}%`;
  breakBar.style.width = `${breakW}%`;

  const goodFocus = focus >= 55;
  focusTag.textContent = goodFocus ? "Good" : "Build";
  focusTag.className = `tag ${goodFocus ? "tag--good" : "tag--watch"}`;
  const goodBreak = breakW >= 50;
  breakTag.textContent = goodBreak ? "Good" : "Adjust";
  breakTag.className = `tag ${goodBreak ? "tag--good" : "tag--watch"}`;

  if (pct >= 80 && pct < 100) {
    balanceTip.textContent = "You’re maintaining a healthy balance between subjects. Well done!";
  } else if (pct >= 100) {
    balanceTip.textContent = "All scheduled blocks are checked — rest and reset for tomorrow.";
  } else {
    balanceTip.textContent = "Use short breaks between blocks; check off each session when it’s done.";
  }

  const totalH = totalMinutes / 60;
  scheduleTotal.textContent = totalMinutes ? `Total: ${totalH % 1 === 0 ? totalH : totalH.toFixed(1)} h` : "";

  scheduleList.innerHTML = "";
  if (!sessions.length) {
    emptySchedule.hidden = false;
  } else {
    emptySchedule.hidden = true;
    sessions.forEach((s) => {
      const done = !!checks[s.key];
      const dotColor = DOT_COLORS[(s.index - 1) % DOT_COLORS.length];
      const li = el("li", { className: "schedule-row" });
      li.appendChild(el("span", { className: "schedule-row__idx", textContent: String(s.index) }));
      const dot = el("span", { className: "schedule-row__dot" });
      dot.style.background = dotColor;
      li.appendChild(dot);
      const mid = el("div", { className: "schedule-row__mid" });
      mid.appendChild(el("div", { className: "schedule-row__time", textContent: s.timeRange }));
      const titleRow = el("p", { className: "schedule-row__title" });
      const hrs = s.minutes / 60;
      titleRow.appendChild(
        document.createTextNode(`${s.name} · ${hrs % 1 === 0 ? hrs : hrs.toFixed(1)} h`)
      );
      if (s.compulsory) titleRow.appendChild(el("span", { className: "badge-compulsory", textContent: "Compulsory" }));
      mid.appendChild(titleRow);
      li.appendChild(mid);

      if (done) {
        li.appendChild(el("button", { type: "button", className: "btn-study btn-study--done", textContent: "Done", disabled: true }));
      } else {
        const b = el("button", { type: "button", className: "btn-study", textContent: "Study" });
        b.addEventListener("click", () => {
          checks[s.key] = true;
          saveState(state);
          renderAll();
        });
        li.appendChild(b);
      }

      scheduleList.appendChild(li);
    });
  }

  const { avg, pcts } = weekConsistency(dateStr);
  weekPct.textContent = String(avg);
  weekBars.innerHTML = "";
  const maxBar = Math.max(1, ...pcts);
  pcts.forEach((p) => {
    const h = Math.max(8, Math.round((p / maxBar) * 48));
    const bar = el("div", {
      className: "week-bar" + (p >= 70 ? " week-bar--fill" : ""),
      title: `${p}%`,
      style: { height: `${h}px` },
    });
    weekBars.appendChild(bar);
  });

  streakDays.textContent = String(streakEndingAt(dateStr));

  const next = sessions.find((s) => !checks[s.key]);
  if (next) {
    const clock = formatClock(next.startMinutes);
    nextReminderText.textContent = `${clock} — ${next.name}${next.compulsory ? " (Compulsory)" : ""}`;
  } else if (sessions.length) {
    nextReminderText.textContent = "All blocks done for this day.";
  } else {
    nextReminderText.textContent = "Add courses to see reminders.";
  }
}

function renderCheckin() {
  const dateStr = selectedDate();
  const { sessions, checks } = sessionStats(dateStr);
  checkinList.innerHTML = "";
  if (!sessions.length) {
    emptyCheckin.hidden = false;
    return;
  }
  emptyCheckin.hidden = true;

  for (const s of sessions) {
    const done = !!checks[s.key];
    const li = el("li", { className: "checkin-row" + (done ? " checkin-row--done" : "") });
    const cb = el("input", {
      type: "checkbox",
      checked: done,
    });
    cb.setAttribute("aria-label", `Done: ${s.name}`);
    cb.addEventListener("change", () => {
      checks[s.key] = cb.checked;
      saveState(state);
      renderAll();
    });
    const body = el("div", { className: "checkin-body" });
    body.appendChild(el("p", { className: "checkin-title", textContent: s.name }));
    body.appendChild(
      el("p", {
        className: "checkin-meta",
        textContent: `${s.timeRange} · ${s.minutes} min${s.compulsory ? " · compulsory" : ""}`,
      })
    );
    const pill = el("span", {
      className: "status-pill " + (done ? "status-pill--done" : "status-pill--pending"),
      textContent: done ? "Completed" : "Pending",
    });
    li.appendChild(cb);
    li.appendChild(body);
    li.appendChild(pill);
    checkinList.appendChild(li);
  }
}

function renderCourses() {
  courseTableBody.innerHTML = "";
  const sorted = [...state.courses].sort((a, b) => a.order - b.order);

  sorted.forEach((course) => {
    const tr = el("tr", { dataset: { id: course.id } });

    const tdActions = el("td", { className: "actions" });
    const grip = el("button", {
      type: "button",
      className: "btn icon-drag",
      title: "Drag to reorder",
      textContent: "⠿",
    });
    grip.draggable = true;
    grip.addEventListener("dragstart", (e) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", course.id);
      tr.classList.add("dragging");
    });
    grip.addEventListener("dragend", () => tr.classList.remove("dragging"));
    tr.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    });
    tr.addEventListener("drop", (e) => {
      e.preventDefault();
      const fromId = e.dataTransfer.getData("text/plain");
      if (fromId === course.id) return;
      reorderCourses(fromId, course.id);
    });
    const del = el("button", { type: "button", className: "btn danger", textContent: "Remove" });
    del.addEventListener("click", () => {
      state.courses = state.courses.filter((c) => c.id !== course.id);
      normalizeOrder();
      saveState(state);
      renderAll();
    });
    tdActions.appendChild(grip);
    tdActions.appendChild(del);

    const tdName = el("td");
    const nameInput = el("input", { type: "text", value: course.name });
    nameInput.addEventListener("change", () => {
      course.name = nameInput.value.trim() || course.name;
      saveState(state);
      renderAll();
    });
    tdName.appendChild(nameInput);

    const tdMin = el("td");
    const minInput = el("input", { type: "number", min: 15, max: 480, value: course.minutes });
    minInput.addEventListener("change", () => {
      course.minutes = Math.min(480, Math.max(15, Number(minInput.value) || 60));
      minInput.value = String(course.minutes);
      saveState(state);
      renderAll();
    });
    tdMin.appendChild(minInput);

    const tdComp = el("td");
    const comp = el("input", { type: "checkbox", checked: course.compulsory });
    comp.addEventListener("change", () => {
      course.compulsory = comp.checked;
      saveState(state);
      renderAll();
    });
    tdComp.appendChild(comp);

    tr.appendChild(tdName);
    tr.appendChild(tdMin);
    tr.appendChild(tdComp);
    tr.appendChild(tdActions);
    courseTableBody.appendChild(tr);
  });
}

function reorderCourses(fromId, toId) {
  const list = [...state.courses].sort((a, b) => a.order - b.order);
  const fromIdx = list.findIndex((c) => c.id === fromId);
  const toIdx = list.findIndex((c) => c.id === toId);
  if (fromIdx < 0 || toIdx < 0) return;
  const [removed] = list.splice(fromIdx, 1);
  list.splice(toIdx, 0, removed);
  list.forEach((c, i) => {
    c.order = i;
  });
  state.courses = list;
  saveState(state);
  renderAll();
}

function normalizeOrder() {
  state.courses
    .sort((a, b) => a.order - b.order)
    .forEach((c, i) => {
      c.order = i;
    });
}

function renderAll() {
  renderHoursAlert();
  renderDashboard();
  renderCheckin();
  renderCourses();
}

document.querySelectorAll(".bottom-nav__btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const id = btn.dataset.tab;
    document.querySelectorAll(".bottom-nav__btn").forEach((b) => {
      const on = b === btn;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    document.getElementById("tab-dashboard").hidden = id !== "dashboard";
    document.getElementById("tab-checkin").hidden = id !== "checkin";
  });
});

planDate.value = new Date().toISOString().slice(0, 10);
planDate.addEventListener("change", () => renderAll());

dayStartInput.value = state.dayStart;
dayStartInput.addEventListener("change", () => {
  state.dayStart = dayStartInput.value || "06:00";
  saveState(state);
  renderAll();
});

addCourseForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("newCourseName").value.trim();
  const minutes = Math.min(480, Math.max(15, Number(document.getElementById("newCourseMinutes").value) || 60));
  const compulsory = document.getElementById("newCourseCompulsory").checked;
  const maxOrder = state.courses.reduce((m, c) => Math.max(m, c.order), -1);
  state.courses.push({
    id: crypto.randomUUID(),
    name: name || "New course",
    minutes,
    compulsory,
    order: maxOrder + 1,
  });
  saveState(state);
  addCourseForm.reset();
  document.getElementById("newCourseMinutes").value = "90";
  document.getElementById("newCourseCompulsory").checked = true;
  renderAll();
});

btnResetDay.addEventListener("click", () => {
  if (!confirm("Clear all checkmarks for this day?")) return;
  state.checks[selectedDate()] = {};
  saveState(state);
  renderAll();
});

btnMarkAll.addEventListener("click", () => {
  const dateStr = selectedDate();
  const sessions = attachTimes(buildSessions(state.courses), state.dayStart);
  const checks = checksForDate(dateStr);
  for (const s of sessions) checks[s.key] = true;
  saveState(state);
  renderAll();
});

normalizeOrder();
saveState(state);
renderAll();
