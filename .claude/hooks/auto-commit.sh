#!/bin/bash
# Claudeが応答を終えたとき、未コミットの変更があればコミットを促すStopフック。
# decision:block で応答を継続させ、Claude自身に変更内容に即した
# コミットメッセージを書かせてコミットさせる。
cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0

input=$(cat)

# フック起因で継続した後の2回目のStopでは再ブロックしない（無限ループ防止）
case "$input" in
  *'"stop_hook_active":true'* | *'"stop_hook_active": true'*) exit 0 ;;
esac

# gitリポジトリでない・変更なしなら何もしない
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0
[ -z "$(git status --porcelain 2>/dev/null)" ] && exit 0

cat <<'EOF'
{"decision": "block", "reason": "未コミットの変更があります。git status と git diff で変更内容を確認し、変更の要点をまとめた日本語のコミットメッセージで git add -A してからコミットしてください。コミットが完了したら、他の作業はせずに終了してください。"}
EOF
exit 0
