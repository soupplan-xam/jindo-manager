// Firebase 웹 앱 설정 — Firebase 콘솔 > 프로젝트 설정 > 내 앱에서 복사한 값.
// 이 값들은 공개되어도 되는 식별자다. 데이터 보호는 firestore.rules(본인 문서만 읽고 쓰기)가 맡는다.
// apiKey 가 비어 있으면 기기 연동 기능은 숨겨지고 앱은 이 브라우저 저장만 쓴다.
export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
}
