import { zipSync, strToU8 } from "fflate";
import { validateCards, type Card } from "./model";
import { renderCard, toBlob } from "./render";
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
export async function exportOne(
  card: Card,
  format: "png" | "jpg",
  width: number,
) {
  const errors = validateCards([card]);
  if (errors.length) throw Error(errors.join("\n"));
  const c = document.createElement("canvas");
  await renderCard(card, c, width);
  download(await toBlob(c, format), `${card.id}.${format}`);
}
export async function exportZip(
  cards: Card[],
  format: "png" | "jpg",
  onProgress: (v: string) => void,
) {
  const errors = validateCards(cards);
  if (!cards.length || errors.length)
    throw Error(errors.join("\n") || "출력할 카드를 선택하세요.");
  const files: Record<string, Uint8Array> = {};
  const manifest = {
    schema_version: 1,
    application: "DUELMIND CARD STUDIO",
    created_at: new Date().toISOString(),
    cards: [] as object[],
  };
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    onProgress(`${i + 1} / ${cards.length} 렌더링 중`);
    const c = document.createElement("canvas");
    await renderCard(card, c, 421);
    files[`pics/${card.id}.${format}`] = new Uint8Array(
      await (await toBlob(c, format)).arrayBuffer(),
    );
    await renderCard(card, c, 1263);
    files[`originals/${card.id}.${format}`] = new Uint8Array(
      await (await toBlob(c, format)).arrayBuffer(),
    );
    manifest.cards.push({
      id: card.id,
      name: card.name,
      theme: card.theme,
      pics: `pics/${card.id}.${format}`,
      original: `originals/${card.id}.${format}`,
      size: { pics: [421, 614], original: [1263, 1842] },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  files["manifest.json"] = strToU8(JSON.stringify(manifest, null, 2));
  return new Blob([zipSync(files, { level: 0 }) as Uint8Array<ArrayBuffer>], {
    type: "application/zip",
  });
}
