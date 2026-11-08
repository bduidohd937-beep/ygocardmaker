# 렌더러 연결 계획 (아직 외부 자산 미적용)

## 현재 구현과 필요한 보완

`src/render.ts`는 동일 Canvas 코드로 미리보기/내보내기를 처리한다.
프레임은 색상+도형, 속성은 원형+문자, 별과 링크는 도형으로 직접 그린다.
마함 유형은 현재 텍스트로 표시한다. 수집한 유형 아이콘이 추후 이를 보완할 수 있다.
현재의 JSON/CDB 가져오기·일러스트·크롭·출력 코드는 유지한다.

## 허가 확인 후 자산 매핑

| 앱 데이터 | 후보 파일 (kooriookami 기준) |
|---|---|
| normal/effect/fusion/ritual/synchro/xyz/link/spell/trap | card-{frame}.png |
| pendulum=true | card-{frame}-pendulum.png (링크/마함 제외) |
| 토큰 | card-token.png, 앱 모델은 별도 확장 필요 |
| 어둠/빛/땅/물/불/바람/신 | attribute-{dark/light/earth/water/fire/wind/divine}-kr.png |
| 마법/함정 | attribute-{spell/trap}-kr.png |
| 레벨/랭크 | level.png / rank.png |
| 지속/속공/장착/필드/의식/카운터 | icon-{continuous/quick-play/equip/field/ritual/counter}.png |

링크 비트 ↔ 방향은 EDOPro 기준을 유지한다:
64 좌상, 128 상, 256 우상, 8 좌, 32 우, 1 좌하, 2 하, 4 우하.
파일의 up/left-up/right-down 이름으로 매핑한다.
kooriookami arrowList 배열 번호는 1=상부터 시계방향이므로 비트 값과 혼동하면 안 된다.

## 배치 구조 확인

kooriookami는 1394×2031 기준으로 배경→이름→속성→별→마함 유형→일러스트→마스크→
펜듈럼→효과→스탯→하단 텍스트를 레이어로 그린다.
kr-style.js에는 한국어 전용 이름/종족/본문 글꼴과 자간·행간이 있다.
이름 top 90/fontSize 106, 속성 x1163/y96, 본문 계열 fontSize36/lineHeight1.19,
펜듈럼 top1282, 효과 표제 top1526을 확인했다. 일부 값은 기본 style에서 상속한다.
따라서 이 숫자만으로 전체 배치를 복원했다고 주장하지 않는다.

현재 출력 좌표로는 x*=842/1394, y*=1228/2031로 각각 변환하거나,
렌더러 논리 좌표 자체를 원본 크기로 변경하고 출력 때만 스케일한다.
현재 842×1228와 원본 비율의 미세 차이를 명시하고 비균등 변형/여백 정책을 결정해야 한다.
카드명·본문이 구 프레임 텍스트 영역을 덮지 않도록 동일 설정에서 비교한다.

YugiLife는 813×1185의 JSON 레이어·자산 ID·마스크·색상 preset 구조다.
단일 프레임 PNG처럼 붙이는 구조가 아니며 AGPL 템플릿을 직접 변환/포팅하기 전 조건 검토가 필요하다.
현재 조사한 Series 10 template.json에서 한국어 로캘 설정은 확인하지 못했다.

## 검증할 항목

1. 자산 허가/출처 표시, 해시 고정, 누락 파일 검사.
2. 한국어 7속성, 별 0~13, 링크 8방향 on/off, 마함 유형 6종.
3. 일반/엑시즈/링크/6펜듈럼 및 긴 본문에서 레이어 겹침.
4. 미리보기와 PNG/JPG/ZIP 이미지의 동일성 및 폰트 준비 완료 대기.
5. 421×614/1263×1842 출력과 EDOPro 실제 표시.

수집 경로는 현재 앱의 런타임 자산 경로가 아니다. 적용하려면 허가 확인 후
AssetPack 인터페이스(프레임/아이콘/좌표/폰트/출처)를 추가하고,
기존 original 팩을 fallback으로 남기는 방식이 적절하다.
