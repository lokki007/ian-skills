#!/usr/bin/env bash
# Privacy gate: fails if the repo contains personal paths, emails, secrets,
# or any word from the local, gitignored .private-denylist (one regex per line).
# Run before every commit:  bash scripts/check-private.sh
set -uo pipefail
cd "$(dirname "$0")/.."
fail=0
files=$(git ls-files --cached --others --exclude-standard 2>/dev/null || find . -type f -not -path './.git/*')
files=$(echo "$files" | grep -v -E '(^|/)(vendor/|.*\.min\.js$|zipf-en\.json$|scripts/check-private\.sh$)')

check() { # label, extended regex
  local hits
  hits=$(echo "$files" | xargs -d '\n' grep -nIiE -- "$2" 2>/dev/null | head -20)
  if [ -n "$hits" ]; then echo "✗ $1"; echo "$hits" | sed 's/^/    /'; fail=1; fi
}

check "absolute user paths"  '([A-Z]:\\Users\\|[A-Z]:/Users/|/Users/[A-Za-z]|/home/[a-z]+/|\b[A-Z]:[\/][A-Za-z_][A-Za-z0-9_. -]*[\/])'
check "email addresses"      '[A-Za-z0-9._%+-]+@(gmail|outlook|hotmail|yahoo|icloud|proton)\.'
check "likely secrets"       '(sk-[A-Za-z0-9]{20,}|sk_live_|rk_live_|ghp_[A-Za-z0-9]{20,}|xox[bp]-|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY)'

if [ -f .private-denylist ]; then
  while IFS= read -r pat; do
    [ -z "$pat" ] || [[ "$pat" == \#* ]] && continue
    check "private word: $pat" "$pat"
  done < .private-denylist
else
  echo "! no .private-denylist found (local only) — only generic checks ran"
fi

if command -v gitleaks >/dev/null; then
  gitleaks dir . --no-banner --redact -v >/dev/null 2>&1 || { echo "✗ gitleaks found something (run: gitleaks dir . -v)"; fail=1; }
fi

[ $fail -eq 0 ] && echo "✓ privacy check passed"
exit $fail
