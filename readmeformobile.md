# Offroute Mobile — Android & iOS Deployment

Guide to build and run Offroute on Android and iOS (Tauri v2 mobile).

## Prerequisites (both platforms)

| Tool | Requirements |
|------|-------------|
| Node/Deno | Project tooling (Vite, Tauri CLI) |
| Tauri CLI | `@tauri-apps/cli` (already in `package.json`) |
| Rust | Stable toolchain + mobile targets (see below) |

## Current Machine State

| Item | Status |
|------|--------|
| `src-tauri/gen/android` scaffold | ✅ exists (Gradle 8.14.3, compileSdk 36) |
| `src-tauri/gen/apple` scaffold | ✅ exists (Xcode 26.5) |
| CocoaPods | ✅ installed |
| iOS Rust targets | ✅ installed (`aarch64-apple-ios`, `aarch64-apple-ios-sim`, `x86_64-apple-ios`) |
| JDK 17+ | ❌ missing |
| Android SDK (Platform 36, Build-Tools, NDK 27.x) | ❌ missing |
| Android Rust targets | ❌ missing |
| Android device/emulator | ❌ not set up |

---

## Android

### Setup (one-time)

```bash
# 1. JDK 17+
brew install --cask temurin@17

# 2. Android SDK — easiest via Android Studio, or headless:
brew install --cask android-studio
#   Inside Studio: SDK Manager → install Android SDK Platform 36, Build-Tools, NDK 27.x
#   Or headless:
SDK="$HOME/Library/Android/sdk"
mkdir -p "$SDK/cmdline-tools"
curl -L -o /tmp/cmdtools.zip "https://dl.google.com/android/repository/commandlinetools-mac-11076708_latest.zip"
unzip -q /tmp/cmdtools.zip -d "$SDK/cmdline-tools" && mv "$SDK/cmdline-tools/cmdline-tools" "$SDK/cmdline-tools/latest"
"$SDK/cmdline-tools/latest/bin/sdkmanager" "platforms;android-36" "build-tools;36.0.0" "ndk;27.x" "platform-tools"

# 3. Environment (add to ~/.zshrc)
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin"

# 4. Rust Android targets
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
```

### Device / Emulator

- **Physical device**: enable Developer Options + USB Debugging, plug in (`adb devices` to verify).
- **Emulator**:
  ```bash
  "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" "system-images;android-36;google_apis;arm64-v8a"
  "$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager" create avd -n offroute -k "system-images;android-36;google_apis;arm64-v8a"
  "$ANDROID_HOME/emulator/emulator" -avd offroute
  ```

### Build & Run

```bash
npm run tauri android init      # only if gen/android missing (already done)
npm run tauri android dev       # hot-reload dev build on device/emulator
npm run tauri android build     # release APK/AAB -> src-tauri/gen/android/app/build/outputs/
```

First build compiles all Rust targets — expect several minutes.

---

## iOS

Requires macOS + Xcode. All scaffolds already generated.

### Setup (one-time)

```bash
# 1. Xcode + Command Line Tools (already installed)
xcode-select --install

# 2. CocoaPods (already installed)
sudo gem install cocoapods

# 3. Rust iOS targets (already installed)
rustup target add aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios
```

### Signing

- **Simulator**: no signing needed.
- **Physical device**: create a free Apple ID team in Xcode → Signing & Capabilities, or set a paid Developer team in `src-tauri/gen/apple/offroute.xcodeproj`.

### Build & Run

```bash
npm run tauri ios init      # only if gen/apple missing (already done)
npm run tauri ios dev       # hot-reload in iOS Simulator
npm run tauri ios build     # release .app/.ipa -> src-tauri/gen/apple/build/
```

---

## Platform Plugin Notes

| Plugin | Android | iOS |
|--------|---------|-----|
| `tauri-plugin-sql` (sqlite) | ✅ works out of the box | ✅ works out of the box |
| `tauri-plugin-geolocation` | needs `ACCESS_FINE_LOCATION`/`ACCESS_COARSE_LOCATION` in `gen/android/app/src/main/AndroidManifest.xml` + `geolocation:default` capability | needs `NSLocationWhenInUseUsageDescription` in Info.plist + `geolocation:default` capability |
| `tauri-plugin-notification` | needs `POST_NOTIFICATIONS` permission in manifest | permission requested at runtime |
| `tauri-plugin-blec` | adds BLE permissions via its own manifest | needs `NSBluetoothAlwaysUsageDescription` in Info.plist |

Desktop-only deps (e.g. `starship-battery`) are already gated via `[target.'cfg(not(any(target_os = "android", target_os = "ios")))'.dependencies]` in `Cargo.toml`.

## Gotchas

- `npm run tauri android dev` requires the dev server + devices reachable from the host — same LAN is fine via USB debugging/emulator networking.
- Re-run `tauri android init` / `tauri ios init` after upgrading the Tauri CLI version to regenerate scaffolding.
- iOS release signing requires `ExportOptions.plist` configured when distributing via `altool`/TestFlight.