#!/bin/sh
# Platinum Reader installer for Linux and macOS.
#   curl -fsSL https://raw.githubusercontent.com/mishuk-11/platinum-reader/main/install.sh | sh
# Downloads the newest release from GitHub and verifies its SHA-256 checksum.
# Linux: installs the AppImage to ~/.local/bin/platinum-reader. macOS: opens the .dmg.
set -eu
repo="mishuk-11/platinum-reader"
api="https://api.github.com/repos/$repo/releases?per_page=15"

case "$(uname -s)" in
  Linux)  pattern='_amd64\.AppImage"' ;;
  Darwin) pattern='\.dmg"' ;;
  *) echo "Unsupported system: $(uname -s)" >&2; exit 1 ;;
esac

json=$(curl -fsSL "$api")
asset=$(printf '%s' "$json" | grep -o "\"browser_download_url\": *\"[^\"]*$pattern" | head -n1 | sed 's/.*"\(https[^"]*\)"/\1/')
sums=$(printf '%s' "$json" | grep -o '"browser_download_url": *"[^"]*SHA256SUMS[^"]*"' | head -n1 | sed 's/.*"\(https[^"]*\)"/\1/')
[ -n "$asset" ] && [ -n "$sums" ] || { echo "No installer for this system in the latest release." >&2; exit 1; }

tmp=$(mktemp -d)
name=$(basename "$asset")
echo "Downloading $name..."
curl -fsSL -o "$tmp/$name" "$asset"
curl -fsSL -o "$tmp/SHA256SUMS.txt" "$sums"

expected=$(grep " $name\$" "$tmp/SHA256SUMS.txt" | awk '{print $1}')
if command -v sha256sum >/dev/null; then actual=$(sha256sum "$tmp/$name" | awk '{print $1}')
else actual=$(shasum -a 256 "$tmp/$name" | awk '{print $1}'); fi
[ -n "$expected" ] && [ "$expected" = "$actual" ] || { echo "Checksum mismatch, nothing installed." >&2; rm -rf "$tmp"; exit 1; }
echo "Checksum OK."

if [ "$(uname -s)" = Linux ]; then
  mkdir -p "$HOME/.local/bin"
  mv "$tmp/$name" "$HOME/.local/bin/platinum-reader"
  chmod +x "$HOME/.local/bin/platinum-reader"
  echo "Installed to ~/.local/bin/platinum-reader (make sure ~/.local/bin is on your PATH)."
else
  open "$tmp/$name"
  echo "Drag Platinum Reader into Applications to finish."
fi
