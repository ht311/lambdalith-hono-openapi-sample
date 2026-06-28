# アーキテクチャ・ディレクトリ構成 レビュー

**日付**: 2026-06-28
**対象**: プロジェクト全体のディレクトリ構成と設計

---

## サマリー

TypeSpec → OpenAPI → Hono → Lambda というパイプラインの骨格は明確で、サンプルとして動作する最小構成を達成している。一方、`generated/` の命名重複と `openapi.json` の冗長生成、CI/CD フローの未整備、openapi-typescript で生成した型が実装で活用されていない点など、パイプラインの「つながり」を示すサンプルとして見るとコアの価値が伝わりにくい箇所がある。

---

## 課題一覧

### 🔴 高優先度

#### 1. `generated/openapi.json` の冗長生成と dist/ へのコピー

- **場所**: `generated/openapi.json`、`package.json#scripts.generate:json`、`src/app.ts`、`scripts/build.js`
- **問題**:
  - `tspconfig.yaml` は YAML のみを出力する設定だが、`generate:json` スクリプトが YAML を読み込んで JSON に変換し `generated/openapi.json` を生成している。
  - `src/app.ts` が `await import("../generated/openapi.json", { with: { type: "json" } })` で JSON を直接インポートするためにこの変換が必要になっている。
  - `scripts/build.js` は `cpSync("generated", "dist/generated", { recursive: true })` で `generated/` 全体をコピーするため、ランタイムで不要な `openapi.yaml` も dist/ に含まれる。
  - `generated/openapi.json` 自体は `.gitignore` されておらず、YAML と JSON の二ファイルがともにコミット対象となっている。
- **影響**:
  - JSON を手動で再生成し忘れると YAML と JSON が乖離し、ランタイムが古い仕様を返す。
  - `dist/` に不要な YAML が含まれ、Lambda ZIP が不必要に大きくなる。
- **提案**:
  - `tspconfig.yaml` で `file-type: json` に変更し、TypeSpec コンパイルから直接 JSON を出力する。`generate:json` ステップを廃止できる。
  - あるいは YAML を維持し、`src/app.ts` でランタイム読み込みではなく `openapi-typescript` の型生成時にのみ YAML を参照する設計に切り替える（Swagger UI 向けにはビルド時に JSON へ変換して dist/ のみに置く）。
  - `generated/openapi.json` を `.gitignore` に追加し、生成物として扱う。コミット対象は `generated/openapi.yaml`（API 契約）のみとする。

  ```yaml
  # tspconfig.yaml — JSON 直接出力案
  emit:
    - "@typespec/openapi3"
  options:
    "@typespec/openapi3":
      emitter-output-dir: "{project-root}/generated"
      output-file: openapi.json
      file-type: json
  ```

  ```
  # .gitignore 追加案
  generated/openapi.json
  ```

#### 2. openapi-typescript 生成型が実装で未活用

- **場所**: `src/generated/openapi.d.ts`（生成）、`src/routes/users.ts`、`src/repository/userRepository.ts`
- **問題**:
  - `generate:types` で `src/generated/openapi.d.ts` を生成するが、`routes/users.ts` や `userRepository.ts` ではこの型を一切インポートしていない。
  - `src/schemas/user.ts` の Zod スキーマは TypeSpec モデルとは独立に手書きされており、TypeSpec → 型という Pipeline の核心的メリットが実装に反映されていない。
  - このサンプルを参照するユーザーは「生成した型をどう使うか」を学ぶことができない。
- **影響**:
  - TypeSpec でモデルを変更しても Zod スキーマ・リポジトリ型との乖離が検出されない。型安全の恩恵がない。
  - サンプルとしての教育的価値が低い。
- **提案**:
  - `src/repository/userRepository.ts` の `User` 型を `openapi.d.ts` から参照するか、openapi-typescript の `components["schemas"]["User"]` を再エクスポートして利用する。
  - Zod スキーマの型定義も可能な限り生成型に寄せることで、TypeSpec → 型安全な実装というフローを示す。

  ```typescript
  // src/repository/userRepository.ts の改善例
  import type { components } from "../generated/openapi.js";
  export type User = components["schemas"]["User"];
  ```

---

### 🟡 中優先度

#### 3. `generated/` と `src/generated/` の命名による混乱

- **場所**: `generated/`（ルート）、`src/generated/`
- **問題**:
  - 同名の `generated/` ディレクトリが2つ存在し、一方はコミット対象（API 契約）、もう一方は `.gitignore` 対象（TypeScript 型）という正反対の性質を持つ。
  - 命名規則だけでは区別がつかず、初見のコントリビューターが混乱しやすい。
- **影響**: `src/generated/` を誤ってコミットしようとする、または `generated/` を誤って削除する操作ミスが起きやすい。
- **提案**:
  - `generated/` → `openapi/`（または `spec/`）に改名し「API 仕様ファイル置き場」であることを明示する。
  - `src/generated/` → `src/__generated__/`（慣例的なマシン生成コード表記）に改名する。
  - `tspconfig.yaml`・`package.json` の参照パスも合わせて変更する。

  ```yaml
  # tspconfig.yaml 改名案
  options:
    "@typespec/openapi3":
      emitter-output-dir: "{project-root}/openapi"
  ```

#### 4. CI/CD フローが存在せず、デプロイ手順が不明確

- **場所**: `infrastructure/lambda.tf`、`.gitignore`、`README.md`
- **問題**:
  - `lambda.tf` の `archive_file` は `source_dir = "${path.module}/../dist"` を参照するが、`dist/` は `.gitignore` されており CI でそのまま `terraform apply` すると失敗する。
  - `pnpm build` → `terraform apply` の順序依存がコードからは読み取れず、ドキュメントにも明記がない。
  - GitHub Actions 等の CI 定義ファイルが存在しない。
- **影響**: 初めてデプロイしようとするユーザーが手順を自力で組み立てる必要がある。サンプルとしての完成度が低い。
- **提案**:
  - 最低限のデプロイ手順を README に追記する（`pnpm build && cd infrastructure && terraform apply`）。
  - サンプルとして完結させるなら `.github/workflows/deploy.yml` を追加し、`pnpm build` → `terraform apply` のシーケンスを示す。

  ```yaml
  # .github/workflows/deploy.yml（最小構成例）
  name: Deploy
  on:
    push:
      branches: [main]
  jobs:
    deploy:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: pnpm/action-setup@v4
        - run: pnpm install
        - run: pnpm build
        - uses: hashicorp/setup-terraform@v3
        - run: terraform -chdir=infrastructure apply -auto-approve
          env:
            AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
            AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
  ```

#### 5. `generate:json` スクリプトがインラインで読みにくい

- **場所**: `package.json#scripts.generate:json`
- **問題**:
  - `build.js` が `scripts/build.js` に外出しされている一方で、`generate:json` は一行の難読インラインスクリプトとして `package.json` に直接記述されている。一貫性がない。
  - メンテナンスや変更が困難。
- **影響**: 変換ロジックが見えにくく、変更時にミスが起きやすい。
- **提案**:
  - `scripts/generate-json.js`（または `scripts/generate.js`）に外出しして可読性を上げる。
  - あるいは課題1の対応（tspconfig で JSON 直接出力）で `generate:json` ステップごと廃止する。

#### 6. Terraform のセキュリティ設定（サンプルの範囲外であることが不明瞭）

- **場所**: `infrastructure/lambda.tf`
- **問題**:
  - `authorization_type = "NONE"` および `allow_origins = ["*"]` はパブリックアクセス・全オリジン許可の設定であり、サンプルとはいえコメント一行のみで警告が薄い。
  - コードをそのまま本番に転用するリスクがある。
- **影響**: セキュリティ上の誤用リスク。
- **提案**:
  - コメントを強化する（`# WARNING: サンプル用。本番では IAM 認証と適切な CORS 設定を使用すること`）。
  - README の「デプロイ」セクションに注意書きを追加する。

---

### 🟢 低優先度（改善提案）

#### 7. `api/` ディレクトリ名の慣例との乖離

- **場所**: `api/`
- **問題**: TypeSpec の慣例では `typespec/`・`spec/` が使われることが多い。`api/` は「REST API の実装コード」と誤解されやすい。
- **提案**: `typespec/` または `spec/` に改名することを検討する。`src/` との対比（定義 vs 実装）がより明確になる。

#### 8. `pnpm-workspace.yaml` がモノレポ設定なしに存在

- **場所**: `pnpm-workspace.yaml`
- **問題**:
  - 内容は `onlyBuiltDependencies: [esbuild]` のみで、モノレポの `packages:` 定義が存在しない。
  - pnpm v9 以降では `onlyBuiltDependencies` を `pnpm-workspace.yaml` に記述できるが、ファイル名がモノレポを連想させるため初見で混乱しやすい。
- **影響**: 軽微。pnpm はこの設定を正しく解釈するが、ファイルの存在意図が伝わらない。
- **提案**: ファイル先頭にコメントで意図を明記する。
  ```yaml
  # pnpm-workspace.yaml
  # モノレポではない。esbuild のネイティブバイナリビルドを許可するための設定のみ。
  onlyBuiltDependencies:
    - esbuild
  ```

#### 9. `src/dev.ts` の配置と意図の不明確さ

- **場所**: `src/dev.ts`
- **問題**:
  - esbuild のエントリポイントは `src/index.ts` のみなので `dev.ts` はバンドルに含まれないが、それが明示されていない。
  - `tsconfig.json` の `include: ["src/**/*"]` に含まれるため、型チェックは通る。
- **提案**: `src/dev.ts` を `dev/server.ts`（または `src/dev/index.ts`）に移動するか、コメントで「ローカル開発専用・バンドル対象外」と明記する。esbuild の設定に `exclude` を追加しても良い。

#### 10. テストが存在しない

- **場所**: プロジェクト全体
- **問題**: `test/`・`__tests__/` ディレクトリが存在せず、テストスクリプトも `package.json` にない。
- **影響**: CI でのリグレッション検知ができない。サンプルとしてテストの書き方を示せない。
- **提案**: Hono のテストユーティリティ（`hono/testing`）を使った最小限のルートテストを追加する。Vitest または Node.js 組み込みテストランナーが候補。

  ```typescript
  // test/users.test.ts（例）
  import { describe, it, expect } from "vitest";
  import { testClient } from "hono/testing";
  import app from "../src/app.js";

  describe("GET /users", () => {
    it("returns empty array initially", async () => {
      const client = testClient(app);
      const res = await client.users.$get();
      expect(res.status).toBe(200);
    });
  });
  ```

#### 11. `schemas/` と TypeSpec `models/` の二重管理

- **場所**: `src/schemas/user.ts`、`api/models/user.tsp`
- **問題**:
  - `CreateUserInput`・`UpdateUserInput` が TypeSpec と Zod の両方で定義されており、バリデーションルール（`min(1)` など）に乖離が生じる可能性がある。
  - TypeSpec 側には `email` の format 制約が定義されていない（`string` のみ）。
- **提案**:
  - TypeSpec に `@format("email")` を追加して OpenAPI の制約を強化し、`openapi-typescript` 型に反映させる。
  - Zod スキーマは「ランタイム検証の実装」として維持しつつ、その定義根拠が TypeSpec にあることをコメントで明示する。

  ```tsp
  // api/models/user.tsp 改善案
  model CreateUserInput {
    @minLength(1)
    name: string;

    @format("email")
    email: string;
  }
  ```

---

## 理想的なディレクトリ構成案

現状の問題を踏まえた改善案：

```
/workspaces/lambdalith-hono-openapi-sample/
├── typespec/                     # TypeSpec 定義（api/ → typespec/ に改名）
│   ├── main.tsp
│   └── models/
│       └── user.tsp
│
├── openapi/                      # tsp compile の出力（コミット対象）
│   └── openapi.yaml              # API 契約 (YAML のみ。JSON は自動生成)
│                                 # openapi.json は .gitignore
│
├── src/                          # Hono アプリケーション
│   ├── index.ts                  # Lambda エントリポイント
│   ├── app.ts                    # Hono アプリ設定
│   ├── routes/
│   │   └── users.ts
│   ├── schemas/
│   │   └── user.ts               # Zod バリデーション（TypeSpec モデルと対応）
│   ├── repository/
│   │   └── userRepository.ts     # User 型は src/__generated__ から参照
│   └── __generated__/            # openapi-typescript の出力（.gitignore）
│       └── openapi.d.ts
│
├── dev/                          # ローカル開発専用（バンドル対象外を明示）
│   └── server.ts                 # src/dev.ts → dev/server.ts に移動
│
├── test/                         # テスト（新規追加）
│   └── routes/
│       └── users.test.ts
│
├── scripts/
│   ├── build.js                  # esbuild バンドル
│   └── generate-json.js          # YAML → JSON 変換（インライン廃止）
│
├── infrastructure/               # Terraform（変更なし）
│   ├── main.tf
│   ├── iam.tf
│   ├── lambda.tf
│   ├── variables.tf
│   └── outputs.tf
│
├── .github/
│   └── workflows/
│       └── deploy.yml            # CI/CD（新規追加）
│
├── docs/
│   └── review/
│       └── ...
│
├── dist/                         # esbuild 出力（.gitignore）
├── package.json
├── tsconfig.json
├── tspconfig.yaml
└── pnpm-workspace.yaml
```

### 主な変更点まとめ

| 変更前 | 変更後 | 理由 |
|---|---|---|
| `api/` | `typespec/` | TypeSpec 定義と混同防止 |
| `generated/` | `openapi/` | API 仕様置き場として明示 |
| `generated/openapi.json` | `.gitignore` 追加 | 派生物のコミット排除 |
| `src/generated/` | `src/__generated__/` | 機械生成コード慣例に準拠 |
| `src/dev.ts` | `dev/server.ts` | バンドル対象外を構造で明示 |
| `generate:json` インライン | `scripts/generate-json.js` | 可読性・保守性向上 |
| なし | `test/` | テスト追加 |
| なし | `.github/workflows/deploy.yml` | CI/CD フロー明示 |

---

## 総評

パイプラインの骨格（TypeSpec → OpenAPI → Lambda）はシンプルかつ理解しやすく、最小サンプルとして成立している。しかし「TypeSpec で定義した型が実装コードにどう伝播するか」という点—このプロジェクトの最大の教育的価値—が実装側で活用されていない。`openapi-typescript` で生成した型を `userRepository.ts` や `routes/users.ts` に取り込むだけで、パイプラインの意義が格段に伝わるサンプルになる。

`generated/openapi.json` の冗長管理は CI 環境での乖離リスクを持ち、`dist/` の `.gitignore` と Terraform の依存関係はデプロイ手順の暗黙知となっている。これらは README または CI 定義で補うことで解消できる。全体として修正コストは低く、数ステップの改善でサンプルとしての完成度が大幅に向上する。
