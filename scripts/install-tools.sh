#!/usr/bin/env bash
# Life OS optional-tools installer (macOS / Linux).
# Usage: install-tools.sh ollama|tmux|claude|all
# Idempotent; prints progress lines the Electron wizard streams to the user.
set -u
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$HOME/.npm-global/bin:/snap/bin:$PATH"
export NONINTERACTIVE=1
TARGET="${1:-}"
OS="$(uname -s)"
FAILED=0

say()  { printf '==> %s\n' "$*"; }
ok()   { printf '    ok: %s\n' "$*"; }
warn() { printf '    warning: %s\n' "$*"; }
fail() { printf '    FAILED: %s\n' "$*"; FAILED=1; }
has()  { command -v "$1" >/dev/null 2>&1; }

# Runs a privileged command; without a TTY sudo would hang, so print it instead.
run_sudo() {
  if [ "$(id -u)" = "0" ]; then "$@"; return $?; fi
  if [ -t 0 ] && has sudo; then sudo "$@"; return $?; fi
  if has sudo && sudo -n true 2>/dev/null; then sudo -n "$@"; return $?; fi
  warn "needs administrator rights and no terminal is attached. Run this manually:"
  printf '      sudo %s\n' "$*"
  return 1
}

ensure_brew() {
  if has brew; then return 0; fi
  say "Homebrew not found — installing (this can take a few minutes)"
  if /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"; then
    # Apple Silicon puts brew in /opt/homebrew, Intel in /usr/local — both on PATH above.
    has brew && { ok "Homebrew installed"; return 0; }
  fi
  fail "Homebrew installation failed. Install it from https://brew.sh and try again."
  return 1
}

install_ollama() {
  say "Ollama (local AI)"
  if has ollama; then ok "already installed at $(command -v ollama)"
  else
    case "$OS" in
      Darwin)
        ensure_brew || return 1
        brew install ollama && ok "installed via Homebrew" || { fail "brew install ollama"; return 1; }
        ;;
      Linux)
        if curl -fsSL https://ollama.com/install.sh | sh; then ok "installed via ollama.com/install.sh"
        else fail "ollama.com/install.sh (it may need sudo — run it in a terminal)"; return 1; fi
        ;;
      *) fail "unsupported OS: $OS"; return 1 ;;
    esac
  fi
  start_ollama
}

start_ollama() {
  if curl -fsS --max-time 2 http://localhost:11434/api/tags >/dev/null 2>&1; then ok "Ollama is running"; return 0; fi
  say "starting Ollama"
  if [ "$OS" = "Darwin" ] && has brew && brew list ollama >/dev/null 2>&1; then
    brew services start ollama >/dev/null 2>&1 || true
  elif [ "$OS" = "Linux" ] && has systemctl && systemctl list-unit-files ollama.service >/dev/null 2>&1; then
    run_sudo systemctl enable --now ollama >/dev/null 2>&1 || true
  fi
  if ! curl -fsS --max-time 2 http://localhost:11434/api/tags >/dev/null 2>&1; then
    nohup ollama serve >/dev/null 2>&1 &
    disown 2>/dev/null || true
  fi
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    sleep 1
    if curl -fsS --max-time 2 http://localhost:11434/api/tags >/dev/null 2>&1; then ok "Ollama is running on http://localhost:11434"; return 0; fi
  done
  warn "Ollama installed but not reachable yet; it should start on its own shortly (or run: ollama serve)"
}

install_tmux() {
  say "tmux (Kairos terminal)"
  if has tmux; then ok "already installed at $(command -v tmux)"; return 0; fi
  case "$OS" in
    Darwin)
      ensure_brew || return 1
      brew install tmux && ok "installed via Homebrew" || { fail "brew install tmux"; return 1; }
      ;;
    Linux)
      if has apt-get; then run_sudo apt-get install -y tmux
      elif has dnf; then run_sudo dnf install -y tmux
      elif has pacman; then run_sudo pacman -S --noconfirm tmux
      elif has zypper; then run_sudo zypper install -y tmux
      else fail "no supported package manager found (apt/dnf/pacman/zypper)"; return 1; fi
      has tmux && ok "installed" || { fail "tmux install"; return 1; }
      ;;
    *) fail "unsupported OS: $OS"; return 1 ;;
  esac
}

install_claude() {
  say "Claude Code CLI (Kairos)"
  if has claude; then ok "already installed at $(command -v claude)"; return 0; fi
  if ! has npm; then
    fail "npm not found. Install Node.js (LTS) from https://nodejs.org and run this again."
    return 1
  fi
  if npm install -g @anthropic-ai/claude-code; then
    has claude && ok "installed at $(command -v claude)" || warn "installed; open a new terminal if 'claude' is not found yet"
  else
    warn "global npm install failed (permissions?). Retrying with a per-user prefix in ~/.npm-global"
    mkdir -p "$HOME/.npm-global"
    if npm install -g --prefix "$HOME/.npm-global" @anthropic-ai/claude-code; then
      ok "installed to ~/.npm-global/bin (Life OS adds it to PATH automatically)"
    else
      fail "npm install -g @anthropic-ai/claude-code"; return 1
    fi
  fi
}

case "$TARGET" in
  ollama) install_ollama ;;
  tmux)   install_tmux ;;
  claude) install_claude ;;
  all)    install_ollama; install_tmux; install_claude ;;
  *) echo "usage: $0 ollama|tmux|claude|all" >&2; exit 2 ;;
esac

if [ "$FAILED" -ne 0 ]; then say "finished with errors"; exit 1; fi
say "done"
exit 0
