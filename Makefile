# taskTimer — gettext, gnome-extensions pack, AppImage, gjs tests (see bin/ and packaging/appimage/).

ROOT := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))

.PHONY: all mo pack clean install uninstall appimage test lint sync-version check-deps check-deps-appimage

all: pack

sync-version:
	"$(ROOT)/bin/sync-version.py"

check-deps:
	"$(ROOT)/bin/check-deps.sh"

check-deps-appimage:
	"$(ROOT)/bin/check-deps.sh" --appimage

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
