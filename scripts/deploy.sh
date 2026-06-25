#!/usr/bin/env bash
# GitHub Pages へデプロイ（data/extras-*.json は preserve-extras.js で保護）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="${GITHUB_REPO:-takpz93/invoice-input}"
TMP="$(mktemp -d)"

echo "→ Preserving extras JSON..."
node "$ROOT/scripts/preserve-extras.js" || true

echo "→ Packaging..."
rsync -a \
  --exclude '.git' \
  --exclude '.github' \
  --exclude 'scripts/build_invoice.py' \
  "$ROOT/" "$TMP/"

cd "$TMP"
git init -b main
git add -A
git commit -m "${1:-Update invoice-input app}"

gh auth setup-git 2>/dev/null || true

if ! gh repo view "$REPO" &>/dev/null; then
  echo "→ Creating repo $REPO ..."
  gh repo create "$REPO" --public --description "請求書 追加明細入力（交通費・撮影費）"
fi

git remote add origin "https://github.com/${REPO}.git" 2>/dev/null || \
  git remote set-url origin "https://github.com/${REPO}.git"

git push origin main --force

# GitHub Pages 有効化（legacy / root）
if ! gh api "repos/${REPO}/pages" &>/dev/null; then
  gh api "repos/${REPO}/pages" -X POST --input - <<EOF
{"build_type":"legacy","source":{"branch":"main","path":"/"}}
EOF
fi

echo ""
echo "→ Deployed: https://takpz93.github.io/invoice-input/"
