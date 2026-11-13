const { test, expect } = require("@playwright/test");

test("메인에서 한 번 클릭으로 범용 카드 도감에 진입한다", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "범용 카드 도감 바로 열기" })).toBeVisible();
  await page.getByRole("button", { name: "범용 카드 도감 바로 열기" }).click();
  const dialog = page.getByRole("dialog", { name: "범용 카드 도감" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("region", { name: "범용 카드 도감" })).toBeVisible();
  await expect(dialog.getByText("검색 결과 9건")).toBeVisible();
  await expect(dialog.getByRole("navigation", { name: "통합 제작 단계" })).toHaveCount(0);
  await dialog.getByLabel("범용 카드 검색").fill("990470201");
  await expect(dialog.getByText("검색 결과 1건")).toBeVisible();
  await dialog.getByRole("button", { name: "통합 작업실 전체 보기" }).click();
  const workspace = page.getByRole("dialog", { name: "카드 제작 통합 작업실" });
  await expect(workspace.getByRole("navigation", { name: "통합 제작 단계" })).toBeVisible();
  await workspace.getByRole("button", { name: "통합 작업실 닫기" }).click();
  await page.getByRole("button", { name: "V4.3 통합 작업실 열기" }).click();
  await expect(page.getByRole("dialog", { name: "카드 제작 통합 작업실" })).toBeVisible();
  await page.getByRole("button", { name: /05 범용 카드 도감/ }).click();
  await expect(page.getByRole("region", { name: "범용 카드 도감" })).toBeVisible();
});