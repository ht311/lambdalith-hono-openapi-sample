# 依存関係・ビルドパイプライン レビュー

**日付**: 2026-06-28
**対象**: `package.json`, `scripts/build.js`, `tspconfig.yaml`, `src/app.ts`, `tsconfig.json`, ビルドパイプライン全般

---

## サマリー

`yaml` パッケージの依存関係分類誤り（`dependencies` → `devDependencies`）と、ESLint ディレクティブの誤記（対象ルールが実際のコードと一致していない上に ESLint 設定ファイル自体が存在しない）が即座に修正すべき問題として挙げられる。
中程度の問題として、`generate:json` のインラインスクリプトによるメンテナンス性の低下、openapi.json / openapi.yaml の二重管理、esbuild バンドル済みにもかかわらず `dist/generated/` 全体をコピーしていることによる冗長なデプロイ成果物がある。
軽微な改善点として、`tsconfig.json` の未使用設定、`generate` と `build` の責務混在、`generated/` が `.gitignore` に含まれていない点が挙げられる。

---

## 課題一覧

### 🔴 高優先度

#### [1] yaml パッケージが `dependencies` に誤って分類されている

- **場所**: `package.json:19`
- **問題**: `yaml` パッケージは `generate:json` スクリプト（`pnpm generate:json`）でのみ使用されており、ビルド時のみ必要なツールである。にもかかわらず `dependencies`（ランタイム依存）に含まれている。
- **影響**: `npm install --production` や `pnpm install --prod` でのインストール時に不要なパッケージが含まれる。esbuild でフルバンドルするためコード上は影響しないが、`package.json` の意図が誤解される。`package-lock.json` や `pnpm-lock.yaml` のサイズ肥大にも繋がる。
- **提案**: `devDependencies` に移動する。

```jsonc
// package.json（修正前）
"dependencies": {
  "yaml": "^2.9.0",   // ← ビルド専用なのに runtime 依存に入っている
  ...
}

// package.json（修正後）
"devDependencies": {
  "yaml": "^2.9.0",
  ...
}
```

---

#### [2] ESLint ディレクティブの誤記 / ESLint 設定自体が存在しない

- **場所**: `src/app.ts:6-8`
- **問題**: `// eslint-disable-next-line @typescript-eslint/no-require-imports` というコメントが JSON import assertion (`import ... with { type: "json" }`) の直前に書かれている。しかし：
  1. `no-require-imports` は `require()` 呼び出しを禁止するルールであり、`import` 文には適用されない。このディレクティブは何も無効化していない。
  2. プロジェクトに ESLint 設定ファイル（`eslint.config.js`, `.eslintrc.*` 等）が存在しない。ESLint が設定されていない状態でディレクティブを書いても効果はない。
- **影響**: コードの意図が誤解される。将来 ESLint を導入した際に「なぜここに suppress コメントがあるのか」という混乱の原因になる。
- **提案**: コメントを削除する。JSON import assertion に lint 警告が出る環境では、正確なルール名（例: `@typescript-eslint/consistent-type-imports` や JSON import 関連のルール）を指定する。

```typescript
// src/app.ts（修正前）
// eslint-disable-next-line @typescript-eslint/no-require-imports  ← 誤ったルール名・設定なし
const openapiSpec = await import("../generated/openapi.json", {
  with: { type: "json" },
});

// src/app.ts（修正後）
const openapiSpec = await import("../generated/openapi.json", {
  with: { type: "json" },
});
```

---

### 🟡 中優先度

#### [3] `generate:json` スクリプトが読みにくいインラインコード

- **場所**: `package.json:8`
- **問題**: `node --input-type=module -e` に長い JavaScript コードを1行で埋め込んでいる。スペース・改行がなく、引数のエスケープも複雑で可読性が極めて低い。
- **影響**: バグ修正・機能追加時の修正コストが高い。コードレビューが困難。
- **提案**: `scripts/yaml-to-json.js` として分離する。

```js
// scripts/yaml-to-json.js（新規作成）
import { parse } from "yaml";
import { readFileSync, writeFileSync } from "node:fs";

const yaml = readFileSync("generated/openapi.yaml", "utf-8");
writeFileSync(
  "generated/openapi.json",
  JSON.stringify(parse(yaml), null, 2)
);
```

```jsonc
// package.json（修正後）
"generate:json": "node scripts/yaml-to-json.js",
```

---

#### [4] openapi.json / openapi.yaml の二重管理

- **場所**: `tspconfig.yaml:4-7`, `package.json:8`, `src/app.ts:7-9`
- **問題**: TypeSpec は YAML を生成し（`tspconfig.yaml` の `file-type: yaml`）、その後 `generate:json` で YAML → JSON に変換している。`app.ts` では JSON import assertion のために JSON が必要という事情があるが、YAML と JSON の2ファイルが `generated/` に共存し続ける。
  - `generated/openapi.yaml`（TypeSpec 生成）
  - `generated/openapi.json`（`generate:json` 変換）
- **影響**: 同一内容のファイルが2つ存在し、どちらが正とも分かりにくい。`dist/generated/` にも両方がコピーされ Lambda デプロイ成果物が不必要に膨らむ。
- **提案A（推奨）**: TypeSpec に JSON を直接生成させ、変換ステップを省く。

```yaml
# tspconfig.yaml（修正後）
emit:
  - "@typespec/openapi3"
options:
  "@typespec/openapi3":
    emitter-output-dir: "{project-root}/generated"
    output-file: openapi.json
    file-type: yaml   # ← "json" に変更
```

```jsonc
// package.json（修正後）
"generate": "pnpm generate:typespec && pnpm generate:types",
// generate:json スクリプトを削除
// generate:types は openapi.yaml の代わりに openapi.json を入力にする
"generate:types": "openapi-typescript generated/openapi.json -o src/generated/openapi.d.ts",
```

ただし `openapi-typescript` が JSON と YAML どちらも受け付けるため、`generate:types` 側の入力ファイルも変更が必要。

**提案B**: YAML を直接サーブする。`yaml` パッケージを実行時に使って YAML を読み込む方法もあるが、その場合 `yaml` を `dependencies` に置く必要があり、バンドルサイズも増加する。提案Aの方がシンプル。

---

#### [5] esbuild でバンドル済みなのに `dist/generated/` 全体をコピーしている

- **場所**: `scripts/build.js:17`
- **問題**: `cpSync("generated", "dist/generated", { recursive: true })` により `openapi.json` と `openapi.yaml` の両方が `dist/generated/` にコピーされる。しかし `app.ts` の JSON import assertion はesbuild のバンドル時にインライン化されるため（実際に `dist/index.mjs` 内に OpenAPI 仕様が埋め込まれていることを確認済み）、`dist/generated/openapi.json` はランタイムで参照されない。また `openapi.yaml` は実行時に一切使用されない。
- **影響**: Lambda デプロイパッケージに不要なファイルが含まれ、デプロイサイズが増加する（`openapi.json`: 約6.5KB、`openapi.yaml`: 別途）。コールドスタートの微増にも繋がる。
- **提案**: JSON が esbuild でインライン化されていることを前提に `cpSync` を削除する。もし明示的に外部ファイルとして保持したい場合は `external` に指定し、`openapi.json` のみをコピーする。

```js
// scripts/build.js（修正後）
import { build } from "esbuild";
import { mkdirSync, writeFileSync } from "node:fs";

mkdirSync("dist", { recursive: true });

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outfile: "dist/index.mjs",
});

writeFileSync("dist/package.json", JSON.stringify({ type: "module" }, null, 2));
console.log("Build complete: dist/index.mjs");
```

---

#### [6] `external: []` の明示（冗長）

- **場所**: `scripts/build.js:13`
- **問題**: esbuild の `external` オプションのデフォルト値は空配列（すべてバンドル）である。`external: []` を明示することはデフォルト動作と同じで、意味のない宣言になっている。
- **影響**: 読者に「意図的に何かを除外しないことを宣言している」と誤解させる可能性がある。`node_modules` を除外したい場合に `external: ["node_modules/*"]` などと書くべき箇所で間違えやすい。
- **提案**: `external: []` の行を削除する。

```js
// scripts/build.js（修正後）
await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outfile: "dist/index.mjs",
  // external は省略（デフォルトで空、すべてバンドル）
});
```

---

### 🟢 低優先度（改善提案）

#### [7] `generated/` ディレクトリが `.gitignore` に含まれていない

- **場所**: `.gitignore`
- **問題**: `src/generated/` は `.gitignore:89` で除外されているが、`generated/`（プロジェクトルート直下の TypeSpec 生成 YAML / JSON）は除外されていない。TypeSpec で生成されるファイルはソース管理対象外とするのが一般的なプラクティスである。
- **影響**: `generated/openapi.yaml` と `generated/openapi.json` が `git status` に現れ、コミットに含まれてしまう。TypeSpec のスキーマ定義が正として管理されているにもかかわらず、生成物も追跡するのは冗長。
- **提案**: 生成物を除外するかどうかチームで方針を決めた上で、除外する場合は `.gitignore` に追加する。

```gitignore
# .gitignore に追加
generated/
```

ただし CI パイプラインで `pnpm generate:typespec` を実行している場合は除外で問題ない。未実行のまま `generated/` がコミットに含まれないと、`generate:types` や `generate:json` が失敗することに注意。

---

#### [8] `tsconfig.json` に esbuild ビルドでは無意味な `outDir` / `rootDir` が設定されている

- **場所**: `tsconfig.json:11-12`
- **問題**: `outDir: "dist"` と `rootDir: "src"` が設定されているが、`typecheck` スクリプトは `tsc --noEmit` で実行されるため、これらの設定は型検査には影響しない。ビルドは esbuild が担うため `tsc` でのコンパイルは行われない。
- **影響**: 設定の意図が不明確になる。将来のメンテナー が「tsc でビルドもしているのか」と誤解する可能性がある。
- **提案**: 型検査専用の意図を明示するコメントを追加し、esbuild で不要な設定を削除するか、あるいはそのままにする場合は意図をコメントで説明する。

```jsonc
// tsconfig.json（改善案）
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node"]
    // outDir / rootDir は tsc --noEmit (typecheck専用) では不要なため削除
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

#### [9] `build` スクリプトに `generate` が混在している

- **場所**: `package.json:12`
- **問題**: `"build": "pnpm generate && node scripts/build.js"` と定義されており、ビルドを実行するたびに TypeSpec のコンパイルと型生成が走る。
- **影響**: TypeSpec スキーマが変更されていない場合でも毎回 `tsp compile` が実行され、CI の実行時間が無駄に増加する。ビルド（バンドル）と生成（コード生成）は本来独立した関心事である。
- **提案**: スクリプトを分離し、CI では必要に応じて各ステップを個別に呼び出す。

```jsonc
// package.json（改善案）
"scripts": {
  "generate:typespec": "tsp compile api/main.tsp",
  "generate:json":     "node scripts/yaml-to-json.js",
  "generate:types":    "openapi-typescript generated/openapi.yaml -o src/generated/openapi.d.ts",
  "generate":          "pnpm generate:typespec && pnpm generate:json && pnpm generate:types",
  "bundle":            "node scripts/build.js",          // バンドルのみ
  "build":             "pnpm generate && pnpm bundle",   // 全体（ローカル用）
  "dev":               "tsx watch src/dev.ts",
  "typecheck":         "tsc --noEmit"
}
```

---

#### [10] `dist/package.json` を毎回上書きしている

- **場所**: `scripts/build.js:20`
- **問題**: `writeFileSync("dist/package.json", JSON.stringify({ type: "module" }, null, 2))` で毎回固定内容のファイルを書き出している。内容が変わらないにもかかわらず毎回書き換えるため、差分が常に発生し、CI でのアーティファクトキャッシュの比較に影響する可能性がある。
- **影響**: 軽微。ただし Lambda デプロイで `dist/` の差分を使うような仕組みがある場合、意図しない再デプロイの原因になりえる。
- **提案**: 既存ファイルの存在確認を行い、内容が同じ場合はスキップする、または `dist/package.json` を静的なファイルとしてリポジトリに置いておく。

```js
// scripts/build.js（改善案）
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const pkgContent = JSON.stringify({ type: "module" }, null, 2);
const pkgPath = "dist/package.json";

if (!existsSync(pkgPath) || readFileSync(pkgPath, "utf-8") !== pkgContent) {
  writeFileSync(pkgPath, pkgContent);
}
```

---

## 総評

ビルドパイプライン全体の構成は TypeSpec → OpenAPI → 型生成 → esbuild バンドル → Lambda という流れが明確で、サンプルとして理解しやすい設計になっている。

ただし、**最優先で修正すべき点**は `yaml` パッケージの依存分類誤り（`dependencies` → `devDependencies`）と、ESLint 設定が存在しない中での誤ったディレクティブの記述である。これらは意図の誤読や将来の混乱につながる。

**中期的に対処すべき点**は、`tspconfig.yaml` の `file-type` を `json` に変更して YAML → JSON 変換ステップを丸ごと排除することである。これにより `generate:json` インラインスクリプト・`yaml` パッケージ・`generated/` の二重ファイル・`dist/generated/` の冗長コピーがまとめて解消される。1つの設定変更が複数の課題を連鎖的に解決するため、費用対効果が高い改善となる。

`scripts/build.js` の `external: []` や `tsconfig.json` の `outDir`/`rootDir` など軽微な問題は、コードの明瞭さのために対処することを推奨するが、動作上の影響はない。
