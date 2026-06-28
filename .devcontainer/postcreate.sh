#!/bin/bash
set -e

export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH"

# Claude Code のインストール
npm install -g @anthropic-ai/claude-code

# プロジェクト依存関係のインストール
cd /workspaces/lambdalith-hono-openapi-sample
pnpm install

# git branch in prompt
if ! grep -q 'git-sh-prompt' ~/.bashrc; then
  echo '. /usr/lib/git-core/git-sh-prompt' >> ~/.bashrc
  echo 'PS1='"'"'\[\033[01;32m\]\u@\h\[\033[01;33m\] \w \[\033[01;31m\]$(__git_ps1 "(%s)") \[\033[01;34m\]\$\[\033[00m\] '"'" >> ~/.bashrc
fi
