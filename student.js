import { db, ensureAuth } from "./firebase-init.js";
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
const joinBtn = document.getElementById("joinBtn");
const joinError = document.getElementById("joinError");

const waitScreen = document.getElementById("waitScreen");
const myNumberLabel = document.getElementById("myNumberLabel");

const wordScreen = document.getElementById("wordScreen");
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
  return `clt_student_number_${code}`;
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

function watchMode(code, studentNumber) {
  onValue(ref(db, `sessions/${code}/mode`), (snap) => {
    const mode = snap.val() || "idle";
    if (mode === "wordcloud") {
      myNumberLabel2.textContent = studentNumber;
      showScreen(wordScreen);
    } else {
      myNumberLabel.textContent = studentNumber;
      showScreen(waitScreen);
    }
  });
}

function setupWordSubmit(code, studentNumber) {
  wordSubmitBtn.addEventListener("click", async () => {
    const text = wordInput.value.trim();
    if (!text) return;
    await push(ref(db, `sessions/${code}/words`), {
      text,
      by: studentNumber,
      ts: serverTimestamp(),
    });
    wordInput.value = "";
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
    watchMode(code, saved);
    setupWordSubmit(code, saved);
    return;
  }

  showScreen(joinScreen);
  joinBtn.addEventListener("click", async () => {
    const number = numberInput.value.trim();
    if (!number) {
      joinError.textContent = "번호를 입력하세요.";
      return;
    }
    await set(ref(db, `sessions/${code}/students/${number}`), {
      joinedAt: serverTimestamp(),
    });
    localStorage.setItem(studentKey(code), number);
    watchMode(code, number);
    setupWordSubmit(code, number);
  });
  numberInput.addEventListener("keydown", (e) => {
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
