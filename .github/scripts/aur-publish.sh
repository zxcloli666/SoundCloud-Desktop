#!/usr/bin/env bash
# Публикация soundcloud-bin в AUR (вызов — .github/workflows/aur-publish.yml).
#
# Идемпотентен: в режиме auto публикует, только если релиз новее версии в AUR.
# Поэтому его гоняет ещё и расписание — упавший на релизе запуск догоняется сам.
#
# Env:
#   TAG          тег релиза; пусто → последний релиз репозитория (Latest)
#   MODE         auto  — только если релиз новее AUR (по умолчанию)
#                force — всегда; та же версия → pkgrel+1
#   DRY_RUN      1 → всё, кроме git push (печатает diff)
#   REPO         owner/name (по умолчанию $GITHUB_REPOSITORY)
#   ARCH_IMAGES  образы archlinux:base-devel через пробел, пробуются по порядку
set -euo pipefail

PKG=soundcloud-bin
REPO=${REPO:-${GITHUB_REPOSITORY:?нужен REPO или GITHUB_REPOSITORY}}
TAG=${TAG:-}
MODE=${MODE:-auto}
DRY_RUN=${DRY_RUN:-0}
ARCH_IMAGES=${ARCH_IMAGES:-mirror.gcr.io/library/archlinux:base-devel docker.io/library/archlinux:base-devel ghcr.io/archlinux/archlinux:base-devel}
AUR_GIT=https://aur.archlinux.org/${PKG}.git
AUR_PUSH=ssh://aur@aur.archlinux.org/${PKG}.git

log() { printf '==> %s\n' "$*" >&2; }
die() {
  printf '::error::%s\n' "$*" >&2
  exit 1
}

# retry N cmd... — до N попыток, пауза 5, 10, 20, … секунд.
retry() {
  local tries=$1 n=1 delay=5
  shift
  until "$@"; do
    ((n < tries)) || return 1
    log "не вышло ($n/$tries), повтор через ${delay}s: $*"
    sleep "$delay"
    n=$((n + 1)) delay=$((delay * 2))
  done
}

# ver_gt A B — A строго новее B.
ver_gt() { [ "$1" != "$2" ] && [ "$(printf '%s\n%s\n' "$1" "$2" | sort -V | tail -n1)" = "$1" ]; }

sha256() {
  if command -v sha256sum >/dev/null; then sha256sum "$1"; else shasum -a 256 "$1"; fi | cut -d' ' -f1
}

case $MODE in auto | force) ;; *) die "MODE=$MODE: ожидается auto или force" ;; esac

# 1. Версия.
if [ -z "$TAG" ]; then
  TAG=$(retry 5 gh release view -R "$REPO" --json tagName --jq .tagName) || die "не узнал последний релиз $REPO"
fi
NEW_VER=${TAG#v}
log "релиз $TAG → pkgver $NEW_VER, режим $MODE"

# 2. Префильтр по RPC: дёшево и без клона. Кэш RPC отстаёт на минуты, так что
#    «в AUR старее» тут не окончательно — окончательно решает PKGBUILD ниже.
if [ "$MODE" = auto ]; then
  rpc=$(curl -gfsS --retry 3 --retry-all-errors --max-time 30 \
    "https://aur.archlinux.org/rpc/v5/info?arg[]=${PKG}" | jq -r '.results[0].Version // empty') || rpc=
  if [ -n "$rpc" ] && ! ver_gt "$NEW_VER" "${rpc%-*}"; then
    log "в AUR уже $rpc — публиковать нечего"
    exit 0
  fi
fi

WORK=$(mktemp -d "${TMPDIR:-/tmp}/aur-publish.XXXXXX")
trap 'rm -rf "$WORK"' EXIT

# 3. Ассеты релиза — раньше клона AUR: нет .deb → дальше не идём.
URL="https://github.com/${REPO}/releases/download/${TAG}"
for deb_arch in amd64 arm64; do
  curl -fsSL --retry 5 --retry-all-errors --retry-delay 5 --max-time 900 \
    -o "$WORK/$deb_arch.deb" "${URL}/soundcloud-desktop_${NEW_VER}_${deb_arch}.deb" ||
    die "не скачал soundcloud-desktop_${NEW_VER}_${deb_arch}.deb из релиза $TAG"
done
SHA_AMD=$(sha256 "$WORK/amd64.deb")
SHA_ARM=$(sha256 "$WORK/arm64.deb")
rm -f "$WORK"/*.deb

# 4. Клон: читаем по HTTPS (ключ не нужен), пушим по SSH.
clone() {
  rm -rf "$WORK/aur"
  git clone -q "$AUR_GIT" "$WORK/aur"
}
retry 5 clone || die "AUR не отдал $AUR_GIT"
cd "$WORK/aur"
git remote set-url --push origin "$AUR_PUSH"

OLD_VER=$(sed -n 's/^pkgver=//p' PKGBUILD)
OLD_REL=$(sed -n 's/^pkgrel=//p' PKGBUILD)
[ -n "$OLD_VER" ] && [ -n "$OLD_REL" ] || die "в PKGBUILD нет pkgver=/pkgrel= с начала строки"
log "в AUR (git): $OLD_VER-$OLD_REL"

if ver_gt "$OLD_VER" "$NEW_VER"; then
  # Откат без epoch пользователям не приедет — pacman оставит у них новую версию.
  [ "$MODE" = auto ] && {
    log "в AUR $OLD_VER новее $NEW_VER — пропускаю"
    exit 0
  }
  die "в AUR $OLD_VER новее $NEW_VER: откат без epoch не доедет до пользователей"
fi
if [ "$MODE" = auto ] && [ "$OLD_VER" = "$NEW_VER" ]; then
  log "в AUR уже $OLD_VER-$OLD_REL — публиковать нечего"
  exit 0
fi
if [ "$OLD_VER" = "$NEW_VER" ]; then REL=$((OLD_REL + 1)); else REL=1; fi

# 5. PKGBUILD: только эти четыре поля, якорь ^ — см. комментарий в шапке PKGBUILD.
sed -e "s/^pkgver=.*/pkgver=${NEW_VER}/" \
  -e "s/^pkgrel=.*/pkgrel=${REL}/" \
  -e "s/^sha256sums_x86_64=.*/sha256sums_x86_64=('${SHA_AMD}')/" \
  -e "s/^sha256sums_aarch64=.*/sha256sums_aarch64=('${SHA_ARM}')/" \
  PKGBUILD >PKGBUILD.new
mv PKGBUILD.new PKGBUILD
for want in "pkgver=${NEW_VER}" "pkgrel=${REL}" "sha256sums_x86_64=('${SHA_AMD}')" "sha256sums_aarch64=('${SHA_ARM}')"; do
  grep -qxF "$want" PKGBUILD || die "PKGBUILD не принял «$want» — поменялась разметка?"
done

# 6. .SRCINFO пишет только makepkg. Образ — из первого живого реестра:
#    одна недоступная копия (как mirror.gcr.io на 8.8.0) больше не роняет публикацию.
srcinfo() {
  local img
  for img in $ARCH_IMAGES; do
    if retry 3 docker pull -q "$img" >/dev/null &&
      docker run --rm -v "$PWD:/pkg" -w /pkg -u "$(id -u):$(id -g)" -e HOME=/tmp "$img" \
        makepkg --printsrcinfo >.SRCINFO.new; then
      mv .SRCINFO.new .SRCINFO
      log ".SRCINFO собран в $img"
      return 0
    fi
    log "образ $img не сработал, беру следующий"
  done
  rm -f .SRCINFO.new
  return 1
}
srcinfo || die "ни один образ Arch не поднялся: $ARCH_IMAGES"
if ! grep -qxF $'\tpkgver = '"$NEW_VER" .SRCINFO || ! grep -qxF $'\tpkgrel = '"$REL" .SRCINFO; then
  die ".SRCINFO не совпал с PKGBUILD ($NEW_VER-$REL)"
fi

# 7. Коммит и пуш.
msg="Auto-update to version ${NEW_VER}"
[ "$REL" = 1 ] || msg="$msg (pkgrel $REL)"
git add PKGBUILD .SRCINFO
git -c user.name='github-actions[bot]' -c user.email='github-actions[bot]@users.noreply.github.com' \
  commit -q -m "$msg"
git --no-pager show --format='%h %s' HEAD >&2

if [ "$DRY_RUN" = 1 ]; then
  log "DRY_RUN: в AUR не пушу ($NEW_VER-$REL)"
  exit 0
fi
retry 5 git push -q origin HEAD:master || die "push в AUR не прошёл"
log "AUR: $PKG $NEW_VER-$REL опубликован"
