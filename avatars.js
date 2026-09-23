// 학생마다 귀여운 동물 캐릭터를 하나씩 배정한다 (번호가 같으면 항상 같은 캐릭터가 나오도록 해시 사용).
const AVATARS = [
  "🐰", "🐱", "🐶", "🐻", "🐼", "🦊", "🐨", "🐯", "🦁", "🐮",
  "🐷", "🐸", "🐵", "🐔", "🐧", "🦄", "🐹", "🐭", "🦋", "🐝",
];

export function avatarFor(key) {
  const s = String(key);
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  }
  return AVATARS[hash % AVATARS.length];
}
