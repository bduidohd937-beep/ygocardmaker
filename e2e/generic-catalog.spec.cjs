const { test, expect } = require("@playwright/test");
const { unzipSync, strFromU8 } = require("fflate");
const { readFileSync } = require("node:fs");

async function openCatalog(page) {
  await page.goto("/");
  await page.getByRole("button", { name: "V4.3 통합 작업실 열기" }).click();
  await page.getByRole("button", { name: /05 범용 카드 도감/ }).click();
  await expect(page.getByRole("region", { name: "범용 카드 도감" })).toBeVisible();
}
test("도감 9종 초기 등록, ID·역할 검색 및 검증 상태 독립 저장", async ({ page }) => {
  await openCatalog(page);
  await expect(page.getByText("전체").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /정수약탈자 루미크론/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /차원의 유예/ })).toBeVisible();
  const query = page.getByLabel("범용 카드 검색");
  await query.fill("특수 소환 대응 드로우");
  await expect(page.getByText("검색 결과 1건")).toBeVisible();
  await query.fill("919300104");
  await page.getByRole("button", { name: /공역의 관측자－오르비아/ }).click();
  await expect(page.getByLabel("도감 CDB 구현 상태")).toHaveValue("제작 기록");
  await expect(page.getByLabel("도감 Lua 구현 상태")).toHaveValue("제작 기록");
  await expect(page.getByLabel("도감 실전 검증 상태")).toHaveValue("미검증");
  await page.getByLabel("도감 실전 검증 상태").selectOption("검증 중");
  await page.getByLabel("도감 검증 메모").fill("EDOPro 미완료: 추후 실전 검증");
  await expect(page.getByText("이 기기에 저장됨")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "V4.3 통합 작업실 열기" }).click();
  await page.getByRole("button", { name: /05 범용 카드 도감/ }).click();
  await page.getByLabel("범용 카드 검색").fill("919300104");
  await page.getByRole("button", { name: /공역의 관측자－오르비아/ }).click();
  await expect(page.getByLabel("도감 실전 검증 상태")).toHaveValue("검증 중");
  await expect(page.getByLabel("도감 CDB 구현 상태")).toHaveValue("제작 기록");
  await expect(page.getByLabel("도감 검증 메모")).toHaveValue("EDOPro 미완료: 추후 실전 검증");
});
test("도감 ZIP 출력에 한글 폴더와 검증 원문이 포함된다", async ({ page }, testInfo) => {
  await openCatalog(page);
  const promise = page.waitForEvent("download");
  await page.getByRole("button", { name: "도감 ZIP" }).click();
  const result = await promise;
  expect(result.suggestedFilename()).toBe("범용카드_도감_전체백업.zip");
  const output = testInfo.outputPath("도감.zip");
  await result.saveAs(output);
  const zip = unzipSync(new Uint8Array(readFileSync(output)));
  expect(zip["범용카드_도감/범용카드_마스터목록.csv"]).toBeDefined();
  expect(zip["범용카드_도감/채택카드/919300104_공역의_관측자－오르비아/검증기록.md"]).toBeDefined();
  expect(strFromU8(zip["범용카드_도감/범용카드_채택기록.md"])).toContain("제작 기록");
});
