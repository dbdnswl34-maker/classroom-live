import { db, ensureAuth } from "./firebase-init.js";
import { avatarFor } from "./avatars.js";
import { REACTION_TYPES } from "./reactions.js";
import {
  ref,
  set,
  push,
  get,
  onValue,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const codeScreen = document.getElementById("codeScreen");
const codeInput = document.getElementById("codeInput");
const codeSubmitBtn = document.getElementById("codeSubmitBtn");
const codeError = document.getElementById("codeError");

const joinScreen = document.getElementById("joinScreen");
const numberInput = document.getElementById("numberInput");
const nicknameInput = document.getElementById("nicknameInput");
const joinBtn = document.getElementById("joinBtn");
const joinError = document.getElementById("joinError");

const waitScreen = document.getElementById("waitScreen");
const myAvatar1 = document.getElementById("myAvatar1");
const myNumberLabel = document.getElementById("myNumberLabel");

const wordScreen = document.getElementById("wordScreen");
const myAvatar2 = document.getElementById("myAvatar2");
const myNumberLabel2 = document.getElementById("myNumberLabel2");
const wordInput = document.getElementById("wordInput");
const wordSubmitBtn = document.getElementById("wordSubmitBtn");
const wordStatus = document.getElementById("wordStatus");

const reactionScreen = document.getElementById("reactionScreen");
const myAvatar3 = document.getElementById("myAvatar3");
const myNumberLabel3 = document.getElementById("myNumberLabel3");
const reactionButtonsEl = document.getElementById("reactionButtons");

const pollScreen = document.getElementById("pollScreen");
const myAvatar4 = document.getElementById("myAvatar4");
const myNumberLabel4 = document.getElementById("myNumberLabel4");
const pollQuestionText = document.getElementById("pollQuestionText");
const pollOptionButtonsEl = document.getElementById("pollOptionButtons");

const buzzerScreen = document.getElementById("buzzerScreen");
const myAvatar5 = document.getElementById("myAvatar5");
const myNumberLabel5 = document.getElementById("myNumberLabel5");
const buzzBtn = document.getElementById("buzzBtn");
const buzzStatus = document.getElementById("buzzStatus");

const ALL_SCREENS = [
  codeScreen,
  joinScreen,
  waitScreen,
  wordScreen,
  reactionScreen,
  pollScreen,
  buzzerScreen,
];

function showScreen(el) {
  for (const s of ALL_SCREENS) {
    s.style.display = "none";
  }
  el.style.display = "flex";
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

function studentKey(code) {
  return `clt_student_${code}`;
}

function displayLabel(student) {
  return student.nickname ? `${student.number}번 ${student.nickname}` : `${student.number}번`;
}

async function resolveCode() {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("s");
  if (fromUrl && /^\d{4}$/.test(fromUrl)) {
    const snap = await get(ref(db, `sessions/${fromUrl}`));
    if (snap.exists()) return fromUrl;
  }
  return null;
}

function askForCode() {
  showScreen(codeScreen);
  codeSubmitBtn.addEventListener("click", async () => {
    const code = codeInput.value.trim();
    if (!/^\d{4}$/.test(code)) {
      codeError.textContent = "4자리 숫자 코드를 입력하세요.";
      return;
    }
    const snap = await get(ref(db, `sessions/${code}`));
    if (!snap.exists()) {
      codeError.textContent = "존재하지 않는 수업 코드예요.";
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set("s", code);
    window.location.href = url.toString();
  });
}

const MODE_SCREENS = {
  wordcloud: () => wordScreen,
  reaction: () => reactionScreen,
  poll: () => pollScreen,
  buzzer: () => buzzerScreen,
};

function watchMode(code, student) {
  const avatar = avatarFor(student.number);
  const label = displayLabel(student);
  onValue(ref(db, `sessions/${code}/mode`), (snap) => {
    const mode = snap.val() || "idle";
    myAvatar1.textContent = avatar;
    myAvatar2.textContent = avatar;
    myAvatar3.textContent = avatar;
    myAvatar4.textContent = avatar;
    myAvatar5.textContent = avatar;
    myNumberLabel.textContent = label;
    myNumberLabel2.textContent = label;
    myNumberLabel3.textContent = label;
    myNumberLabel4.textContent = label;
    myNumberLabel5.textContent = label;
    const screen = MODE_SCREENS[mode] ? MODE_SCREENS[mode]() : waitScreen;
    showScreen(screen);
  });
}

function setupWordSubmit(code, student) {
  wordSubmitBtn.addEventListener("click", async () => {
    const text = wordInput.value.trim();
    if (!text) return;
    wordInput.value = "";
    await push(ref(db, `sessions/${code}/words`), {
      text,
      by: student.number,
      nickname: student.nickname,
      ts: serverTimestamp(),
    });
    wordStatus.textContent = `"${text}" 제출했어요!`;
    wordInput.focus();
  });
  wordInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") wordSubmitBtn.click();
  });
}

function setupReactions(code, student) {
  reactionButtonsEl.innerHTML = REACTION_TYPES.map(
    (r) =>
      `<button class="reaction-btn" data-key="${r.key}"><span>${r.emoji}</span><span class="reaction-btn-label">${escapeHtml(r.label)}</span></button>`
  ).join("");
  const buttons = [...reactionButtonsEl.querySelectorAll(".reaction-btn")];
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      set(ref(db, `sessions/${code}/reactions/${student.number}`), {
        reaction: btn.dataset.key,
        ts: serverTimestamp(),
      });
    });
  });
  onValue(ref(db, `sessions/${code}/reactions/${student.number}`), (snap) => {
    const current = snap.val() && snap.val().reaction;
    buttons.forEach((btn) => btn.classList.toggle("selected", btn.dataset.key === current));
  });
}

function setupPoll(code, student) {
  onValue(ref(db, `sessions/${code}/poll`), (snap) => {
    const poll = snap.val();
    if (!poll || !poll.question) {
      pollQuestionText.textContent = "📊 선생님이 질문을 준비 중이에요";
      pollOptionButtonsEl.innerHTML = "";
      return;
    }
    pollQuestionText.textContent = poll.question;
    const options = poll.options || [];
    const myVote = poll.votes && poll.votes[student.number];
    pollOptionButtonsEl.innerHTML = options
      .map(
        (opt, i) =>
          `<button class="poll-option-btn ${i === myVote ? "selected" : ""}" data-i="${i}">${escapeHtml(opt)}</button>`
      )
      .join("");
    pollOptionButtonsEl.querySelectorAll(".poll-option-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        set(ref(db, `sessions/${code}/poll/votes/${student.number}`), Number(btn.dataset.i));
      });
    });
  });
}

function setupBuzzer(code, student) {
  let lastRoundKey = null;
  let pressedThisRound = false;

  function updateBuzzBtn() {
    buzzBtn.disabled = pressedThisRound;
    buzzBtn.classList.toggle("pressed", pressedThisRound);
    buzzStatus.textContent = pressedThisRound ? "눌렀어요! 결과를 기다려주세요." : "";
  }

  onValue(ref(db, `sessions/${code}/buzzer`), (snap) => {
    const val = snap.val() || {};
    const roundKey = val.startedAt || null;
    if (roundKey !== lastRoundKey) {
      lastRoundKey = roundKey;
      pressedThisRound = !!(val.buzzes && val.buzzes[student.number]);
      updateBuzzBtn();
    }
  });

  buzzBtn.addEventListener("click", () => {
    if (pressedThisRound) return;
    pressedThisRound = true;
    updateBuzzBtn();
    set(ref(db, `sessions/${code}/buzzer/buzzes/${student.number}`), serverTimestamp());
  });
}

async function joinWithNumber(code) {
  const saved = localStorage.getItem(studentKey(code));
  if (saved) {
    const student = JSON.parse(saved);
    watchMode(code, student);
    setupWordSubmit(code, student);
    setupReactions(code, student);
    setupPoll(code, student);
    setupBuzzer(code, student);
    return;
  }

  showScreen(joinScreen);
  joinBtn.addEventListener("click", async () => {
    const number = numberInput.value.trim();
    const nickname = nicknameInput.value.trim();
    if (!number) {
      joinError.textContent = "번호를 입력하세요.";
      return;
    }
    if (!nickname) {
      joinError.textContent = "닉네임을 입력하세요.";
      return;
    }
    const student = { number, nickname };
    await set(ref(db, `sessions/${code}/students/${number}`), {
      nickname,
      joinedAt: serverTimestamp(),
    });
    localStorage.setItem(studentKey(code), JSON.stringify(student));
    watchMode(code, student);
    setupWordSubmit(code, student);
    setupReactions(code, student);
    setupPoll(code, student);
    setupBuzzer(code, student);
  });
  numberInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") joinBtn.click();
  });
  nicknameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") joinBtn.click();
  });
}

async function init() {
  try {
    await ensureAuth();
  } catch (err) {
    showScreen(codeScreen);
    codeScreen.querySelector("h1").textContent = "연결에 실패했어요";
    codeError.textContent = "선생님께 알려주세요: " + (err && err.message ? err.message : err);
    return;
  }
  const code = await resolveCode();
  if (!code) {
    askForCode();
    return;
  }
  await joinWithNumber(code);
}

init();
