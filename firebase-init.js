// Firebase 콘솔에서 복사한 설정 값을 아래 firebaseConfig에 붙여넣으세요.
// 경로: Firebase 콘솔 > 프로젝트 설정(톱니바퀴) > 일반 > 내 앱 > (없으면 </> 웹 앱 추가) > SDK 설정 및 구성
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);

let authReadyPromise = null;

// 학생/선생님 화면 모두 로그인 UI 없이 익명 인증만으로 DB 규칙(auth != null)을 통과시킨다.
export function ensureAuth() {
  if (!authReadyPromise) {
    authReadyPromise = new Promise((resolve, reject) => {
      const unsub = onAuthStateChanged(
        auth,
        (user) => {
          if (user) {
            unsub();
            resolve(user);
          }
        },
        reject
      );
      signInAnonymously(auth).catch(reject);
    });
  }
  return authReadyPromise;
}
