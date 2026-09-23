# 교실 실시간 도구 (classroom-live)

학생들이 각자 기기로 번호와 닉네임을 입력해 입장하면, 선생님 화면에 실시간으로 표시되는 수업용 웹앱입니다.
- 🎲 랜덤 뽑기: 입장한 학생 중에서 (또는 1~N 범위에서) 무작위로 한 명을 뽑습니다.
- ☁️ 글자구름: 학생들이 제출한 단어를 모아, 많이 나온 단어일수록 크게 보여줍니다.

빌드 없이 정적 파일만으로 동작하며, 실시간 동기화에는 Firebase Realtime Database(무료 Spark 플랜)를 사용합니다.

## 1. Firebase 프로젝트 설정 (최초 1회, 직접 진행)

1. https://console.firebase.google.com 접속 → 로그인 → **프로젝트 추가**
   - 이름 예시: `classroom-live-tools`
   - Google Analytics는 꺼도 됩니다.
2. 왼쪽 메뉴 **Build → Realtime Database → 데이터베이스 만들기**
   - 위치: 가까운 리전 선택 (예: 싱가포르)
   - 우선 **테스트 모드**로 시작 (규칙은 아래 3번에서 교체합니다)
3. Realtime Database → **Rules** 탭 → 이 저장소의 [`database.rules.json`](database.rules.json) 내용을 그대로 붙여넣고 **게시**
4. 왼쪽 메뉴 **Build → Authentication → Sign-in method** → **익명(Anonymous)** 제공업체 사용 설정
5. 프로젝트 설정(⚙️ 톱니바퀴) → **일반** 탭 → 내 앱에서 **웹 앱 추가(`</>`)** → 닉네임만 입력하고 등록
   - 화면에 뜨는 `firebaseConfig` 객체를 복사

## 2. 코드에 설정값 붙여넣기

이 저장소의 [`firebase-init.js`](firebase-init.js) 상단 `firebaseConfig` 객체의 `YOUR_...` 부분을 1번에서 복사한 값으로 교체합니다.

## 3. 배포

GitHub Pages로 배포되어 있다면 `main`/`master` 브랜치에 push할 때마다 자동으로 반영됩니다.

## 4. 사용법

1. 선생님이 [`teacher.html`](teacher.html)을 열면 자동으로 수업 코드(4자리)가 발급됩니다.
2. 학생은 QR코드를 스캔하거나 [`student.html`](student.html)에서 코드를 입력해 접속한 뒤, 자기 번호와 닉네임을 입력해 입장합니다.
3. 선생님 화면 상단 탭에서 "랜덤 뽑기" / "글자구름"을 전환하면 학생 화면도 자동으로 바뀝니다.
4. 다음 수업에는 선생님 화면에서 **새 수업 시작**을 눌러 학생 목록을 초기화합니다.
