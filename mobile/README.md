# Loop — Mobile (Flutter)

The cargo-owner + driver mobile app for Loop. Talks to the NestJS API (`../api`), which is the system of record. State management is `provider`; networking is a single Dio client (`lib/core/api/`) that attaches the JWT and refreshes it on 401.

## Stack

- Flutter (stable) — developed on 3.32.5, Dart SDK `^3.8.1`
- `provider` (state), `dio` + `flutter_secure_storage` (API + JWT)
- `flutter_map` + OpenStreetMap tiles (maps, no API key), `latlong2`, `geolocator` (device location)
- `firebase_core` + `firebase_storage` retained for FCM push / document storage (later milestones). **Firebase Auth is not used** — identity is the API's JWT.

> Location search (place/landmark autocomplete + reverse-geocoded pin labels, served by the API's `/geocode/*` proxy over OpenStreetMap) and the "Open in Maps" navigation hand-off (`map_launcher` / `url_launcher` → Google / Apple Maps / Waze) arrive with M3.5–M4. No Google Maps SDK and no API key are used.

## Run

```bash
flutter pub get

# Point at the API. Default base URL is http://localhost:3000.
# iOS simulator / desktop:
flutter run --dart-define=API_BASE_URL=http://localhost:3000
# Android emulator (host loopback is 10.0.2.2):
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000
```

Start the API + database first — see `../api/README.md`.

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

> Migration status: auth, profile, driver verification, **matching** (availability toggle + nearby map + vehicle management) and **jobs** (pin-based create/post + owner job detail, on the `estimated_price` + `price` model) are wired to the API (M1–M3). Chat/messaging still uses Firestore and moves to the API (Postgres + a NestJS WebSocket gateway) in M4.

## Development

Format, analyze, and test before committing:

```bash
dart format .        # format Dart code (the repo standard)
flutter analyze      # static analysis / lints (build/ is excluded)
flutter test         # run the unit + widget tests
```

`analysis_options.yaml` enables `flutter_lints` and excludes `build/` (vendored SDK sources produce unrelated warnings). Fix analyzer issues before pushing.
