import { db, ensureAuth } from "./firebase-init.js";
import { avatarFor } from "./avatars.js";
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

function showScreen(el) {
  for (const s of [codeScreen, joinScreen, waitScreen, wordScreen]) {
    s.style.display = "none";
  }
  el.style.display = "flex";
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

function watchMode(code, student) {
  const avatar = avatarFor(student.number);
  onValue(ref(db, `sessions/${code}/mode`), (snap) => {
    const mode = snap.val() || "idle";
    if (mode === "wordcloud") {
      myAvatar2.textContent = avatar;
      myNumberLabel2.textContent = displayLabel(student);
      showScreen(wordScreen);
    } else {
      myAvatar1.textContent = avatar;
      myNumberLabel.textContent = displayLabel(student);
      showScreen(waitScreen);
    }
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

async function joinWithNumber(code) {
  const saved = localStorage.getItem(studentKey(code));
  if (saved) {
    const student = JSON.parse(saved);
    watchMode(code, student);
    setupWordSubmit(code, student);
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
