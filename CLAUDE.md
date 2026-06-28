アーキテクチャ・技術スタック・仕様の詳細は `README.md` を参照。

# 開発スタイル

- 不明瞭な指示は作業前に質問して明確にする
- 変更前に既存のコードとパターンを把握する
- 小さく・確認しながら進める（大きなリファクタは分割して実施）
- コミット前に lint・フォーマットの通過を確認する
- 作業が完了したらコミット・push・PR起票まで行う。
- 必ずmainの最新を取り込んでからブランチを切って作業し、PR 経由でマージする。

# ブランチ運用

```bash
git switch -c <branch-name>                  # ブランチを作成して切り替え
# 変更・コミット
git push -u origin <branch-name>             # リモートにプッシュ
gh pr create --title "<title>" --body "<body>"  # PR起票（自動マージ有効）
```


# コード設計

- 関心の分離を保つ（設定・ロジック・インフラを混在させない）
- シークレットは環境変数経由で渡す（ハードコード禁止）
- Infrastructure as Code は `infrastructure/` 配下に集約する
- ドキュメント・図は `docs/` 配下に置く

# コマンド

```bash
pnpm install          # 依存関係インストール
pnpm generate         # TypeSpec → OpenAPI → TypeScript 型を生成
pnpm dev              # ローカル開発サーバー起動 (http://localhost:3000)
pnpm build            # Lambda 用バンドル生成 (dist/index.mjs)
pnpm test:run         # テスト
pnpm typecheck        # 型検査
pnpm lint             # lint (Biome)
pnpm lint:fix         # lint 自動修正
```
