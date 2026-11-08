# DUELMIND Card Studio — 리소스 확보·검토 기록

조사일: 2026-11-08. 현재 앱은 React/TypeScript/Vite의 자체 Canvas 렌더러다.
9개 기본 프레임과 펜듈럼, 한국어 줄바꿈, 업로드/크롭, JSON/CDB 입력,
IndexedDB 저장, PNG/JPG/ZIP 출력을 구현한 상태에서 리소스를 조사했다.
기존 src 파일을 외부 코드로 교체하거나 기존 데이터를 초기화하지 않았다.

## 보관 위치

- `resources/catalog.json`: 175개 파일의 원본 저장소·고정 커밋·경로·URL·SHA256·바이트·PNG 크기·분류·권리 검토 상태.
- `resources/review-only/`: 실제 확보한 파일. 공개 배포 검토 전용, Git 제외.
- `resources/review-only/index.html`: 로컬 이미지 목록 미리보기.
- `scripts/collect-resources.mjs`: 지정한 세 조사용 클론에서 필요한 파일만 선별 복사.
- `scripts/verify-resources.mjs`: 175개 파일 크기와 SHA256 재검증.

`review-only`는 Vite의 public/ 또는 src/가 아니다. 앱에서 import하거나 원격 hotlink하지 않는다.
GitHub에는 조사 문서와 목록·도구만 포함한다. 사용 허가를 받은 파일만 추후 별도 승격한다.
조사용 원본 클론은 프로젝트의 부모 폴더에 있으며 실행/의존성 설치하지 않았다.

## 확보 내역

| 원본 | 고정 커밋 | 파일 수 | 주요 내용 |
|---|---|---:|---|
| kooriookami/yugioh-card | 92462bbd2aa3aa0075ebcc9b633bdc05137fd7ac | 54 | 프레임 16, 한국어 속성/마법/함정 아이콘 9, 레벨·랭크 2, 링크 on/off 16, 마함 유형 6, 한국어 폰트 3, 배치 JS 1, LICENSE 1 |
| alixsep/yugilife | 3daf8f553d70ffecbe2402206ddafe52a0687fdd | 70 | 속성 계열 8, 링크 활성/비활성/그림자 24, 마함 유형 6, 별 2, 텍스처·마스크·배치 자료 29, LICENSE 1 |
| Paper-Yuan/yugioh-ai-card-creator | 2c0dd8105ab258b4ba090a523c784f4ab157c08a | 51 | 프레임 16, 속성 계열 9, 링크 on/off 16, 마함 유형 6, 레벨·랭크 2, 권리 관련 문서 2 |

동일 의미의 파일이 여러 저장소에 있으므로 175종의 독립 디자인이 있다는 뜻은 아니다.
원본 크기·해시를 유지했다. 총 약 54.5 MiB이며 조사용 복제본 간 중복을 포함한다.

### 카드 프레임

kooriookami와 Paper-Yuan에서 각각 확보:

- 일반, 효과, 의식, 융합, 싱크로, 엑시즈, 링크, 토큰, 마법, 함정: 10종.
- 일반/효과/의식/융합/싱크로/엑시즈 펜듈럼: 6종.
- kooriookami PNG는 모두 1394×2031. 현재 앱의 842×1228 좌표를 그대로 쓸 수 없다.
- YugiLife는 완성 PNG 프레임 모음 대신 813×1185 기준의 텍스처·색상·마스크·레이어 방식이다.

### 아이콘

- 한국어: 어둠·빛·땅·물·불·바람·신 7종 + 마법·함정 2종 (`attribute-*-kr.png`).
- 레벨/랭크 별 각각 1종.
- 링크 8방향 × 활성/비활성 = 16종. YugiLife는 그림자 8개를 추가로 제공한다.
- 지속·속공·장착·필드·의식·카운터 아이콘 각각 1종.
- YugiLife의 attribute-light-divine은 빛/신 공통 이미지 계열이며 독립 한국어 7종 세트로 세지 않는다.
- 공식 로고·저작권 인쇄·홀로그램 스티커·실제 카드 일러스트·희귀도 효과는 선별 수집하지 않았다.

## 원본 라이선스와 자산 조건

아래는 원문에서 확인한 사실과 배포 전 필요한 검토다. 저장소 라이선스만으로
모든 제3자 이미지·상표·폰트의 권리까지 확인되었다고 취급하지 않는다.

### kooriookami

- [고정 LICENSE](https://github.com/kooriookami/yugioh-card/blob/92462bbd2aa3aa0075ebcc9b633bdc05137fd7ac/LICENSE): MIT, copyright 2023-present kooriookami.
- 원저작자의 소프트웨어/문서 재사용 시 저작권 및 허가문 보존 조건을 기록했다.
- README는 고해상도 템플릿 제공자로 白羽幸鳥를 감사 표기한다.
- 확인한 자료에는 템플릿 제공자·원 권리자의 별도 이미지 이용 허가나
  ygo-kr/ygo-kr-name/ygo-kr-race 폰트의 독립 라이선스 증빙이 없다.
- 분류: 저장소 MIT 확인 / 제3자 템플릿·아이콘·폰트 재배포 미확인.

### YugiLife

- [템플릿 패키지](https://github.com/alixsep/yugilife/blob/3daf8f553d70ffecbe2402206ddafe52a0687fdd/packages/yugilife-templates/package.json)의 license 필드는 AGPL-3.0-only.
- 같은 패키지 LICENSE 및 앱 LICENSE는 GNU AGPL v3 본문이다.
- 템플릿 README는 레이어/자산/배치가 같은 패키지로 관리된다고 설명한다.
- 코드나 template.json을 제품에 직접 결합하려면 해당 라이선스 의무를 검토해야 한다.
  현재 앱이 자동으로 AGPL로 바뀌었다는 뜻은 아니다. 제품 코드는 결합하지 않았다.
- 원본 상표/폰트 권리는 별도다. 상용 계열 폰트와 테스트의 공식 일러스트는 선별 수집하지 않았다.
- 분류: AGPL 명시 / 제3자 이미지 권리·한국어 별도 자산 미확인.

### Paper-Yuan

- [고정 LICENSE](https://github.com/Paper-Yuan/yugioh-ai-card-creator/blob/2c0dd8105ab258b4ba090a523c784f4ab157c08a/LICENSE)는 자체 코드만 MIT 적용이라고 명시하고 제3자 프레임·아이콘·폰트를 제외한다.
- [ASSETS.md](https://github.com/Paper-Yuan/yugioh-ai-card-creator/blob/2c0dd8105ab258b4ba090a523c784f4ab157c08a/docs/ASSETS.md)는 프레임·아이콘을 kooriookami의 MIT 출처로 소개하면서,
  마지막에는 Konami 자산의 공개 재배포·상용 이용을 하지 말라고 안내한다.
- README에도 MIT 이미지라는 설명과 제3자 자산 재배포 금지 안내가 함께 있다.
- 따라서 'MIT로 자유 재배포 가능'이라고 확정하지 않는다. 원본과 조건이 상충하는 자산으로 분리했다.
- Source Han Sans OFL 표기는 확인했지만 SC 폰트는 현재 한국어 Noto 폰트의 대체품으로 필요하지 않아 수집하지 않았다.

## 부족한 자료

1. 원 권리자/템플릿 제작자의 공개 웹앱 내 재배포를 허용하는 독립적인 허가 증빙.
2. 공식 한국어 인쇄 폰트의 웹 임베딩·수정·재배포 권한. 현재 앱은 Noto Sans KR(OFL)을 유지한다.
3. 한국어 금칙처리/자간/본문 압축의 실제 인쇄본 대조 및 긴 텍스트 검증.
4. 대형 펜듈럼/풀아트/특수 신 카드 프레임: 현재 제품 범위 밖. 일부 원본에는 있으나 선별 대상에서 제외했다.
5. EDOPro 적용 후 인게임 선명도·가독성: 이번 자산 확보와 별도의 검증 단계.

## 적용 제안

`INTEGRATION.md`에 프레임/속성/마함 유형/링크 비트 매핑과 배치 환산 계획을 기록했다.
당장은 자체 프레임과 도형 아이콘을 유지한다. 배포 허용이 확인된 자산만
`public/assets/card/`로 옮기고 허가문·출처와 함께 레이어 설정으로 연결한다.
