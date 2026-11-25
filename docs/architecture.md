# Architecture

## Client state and scoring

The app retains one session, with an ordered rating prefix and a reference to an immutable published catalog revision. A rating must match the next expected photo. Undo removes the last rating and reopens completed sessions. Preliminary results require 20 ratings; completed short galleries also produce results. No unviewed photo is interpreted as a dislike.

The pure scorer ranks styles by likes divided by reviewed photos of that style. It requires three total likes and two supporting likes per qualifying style. Qualifying styles scoring at least 85% of the leading score produce a single, blend, or varied result. Feature tags require two liked-photo occurrences and at least 30% support, with up to two per category. Results use descriptive language, never confidence percentages.

SQLite operations run through one serialized lane. UI mutations use an immediate ref guard as well as a visible busy state, so rapid touch events cannot duplicate votes. Views change only after a write succeeds. Functional draft updates resolve against the latest saved draft; a delayed image import cannot overwrite edits made while the picker was open.

## Catalog publication and recovery

Schema version 1 has metadata, catalog revisions, one working draft, one active session, and recovery copies. Publication validates the draft, checks selected image availability, inserts a revision, and changes the current pointer in a transaction. The draft retains unselected library images; the published snapshot contains gallery-selected photos. Empty galleries are permitted and disabled in the client UI.

Room definitions are ordered catalog data (`rooms`: stable ID and Russian/Turkmen labels). Photos and room galleries refer to those IDs; `whole_house` remains a reserved collection. Legacy JSON payloads without `rooms` receive the original four definitions on read, including retained session revisions. An explicit empty list stays empty. This additive payload migration does not change SQLite tables or historical stored revisions. Bulk deletion rechecks references in the latest draft and rejects the entire batch if any selected option is used by a saved photo.

Corrupt sessions and drafts are quarantined before recovery. An unreadable published catalog or unsupported future schema fails without overwriting it. Old revisions are pruned only when no current session or recovery record needs them. Startup cleanup aborts if references cannot be read safely.

## Photos and memory

The bundled-image manifest contains static `require` references so native exports include offline assets. Images are ordinary JPEGs, with separate thumbnails. Imports use SDK 58 ImageManipulator decoding limits of 1,600 × 1,600 and 320 × 320; the aspect ratio is retained. Source originals are not deleted or changed. Batches are sequential and all-or-nothing, with native objects explicitly released and partial copies removed on failure.

Durable image names are relative to the app-private document directory, avoiding installation-specific absolute paths. Local names are validated before resolution. Cleanup only examines the owned image directory, preserves all referenced files, and gives new imports a one-hour grace period. Thumbnail lists are virtualized; full photographs are rendered with downscaling and without whole-catalog memory caching.

## Dashboard authoring and transfers

The staff layout owns a workspace provider above the PIN gate. It retains unsaved entry fields, staged image ownership, import review, and export file references while the gate unmounts screens on background lock. Its operation guard prevents duplicate work. A synchronous auth query blocks saving after a background event, even before React rerenders. Route removal is guarded while work is pending or input is unsaved. Leaving the layout aborts preparation and releases files that were never committed; cleanup waits for an in-flight save to settle.

The workbook contract contains exactly two visible sheets ordered `Russian` then `Turkmen`, each with `Image filename`, `Room`, `Style`, `Palette`, `Material`, and `Detail` headers. All six cells must be complete in both languages for import; incomplete drafts may still be exported for completion in Excel. Rows pair by Unicode-normalized, case-insensitive filename rather than row position. Blank rows at any physical location are ignored and only meaningful rows count toward the 500-photo limit. Style is singular; palette/material/detail lists use semicolon-separated names with CSV-style quoting and positionally corresponding translations. Workbooks whose visible sheets are not strictly `['Russian', 'Turkmen']` in order—including technical workbook versions 1/2, extra tabs, missing/swapped tabs, or hidden tabs—are rejected immediately with `INVALID_WORKBOOK`. Formula cells, errors, extra data columns, duplicate filenames, missing counterparts, and inconsistent translations block import with the actual sheet/row/column.

Rooms and vocabulary are resolved from bilingual labels and receive internal IDs. A unique name match can identify a translation correction; contradictory matches are rejected. Merge preserves omitted records and existing gallery selection/order, adding new photos only to their room gallery. A selected photo changing rooms moves its room membership while retaining Whole House membership. Replacement keeps workbook-derived records, builds room galleries in Russian-sheet order, and empties Whole House. The format transfers photo descriptions/images; unused vocabulary, sample flags on a new device, and custom gallery arrangements cannot be represented. Existing matched sample flags remain internal.

Photos carry optional persisted `exportFilename` and original `sourceFilename` aliases; catalogs carry a filename allocation counter. Older JSON payloads are normalized and persisted on read for the current draft, published revision, and any revision referenced by an active session, without a SQL schema migration. Central draft saves preserve assigned filenames even when an older photo edit object omits them. Canonical export names use `.jpg` because the stored images are JPEGs; all source aliases are reserved before collision-safe names are allocated. Both sheets and the companion ZIP use the same normalized snapshot. Workbook decoding and merge/replace review remain pure services. Commit compares the reviewed draft fingerprint inside the functional `saveDraft` updater. Replacement confirmation captures its reviewed candidate so later edits cannot be silently overwritten.

Native adapters use SDK 58 DocumentPicker, Sharing, Asset, and the current File/FileHandle APIs. ZIP input has bounded directory preflight, path/size checks, actual output-size checks, and CRC verification. It streams into an owned cache directory; photos are then decoded sequentially using the existing bounded image pipeline and fresh UUID file names. Replacements never overwrite images referenced by published revisions or active sessions. Failed import persistence releases prepared images. Export writes a workbook and streams stored JPEGs into a companion ZIP from one snapshot. No whole photo archive is held in JavaScript memory. Generated outputs are retained for repeat sharing until leaving staff mode or generating replacements.

Transfer limits are 500 photos, 5,000 terms and room definitions each, 10 MiB XLSX input, 50 MiB expanded workbook contents, 50 MiB per source image, and 1 GiB total source images. The dashboard's single-photo picker separately enforces 10 MiB before processing, using picker metadata or the file size; unknown sizes are rejected. Removing or replacing a staged photo releases only its uncommitted app-owned files. Password protection, embedded spreadsheet images, formulas in data columns, encrypted archives, and ZIP64 are unsupported. There is no automatic synchronization.

SheetJS is pinned to its official 0.20.3 tarball, with integrity recorded in the lockfile, and initialized on the first spreadsheet operation. Install through Expo. On machines where npm blocks direct URL packages, `npx.cmd expo install -- --allow-remote=root` permits the URL dependencies explicitly listed in this project's manifest for that command without changing global npm settings.

## Staff access

Staff credentials use random salts and credential hashes held in native SecureStore. Raw PINs and recovery codes are not persisted. Recovery codes contain 128 random bits and rotate after use. Failed attempts and cooldown timestamps persist across restarts. Staff access closes on backgrounding and on leaving the staff navigator. An unlock finishing after a background event cannot reopen the workspace.

This is a local showroom access gate, with no remote authentication service. Catalog content is in the application sandbox, not an encrypted photo vault. There is no network backend, runtime AI, telemetry, or synchronization.

## Native configuration

The project remains on Expo SDK 58, with Expo Router and Continuous Native Generation. Portrait and landscape are enabled, iPad support is enabled, and the interface uses a consistent light appearance. Photo selection uses the system library picker; camera and microphone permissions are disabled. No native project directories or installable packages are generated in this phase.

The shared screen applies keyboard avoidance on Android and iOS. Staff lists keep their headings and search controls inside the virtualized scroll area so they remain reachable on short screens. Native modals explicitly support both orientations and measure their own safe areas. Confirmation content scrolls at larger text sizes, and pending destructive actions block dismissal through native Back as well as the cancel button.
