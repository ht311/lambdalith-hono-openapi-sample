# インフラ・DevContainer・セキュリティ レビュー

**日付**: 2026-06-28
**対象**: infrastructure/, .devcontainer/, セキュリティ全般
**レビュアー**: Claude (自動レビュー)

---

## サマリー

Lambda Function URL を認証なし・CORS ワイルドカードで公開しているセキュリティリスクが最大の懸念点。加えて、`archive_file` の出力先が source_dir 内に設定されており ZIP の自己循環包含が起きる Terraform バグ、terraform.tfvars.example が存在しないドキュメント不整合、Dockerfile のフローティングタグによる再現性の欠如など、品質・デプロイ安全性に関わる問題が複数存在する。

---

## 課題一覧

### 🔴 高優先度（セキュリティ・デプロイ障害）

#### [TF-001] archive_file の output_path が source_dir 内に設定されており ZIP が自己包含する

- **場所**: `infrastructure/lambda.tf` 全体
- **問題**: `source_dir = "${path.module}/../dist"` と `output_path = "${path.module}/../dist/function.zip"` が同じディレクトリを指している。`terraform apply` を 2 回目以降に実行すると、前回生成された `function.zip` が `source_dir` 内に存在した状態でアーカイブが作成され、ZIP ファイルが ZIP 内に含まれる（自己循環包含）。結果として Lambda へのデプロイ物が肥大化し、ハンドラが正常起動しない可能性がある。
- **影響**: 2 回目以降の `terraform apply` で Lambda が正常動作しないデプロイ障害。デバッグが困難。
- **提案**: output_path を `dist/` の外に出す。

```hcl
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../dist"
  output_path = "${path.module}/function.zip"   # infrastructure/ 直下に出力
  excludes    = ["function.zip"]                 # 念のため自己除外を明示
}
```

---

#### [TF-002] Lambda Function URL が認証なしで全世界に公開されている

- **場所**: `infrastructure/lambda.tf` — `aws_lambda_function_url` リソース
- **問題**: `authorization_type = "NONE"` により、Function URL を知っている誰でも API を呼び出せる。README にも警告が存在しない。
- **影響**: 不正アクセス・意図しない API 呼び出しによる課金増加・データ破壊（現状はインメモリだが、将来 DB を追加した際に深刻化）。
- **提案**: サンプルとしての許容範囲であることを明記した上で、README に以下のような警告を追加する。また本番用途では `authorization_type = "AWS_IAM"` に変更する。

```markdown
> **セキュリティ警告**: このサンプルの Lambda Function URL は認証なし (`authorization_type = "NONE"`) で
> 公開されています。本番環境では `AWS_IAM` 認証または API Gateway + オーソライザーを使用してください。
```

---

#### [TF-003] CORS allow_origins / allow_methods / allow_headers がすべてワイルドカード

- **場所**: `infrastructure/lambda.tf` — `cors` ブロック
- **問題**: `allow_origins = ["*"]`、`allow_methods = ["*"]`、`allow_headers = ["*"]` の組み合わせは CORS プリフライトを無制限に通過させる。ブラウザから任意のオリジンが API を呼び出せる状態。
- **影響**: 悪意のある Web ページからのクロスオリジンリクエストが通過する。認証トークンが Cookie に保存されている場合は CSRF に類似した攻撃が成立しうる。
- **提案**: 許可するオリジンを変数で管理し、デプロイ先に応じて制限する。

```hcl
variable "allowed_origins" {
  description = "CORS allowed origins"
  type        = list(string)
  default     = ["*"]  # サンプル用。本番では実際のフロントエンドURLを指定すること
}

cors {
  allow_origins = var.allowed_origins
  allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
  allow_headers = ["Content-Type", "Authorization"]
}
```

---

#### [TF-004] Terraform state がローカルのみで管理されており共有・復旧ができない

- **場所**: `infrastructure/main.tf` — `terraform` ブロック
- **問題**: `backend` 設定がなく、`terraform.tfstate` がローカルファイルとして生成される。複数人で作業する場合やローカル環境が壊れた場合に state の共有・復旧が不可能になる。
- **影響**: インフラのドリフト検知不能・state ロストによるリソースの孤立。
- **提案**: サンプルであれば最低限コメントで remote backend の設定例を示す。

```hcl
terraform {
  required_version = ">= 1.6"

  # 本番環境では remote backend を設定してください（例: S3 + DynamoDB）
  # backend "s3" {
  #   bucket         = "your-tfstate-bucket"
  #   key            = "lambdalith-hono/terraform.tfstate"
  #   region         = "ap-northeast-1"
  #   dynamodb_table = "terraform-lock"
  #   encrypt        = true
  # }

  required_providers { ... }
}
```

---

### 🟡 中優先度（品質・再現性）

#### [TF-005] terraform.tfvars.example が .gitignore で除外解除されているが実ファイルが存在しない

- **場所**: `.gitignore:46`、`infrastructure/` ディレクトリ
- **問題**: `.gitignore` に `!terraform.tfvars.example` が記載されており、このファイルを追跡対象にする意図が示されているが、`infrastructure/terraform.tfvars.example` が存在しない。
- **影響**: `terraform.tfvars` を用意しようとしたユーザーがどの変数を設定すべきか不明。また `.gitignore` の記述が死んでいる。
- **提案**: `infrastructure/terraform.tfvars.example` を作成する。

```hcl
# infrastructure/terraform.tfvars.example
aws_region    = "ap-northeast-1"
function_name = "lambdalith-hono-users-api"

# CORS 許可オリジン（本番では実際のフロントエンドURLを指定）
# allowed_origins = ["https://your-frontend.example.com"]
```

---

#### [TF-006] CloudWatch Logs のロググループ保持期間が設定されていない

- **場所**: `infrastructure/lambda.tf`（ロググループリソースが存在しない）
- **問題**: `aws_lambda_function` リソースは自動でロググループを作成するが、保持期間がデフォルト（無期限）になる。長期間放置するとコスト増加につながる。
- **影響**: ログストレージコストの無制限増加。
- **提案**: ロググループを明示的に管理する。

```hcl
resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/lambda/${var.function_name}"
  retention_in_days = 30
}

resource "aws_lambda_function" "api" {
  # ... 既存設定 ...
  depends_on = [aws_cloudwatch_log_group.api]

  logging_config {
    log_format = "JSON"
    log_group  = aws_cloudwatch_log_group.api.name
  }
}
```

---

#### [TF-007] Lambda に environment ブロックがなく、将来の設定追加パスが不明確

- **場所**: `infrastructure/lambda.tf` — `aws_lambda_function` リソース
- **問題**: 現在は環境変数が不要でも、DB 接続文字列やシークレット ARN を渡す際のパターンが示されていない。
- **影響**: 将来の拡張時にハードコード・直接埋め込みのリスクが増す。
- **提案**: コメント付きの空 `environment` ブロックを残しておく、または変数例をコメントで示す。

```hcl
resource "aws_lambda_function" "api" {
  # ... 既存設定 ...

  # 環境変数を追加する場合はここで設定（シークレットは AWS Secrets Manager ARN を渡す）
  # environment {
  #   variables = {
  #     NODE_ENV        = "production"
  #     SECRET_ARN      = aws_secretsmanager_secret.api.arn
  #   }
  # }
}
```

---

#### [DC-001] Dockerfile のベースイメージにバージョンタグがなく再現性が低い

- **場所**: `.devcontainer/Dockerfile:1`
- **問題**: `FROM mcr.microsoft.com/devcontainers/base:ubuntu` の `ubuntu` タグはフローティングタグであり、イメージのプルのたびに異なる Ubuntu バージョンが取得される可能性がある。
- **影響**: 時期によって開発環境の Ubuntu バージョンが変わり、パッケージの挙動やパスが変わるリスク。
- **提案**: Ubuntu バージョンを固定する。

```dockerfile
FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04
```

---

#### [DC-002] postcreate.sh で pnpm を npm install -g でインストールしており Node.js Feature と競合する可能性がある

- **場所**: `.devcontainer/postcreate.sh`
- **問題**: `npm install -g pnpm@11.6.0` で pnpm をグローバルインストールしているが、Dev Container Features の `node:1` が管理するパス（`/usr/local/share/nvm/...`）と競合する可能性がある。また Node.js Feature では `packageManager` オプションで pnpm をセットアップできる。
- **影響**: `pnpm` コマンドが見つからない、または意図しないバージョンが使われる環境不整合。
- **提案**: `devcontainer.json` の Node.js Feature オプションで pnpm を管理する。

```json
"ghcr.io/devcontainers/features/node:1": {
  "version": "lts",
  "packageManager": "pnpm",
  "packageManagerVersion": "11.6.0"
}
```

`postcreate.sh` からは `npm install -g pnpm@11.6.0` を削除する。

---

#### [DC-003] postcreate.sh に pnpm install が含まれておらず、コンテナ起動後に手動実行が必要

- **場所**: `.devcontainer/postcreate.sh`
- **問題**: `pnpm install` が実行されないため、コンテナ起動直後は `node_modules` がなく、`pnpm dev` や `pnpm generate` が失敗する。
- **影響**: 開発者が明示的に `pnpm install` を実行しなければならず、オンボーディング体験が悪化する。
- **提案**: postcreate.sh の末尾に追加する。

```bash
# プロジェクト依存関係のインストール
cd /workspaces/lambdalith-hono-openapi-sample
pnpm install
```

---

#### [DEPLOY-001] dist/ が .gitignore されているため CI/CD なしでは Terraform apply の前提条件を手動で満たす必要がある

- **場所**: `.gitignore:57`、README の「デプロイ (Terraform)」セクション
- **問題**: `dist/` が Git 管理外であるため、`pnpm build` → `terraform apply` をすべてローカルで実行しなければならない。誤って `pnpm build` を省いた状態で `terraform apply` を実行するとビルド前の成果物がデプロイされる。
- **影響**: 誤デプロイリスク・CI/CD 未整備での属人的オペレーション。
- **提案**: GitHub Actions ワークフローの雛形を追加し、`pnpm build` → `terraform apply` を自動化する。最低限 README に「terraform apply の前に必ず pnpm build を実行すること」という注意書きを目立つ形で追加する。

---

### 🟢 低優先度（改善提案）

#### [TF-008] IAM ロール・ポリシーにコメントがなく意図が読み取りにくい

- **場所**: `infrastructure/iam.tf`
- **問題**: `AWSLambdaBasicExecutionRole` がアタッチされているだけで、このポリシーが何を許可するか（CloudWatch Logs への書き込みのみ）のコメントがない。
- **提案**: コメントを追加して最小権限の原則を明示する。

```hcl
# AWSLambdaBasicExecutionRole: CloudWatch Logs への書き込みのみを許可する最小権限ポリシー
resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}
```

---

#### [SEC-001] インメモリデータストアが Lambda 再起動で消えることが README に未記載

- **場所**: README 全般、`src/repository/`
- **問題**: Lambda はコールドスタートやスケーリングのたびにインスタンスが新規作成され、インメモリストアのデータが消える。サンプルとして許容できるが、ユーザーが本番利用を誤解するリスクがある。
- **提案**: README に以下を追記する。

```markdown
> **注意**: データストアはインメモリ実装のため、Lambda の再起動やスケールアウトによりデータが消失します。
> 永続化が必要な場合は DynamoDB や RDS などの外部データストアに置き換えてください。
```

---

#### [DC-004] swagger-viewer 拡張が古く、TypeSpec 開発に適した代替がある

- **場所**: `.devcontainer/devcontainer.json` — `extensions` 配列
- **問題**: `arjun.swagger-viewer` は更新が止まっており、OpenAPI 3.x の対応が不完全な場合がある。
- **提案**: より活発にメンテナンスされている拡張に置き換えることを検討する。

```json
"extensions": [
  "hashicorp.terraform",
  "hediet.vscode-drawio",
  "typespec.typespec-vscode",
  "42crunch.vscode-openapi"    // arjun.swagger-viewer の代替
]
```

---

#### [SEC-002] HTTP セキュリティヘッダーがアプリケーションレベルで設定されていない

- **場所**: `src/app.ts`（推定）
- **問題**: `X-Content-Type-Options`、`X-Frame-Options`、`Strict-Transport-Security` 等のセキュリティヘッダーが設定されていない（Function URL は HTTPS 専用のため HSTS の実用性は限定的だが）。
- **提案**: Hono のミドルウェアで設定する。

```typescript
import { secureHeaders } from 'hono/secure-headers'

app.use('*', secureHeaders())
```

---

## 総評

このサンプルはアーキテクチャの骨格として優れており、TypeSpec → OpenAPI → Hono → Lambda のパイプラインは明快に示されている。ただし、インフラコードにはサンプルとして許容できない問題が 2 点ある。**[TF-001] archive_file の自己循環包含** は 2 回目以降のデプロイを実質的に破壊するバグであり最優先で修正が必要。**[TF-002/003] 認証なし・CORS ワイルドカード** はサンプルとして意図的な選択であるとしても、README での明示的な警告が不可欠である。DevContainer は DX の向上余地が複数あるが、致命的な問題はない。全体として「動くサンプル」としての品質はあるが、これをベースに実装を進める開発者が安全に利用できるガードレール（警告コメント・CI/CD 雛形・example ファイル）の整備が望まれる。
