// Curated local research collection. No remote code is executed or imported.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
const root = process.cwd();
const specs = [
  {
    slug: "kooriookami",
    dir: "yugioh-card",
    repo: "kooriookami/yugioh-card",
    license: "MIT (repository); underlying artwork permissions unverified",
    base: "src/assets/yugioh-card/yugioh/image",
    filter: (n) =>
      /^card-(normal|effect|ritual|fusion|synchro|xyz|link|token|spell|trap)(-pendulum)?\.png$/.test(
        n,
      ) ||
      /^attribute-(dark|light|earth|water|fire|wind|divine|spell|trap)-kr\.png$/.test(
        n,
      ) ||
      /^(level|rank|icon-(continuous|quick-play|equip|field|ritual|counter)|arrow-.+-(on|off))\.png$/.test(
        n,
      ),
    extras: [
      "LICENSE",
      "packages/src/yugioh-card/style/kr-style.js",
      "src/assets/yugioh-card/yugioh/font/ygo-kr.woff2",
      "src/assets/yugioh-card/yugioh/font/ygo-kr-name.woff2",
      "src/assets/yugioh-card/yugioh/font/ygo-kr-race.woff2",
    ],
  },
  {
    slug: "yugilife",
    dir: "yugilife",
    repo: "alixsep/yugilife",
    license: "AGPL-3.0-only (template package); third-party rights unverified",
    base: "packages/yugilife-templates/templates/card/series-10/assets",
    filter: (n) =>
      /^(attribute-|link-arrow-|spell-trap-icon-|star-|artwork-|effects-|pendulum-)/.test(
        n,
      ),
    extras: [
      "packages/yugilife-templates/LICENSE",
      "packages/yugilife-templates/templates/card/series-10/template.json",
      "packages/yugilife-templates/templates/card/series-10/manifest.json",
      ...[
        "border",
        "frame-texture",
        "link-texture",
        "xyz-texture",
        "pendulum-scale-left",
        "pendulum-scale-right",
      ].map((n) => `packages/yugilife-templates/shared/${n}.png`),
    ],
  },
  {
    slug: "paper-yuan",
    dir: "yugioh-ai-card-creator",
    repo: "Paper-Yuan/yugioh-ai-card-creator",
    license:
      "MIT for own code only; third-party assets excluded; documentation conflicts",
    base: "src/web/public/assets/yugioh/image",
    filter: (n) =>
      /^card-(normal|effect|ritual|fusion|synchro|xyz|link|token|spell|trap)(-pendulum)?\.png$/.test(
        n,
      ) ||
      /^attribute-(dark|light|earth|water|fire|wind|divine|spell|trap)\.png$/.test(
        n,
      ) ||
      /^(level|rank|icon-(continuous|quick-play|equip|field|ritual|counter)|arrow-.+-(on|off))\.png$/.test(
        n,
      ),
    extras: ["LICENSE", "docs/ASSETS.md"],
  },
];
const catalog = {
  schema_version: 1,
  review_date: "2026-11-08",
  policy: "local_review_only_not_cleared_for_redistribution",
  sources: [],
  assets: [],
};
for (const spec of specs) {
  const repo = path.resolve(root, "..", spec.dir);
  const commit = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repo,
    encoding: "utf8",
  }).trim();
  const files = [
    ...fs
      .readdirSync(path.join(repo, spec.base))
      .filter(spec.filter)
      .map((n) => `${spec.base}/${n}`),
    ...spec.extras,
  ];
  catalog.sources.push({
    repository: spec.repo,
    commit,
    license: spec.license,
    selected_file_count: files.length,
  });
  for (const file of files) {
    const source = path.join(repo, file);
    if (!fs.existsSync(source)) throw Error("Missing " + source);
    const bytes = fs.readFileSync(source);
    const relative = `resources/review-only/${spec.slug}/${file}`;
    const dest = path.join(root, relative);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (fs.existsSync(dest) && !fs.readFileSync(dest).equals(bytes))
      throw Error("Refusing to overwrite different asset " + dest);
    if (!fs.existsSync(dest)) fs.copyFileSync(source, dest);
    const name = path.basename(file);
    const category = name.startsWith("card-")
      ? "frame"
      : name.startsWith("attribute-")
        ? "attribute"
        : name.startsWith("arrow-") || name.startsWith("link-arrow-")
          ? "link_arrow"
          : /^(level|rank|star-)/.test(name)
            ? "level_rank"
            : name.startsWith("icon-") || name.startsWith("spell-trap-icon-")
              ? "spell_trap_icon"
              : /woff/.test(name)
                ? "font"
                : /LICENSE|ASSETS\.md/.test(name)
                  ? "license_evidence"
                  : "layout_component";
    const asset = {
      source_repository: spec.repo,
      commit,
      source_path: file,
      source_url: `https://github.com/${spec.repo}/blob/${commit}/${file}`,
      local_path: relative,
      category,
      license_claim: spec.license,
      redistribution_status: "review_required",
      bytes: bytes.length,
      sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    };
    if (name.endsWith(".png") && bytes.subarray(1, 4).toString() === "PNG")
      asset.dimensions = {
        width: bytes.readUInt32BE(16),
        height: bytes.readUInt32BE(20),
      };
    catalog.assets.push(asset);
  }
}
fs.mkdirSync(path.join(root, "resources"), { recursive: true });
fs.writeFileSync(
  path.join(root, "resources/catalog.json"),
  JSON.stringify(catalog, null, 2) + "\n",
);
const tiles = catalog.assets
  .filter((a) => a.dimensions)
  .map(
    (a) =>
      `<figure><img loading="lazy" src="${a.local_path.replace("resources/review-only/", "")}"/><figcaption>${a.source_repository}<br/>${path.basename(a.source_path)}<br/>${a.dimensions.width} × ${a.dimensions.height}</figcaption></figure>`,
  )
  .join("");
fs.writeFileSync(
  path.join(root, "resources/review-only/index.html"),
  `<!doctype html><meta charset="utf-8"><title>DUELMIND resource review</title><style>body{background:#20242b;color:#eee;font:12px system-ui;padding:24px}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:16px}figure{margin:0;background:#333a43;padding:12px}img{width:100%;height:180px;object-fit:contain;background:repeating-conic-gradient(#777 0% 25%,#999 0% 50%) 0/12px 12px}figcaption{overflow-wrap:anywhere;margin-top:10px}</style><h1>Local review only</h1><p>Redistribution not cleared. Not included in app builds.</p><main>${tiles}</main>`,
);
console.log(JSON.stringify(catalog.sources, null, 2));
console.log("Files:", catalog.assets.length);
