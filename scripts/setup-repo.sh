#!/usr/bin/env bash
# setup-repo.sh — テンプレートから派生したリポジトリに標準設定を適用する
#
# 使い方:
#   bash scripts/setup-repo.sh
#
# 必要なもの:
#   - gh CLI (github.com/cli/cli) がインストール・認証済みであること
#   - このスクリプトはリポジトリルートで実行すること
#
# 冪等: 再実行しても同じ状態になる（既存ルールセットは上書き）

set -euo pipefail

###############################################################################
# 色付きログ
###############################################################################
info()    { echo -e "\033[0;34m[INFO]\033[0m  $*"; }
success() { echo -e "\033[0;32m[OK]\033[0m    $*"; }
warn()    { echo -e "\033[0;33m[WARN]\033[0m  $*"; }
error()   { echo -e "\033[0;31m[ERROR]\033[0m $*" >&2; }

###############################################################################
# 前提チェック
###############################################################################
if ! command -v gh &>/dev/null; then
  error "gh CLI が見つかりません。https://cli.github.com/ からインストールしてください。"
  exit 1
fi

if ! gh auth status &>/dev/null; then
  error "gh が認証されていません。'gh auth login' を実行してください。"
  exit 1
fi

REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner' 2>/dev/null || true)
if [[ -z "$REPO" ]]; then
  error "カレントディレクトリが GitHub リポジトリではないか、'gh repo view' が失敗しました。"
  exit 1
fi

REPO_NAME="${REPO##*/}"

# テンプレートリポジトリ自身への誤実行を防ぐ
if [[ "$REPO_NAME" == "template" ]]; then
  error "'template' リポジトリ自身には実行しないでください。"
  error "このスクリプトは派生リポジトリで実行するものです。"
  exit 1
fi

echo ""
info "対象リポジトリ: ${REPO}"
echo ""
read -rp "このリポジトリに標準設定を適用しますか？ [y/N] " confirm
if [[ "${confirm,,}" != "y" ]]; then
  echo "キャンセルしました。"
  exit 0
fi
echo ""

###############################################################################
# 1. リポジトリ基本設定
###############################################################################
info "リポジトリ設定を更新中..."

gh repo edit "$REPO" \
  --enable-auto-merge \
  --delete-branch-on-merge \
  --enable-squash-merge \
  --enable-merge-commit=false \
  --enable-rebase-merge=false

success "自動マージ・squash 統一・マージ後ブランチ自動削除 を有効化しました。"

###############################################################################
# 2. main ブランチのルールセット（冪等）
###############################################################################
info "main ブランチルールセットを設定中..."

RULESET_NAME="main-protection"

# 既存ルールセットの ID を検索
EXISTING_ID=$(
  gh api "/repos/${REPO}/rulesets" 2>/dev/null \
    | jq -r --arg name "$RULESET_NAME" '.[] | select(.name == $name) | .id' \
    | head -n1
)

RULESET_PAYLOAD=$(cat <<'JSON'
{
  "name": "main-protection",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": {
      "include": ["~DEFAULT_BRANCH"],
      "exclude": []
    }
  },
  "bypass_actors": [],
  "rules": [
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "required_status_checks": [
          { "context": "ci" }
        ],
        "strict_required_status_checks_policy": true
      }
    },
    {
      "type": "non_fast_forward"
    },
    {
      "type": "deletion"
    }
  ]
}
JSON
)

if [[ -n "$EXISTING_ID" ]]; then
  # 既存ルールセットを上書き（PUT）
  echo "$RULESET_PAYLOAD" | gh api \
    --method PUT \
    "/repos/${REPO}/rulesets/${EXISTING_ID}" \
    --input - > /dev/null
  success "既存ルールセット (ID: ${EXISTING_ID}) を更新しました。"
else
  # 新規作成
  echo "$RULESET_PAYLOAD" | gh api \
    --method POST \
    "/repos/${REPO}/rulesets" \
    --input - > /dev/null
  success "ルールセット '${RULESET_NAME}' を作成しました。"
fi

###############################################################################
# 3. 標準ラベルの整備
###############################################################################
info "標準ラベルを設定中..."

declare -A LABELS=(
  ["bug"]="d73a4a:バグ・不具合"
  ["enhancement"]="a2eeef:新機能・機能改善"
  ["chore"]="e4e669:依存更新・雑務"
  ["documentation"]="0075ca:ドキュメント"
  ["question"]="d876e3:質問・調査"
)

for label in "${!LABELS[@]}"; do
  IFS=':' read -r color description <<< "${LABELS[$label]}"
  gh label create "$label" \
    --color "$color" \
    --description "$description" \
    --repo "$REPO" \
    --force 2>/dev/null && true
done

success "ラベルを設定しました。"

###############################################################################
# 完了
###############################################################################
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
success "セットアップ完了: ${REPO}"
echo ""
echo "  ✓ 自動マージ・squash 統一・ブランチ自動削除"
echo "  ✓ main ブランチルールセット (PR 必須・CI 必須・force push 禁止)"
echo "  ✓ 標準ラベル"
echo ""
echo "日常フロー:"
echo "  1. git checkout -b feature/xxx"
echo "  2. 作業してコミット・push"
echo "  3. gh pr create --fill"
echo "  4. gh pr merge --auto --squash  # CI 通過後に自動マージ"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
