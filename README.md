# lambdalith-hono-openapi-sample

TypeSpec + OpenAPI + Hono + AWS Lambda (Lambdalith) のサンプルプロジェクト。

ユーザー管理 CRUD API を通じて、**TypeSpec をスキーマの唯一の真実 (Source of Truth)** とするパイプラインを示します。

## アーキテクチャ概要

```
TypeSpec (.tsp)
  └─ [tsp compile]
      └─ generated/openapi.yaml   ← API 契約
          └─ [openapi-typescript]
              └─ src/generated/openapi.d.ts  ← TypeScript 型
                  └─ Hono ルートハンドラ
                      └─ [esbuild]
                          └─ dist/index.mjs  ← Lambda デプロイ成果物
```

### 技術スタック

| 役割 | 技術 |
|------|------|
| スキーマ定義 | [TypeSpec](https://typespec.io/) |
| API ドキュメント | OpenAPI 3.0 (TypeSpec 生成) |
| Web フレームワーク | [Hono](https://hono.dev/) |
| Lambda アダプタ | `hono/aws-lambda` (Hono 同梱) |
| API ドキュメント UI | [Scalar](https://scalar.com/) (`GET /docs`) |
| バリデーション | Zod + `@hono/zod-validator` |
| バンドル | esbuild |
| IaC | Terraform |

### Lambdalith パターン

単一の Lambda 関数がすべてのルート (`/users/*`) を処理します。  
API Gateway や Lambda Function URL がリクエストを受け取り、Hono が内部ルーティングを担当します。

## API エンドポイント

| Method | Path | 説明 |
|--------|------|------|
| GET | /users | ユーザー一覧取得 |
| POST | /users | ユーザー作成 |
| GET | /users/:id | ユーザー取得 |
| PUT | /users/:id | ユーザー更新 |
| DELETE | /users/:id | ユーザー削除 |
| GET | /openapi.json | OpenAPI スペック |
| GET | /docs | Scalar API ドキュメント UI |

> **注意**: データストアはインメモリ実装のため、Lambda の再起動やスケールアウトにより
> データが消失します。永続化が必要な場合は DynamoDB や RDS などに置き換えてください。

## ディレクトリ構成

```
├── api/                      # TypeSpec 定義（スキーマの Single Source of Truth）
│   ├── main.tsp              # API エンドポイント定義
│   └── models/user.tsp       # モデル定義
├── generated/                # TypeSpec 生成物（コミット対象）
│   └── openapi.yaml          # OpenAPI スペック（契約として管理）
│   # openapi.json は pnpm generate:json で生成（gitignore）
├── src/                      # Hono アプリケーション
│   ├── index.ts              # Lambda ハンドラ エントリ
│   ├── app.ts                # Hono アプリ設定
│   ├── dev.ts                # ローカル開発サーバー（Lambda 環境では使用しない）
│   ├── routes/users.ts       # CRUD ルートハンドラ
│   ├── schemas/user.ts       # Zod ランタイムバリデーションスキーマ
│   ├── repository/           # In-memory データストア
│   └── generated/            # openapi-typescript 出力（gitignore）
│       └── openapi.d.ts      # TypeScript 型定義
├── infrastructure/           # Terraform
│   ├── main.tf
│   ├── iam.tf
│   ├── lambda.tf             # Lambda + Function URL
│   ├── variables.tf
│   └── outputs.tf
├── scripts/
│   ├── build.js              # esbuild バンドルスクリプト
│   └── yaml-to-json.js       # YAML → JSON 変換スクリプト
└── pnpm-workspace.yaml       # esbuild ネイティブビルド許可設定（モノレポではない）
```

## セットアップ

```bash
# 依存関係インストール
pnpm install

# TypeSpec → OpenAPI → TypeScript 型を生成
pnpm generate
```

## ローカル開発

```bash
pnpm dev
# → http://localhost:3000
# → http://localhost:3000/docs  (Scalar UI)
# → http://localhost:3000/openapi.json
```

## ビルド（Lambda デプロイ用）

```bash
pnpm build
# → dist/index.mjs  (Lambda ハンドラ)
# → dist/generated/ (OpenAPI スペック)
```

## デプロイ (Terraform)

> **デプロイ前の注意**: `dist/` は Git 管理対象外です。`terraform apply` の前に
> 必ず `pnpm build` を実行してください。
>
> **Terraform State**: このサンプルは state をローカルファイルで管理しています。
> チーム開発・本番環境では S3 + DynamoDB による remote backend の使用を推奨します。

> **セキュリティ警告（サンプル用設定）**: このサンプルの Lambda Function URL は
> 認証なし（`authorization_type = "NONE"`）、CORS はすべてのオリジン・メソッドを許可する
> 設定になっています。本番環境では `AWS_IAM` 認証と適切な CORS 設定を使用してください。

```bash
# 1. ビルド（dist/ は gitignore のため必須）
pnpm build

# 2. Terraform 初期化（初回のみ）
cd infrastructure
terraform init

# 3. プレビュー
terraform plan

# 4. デプロイ
terraform apply

# → output: function_url = "https://xxxx.lambda-url.ap-northeast-1.on.aws/"
```

デプロイ後の動作確認:

```bash
FUNCTION_URL="https://xxxx.lambda-url.ap-northeast-1.on.aws"

# ユーザー作成
curl -X POST $FUNCTION_URL/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com"}'

# ユーザー一覧
curl $FUNCTION_URL/users

# API ドキュメント
open $FUNCTION_URL/docs
```

## スキーマ変更の流れ

`api/` 以下の TypeSpec を変更したら:

```bash
pnpm generate        # TypeSpec → openapi.yaml → TypeScript 型（openapi.d.ts）を再生成
pnpm generate:json   # openapi.yaml → openapi.json を生成（ビルド前に必要な中間生成物）
pnpm typecheck       # 型エラーがないか確認
pnpm build           # Lambda 用バンドルを再生成（openapi.json を dist/ に同梱）
```

> `pnpm generate` は `openapi.yaml`（契約）と `openapi.d.ts`（型）を生成しますが、
> アプリが実行時に参照する `openapi.json` は別途 `pnpm generate:json` で生成する必要があります。
> `pnpm build` はこの `openapi.json` を `dist/` にバンドルするため、ビルド前の実行が必須です。
