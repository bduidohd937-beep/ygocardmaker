const { test, expect } = require("@playwright/test");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const initSqlJs = require("sql.js");
const { zipSync, unzipSync, strToU8 } = require("fflate");

const cardId = 918770501;
async function makeCdb() {
  const wasmBinary = readFileSync(join(process.cwd(),"node_modules/sql.js/dist/sql-wasm.wasm"));
  const SQL = await initSqlJs({ wasmBinary });
  const db = new SQL.Database();
  db.run("CREATE TABLE datas (id INTEGER, ot INTEGER, alias INTEGER, setcode INTEGER, type INTEGER, atk INTEGER, def INTEGER, level INTEGER, race INTEGER, attribute INTEGER, category INTEGER)");
  db.run("CREATE TABLE texts (id INTEGER, name TEXT, desc TEXT)");
  db.run("INSERT INTO datas VALUES (?,0,0,0,33,1200,800,4,1,16,0)",[cardId]);
  db.run("INSERT INTO texts VALUES (?,?,?)",[cardId,"V4.2 실전 테스트 카드","①: 실전 이미지 출력 테스트."]);
  const bytes = db.export();
  db.close();
  return Buffer.from(bytes);
}
async function openStudio(page) {
  await page.goto("/");
  await page.getByRole("button",{name:"V4.2 통합 작업실 열기"}).click();
  await expect(page.getByRole("dialog",{name:"카드 제작 통합 작업실"})).toBeVisible();
}
test("실제 CDB → PNG ZIP → 카드 ID 원화 저장 → EDOPro ZIP 다운로드", async ({page},testInfo)=>{
  await openStudio(page);
  const cdb = await makeCdb();
  await page.getByLabel("통합 카드 데이터 파일").setInputFiles({
    name:"테스트_카드.cdb",mimeType:"application/octet-stream",buffer:cdb,
  });
  await expect(page.getByRole("status").filter({hasText:"장의 카드 데이터를 가져왔습니다."})).toBeVisible();
  await expect(page.getByText("02 이미지 관리 · 카드 ID 자동 연결")).toBeVisible();
  const dataUrl=await page.evaluate(()=>{
    const canvas=document.createElement("canvas");
    canvas.width=128;canvas.height=128;
    const ctx=canvas.getContext("2d");
    ctx.fillStyle="#124fa8";ctx.fillRect(0,0,128,128);
    ctx.fillStyle="#fff";ctx.fillRect(40,40,48,48);
    return canvas.toDataURL("image/png");
  });
  const png=Buffer.from(dataUrl.split(",")[1],"base64");
  const archive=zipSync({["원화/"+cardId+".png"]:png});
  await page.getByLabel("통합 이미지 묶음 파일").setInputFiles({
    name:"테스트_원화.zip",mimeType:"application/zip",buffer:Buffer.from(archive),
  });
  await expect(page.getByText("매칭 1장")).toBeVisible();
  await page.getByRole("button",{name:"선택한 카드 1장에 이미지 적용"}).click();
  await page.getByRole("button",{name:/04 출력/}).click();
  await page.getByLabel("통합 출력 형태").selectOption("normal");
  await page.getByLabel("통합 출력 규격").selectOption("edopro");
  await expect(page.getByText("출력 가능 1건")).toBeVisible();
  const waitDownload=page.waitForEvent("download");
  await page.getByRole("button",{name:"선택 카드 통합 ZIP 다운로드"}).click();
  const downloaded=await waitDownload;
  expect(downloaded.suggestedFilename()).toBe("카드_통합출력_V4.2.zip");
  const target=testInfo.outputPath("카드_실전출력.zip");
  await downloaded.saveAs(target);
  const files=unzipSync(new Uint8Array(readFileSync(target)));
  const image=files["pics/"+cardId+".png"];
  expect(image).toBeDefined();
  expect(image[0]).toBe(137);
  expect(new DataView(image.buffer,image.byteOffset).getUint32(16)).toBe(421);
  expect(new DataView(image.buffer,image.byteOffset).getUint32(20)).toBe(614);
  const manifest=JSON.parse(new TextDecoder().decode(files["제작_검수보고서.json"]));
  expect(manifest.success).toBe(1);
  expect(manifest.skipped).toHaveLength(0);
  expect(manifest.preflight_version).toBe("4.2");
});
test("잘못된 CDB는 실패 안내하고 성공으로 표시하지 않는다",async({page})=>{
  await openStudio(page);
  await page.getByLabel("통합 카드 데이터 파일").setInputFiles({
    name:"잘못된_카드.cdb",mimeType:"application/octet-stream",buffer:Buffer.from("not a valid CDB"),
  });
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByText("01 카드·CDB 데이터")).toBeVisible();
});
test("손상된 ZIP 원화는 적용 버튼을 활성화하지 않는다",async({page})=>{
  await openStudio(page);
  const cdb=await makeCdb();
  await page.getByLabel("통합 카드 데이터 파일").setInputFiles({
    name:"시험.cdb",mimeType:"application/octet-stream",buffer:cdb,
  });
  await expect(page.getByText("02 이미지 관리 · 카드 ID 자동 연결")).toBeVisible();
  await page.getByLabel("통합 이미지 묶음 파일").setInputFiles({
    name:"손상된_이미지.zip",mimeType:"application/zip",buffer:Buffer.from("invalid zip"),
  });
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("button",{name:/선택한 카드 .*장에 이미지 적용/})).toBeDisabled();
});
