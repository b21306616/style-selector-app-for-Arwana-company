# Architecture

## Client state and scoring

The app retains one session, with an ordered rating prefix and a reference to an immutable published catalog revision. A rating must match the next expected photo. Undo removes the last rating and reopens completed sessions. Preliminary results require 20 ratings; completed short galleries also produce results. No unviewed photo is interpreted as a dislike.

The pure scorer ranks styles by likes divided by reviewed photos of that style. It requires three total likes and two supporting likes per qualifying style. Qualifying styles scoring at least 85% of the leading score produce a single, blend, or varied result. Feature tags require two liked-photo occurrences and at least 30% support, with up to two per category. Results use descriptive language, never confidence percentages.

SQLite operations run through one serialized lane. UI mutations use an immediate ref guard as well as a visible busy state, so rapid touch events cannot duplicate votes. Views change only after a write succeeds. Functional draft updates resolve against the latest saved draft; a delayed image import cannot overwrite edits made while the picker was open.

## Catalog publication and recovery

Schema version 1 has metadata, catalog revisions, one working draft, one active session, and recovery copies. Publication validates the draft, checks selected image availability, inserts a revision, and changes the current pointer in a transaction. The draft retains unselected library images; the published snapshot contains gallery-selected photos. Empty galleries are permitted and disabled in the client UI.

Corrupt sessions and drafts are quarantined before recovery. An unreadable published catalog or unsupported future schema fails without overwriting it. Old revisions are pruned only when no current session or recovery record needs them. Startup cleanup aborts if references cannot be read safely.

## Photos and memory

The bundled-image manifest contains static `require` references so native exports include offline assets. Images are ordinary JPEGs, with separate thumbnails. Imports use SDK 58 ImageManipulator decoding limits of 1,600 × 1,600 and 320 × 320; the aspect ratio is retained. Source originals are not deleted or changed. Batches are sequential and all-or-nothing, with native objects explicitly released and partial copies removed on failure.

Durable image names are relative to the app-private document directory, avoiding installation-specific absolute paths. Local names are validated before resolution. Cleanup only examines the owned image directory, preserves all referenced files, and gives new imports a one-hour grace period. Thumbnail lists are virtualized; full photographs are rendered with downscaling and without whole-catalog memory caching.

## Staff access

Staff credentials use random salts and credential hashes held in native SecureStore. Raw PINs and recovery codes are not persisted. Recovery codes contain 128 random bits and rotate after use. Failed attempts and cooldown timestamps persist across restarts. Staff access closes on backgrounding and on leaving the staff navigator. An unlock finishing after a background event cannot reopen the workspace.

This is a local showroom access gate, with no remote authentication service. Catalog content is in the application sandbox, not an encrypted photo vault. There is no network backend, runtime AI, telemetry, or synchronization.

## Native configuration

The project remains on Expo SDK 58, with Expo Router and Continuous Native Generation. Portrait and landscape are enabled, iPad support is enabled, and the interface uses a consistent light appearance. Photo selection uses the system library picker; camera and microphone permissions are disabled. No native project directories or installable packages are generated in this phase.

The shared screen applies keyboard avoidance on Android and iOS. Staff lists keep their headings and search controls inside the virtualized scroll area so they remain reachable on short screens. Native modals explicitly support both orientations and measure their own safe areas. Confirmation content scrolls at larger text sizes, and pending destructive actions block dismissal through native Back as well as the cancel button.
