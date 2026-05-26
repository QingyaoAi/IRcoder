<p align="center">
  <a href="https://ircoder.ai">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="IRcoder logo">
    </picture>
  </a>
</p>
<p align="center">IRcoder je open source AI agent za programiranje.</p>
<p align="center">
  <a href="https://ircoder.ai/discord"><img alt="Discord" src="https://img.shields.io/discord/1391832426048651334?style=flat-square&label=discord" /></a>
  <a href="https://www.npmjs.com/package/ircoder-ai"><img alt="npm" src="https://img.shields.io/npm/v/ircoder-ai?style=flat-square" /></a>
  <a href="https://github.com/anomalyco/ircoder/actions/workflows/publish.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/anomalyco/ircoder/publish.yml?style=flat-square&branch=dev" /></a>
</p>

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh.md">简体中文</a> |
  <a href="README.zht.md">繁體中文</a> |
  <a href="README.ko.md">한국어</a> |
  <a href="README.de.md">Deutsch</a> |
  <a href="README.es.md">Español</a> |
  <a href="README.fr.md">Français</a> |
  <a href="README.it.md">Italiano</a> |
  <a href="README.da.md">Dansk</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.pl.md">Polski</a> |
  <a href="README.ru.md">Русский</a> |
  <a href="README.bs.md">Bosanski</a> |
  <a href="README.ar.md">العربية</a> |
  <a href="README.no.md">Norsk</a> |
  <a href="README.br.md">Português (Brasil)</a> |
  <a href="README.th.md">ไทย</a> |
  <a href="README.tr.md">Türkçe</a> |
  <a href="README.uk.md">Українська</a> |
  <a href="README.bn.md">বাংলা</a> |
  <a href="README.gr.md">Ελληνικά</a> |
  <a href="README.vi.md">Tiếng Việt</a>
</p>

[![IRcoder Terminal UI](packages/web/src/assets/lander/screenshot.png)](https://ircoder.ai)

---

### Instalacija

```bash
# YOLO
curl -fsSL https://ircoder.ai/install | bash

# Package manageri
npm i -g ircoder-ai@latest        # ili bun/pnpm/yarn
scoop install ircoder             # Windows
choco install ircoder             # Windows
brew install anomalyco/tap/ircoder # macOS i Linux (preporučeno, uvijek ažurno)
brew install ircoder              # macOS i Linux (zvanična brew formula, rjeđe se ažurira)
sudo pacman -S ircoder            # Arch Linux (Stable)
paru -S ircoder-bin               # Arch Linux (Latest from AUR)
mise use -g ircoder               # Bilo koji OS
nix run nixpkgs#ircoder           # ili github:anomalyco/ircoder za najnoviji dev branch
```

> [!TIP]
> Ukloni verzije starije od 0.1.x prije instalacije.

### Desktop aplikacija (BETA)

IRcoder je dostupan i kao desktop aplikacija. Preuzmi je direktno sa [stranice izdanja](https://github.com/anomalyco/ircoder/releases) ili sa [ircoder.ai/download](https://ircoder.ai/download).

| Platforma             | Preuzimanje                        |
| --------------------- | ---------------------------------- |
| macOS (Apple Silicon) | `ircoder-desktop-mac-arm64.dmg`   |
| macOS (Intel)         | `ircoder-desktop-mac-x64.dmg`     |
| Windows               | `ircoder-desktop-windows-x64.exe` |
| Linux                 | `.deb`, `.rpm`, ili AppImage       |

```bash
# macOS (Homebrew)
brew install --cask ircoder-desktop
# Windows (Scoop)
scoop bucket add extras; scoop install extras/ircoder-desktop
```

#### Instalacijski direktorij

Instalacijska skripta koristi sljedeći redoslijed prioriteta za putanju instalacije:

1. `$IRCODER_INSTALL_DIR` - Prilagođeni instalacijski direktorij
2. `$XDG_BIN_DIR` - Putanja usklađena sa XDG Base Directory specifikacijom
3. `$HOME/bin` - Standardni korisnički bin direktorij (ako postoji ili se može kreirati)
4. `$HOME/.ircoder/bin` - Podrazumijevana rezervna lokacija

```bash
# Primjeri
IRCODER_INSTALL_DIR=/usr/local/bin curl -fsSL https://ircoder.ai/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://ircoder.ai/install | bash
```

### Agenti

IRcoder uključuje dva ugrađena agenta između kojih možeš prebacivati tasterom `Tab`.

- **build** - Podrazumijevani agent sa punim pristupom za razvoj
- **plan** - Agent samo za čitanje za analizu i istraživanje koda
  - Podrazumijevano zabranjuje izmjene datoteka
  - Traži dozvolu prije pokretanja bash komandi
  - Idealan za istraživanje nepoznatih codebase-ova ili planiranje izmjena

Uključen je i **general** pod-agent za složene pretrage i višekoračne zadatke.
Koristi se interno i može se pozvati pomoću `@general` u porukama.

Saznaj više o [agentima](https://ircoder.ai/docs/agents).

### Dokumentacija

Za više informacija o konfiguraciji IRcoder-a, [**pogledaj dokumentaciju**](https://ircoder.ai/docs).

### Doprinosi

Ako želiš doprinositi IRcoder-u, pročitaj [upute za doprinošenje](./CONTRIBUTING.md) prije slanja pull requesta.

### Gradnja na IRcoder-u

Ako radiš na projektu koji je povezan s IRcoder-om i koristi "ircoder" kao dio naziva, npr. "ircoder-dashboard" ili "ircoder-mobile", dodaj napomenu u svoj README da projekat nije napravio IRcoder tim i da nije povezan s nama.

---

**Pridruži se našoj zajednici** [Discord](https://discord.gg/ircoder) | [X.com](https://x.com/ircoder)
