import { db, ensureAuth } from "./firebase-init.js";
import {
  ref,
  set,
  update,
  remove,
  push,
  onValue,
  serverTimestamp,
  get,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const authStatus = document.getElementById("authStatus");
const sessionCodeEl = document.getElementById("sessionCode");
const studentLinkEl = document.getElementById("studentLink");
const qrHolder = document.getElementById("qrHolder");
const newSessionBtn = document.getElementById("newSessionBtn");
const studentChips = document.getElementById("studentChips");
const studentCountEl = document.getElementById("studentCount");

const tabPicker = document.getElementById("tabPicker");
const tabCloud = document.getElementById("tabCloud");
const pickerPanel = document.getElementById("pickerPanel");
const cloudPanel = document.getElementById("cloudPanel");

const poolAllInput = document.getElementById("poolAllInput");
const poolRangeInput = document.getElementById("poolRangeInput");
const noRepeatInput = document.getElementById("noRepeatInput");
const pickerNumber = document.getElementById("pickerNumber");
const pickBtn = document.getElementById("pickBtn");
const resetHistoryBtn = document.getElementById("resetHistoryBtn");
const pickHistoryEl = document.getElementById("pickHistory");

const resetWordsBtn = document.getElementById("resetWordsBtn");
const wordcloudEl = document.getElementById("wordcloud");

const STORAGE_KEY = "clt_teacher_session_code";

let currentCode = null;
let joinedStudents = [];
let pickHistoryList = [];
let activeUnsubs = [];
let picking = false;

function randomCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function studentUrl(code) {
  const url = new URL("student.html", window.location.href);
  url.searchParams.set("s", code);
  return url.toString();
}

function renderQr(text) {
  qrHolder.innerHTML = "";
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  qrHolder.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2 });
}

async function startNewSession() {
  await ensureAuth();
  const code = randomCode();
  await set(ref(db, `sessions/${code}`), {
    createdAt: serverTimestamp(),
    mode: "idle",
  });
  localStorage.setItem(STORAGE_KEY, code);
  attachSession(code);
}

function renderStudents() {
  studentCountEl.textContent = joinedStudents.length;
  if (joinedStudents.length === 0) {
    studentChips.innerHTML = '<span class="muted">아직 입장한 학생이 없어요.</span>';
    return;
  }
  const sorted = [...joinedStudents].sort((a, b) => Number(a) - Number(b));
  studentChips.innerHTML = sorted
    .map((n) => `<span class="chip">${escapeHtml(n)}</span>`)
    .join("");
}

function renderPickHistory() {
  if (pickHistoryList.length === 0) {
    pickHistoryEl.innerHTML = '<span class="muted">아직 뽑은 기록이 없어요.</span>';
    return;
  }
  pickHistoryEl.innerHTML = pickHistoryList
    .map((n) => `<span class="chip">${escapeHtml(n)}</span>`)
    .join("");
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function attachSession(code) {
  currentCode = code;
  sessionCodeEl.textContent = code;
  const url = studentUrl(code);
  studentLinkEl.innerHTML = `학생 접속 링크: <a href="${url}" target="_blank">${url}</a>`;
  renderQr(url);

  // 코드가 바뀔 때마다 이전 세션 경로의 리스너는 해제하고 새 경로에 다시 붙인다.
  for (const unsub of activeUnsubs) unsub();
  activeUnsubs = [];

  activeUnsubs.push(
    onValue(ref(db, `sessions/${code}/students`), (snap) => {
      const val = snap.val() || {};
      joinedStudents = Object.keys(val);
      renderStudents();
    })
  );

  activeUnsubs.push(
    onValue(ref(db, `sessions/${code}/pickerHistory`), (snap) => {
      const val = snap.val() || {};
      pickHistoryList = Object.values(val);
      renderPickHistory();
    })
  );

  activeUnsubs.push(
    onValue(ref(db, `sessions/${code}/words`), (snap) => {
      const val = snap.val() || {};
      renderWordCloud(Object.values(val));
    })
  );
}

newSessionBtn.addEventListener("click", () => {
  if (!confirm("새 수업을 시작하면 새 코드가 발급됩니다. 계속할까요?")) return;
  startNewSession();
});

// 탭 전환
function setActiveTab(mode) {
  tabPicker.classList.toggle("active", mode === "picker");
  tabCloud.classList.toggle("active", mode === "wordcloud");
  pickerPanel.style.display = mode === "wordcloud" ? "none" : "block";
  cloudPanel.style.display = mode === "wordcloud" ? "block" : "none";
}

async function setMode(mode) {
  if (!currentCode) return;
  await update(ref(db, `sessions/${currentCode}`), { mode });
  setActiveTab(mode);
}

tabPicker.addEventListener("click", () => setMode("picker"));
tabCloud.addEventListener("click", () => setMode("wordcloud"));

poolAllInput.addEventListener("change", () => {
  poolRangeInput.disabled = poolAllInput.checked;
});

pickBtn.addEventListener("click", async () => {
  if (!currentCode || picking) return;
  let pool;
  if (poolAllInput.checked) {
    pool = [...joinedStudents];
  } else {
    const n = Math.max(1, Number(poolRangeInput.value) || 1);
    pool = Array.from({ length: n }, (_, i) => String(i + 1));
  }
  if (noRepeatInput.checked) {
    const excluded = new Set(pickHistoryList);
    pool = pool.filter((n) => !excluded.has(n));
  }
  if (pool.length === 0) {
    alert("뽑을 수 있는 학생이 없어요. (모두 뽑았거나 입장한 학생이 없어요)");
    return;
  }

  picking = true;
  pickBtn.disabled = true;
  const spinDuration = 1200;
  const spinStep = 80;
  const spinEndAt = Date.now() + spinDuration;
  const spinTimer = setInterval(() => {
    const r = pool[Math.floor(Math.random() * pool.length)];
    pickerNumber.textContent = r;
    if (Date.now() >= spinEndAt) {
      clearInterval(spinTimer);
      const finalPick = pool[Math.floor(Math.random() * pool.length)];
      pickerNumber.textContent = finalPick;
      if (noRepeatInput.checked) {
        push(ref(db, `sessions/${currentCode}/pickerHistory`), finalPick);
      }
      picking = false;
      pickBtn.disabled = false;
    }
  }, spinStep);
});

resetHistoryBtn.addEventListener("click", async () => {
  if (!currentCode) return;
  if (!confirm("뽑기 기록을 초기화할까요?")) return;
  await remove(ref(db, `sessions/${currentCode}/pickerHistory`));
});

resetWordsBtn.addEventListener("click", async () => {
  if (!currentCode) return;
  if (!confirm("글자구름을 초기화할까요?")) return;
  await remove(ref(db, `sessions/${currentCode}/words`));
});

function renderWordCloud(entries) {
  if (entries.length === 0) {
    wordcloudEl.innerHTML = '<span class="muted">아직 제출된 단어가 없어요.</span>';
    return;
  }
  const counts = new Map();
  for (const e of entries) {
    const text = String(e && e.text || "").trim().toLowerCase();
    if (!text) continue;
    counts.set(text, (counts.get(text) || 0) + 1);
  }
  const list = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (list.length === 0) {
    wordcloudEl.innerHTML = '<span class="muted">아직 제출된 단어가 없어요.</span>';
    return;
  }
  const maxCount = list[0][1];
  const minPx = 18;
  const maxPx = 100;
  const palette = ["#38bdf8", "#fbbf24", "#4ade80", "#f472b6", "#a78bfa", "#fb923c"];
  wordcloudEl.innerHTML = list
    .map(([word, count], i) => {
      const size = minPx + (count / maxCount) * (maxPx - minPx);
      const color = palette[i % palette.length];
      return `<span style="font-size:${size.toFixed(0)}px;color:${color}">${escapeHtml(word)}</span>`;
    })
    .join("");
}

async function init() {
  try {
    await ensureAuth();
  } catch (err) {
    authStatus.textContent = "연결 실패";
    authStatus.classList.remove("warn");
    authStatus.classList.add("danger");
    newSessionBtn.disabled = true;
    alert(
      "Firebase 연결에 실패했어요. firebase-init.js의 설정값을 확인해주세요.\n\n" +
        (err && err.message ? err.message : err)
    );
    return;
  }
  authStatus.textContent = "연결됨";
  authStatus.classList.remove("warn");
  authStatus.classList.add("ok");

  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const snap = await get(ref(db, `sessions/${saved}`));
    if (snap.exists()) {
      attachSession(saved);
      const mode = (snap.val() && snap.val().mode) || "idle";
      setActiveTab(mode === "wordcloud" ? "wordcloud" : "picker");
      return;
    }
  }
  await startNewSession();
  setActiveTab("picker");
}

init();
