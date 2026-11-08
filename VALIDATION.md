# 검증 기록 — 2026-11-08

## 자동 검사

- `npm test`: 16개 통과, 0개 실패.
- `npm run build`: TypeScript 및 Vite production build 성공.
- `npm audit`: 설치 패키지 알려진 취약점 0개.
- `node scripts/verify-resources.mjs`: 175개 검토 파일의 크기·SHA256 일치.
- 외부 review-only 파일은 Git 제외, dist에 포함하지 않음.

## Chrome에서 실제 수행

- 자체 Canvas 프레임과 한국어 샘플 3장 미리보기 표시.
- 카드명 수정 및 목록/미리보기 반영.
- 링크 프레임으로 전환 시 DEF 필드가 숨겨지고 링크 수치·8방향 마커 표시.
- 펜듈럼 체크 시 양쪽 스케일·펜듈럼 효과 표시 및 입력.
- 페이지/브라우저 재연결 후 IndexedDB 작업 복원.
- metadata-update.json을 가져와 동일 ID의 이름·효과·1700/1300 스탯 갱신.
  일러스트 data URI 길이 898666으로 기존 파일이 유지되는 것 확인.
- JSON 저장 버튼으로 duelmind-project.json 실제 다운로드 확인.
- PNG 실제 다운로드를 Pillow로 검사: 1263×1842, PNG.
- JPG 실제 다운로드를 Pillow로 검사: 421×614, JPEG.
- 선택한 3장 ZIP 실제 다운로드 후 ZipFile로 검사:
  pics 이미지 3개(421×614), originals 3개(1263×1842), manifest.json 1개.
  manifest 카드 3개와 ID 파일명이 일치.
- 기존 로컬 ygocustom.cdb 37장 읽기 전용 가져오기: 샘플 포함 목록 40장 확인.
- 일러스트 없는 CDB 카드의 출력 차단 및 경고 표시 확인.
- 입력 데이터 처리 중 브라우저 console error 없음 확인.

## CDB에서 발견한 입력 자료 문제

원본 DB의 210000307, 210000308은 LINK 1/2인데 def(링크 마커) 값이 모두 0이다.
처음에는 가져오기를 차단했으나, 메타데이터를 편집할 수 있도록 가져오기는 허용하고
출력 시 링크 수치/마커 불일치를 차단하도록 조정했다. 원본 DB는 수정하지 않았다.

## 검증하지 않은 항목

EDOPro 인게임 적용, 실제 효과 처리, Safari/Firefox, 대형 2000장 프로젝트,
휴대폰 실기기, 공식 카드 인쇄본과의 완전한 자형/색상 일치.
재배포 검토 중인 프레임·아이콘의 제품 적용은 수행하지 않았다.
