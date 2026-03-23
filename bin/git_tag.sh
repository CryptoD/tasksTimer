#!/usr/bin/env bash

ME=$(basename "$0")
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
test=""

info() {
	echo -e "${test}> $*"
}

[ $# -lt 2 ] && test="DRYRUN" && info -e "set > 1 parameters to create tag"

info "$ROOT"
cd "$ROOT/taskTimer@CryptoD" || {
	echo "Failed to change to extension directory" >&2
	exit 1
}

info "Working in $(pwd)"

gsv=$(python3 -c "import json; m=json.load(open('metadata.json')); print('_'.join(m['shell-version']).replace('.','_'))")
ver=$(python3 -c "import json; print(json.load(open('$ROOT/version.json'))['version'])")
ver=$(echo -n "$ver")

msg="taskTimer ver$ver for Gnome Shell $gsv"
tag_name=$(echo -n "$msg" | sed 's/[ \.]/_/g')
info git tag -a "$tag_name" -m "$msg"

[ -z "$test" ] && git tag -a "$tag_name" -m "$msg"

info Tags ...
git tag
