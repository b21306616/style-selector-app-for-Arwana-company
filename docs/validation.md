# Validation record

Implementation checks were run on Windows with Node 26.13.1, Expo SDK 58, and React Native 0.88.1 on 17 November 2026. Android and iOS are the target platforms. This record distinguishes automated checks, user-confirmed device checks, and the acceptance work still pending.

## Automated checks

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `npm test` | 10 suites, 53 tests passed |
| `npx expo-doctor` | 20 of 20 checks passed |
| Android JavaScript/Hermes export | Passed; 4.28 MiB bytecode, 123 assets |
| iOS JavaScript/Hermes export | Passed; 4.05 MiB bytecode, 119 assets |
| Catalog and exported-image audit | Passed; all 48 full images and 48 thumbnails present in both exports |

The tests cover deterministic style and feature summaries, the preliminary-result threshold, undo, duplicate rating protection, pinned catalog revisions, transaction rollback, corrupt-data recovery, staff editing and validation, PIN cooldown and recovery, background locking, image downsampling and cleanup, delayed imports preserving newer draft edits, reordering filtered gallery results, and preventing native Back from dismissing a pending destructive action. Repository tests exercise real SQLite using a Node adapter. Native APIs and safe-area measurements are mocked in service and interaction tests.

The device-readiness review corrected a corrupted Russian brand caption, made confirmation panels scrollable, enabled both orientations for iOS modals, added keyboard avoidance on both platforms, moved staff headings into their virtualized lists, and made the staff photo grid use one column at larger text sizes. These changes passed source and interaction checks; their actual native rendering still needs review on devices.

The 100-rating scoring benchmark runs 500 times in Node and checks that the 95th percentile stays below 100 ms. A measured run produced a median of 0.273 ms and a 95th percentile of 0.525 ms. These are desktop JavaScript measurements, not mobile frame-rate, battery, or memory measurements.

## Offline asset and export checks

Run `npm run validate:catalog` to check all 48 distinct full-size JPEGs, 48 thumbnails, dimensions, and exact static manifest mappings. The completed collection occupies 14,772,462 bytes (14.09 MiB). Full images are 1,536 × 1,024; thumbnails are 320 × 213. The audit enforces a maximum of 1,600 pixels per side for full images and 320 for thumbnails.

After exporting both platforms, `npm run validate:catalog -- --exports` also compares the content hashes of every catalog image with the assets listed in each platform's export metadata. This catches a valid source catalog being omitted from a bundle.

The final Android and iOS exports both passed this content-hash audit. All four room contact sheets were visually reviewed. Exact generation prompts and provenance are in [sample-images.md](sample-images.md); images are labeled as samples in the app.

```sh
npx expo export --platform android --output-dir artifacts/android --max-workers 2
npx expo export --platform ios --output-dir artifacts/ios --max-workers 2
npm run validate:catalog -- --exports
```

Exports are ignored local validation artifacts containing JavaScript bytecode and assets. They are not APK, AAB, or IPA files, and do not establish that a signed native application installs or runs correctly. No installable packages or native project directories were created.

## User-confirmed device checks

On 17 November 2026, the user confirmed that the Expo Go preview reached the Arwana home screen on both Android and iOS. The user then confirmed that all of the requested interaction checks below worked on both platforms.

| Check | Android | iOS |
| --- | --- | --- |
| Open the project and reach the home screen | User-confirmed pass | User-confirmed pass |
| Complete one room with swipe and button ratings | User-confirmed pass | User-confirmed pass |
| Open the result and a liked photo | User-confirmed pass | User-confirmed pass |
| Rotate while viewing a liked photo | User-confirmed pass | User-confirmed pass |
| Open Staff → Styles & features, edit a name with the keyboard open, and reach Save | User-confirmed pass | User-confirmed pass |

These are user-reported results, not automated device runs or independently observed recordings. Device models, OS versions, and text-size settings were not supplied. No connected native debugger target was available to the agent, so no device memory or frame-timing measurements were collected.

## Device acceptance still required

Use the [Android/iOS preview walkthrough](device-preview.md) with an SDK 58-compatible Expo Go client for the first interactive review. A Metro connection is needed for that development workflow. First-launch offline behavior must also be checked with the standalone application after packaging is authorized.

| Area | Acceptance steps |
| --- | --- |
| Phones and tablets | Review narrow phones (about 320–430 logical pixels wide), Android tablets, and iPad sizes (about 768–1,366 logical pixels). Rotate through portrait and landscape, including notched devices and split-screen where supported. |
| Language and accessibility | Check Russian and English, system text sizes of 100%, 150%, and 200%, screen-reader labels and order, reduced motion, keyboard visibility, safe areas, and comfortable touch targets. |
| Client flow | Rate with swipes and buttons, tap quickly, undo, inspect a preliminary result after 20 ratings, continue, finish a short gallery, view liked photos, cancel/confirm a new client, and restart the app to resume. Style labels must remain hidden while rating. |
| Staff workflow | Set the first PIN, record and use its recovery code, exercise the five-failure cooldown, background the app during unlock, leave staff mode, import photos, edit vocabulary, reorder galleries, and publish. An existing client must retain its original catalog. |
| Native photo handling | Test permission denial, canceled selection, large camera photos, HEIC/rotated images, low storage, app backgrounding during import, and imported-image availability after restarting. |
| Offline installation | When packaging is approved, launch a fresh standalone installation in airplane mode, complete every client flow, restart, edit/publish staff content, and verify all bundled and imported photographs remain available. |
| Performance | On a representative older phone, profile at least 100 sequential ratings and repeated viewer open/close cycles. Check frame timing, peak/retained memory, startup, result calculation, and large sequential photo imports. Memory should settle rather than grow with every image. |

The confirmed checks above establish basic functionality on both platforms. The full size/font-size matrix, process-kill persistence, permission denial, native import edge cases, recovery/cooldown behavior on devices, first-install offline startup, and sustained device performance remain unverified. There was no automated phone, tablet, emulator, or iOS simulator run in this environment.
