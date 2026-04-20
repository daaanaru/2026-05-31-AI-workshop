#!/usr/bin/env sh
set -eu

fail() {
  printf 'prepublish-check: %s\n' "$1" >&2
  exit 1
}

require_file() {
  [ -f "$1" ] || fail "missing required file: $1"
}

require_file README.md
require_file PUBLICATION.md
require_file index.html
require_file assets/app.js
require_file assets/styles.css

if git ls-files | grep -Eq '^(inbox/|private/|\.private|.*\.napkin$)'; then
  fail "private or generated source files are tracked"
fi

if git status --short --ignored | grep -Eq '^[ AMDRC?]{2} inbox/'; then
  fail "inbox/ must not be staged or committed"
fi

if ! grep -q 'placeholder="なまえ"' index.html; then
  fail 'index.html does not look like the expected latest form'
fi

if grep -RInE '参加予定|プライベート化済み' README.md PUBLICATION.md index.html assets; then
  fail "public files contain known private/draft wording"
fi

if [ -f '.private-public-denylist' ]; then
  while IFS= read -r term || [ -n "$term" ]; do
    case "$term" in
      ''|'#'*) continue ;;
    esac
    if grep -RInF "$term" README.md PUBLICATION.md index.html assets; then
      fail "public files contain a term from .private-public-denylist"
    fi
  done < .private-public-denylist
fi

src_dir='inbox/AI-workshop-form (2)'
if [ -d "$src_dir" ]; then
  cmp -s index.html "$src_dir/AI勉強会 事前フォーム.html" ||
    fail "index.html does not match the approved inbox HTML source"
  cmp -s assets/app.js "$src_dir/assets/app.js" ||
    fail "assets/app.js does not match the approved inbox JS source"
  cmp -s assets/styles.css "$src_dir/assets/styles.css" ||
    fail "assets/styles.css does not match the approved inbox CSS source"
fi

printf 'prepublish-check: ok\n'
