# PC Emulator: third-party software and licenses

Everything in this folder is free software that may be redistributed. No Microsoft software, and nothing
that cannot be redistributed, is hosted, linked or embedded here. The "Bring your own disk image" option
reads a file the user picks from their own computer. That file stays in their browser and is never uploaded.

## v86 (emulator core, not hosted here)

- Loaded at run time from `https://cdn.jsdelivr.net/npm/v86@0.5.470/build/` (`libv86.js`, `v86.wasm`)
- npm package `v86` 0.5.470 (built from commit `6db8b15`), BSD-2-Clause, Copyright (c) 2012, The v86 contributors
- Source: https://github.com/copy/v86 · License: https://github.com/copy/v86/blob/master/LICENSE

## bios/seabios.bin, bios/vgabios.bin

- SeaBIOS and SeaVGABIOS, release `rel-1.16.2`, built by the v86 project with
  [bios/seabios.config](https://github.com/copy/v86/blob/6db8b15/bios/seabios.config) via
  [fetch-and-build-seabios.sh](https://github.com/copy/v86/blob/6db8b15/bios/fetch-and-build-seabios.sh)
- Downloaded unmodified from https://github.com/copy/v86/tree/6db8b15/bios
- License: GNU LGPL v3 (full text in `bios/COPYING.LESSER`; it builds on the GNU GPL v3, https://www.gnu.org/licenses/gpl-3.0.txt)
- Source: https://www.seabios.org/ · https://git.seabios.org/seabios.git (tag `rel-1.16.2`) · mirror https://github.com/coreboot/seabios
- SHA-256: seabios.bin `73e3f359102e3a9982c35fce98eb7cd08f18303ac7f1ba6ebfbe6cdc1c244d98`,
  vgabios.bin `a4bc0d80cc3ca028c73dafa8fee396b8d054ce87ebd8abfbd31b06b437607880`

## images/kolibri.img (KolibriOS)

- KolibriOS nightly build `0.7.7.0-9230-g723a1b443` (en_US), 1.44 MB floppy image, unmodified
- Downloaded from the official site https://kolibrios.org/en/download
  (`https://builds.kolibrios.org/ci/0.7.7.0-9230-g723a1b443/en_US/kolibrios-0.7.7.0-9230-g723a1b443-en_US.img`)
- SHA-256 `60c2a0de2ebc23aed542630b7901e2baa425f85e291b844db7f0bc3aa3cee006` (matches the official `sha256sums.txt`)
- License: GNU GPL v2 (https://www.gnu.org/licenses/gpl-2.0.html). The image carries its own `COPYING` file.
- Source: https://git.kolibrios.org (commit `723a1b443`)

## images/freedos.img (FreeDOS 1.4)

- Boot disk of the official FreeDOS 1.4 Floppy Edition: `144m/x86BOOT.img` from
  https://download.freedos.org/1.4/FD14-FloppyEdition.zip
  (zip SHA-256 `45b1fa7c52dd996c3bfa5e352ffcd410781b952a6ad629f15a4c9ec4bbaefc5a`,
  original image SHA-256 `552f7cbb0625960c050a3e682a4d2121cc2ffdfa9dc9d592ccd49edf179333dc`)
- **Modified** (two same-length text edits, nothing else changed) so it boots straight to the prompt:
  - `FDAUTO.BAT`: the line that starts `SETUP.BAT` on boot (and the errorlevel check after it) was replaced by a
    `rem` comment. Typing `SETUP` still runs the installer.
  - `FDCONFIG.SYS`: the language menu timeout changed from 10 to 2 seconds (`MENUDEFAULT=1,02`).
  - Resulting SHA-256 `3dac53e625967e150f252aef74308ccfd1b240a707620bff340651c782ba4207`
- License: the FreeDOS kernel and FreeCOM shell are GNU GPL v2 (https://www.gnu.org/licenses/gpl-2.0.html). The
  other programs on the disk are GPL or other open-source licenses, listed in each package's metadata.
- Source: https://www.freedos.org/ · package sources https://www.ibiblio.org/pub/micro/pc-stuff/freedos/files/repositories/1.4/
  (also on the FreeDOS 1.4 BonusCD, https://download.freedos.org/1.4/FD14-BonusCD.zip) · kernel https://github.com/FDOS/kernel ·
  FreeCOM https://github.com/FDOS/freecom
