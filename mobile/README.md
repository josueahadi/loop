# Loop — Mobile (Flutter)

The cargo-owner + driver mobile app for Loop. Talks to the NestJS API (`../api`), which is the system of record. State management is `provider`; networking is a single Dio client (`lib/core/api/`) that attaches the JWT and refreshes it on 401.

## Stack

- Flutter (stable) — developed on 3.32.5, Dart SDK `^3.8.1`
- **Android build tooling:** Android Gradle Plugin **≥ 8.11.1** and Gradle **≥ 8.14.3** (pinned in `android/settings.gradle.kts` + `android/gradle/wrapper/gradle-wrapper.properties`). `firebase_messaging` pulls in AndroidX libraries that require AGP 8.9.1+, so older AGP fails the Android build at `checkDebugAarMetadata`. Needs JDK 17+ (developed on 21).
- `provider` (state), `dio` + `flutter_secure_storage` (API + JWT)
- `flutter_map` + OpenStreetMap tiles (maps, no API key), `latlong2`, `geolocator` (device location)
- **Firebase in the client = FCM push only.** Auth (JWT), jobs, proposals, messaging, and document upload all go through the NestJS API. `firebase_core` + `firebase_messaging` (pointed at the `loop-rw` project) power **push notifications** — the API pushes on proposals, messages, and verification decisions. Firebase Storage also runs **server-side** on `loop-rw`. See [Push notifications](#push-notifications) below and [DEPLOYMENT.md §7](../DEPLOYMENT.md#7-push-notifications-fcm).

> Location search (place/landmark autocomplete + reverse-geocoded pin labels, served by the API's `/geocode/*` proxy over OpenStreetMap) and the "Open in Maps" navigation hand-off (`map_launcher` / `url_launcher` → Google / Apple Maps / Waze) arrive with M3.5–M4. No Google Maps SDK and no API key are used.

## Run

```bash
flutter pub get

# Point at the API via --dart-define=API_BASE_URL (default: http://localhost:3000).

# Local dev — iOS simulator / desktop:
flutter run --dart-define=API_BASE_URL=http://localhost:3000
# Local dev — Android emulator (host loopback is 10.0.2.2):
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000

# Against the DEPLOYED (production) API — no local backend needed:
flutter run --dart-define=API_BASE_URL=https://loop-api-prod.up.railway.app
```

For local dev, start the API + database first — see `../api/README.md`. To run against production, no local backend is needed — just point at the hosted URL above. The mobile app is not a browser, so CORS does not apply to it. Building the release APK against production is in [DEPLOYMENT.md §6](../DEPLOYMENT.md#6-mobile-apk).

### Android emulator

Push (FCM) can be tested on an Android emulator — you do **not** need a physical device (unlike iOS). The image must include **Google Play services**, or FCM won't work.

```bash
# One-time setup (via the Android SDK cmdline-tools):
sdkmanager "platforms;android-36" "system-images;android-36;google_apis_playstore;arm64-v8a"
avdmanager create avd --name loop_pixel \
  --package "system-images;android-36;google_apis_playstore;arm64-v8a" --device pixel_7

# Launch + run:
flutter emulators --launch loop_pixel
flutter run --dart-define=API_BASE_URL=https://loop-api-prod.up.railway.app
```

Or create the AVD in Android Studio → **Device Manager** → pick a device + a system image **with the Play Store** icon. First Android build is slow (Gradle + native FCM); subsequent runs are cached.

#### Setting a test location (Kigali)

An emulator has no real GPS — you feed it a coordinate. Loop's matching is geo-based, so set a **Kigali** location before testing nearby drivers / pickup / drop-off. Grant the app **location permission** when prompted, or `geolocator` can't read the fix.

```bash
# adb emu geo fix takes LONGITUDE first, then LATITUDE (reverse of the usual order):
adb -s emulator-5554 emu geo fix 30.1084 -1.9578   # Remera
```

| Place (Kigali) | Latitude | Longitude | `adb … emu geo fix <lng> <lat>` |
| --- | --- | --- | --- |
| Remera (Amahoro Stadium) | -1.9578 | 30.1084 | `emu geo fix 30.1084 -1.9578` |
| Kimironko Market | -1.9536 | 30.0606 | `emu geo fix 30.0606 -1.9536` |
| City Center (CBD) | -1.9441 | 30.0619 | `emu geo fix 30.0619 -1.9441` |
| Nyabugogo (bus hub) | -1.9394 | 30.0444 | `emu geo fix 30.0444 -1.9394` |
| Kigali Airport (KGL) | -1.9686 | 30.1395 | `emu geo fix 30.1395 -1.9686` |

Or set it in the emulator UI: **`⋯` (Extended controls) → Location → Single points →** enter lat/lng → **Set Location**. The fix resets on reboot; re-send it. For **iOS Simulator**: **Features → Location → Custom Location…**.

#### Emulator vs. real device — testing constraints

| Capability | Android emulator | iOS simulator | Real device |
| --- | --- | --- | --- |
| **Location** | Manual (`geo fix` / UI) — no real GPS or movement | Manual (Features → Location) | Real GPS; can walk a route to test live position |
| **FCM push** | ✅ Works (image **must** include Google Play services) | ❌ Cannot receive remote push | Android ✅; iOS needs a paid Apple Developer APNs key |
| **Camera** (document upload) | Emulated/mocked camera; use the gallery/file picker instead | Simulator has no camera — use the photo library | Real camera |
| **Performance** | Depends on host CPU/RAM; slower than a device | Similar | True device performance (test on low-end too) |
| **"Open in Maps" deep links** | Only apps installed on the image resolve (Google Maps present on Play images) | Apple Maps present | All installed maps apps |

For the geo-matching flow specifically, an emulator is fine for functional testing (set two points, create a job, see nearby drivers), but **movement / live-position** and **camera capture** are best shown on a real device.

## Push notifications

FCM push is wired end-to-end: the API pushes to the recipient's device on **proposal sent / accepted / declined**, **new message**, and **verification approved / rejected**. Identity stays JWT — Firebase is used only for push (and server-side Storage). Project: **`loop-rw`**.

- **Client:** on login, `PushMessaging` (`lib/services/push_messaging.dart`) requests permission, obtains the FCM token, and registers it via `POST /me/push-token`; it refreshes on rotation and clears on sign-out.
- **Native config:** `firebase_options.dart`, `android/app/google-services.json`, and `ios/Runner/GoogleService-Info.plist` are generated by `flutterfire configure --project=loop-rw` (client configs — no secrets, safe to commit). Re-run that if the Firebase project or app IDs change.
- **Android** works fully (device or emulator with Play services). **iOS** needs a paid Apple Developer account (for the APNs key, uploaded to Firebase) and a **physical iPhone** — the simulator can't receive remote push. Neither platform needs a store listing.
- **Server side:** the API must run with `PUSH_DRIVER=fcm` and the `loop-rw` service-account credentials — see [DEPLOYMENT.md §7](../DEPLOYMENT.md#7-push-notifications-fcm).

## Structure (feature-first)

```
lib/
├── main.dart
├── core/
│   ├── api/         # ONE Dio client + token store
│   ├── config/      # API base URL
│   ├── enums/  models/  repositories/
├── providers/       # AuthProvider, onboarding (provider-based state)
├── features/        # cargo_owner, driver, matching, jobs, chat, booking, profile
└── screens/  widgets/  mixins/
```

> Migration status: fully on the NestJS API — auth, profile, driver verification, **matching** (availability toggle + nearby map + vehicle management), **jobs** (pin-based create/post + owner job detail, on the `estimated_price` + `price` model), **proposals**, **chat/messaging** (Postgres + NestJS WebSocket, replacing Firestore), and **ratings**. Firebase in the client is FCM push only.

## Development

Format, analyze, and test before committing:

```bash
dart format .        # format Dart code (the repo standard)
flutter analyze      # static analysis / lints (build/ is excluded)
flutter test         # run the unit + widget tests
```

`analysis_options.yaml` enables `flutter_lints` and excludes `build/` (vendored SDK sources produce unrelated warnings). Fix analyzer issues before pushing.
