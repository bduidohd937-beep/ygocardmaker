import fs from "node:fs";
import crypto from "node:crypto";
const catalog = JSON.parse(fs.readFileSync("resources/catalog.json", "utf8"));
let count = 0;
for (const asset of catalog.assets) {
  const b = fs.readFileSync(asset.local_path);
  if (
    b.length !== asset.bytes ||
    crypto.createHash("sha256").update(b).digest("hex") !== asset.sha256
  )
    throw Error("Mismatch: " + asset.local_path);
  count++;
}
console.log(
  `Verified ${count} local files, sizes and SHA-256 hashes. All marked review_required.`,
);
