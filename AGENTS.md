# 진도계획표 프로젝트

- 원본 저장소: https://github.com/dacisosl/jindo-manager
- 수정본 저장소: https://github.com/soupplan-xam/jindo-manager
- 기존 공개 주소: https://dacisosl.github.io/jindo-manager/
- 배포: 원본 main push 시 GitHub Actions → GitHub Pages
- Supabase / Vercel: 사용하지 않음. 데이터는 브라우저 localStorage에 저장됨.
- 연결 계정은 원본 쓰기 권한 없음. 원본 공개 사이트 변경에는 소유자의 PR 반영이 필요함.
- 검사: node scripts/check-exam-target.mjs, npm run build
