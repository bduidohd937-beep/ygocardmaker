# DUELMIND CARD STUDIO

React + TypeScript + Vite로 만든 브라우저 전용 커스텀 카드 이미지 제작기.
카드 효과의 Lua 구현이나 기존 EDOPro 설치본 수정은 하지 않습니다.

## 실행

Node.js 24 권장.

```powershell
npm ci
npm run dev
npm test
npm run build
```

`npm run dev`가 표시한 로컬 주소를 엽니다. 배포 결과물은 dist/입니다.
GitHub Pages는 main push 시 `.github/workflows/pages.yml`로 테스트·빌드·배포합니다.
Vercel에서도 build `npm run build`, output `dist`로 정적 배포할 수 있습니다.

## 사용

1. 카드 목록에서 선택하거나 새 카드를 만듭니다. 테마 필드로 카드를 묶습니다.
2. 카드 종류와 스탯·효과를 입력하고 일러스트 탭에서 PNG/JPG/WebP를 업로드합니다.
3. CDB/JSON 가져오기로 카드 메타데이터를 채웁니다. 동일 ID의 기존 일러스트와 위치는 유지됩니다.
4. JSON 저장으로 프로젝트를 백업합니다. 파일 안에 이미지도 포함됩니다.
5. 출력 체크박스를 선택하고 내보내기에서 PNG/JPG 또는 ZIP을 받습니다.

지원: 일반/효과/의식/융합/싱크로/엑시즈/링크/마법/함정, 링크 마커,
6종 몬스터 펜듈럼, 한국어 자동 줄바꿈·글자 크기 조정, 일러스트 크롭,
테마 필터·검색·복제, IndexedDB 자동 저장.

ZIP 구조:

```text
pics/210000401.png         # 421 × 614
originals/210000401.png    # 1263 × 1842, 전체 카드 고화질
manifest.json             # ID·이름·테마·파일 경로·크기
```

JPG를 선택하면 두 이미지 폴더 모두 .jpg를 사용합니다.
단일 다운로드는 421×614, 842×1228, 1263×1842를 선택할 수 있습니다.
모든 파일명은 카드 ID입니다. 실제 EDOPro 표시 검증은 별도입니다.

## 가져오기와 데이터 보존

- JSON은 프로젝트의 `{version:1, name, cards:[...]}` 또는 EDOPro cards.json 배열을 지원합니다.
- CDB는 datas/texts를 sql.js/WASM으로 브라우저 안에서 읽습니다. 파일을 서버로 전송하지 않습니다.
- 외부 이미지 URL은 가져오지 않습니다. 이미지는 PNG/JPEG/WebP data URI로 보존합니다.
- 메타데이터 병합은 ID 기준입니다. 기존 일러스트가 있으면 이미지·확대·위치를 보호합니다.
- 잘못된 ID/중복 ID는 거부합니다. 이미지 누락·링크 마커 수·스케일·지원하지 않는 설정은 출력 검사에서 확인합니다.
- 초기 3장은 디자인 샘플이며 확정 게임 효과/ID가 아닙니다. 실제 카드 정보는 따로 가져오세요.
- 저장은 브라우저/주소별입니다. 로컬과 배포 사이트는 저장소가 다릅니다. JSON으로 이동하세요.

## 범위와 제한

공식 카드 프레임·로고·상업 폰트를 복제하지 않은 자체 Canvas 프레임입니다.
글이 최소 크기에도 맞지 않으면 출력 오류를 표시하며 텍스트를 잘라 출력하지 않습니다.
매우 긴 카드명은 축소합니다. 특수 튜너/리버스 등 미지원 표기는 확인 경고가 필요합니다.
토큰·공식 홀로그램·희귀도·완전한 공식 인쇄 자형은 아직 지원하지 않습니다.
Undo/카드 삭제/클라우드 동기화는 MVP 범위에 포함하지 않습니다.
큰 프로젝트는 JSON과 ZIP 생성 시 브라우저 메모리를 사용합니다. 중요한 작업은 JSON 백업하세요.

## 자산과 출처

현재 프레임과 샘플 일러스트는 자체 도형/Canvas 코드로 제작했습니다.
UI 아이콘은 Lucide(ISC), 한국어 글꼴은 Noto Sans KR(SIL OFL 1.1)입니다.
폰트 허가문은 public/licenses/NotoSansKR-OFL.txt에 포함합니다.
React·fflate·sql.js 등의 의존성은 각 패키지의 라이선스를 따릅니다.

요청한 외부 카드 리소스는 [조사 보고서](resources/README.md),
[적용 계획](resources/INTEGRATION.md), [파일별 목록](resources/catalog.json)에 정리했습니다.
검토용 외부 이미지와 폰트는 resources/review-only/에만 있으며 Git과 배포에서 제외됩니다.
현재 렌더러에 연결하지 않았습니다.
