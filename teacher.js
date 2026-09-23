import { db, ensureAuth } from "./firebase-init.js";
import { avatarFor } from "./avatars.js";
import { REACTION_TYPES } from "./reactions.js";
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
const tabReaction = document.getElementById("tabReaction");
const tabPoll = document.getElementById("tabPoll");
const tabBuzzer = document.getElementById("tabBuzzer");
const pickerPanel = document.getElementById("pickerPanel");
const cloudPanel = document.getElementById("cloudPanel");
const reactionPanel = document.getElementById("reactionPanel");
const pollPanel = document.getElementById("pollPanel");
const buzzerPanel = document.getElementById("buzzerPanel");

const poolAllInput = document.getElementById("poolAllInput");
const poolRangeInput = document.getElementById("poolRangeInput");
const noRepeatInput = document.getElementById("noRepeatInput");
const modeButtons = [...document.querySelectorAll(".mode-btn")];
const pickerStage = document.getElementById("pickerStage");
const pickBtn = document.getElementById("pickBtn");
const resetHistoryBtn = document.getElementById("resetHistoryBtn");
const pickHistoryEl = document.getElementById("pickHistory");

const resetWordsBtn = document.getElementById("resetWordsBtn");
const wordcloudEl = document.getElementById("wordcloud");

const resetReactionsBtn = document.getElementById("resetReactionsBtn");
const reactionBoard = document.getElementById("reactionBoard");

const pollEditor = document.getElementById("pollEditor");
const pollResults = document.getElementById("pollResults");
const pollQuestionInput = document.getElementById("pollQuestionInput");
const pollOptionInputs = [...document.querySelectorAll(".poll-option-input")];
const startPollBtn = document.getElementById("startPollBtn");
const pollQuestionLabel = document.getElementById("pollQuestionLabel");
const pollBars = document.getElementById("pollBars");
const newPollBtn = document.getElementById("newPollBtn");

const newRoundBtn = document.getElementById("newRoundBtn");
const buzzerOrderEl = document.getElementById("buzzerOrder");

const STORAGE_KEY = "clt_teacher_session_code";

let currentCode = null;
let joinedStudents = [];
let studentNicknames = {};
let pickHistoryList = [];
let latestReactions = {};
let latestPoll = null;
let latestBuzzer = null;
let activeUnsubs = [];
let picking = false;
let pickerMode = "spinner";

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

function studentLabel(n) {
  const nickname = studentNicknames[n] && studentNicknames[n].nickname;
  return nickname ? `${n}번 ${nickname}` : `${n}번`;
}

function renderStudents() {
  studentCountEl.textContent = joinedStudents.length;
  if (joinedStudents.length === 0) {
    studentChips.innerHTML = '<span class="muted">아직 입장한 학생이 없어요.</span>';
  } else {
    const sorted = [...joinedStudents].sort((a, b) => Number(a) - Number(b));
    studentChips.innerHTML = sorted.map((n) => chipHtml(n)).join("");
  }
  renderReactionBoard();
}

function reactionCategoryHtml(emoji, label, list) {
  const chips = list.length
    ? list.sort((a, b) => Number(a) - Number(b)).map((n) => chipHtml(n)).join("")
    : '<span class="muted" style="font-size:13px;">없음</span>';
  return `
    <div class="reaction-category">
      <div class="reaction-category-header">${emoji}</div>
      <div class="reaction-category-count">${escapeHtml(label)} (${list.length})</div>
      <div class="chip-list">${chips}</div>
    </div>
  `;
}

function renderReactionBoard() {
  const groups = {};
  for (const t of REACTION_TYPES) groups[t.key] = [];
  const responded = new Set();
  for (const n of Object.keys(latestReactions)) {
    const key = latestReactions[n] && latestReactions[n].reaction;
    if (groups[key]) {
      groups[key].push(n);
      responded.add(n);
    }
  }
  const noResponse = joinedStudents.filter((n) => !responded.has(n));

  const cards = REACTION_TYPES.map((t) => reactionCategoryHtml(t.emoji, t.label, groups[t.key]));
  cards.push(reactionCategoryHtml("🤔", "응답 없음", noResponse));
  reactionBoard.innerHTML = cards.join("");
}

function renderPoll() {
  if (!latestPoll || !latestPoll.question) {
    pollEditor.style.display = "block";
    pollResults.style.display = "none";
    return;
  }
  pollEditor.style.display = "none";
  pollResults.style.display = "block";
  pollQuestionLabel.textContent = latestPoll.question;
  const options = latestPoll.options || [];
  const votes = latestPoll.votes || {};
  const counts = options.map(() => 0);
  for (const v of Object.values(votes)) {
    if (typeof v === "number" && counts[v] !== undefined) counts[v]++;
  }
  const total = counts.reduce((a, b) => a + b, 0);
  const palette = ["#ff8fab", "#58d6ac", "#b8a9ff", "#ffb37b"];
  pollBars.innerHTML = options
    .map((opt, i) => {
      const pct = total ? Math.round((counts[i] / total) * 100) : 0;
      return `
        <div class="poll-bar-row">
          <div class="poll-bar-label"><span>${escapeHtml(opt)}</span><span>${counts[i]}표 (${pct}%)</span></div>
          <div class="poll-bar-track"><div class="poll-bar-fill" style="width:${pct}%;background:${palette[i % palette.length]}"></div></div>
        </div>
      `;
    })
    .join("");
}

function renderBuzzer() {
  const buzzes = (latestBuzzer && latestBuzzer.buzzes) || {};
  const entries = Object.entries(buzzes).sort((a, b) => a[1] - b[1]);
  if (entries.length === 0) {
    buzzerOrderEl.innerHTML = '<span class="muted">아직 누른 학생이 없어요.</span>';
    return;
  }
  const medals = ["🥇", "🥈", "🥉"];
  buzzerOrderEl.innerHTML = entries
    .map(([n], i) => {
      const rank = medals[i] || `${i + 1}.`;
      return `
        <div class="buzzer-row">
          <span class="buzzer-rank">${rank}</span>
          <span class="avatar">${avatarFor(n)}</span>
          <span>${escapeHtml(studentLabel(n))}</span>
        </div>
      `;
    })
    .join("");
}

function chipHtml(n) {
  return `<span class="chip"><span class="avatar">${avatarFor(n)}</span>${escapeHtml(studentLabel(n))}</span>`;
}

function getPool() {
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
  return pool;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 화면에 다 그리기엔 너무 많은 후보 풀일 때, 당첨자는 반드시 포함하고 나머지는 무작위로 골라 cap개만 보여준다.
function sampleForDisplay(pool, winner, cap) {
  if (pool.length <= cap) return shuffle(pool);
  const others = shuffle(pool.filter((p) => p !== winner)).slice(0, cap - 1);
  return shuffle([...others, winner]);
}

function renderPickHistory() {
  if (pickHistoryList.length === 0) {
    pickHistoryEl.innerHTML = '<span class="muted">아직 뽑은 기록이 없어요.</span>';
    return;
  }
  pickHistoryEl.innerHTML = pickHistoryList.map((n) => chipHtml(n)).join("");
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
      studentNicknames = val;
      renderStudents();
      if (!picking) renderIdleStage();
    })
  );

  activeUnsubs.push(
    onValue(ref(db, `sessions/${code}/pickerHistory`), (snap) => {
      const val = snap.val() || {};
      pickHistoryList = Object.values(val);
      renderPickHistory();
      if (!picking) renderIdleStage();
    })
  );

  activeUnsubs.push(
    onValue(ref(db, `sessions/${code}/words`), (snap) => {
      const val = snap.val() || {};
      renderWordCloud(Object.values(val));
    })
  );

  activeUnsubs.push(
    onValue(ref(db, `sessions/${code}/reactions`), (snap) => {
      latestReactions = snap.val() || {};
      renderReactionBoard();
    })
  );

  activeUnsubs.push(
    onValue(ref(db, `sessions/${code}/poll`), (snap) => {
      latestPoll = snap.val();
      renderPoll();
    })
  );

  activeUnsubs.push(
    onValue(ref(db, `sessions/${code}/buzzer`), (snap) => {
      latestBuzzer = snap.val();
      renderBuzzer();
    })
  );
}

newSessionBtn.addEventListener("click", () => {
  if (!confirm("새 수업을 시작하면 새 코드가 발급됩니다. 계속할까요?")) return;
  startNewSession();
});

// 탭 전환
const TAB_PANELS = {
  picker: { btn: tabPicker, panel: pickerPanel },
  wordcloud: { btn: tabCloud, panel: cloudPanel },
  reaction: { btn: tabReaction, panel: reactionPanel },
  poll: { btn: tabPoll, panel: pollPanel },
  buzzer: { btn: tabBuzzer, panel: buzzerPanel },
};

function setActiveTab(mode) {
  const active = TAB_PANELS[mode] ? mode : "picker";
  for (const [key, { btn, panel }] of Object.entries(TAB_PANELS)) {
    btn.classList.toggle("active", key === active);
    panel.style.display = key === active ? "block" : "none";
  }
}

async function setMode(mode) {
  if (!currentCode) return;
  await update(ref(db, `sessions/${currentCode}`), { mode });
  setActiveTab(mode);
}

tabPicker.addEventListener("click", () => setMode("picker"));
tabCloud.addEventListener("click", () => setMode("wordcloud"));
tabReaction.addEventListener("click", () => setMode("reaction"));
tabPoll.addEventListener("click", () => setMode("poll"));
tabBuzzer.addEventListener("click", () => setMode("buzzer"));

poolAllInput.addEventListener("change", () => {
  poolRangeInput.disabled = poolAllInput.checked;
  renderIdleStage();
});
poolRangeInput.addEventListener("change", renderIdleStage);
noRepeatInput.addEventListener("change", renderIdleStage);

modeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    modeButtons.forEach((b) => b.classList.toggle("active", b === btn));
    pickerMode = btn.dataset.mode;
    renderIdleStage();
  });
});

function renderIdleStage() {
  const pool = getPool();
  if (pickerMode === "lottery") renderLotteryIdle(pool);
  else if (pickerMode === "race") renderRaceIdle(pool);
  else if (pickerMode === "pinball") renderPinballIdle(pool);
  else renderSpinnerIdle();
}

function renderSpinnerIdle() {
  pickerStage.innerHTML = `
    <div class="picker-avatar">❓</div>
    <div class="picker-number">-</div>
  `;
}

const LOTTERY_CAP = 30;
const RACE_CAP = 12;
const PINBALL_CAP = 10;

function renderLotteryIdle(pool) {
  const shown = pool.slice(0, LOTTERY_CAP);
  pickerStage.innerHTML = `<div class="lottery-grid">${shown
    .map(() => slipHtml())
    .join("")}</div>`;
}

function slipHtml(n) {
  const front = n
    ? `<div class="slip-avatar">${avatarFor(n)}</div><div>${escapeHtml(studentLabel(n))}</div>`
    : "";
  return `
    <div class="slip" data-n="${n || ""}">
      <div class="slip-face slip-back">🎫</div>
      <div class="slip-face slip-front">${front}</div>
    </div>
  `;
}

function renderRaceIdle(pool) {
  const shown = pool.slice(0, RACE_CAP);
  pickerStage.innerHTML = `<div class="race-track">${shown
    .map((n) => raceLaneHtml(n))
    .join("")}</div>`;
}

function raceLaneHtml(n) {
  return `
    <div class="race-lane" data-n="${n}">
      <div class="race-runner" style="left:4px;">${avatarFor(n)}<span class="runner-label">${escapeHtml(studentLabel(n))}</span></div>
    </div>
  `;
}

function renderPinballIdle(pool) {
  renderPinballBoard(pool.slice(0, PINBALL_CAP));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runSpinner(pool, finalPick) {
  renderSpinnerIdle();
  const avatarEl = pickerStage.querySelector(".picker-avatar");
  const numberEl = pickerStage.querySelector(".picker-number");
  const spinDuration = 1200;
  const spinStep = 80;
  const steps = Math.floor(spinDuration / spinStep);
  for (let i = 0; i < steps; i++) {
    const r = pool[Math.floor(Math.random() * pool.length)];
    avatarEl.textContent = avatarFor(r);
    numberEl.textContent = studentLabel(r);
    await sleep(spinStep);
  }
  avatarEl.textContent = avatarFor(finalPick);
  numberEl.textContent = studentLabel(finalPick);
}

async function runLottery(pool, finalPick) {
  const shown = sampleForDisplay(pool, finalPick, LOTTERY_CAP);
  pickerStage.innerHTML = `<div class="lottery-grid">${shown.map((n) => slipHtml(n)).join("")}</div>`;
  const slips = [...pickerStage.querySelectorAll(".slip")];
  slips.forEach((s) => s.classList.add("shaking"));
  await sleep(900);
  slips.forEach((s) => s.classList.remove("shaking"));
  await sleep(150);
  for (const s of slips) {
    if (s.dataset.n === finalPick) {
      s.classList.add("flipped", "winner");
    } else {
      s.classList.add("dimmed");
    }
  }
  await sleep(650);
}

async function runRace(pool, finalPick) {
  const shown = sampleForDisplay(pool, finalPick, RACE_CAP);
  pickerStage.innerHTML = `<div class="race-track">${shown.map((n) => raceLaneHtml(n)).join("")}</div>`;
  await sleep(30); // 시작 위치가 먼저 그려지도록 한 프레임 대기
  const lanes = [...pickerStage.querySelectorAll(".race-lane")];
  const winDuration = 1.8 + Math.random() * 0.3;
  lanes.forEach((lane) => {
    const runner = lane.querySelector(".race-runner");
    const isWinner = lane.dataset.n === finalPick;
    const duration = isWinner ? winDuration : winDuration + 0.4 + Math.random() * 0.8;
    runner.style.transitionDuration = `${duration}s`;
    runner.style.left = "calc(100% - 110px)";
  });
  await sleep((winDuration + 1.3) * 1000);
  lanes.forEach((lane) => lane.classList.toggle("winner", lane.dataset.n === finalPick));
}

async function runPinball(pool, finalPick) {
  const shown = sampleForDisplay(pool, finalPick, PINBALL_CAP);
  const winnerIndex = Math.max(0, shown.indexOf(finalPick));
  renderPinballBoard(shown);
  const ball = pickerStage.querySelector(".pinball-ball");
  const slotCount = shown.length;
  const targetX = ((winnerIndex + 0.5) / slotCount) * 100;
  const totalSteps = 26;
  for (let i = 1; i <= totalSteps; i++) {
    const progress = i / totalSteps;
    const wobble = Math.sin(progress * Math.PI * 5) * (1 - progress) * 12;
    const x = 50 + (targetX - 50) * progress + wobble;
    const y = 6 + progress * 82;
    ball.style.left = `${x}%`;
    ball.style.top = `${y}%`;
    await sleep(35);
  }
  const slots = [...pickerStage.querySelectorAll(".pinball-slot")];
  slots.forEach((slot, i) => slot.classList.toggle("winner", i === winnerIndex));
}

function renderPinballBoard(shown) {
  const pegs = [];
  const rows = 4;
  for (let r = 1; r <= rows; r++) {
    const cols = 4 + (r % 2);
    for (let c = 0; c < cols; c++) {
      const x = ((c + 0.5) / cols) * 100;
      const y = (r / (rows + 1)) * 100;
      pegs.push(`<div class="pinball-peg" style="left:${x}%;top:${y}%;"></div>`);
    }
  }
  pickerStage.innerHTML = `
    <div class="pinball-board">
      ${pegs.join("")}
      <div class="pinball-ball" style="left:50%;top:6%;"></div>
    </div>
    <div class="pinball-slots">${shown
      .map((n) => `<div class="pinball-slot" data-n="${n}">${avatarFor(n)}</div>`)
      .join("")}</div>
  `;
}

pickBtn.addEventListener("click", async () => {
  if (!currentCode || picking) return;
  const pool = getPool();
  if (pool.length === 0) {
    alert("뽑을 수 있는 학생이 없어요. (모두 뽑았거나 입장한 학생이 없어요)");
    return;
  }
  const finalPick = pool[Math.floor(Math.random() * pool.length)];

  picking = true;
  pickBtn.disabled = true;
  if (pickerMode === "lottery") await runLottery(pool, finalPick);
  else if (pickerMode === "race") await runRace(pool, finalPick);
  else if (pickerMode === "pinball") await runPinball(pool, finalPick);
  else await runSpinner(pool, finalPick);

  if (noRepeatInput.checked) {
    push(ref(db, `sessions/${currentCode}/pickerHistory`), finalPick);
  }
  picking = false;
  pickBtn.disabled = false;
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

resetReactionsBtn.addEventListener("click", async () => {
  if (!currentCode) return;
  if (!confirm("반응을 초기화할까요?")) return;
  await remove(ref(db, `sessions/${currentCode}/reactions`));
});

startPollBtn.addEventListener("click", async () => {
  if (!currentCode) return;
  const question = pollQuestionInput.value.trim();
  const options = pollOptionInputs.map((i) => i.value.trim()).filter(Boolean);
  if (!question) {
    alert("질문을 입력하세요.");
    return;
  }
  if (options.length < 2) {
    alert("선택지를 2개 이상 입력하세요.");
    return;
  }
  await set(ref(db, `sessions/${currentCode}/poll`), {
    question,
    options,
    createdAt: serverTimestamp(),
  });
  pollQuestionInput.value = "";
  pollOptionInputs.forEach((i) => (i.value = ""));
});

newPollBtn.addEventListener("click", async () => {
  if (!currentCode) return;
  await remove(ref(db, `sessions/${currentCode}/poll`));
});

newRoundBtn.addEventListener("click", async () => {
  if (!currentCode) return;
  await set(ref(db, `sessions/${currentCode}/buzzer`), { startedAt: serverTimestamp() });
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
  const palette = ["#ff8fab", "#58d6ac", "#b8a9ff", "#ffb37b", "#4fc3e0", "#ff6b9d"];
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

  renderIdleStage();

  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const snap = await get(ref(db, `sessions/${saved}`));
    if (snap.exists()) {
      attachSession(saved);
      const mode = (snap.val() && snap.val().mode) || "idle";
      setActiveTab(mode);
      return;
    }
  }
  await startNewSession();
  setActiveTab("picker");
}

init();
