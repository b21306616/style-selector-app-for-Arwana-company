# Arwana Style Selector

An offline Android/iOS showroom app built with Expo SDK 58 and React Native. Clients choose a room, rate interior photographs, and explore a style summary and their liked images. Staff maintain a local, bilingual photo catalog behind a PIN.

## Develop

Use Node 22.13 or newer (Node 26 was used for validation) and npm. Install dependencies with `npm ci`, then:

```sh
npm start
npm run typecheck
npm run lint
npm test
npm run validate:catalog
```

Open the development server in a matching SDK 58 Expo Go client on Android or iOS. Native development tools and installable packages are not needed for this workflow. The application targets Android and iOS; browser functionality is not an acceptance target.

Expo Go needs the development bundle and assets from Metro. This is different from a standalone installation: production images are static bundled assets, and all application state and imported photographs are local. First-launch offline acceptance must be checked when standalone packaging is authorized later.

## Included

- Warm ivory/green photo galleries throughout client and staff screens, responsive phone/tablet layouts, both orientations, safe areas, enlarged text, accessible icon controls, and reduced-motion swipe feedback.
- Russian and Turkmen, with a remembered language preference.
- Heart/cross rating controls and swipes, undo, resume after closing, preliminary results after 20 choices, an optional Details breakdown, and a full-image liked-photo viewer.
- One retained client session. Starting a new client clears previous choices after confirmation.
- Four editable sample rooms with 12 distinct AI-generated interiors each. Full images and thumbnails total 14.09 MiB. Gallery sizes remain editable.
- Staff photo imports, bilingual vocabulary editing, gallery selection/order, draft validation, atomic publication, and offline PIN recovery.

Read the [Android/iOS preview walkthrough](docs/device-preview.md), [staff guide](docs/staff-guide.md), [architecture notes](docs/architecture.md), and [validation record](docs/validation.md). Generated-image prompts and provenance are recorded in [sample-images.md](docs/sample-images.md).

## Offline data

SQLite stores the catalog, draft, language, and one client session. Published catalog revisions are immutable while in use. Imported images are copied into private document storage; the app never depends on a photo-picker URI remaining available. PIN and recovery verifiers use encrypted native SecureStore storage. No analytics, accounts, server, runtime AI, or synchronization is configured.

Each showroom device owns its catalog. Uninstalling the app or clearing its data can remove locally imported content. Staff can transfer a draft to another device with the Excel workbook and its photo ZIP.

## Project layout

```text
src/app/             Expo Router client and staff screens
src/components/      Shared controls, photo rendering, swipe interaction
src/domain/          Types, validation, session transitions, scoring
src/state/           Application provider and serialized UI mutations
src/storage/         SQLite, photo imports/cleanup, staff credentials
src/features/staff/  Staff access and editor helpers
src/data/            Seed catalog and static bundled image references
src/ui/              Theme, layout, and bilingual presentation helpers
assets/photos/       Offline JPEGs and thumbnails
tests/               Domain, SQLite, service, and interaction tests
```

Keep native configuration in `app.json`. Do not create `ios/` or `android/` by hand. Use `npx expo install` for dependency changes and consult the matching SDK documentation before changing Expo APIs.

No APK, AAB, IPA, EAS build, or store submission is part of this implementation phase.
