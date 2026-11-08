import { newCard, type Project } from "./model";
// Original procedural illustrations; no third-party card assets.
export function demoArt(mode = 0): string {
  const c = document.createElement("canvas");
  c.width = 840;
  c.height = 840;
  const x = c.getContext("2d")!;
  const g = x.createLinearGradient(0, 0, 780, 840);
  g.addColorStop(0, mode === 1 ? "#112f50" : "#163b47");
  g.addColorStop(0.55, mode === 1 ? "#438d9c" : "#679d9b");
  g.addColorStop(1, "#101d30");
  x.fillStyle = g;
  x.fillRect(0, 0, 840, 840);
  x.fillStyle = "#d9eed3";
  x.beginPath();
  x.arc(580, 220, 105, 0, Math.PI * 2);
  x.fill();
  for (let i = 0; i < 11; i++) {
    x.beginPath();
    x.moveTo(-20, 540 + i * 32);
    for (let j = 0; j <= 30; j++)
      x.lineTo(j * 30, 540 + i * 32 + Math.sin(j * 0.38 + i * 0.6) * 28);
    x.lineTo(880, 880);
    x.lineTo(-20, 880);
    x.fillStyle = `rgba(14,42,59,${0.12 + i * 0.02})`;
    x.fill();
  }
  const poly = (pts: number[][], color: string) => {
    x.beginPath();
    pts.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])));
    x.closePath();
    x.fillStyle = color;
    x.fill();
    x.strokeStyle = "#bce0ce";
    x.lineWidth = 2;
    x.stroke();
  };
  x.save();
  x.translate(0, mode === 2 ? 40 : 0);
  poly(
    [
      [415, 430],
      [90, 250],
      [181, 482],
      [324, 531],
      [399, 504],
    ],
    "#213d4f",
  );
  poly(
    [
      [418, 429],
      [741, 243],
      [665, 478],
      [508, 530],
      [441, 507],
    ],
    "#20394d",
  );
  poly(
    [
      [408, 425],
      [132, 290],
      [281, 483],
      [399, 487],
    ],
    "#8fb3b0",
  );
  poly(
    [
      [438, 426],
      [702, 288],
      [556, 482],
      [450, 491],
    ],
    "#73a6a6",
  );
  poly(
    [
      [416, 380],
      [371, 454],
      [396, 566],
      [355, 681],
      [421, 628],
      [486, 683],
      [449, 561],
      [471, 454],
    ],
    "#b3c9bd",
  );
  poly(
    [
      [416, 380],
      [403, 483],
      [421, 628],
      [449, 561],
      [471, 454],
    ],
    "#365767",
  );
  poly(
    [
      [416, 380],
      [396, 348],
      [444, 330],
      [477, 369],
      [444, 385],
    ],
    "#d6d8bb",
  );
  poly(
    [
      [444, 365],
      [510, 370],
      [454, 394],
    ],
    "#e9c77b",
  );
  x.fillStyle = "#81f5d9";
  x.shadowBlur = 24;
  x.shadowColor = "#73ffe5";
  x.beginPath();
  x.arc(445, 355, 6, 0, Math.PI * 2);
  x.fill();
  x.shadowBlur = 0;
  x.restore();
  x.strokeStyle = "#d6ead056";
  for (let i = 0; i < 20; i++) {
    x.beginPath();
    x.moveTo(i * 53 - 80, 0);
    x.lineTo(i * 53 + 110, 840);
    x.stroke();
  }
  return c.toDataURL("image/png");
}
export function demoProject(): Project {
  const names = [
    "이소바르 아르젠",
    "이소바르 솔라 호크",
    "이소바르의 기압전선",
  ];
  const cards = names.map((name, i) => ({
    ...newCard(210000401 + i, "이소바르 · 디자인 샘플"),
    name,
    artwork: demoArt(i),
    effect:
      i === 0
        ? "①: 이 카드가 일반 소환 또는 특수 소환에 성공했을 경우에 발동할 수 있다. 덱에서 「이소바르」 마법 / 함정 카드 1장을 패에 넣는다.\n이 카드명의 효과는 1턴에 1번밖에 사용할 수 없다."
        : "디자인 확인을 위한 샘플 카드입니다. 실제 카드 원문은 CDB 또는 JSON에서 가져와 주세요.",
  }));
  cards[1].frame = "xyz";
  cards[1].atk = "2400";
  cards[1].def = "1800";
  cards[2].frame = "spell";
  cards[2].subtype = "속공";
  return { version: 1, name: "나의 카드 작업실", cards };
}
