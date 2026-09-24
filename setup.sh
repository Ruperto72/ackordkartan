#!/usr/bin/env bash
# Skapar repot på GitHub och pushar. Kräver gh CLI (gh auth login).
set -e
REPO="${1:-ackordkartan}"
git init -b main
git add .
git commit -m "Ackordkartan: greppgenerator för gitarr med öppna klanger på hela halsen"
gh repo create "$REPO" --public --source=. --push \
  --description "Gitarrgrepp med öppna klanger över hela halsen, en ackordkarta för att bygga följder (sekundärdominanter, lånade ackord) och ett bibliotek med stilar – en enfilsapp i webbläsaren, installerbar som PWA."
gh repo edit --enable-issues --add-topic guitar --add-topic music-theory --add-topic web-audio --add-topic svg
echo "Klart. Slå på Pages: gh api -X POST repos/:owner/$REPO/pages -f source[branch]=main -f source[path]=/"
