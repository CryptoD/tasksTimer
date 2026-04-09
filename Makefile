# taskTimer — gettext, gnome-extensions pack, AppImage, gjs tests (see bin/ and packaging/appimage/).

ROOT := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))

.PHONY: all mo pack clean install uninstall appimage test lint sync-version sync-appdir check-deps check-deps-appimage test12 test-race

all: pack

sync-version:
	"$(ROOT)/bin/sync-version.py"

# Refresh packaging/appimage/AppDir from repo (ignored in git; use before local AppImage tests)
sync-appdir:
	bash "$(ROOT)/bin/sync-appdir.sh" "$(ROOT)"

check-deps:
	"$(ROOT)/bin/check-deps.sh"

check-deps-appimage:
	"$(ROOT)/bin/check-deps.sh" --appimage

# Full pipeline (TEST 12): lint, test, appimage; pack too if gnome-extensions is installed.
test12:
	bash "$(ROOT)/tests/test12_full_build_local.sh"

lint:
	"$(ROOT)/bin/check-deps.sh" --compile
	"$(ROOT)/bin/lint.sh"

mo:
	"$(ROOT)/bin/po_compile.sh"

pack: mo
	"$(ROOT)/bin/pack.sh"

clean:
	rm -f "$(ROOT)"/taskTimer@CryptoD.*shell-extension*.zip
	rm -rf "$(ROOT)/packaging/appimage/dist"

install: mo
	"$(ROOT)/bin/check-deps.sh" --compile --install
	"$(ROOT)/install_local.sh"

uninstall:
	"$(ROOT)/install_local.sh" -u

appimage: mo
	"$(ROOT)/packaging/appimage/build-appimage.sh"

test:
	"$(ROOT)/bin/check-deps.sh" --runtime
	cd "$(ROOT)" && set -e && for f in tests/test*.js; do \
		echo "==> $$f"; gjs "$$f"; \
	done

# Go race detector (only when this repo contains a Go module).
#
# Default scope is all packages; override with:
#   make test-race RACE_PKGS=./internal/router/...
#
# If any packages must be excluded (e.g. platform-specific or cgo-heavy), list them
# explicitly via RACE_EXCLUDE and keep the rationale in docs/dev/development.md.
RACE_PKGS ?= ./...
RACE_EXCLUDE ?=

test-race:
	@if [ ! -f "$(ROOT)/go.mod" ]; then \
		echo "test-race: no go.mod; skipping"; \
		exit 0; \
	fi
	@if [ -n "$(RACE_EXCLUDE)" ]; then \
		echo "test-race: excluded packages: $(RACE_EXCLUDE)"; \
	fi
	go test -race $(RACE_PKGS)
