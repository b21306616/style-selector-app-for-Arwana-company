# Preview Arwana on Android and iOS

This walkthrough uses the existing Expo Go application to review Arwana without creating an APK, AAB, or IPA. Test both platforms: the native keyboard, photo picker, orientation, and storage behavior can differ.

## Open the preview

1. Install or update Expo Go on each device using the [official environment setup instructions](https://docs.expo.dev/get-started/set-up-your-environment/). Use a client compatible with this project's Expo SDK 58.
2. Connect the computer and both devices to the same Wi-Fi network.
3. In PowerShell, open this project's directory and run:

   ```powershell
   npm.cmd start -- --go --lan --port 8082
   ```

4. Scan the terminal's QR code on each device and open it with Expo Go. Leave the development server running. The first load transfers the JavaScript and sample images.
5. For a physical iPhone or iPad, sign in to the same Expo account in Expo CLI and Expo Go. If needed, run `npx.cmd expo login` in another terminal, then restart the server and scan again. This is an Expo Go development requirement; Arwana itself has no account service. See [Expo's current preview instructions](https://docs.expo.dev/get-started/start-developing/).

If the computer has a VPN and the QR code advertises its address, choose the Wi-Fi IPv4 address instead. Expo CLI supports overriding the advertised URL with `EXPO_PACKAGER_PROXY_URL`. For example, set `$env:EXPO_PACKAGER_PROXY_URL = 'http://YOUR_WIFI_IP:8082'` before starting the server, replacing `YOUR_WIFI_IP` with the computer's Wi-Fi address. See the [Expo CLI reference](https://docs.expo.dev/more/expo-cli/#server-url).

If a connection fails, check the matching SDK version, Wi-Fi network, Expo account on iOS, and Windows Firewall access for Node on the private network. A guest Wi-Fi network may block communication between devices. Keep the server on the LAN for this walkthrough.

## First review on each device

Use Turkmen or Russian from the home screen. The default is Russian. The two devices keep separate client sessions, catalogs, staff credentials, and language settings.

| Step | What to do | Expected behavior |
| --- | --- | --- |
| 1. Home | Switch language, rotate, and open each space. | Text remains readable, cards fit the screen, room galleries show 12 photos and Whole House shows 32. |
| 2. Ratings | Use the heart/cross buttons and left/right swipes; tap rapidly; undo with the curved arrow. | Each photo receives one choice, undo returns to the previous photo, and style names stay hidden. Android icons load from the bundled font; spoken labels remain available. |
| 3. Resume | Make several choices, return home, close/reopen the project. | The saved session and progress can be resumed. |
| 4. Results | Complete a room, open/close Details, and view liked photos. In Whole House, open a preliminary result after 20 ratings and continue. | Style names and liked photos appear first; Details contains feature counts. Closing Details retains the session. |
| 5. Viewer | Open liked photos, move forward/back, and rotate while the viewer is open. | Images fit inside the viewer; navigation and close controls remain usable. |
| 6. New client | Start a new client, cancel, then confirm. | Cancel retains the old choices. Confirmation clears the session while preserving the catalog. |
| 7. Staff access | Open Staff / Сотрудникам, create a six-digit PIN, and save the recovery code. Lock by leaving staff mode or backgrounding the app. | Staff access requires the PIN again. The recovery code replaces a forgotten PIN and issues a new code. |
| 8. Editing | Search the photo library, edit a vocabulary term in both languages, and rotate with the keyboard open. | Inputs and save controls remain reachable by scrolling; text is not covered by the keyboard. |
| 9. Import and publish | Import a locally stored image, assign all required tags, select it for a gallery, reorder it, review, and publish. | The imported photo remains available after reopening. New clients see the published version; an existing client retains its original catalog. |
| 10. Larger text | Repeat the home, editor, confirmation, and viewer checks with larger system text, including 200%, in both orientations. | Content remains reachable. Confirmation panels scroll; the staff photo library uses one column at large text sizes. |

Also cancel a photo selection and deny photo access when the system offers a permission choice. Neither should erase the existing library. Check the staff cooldown after five incorrect PIN attempts and verify that access works again after the delay.

## Offline and performance checks

Expo Go obtains development code and assets from Metro. Losing the Metro connection or reloading the project without it is not a standalone offline acceptance test. Test a fresh standalone installation in airplane mode after packaging is authorized. This remains pending.

Use this preview to identify noticeable stalls and layout problems. Development mode has extra overhead, so final memory, startup, and frame-timing measurements must use an appropriate native release/profile build later. The [validation record](validation.md) contains the full device acceptance matrix.

## Record findings

For each device, record its model, OS version, Expo Go version, language, orientation, and system text size. For an issue, include the step above, the action taken, the expected result, and what actually happened. Keep Android and iOS findings separate.

The user confirmed home-screen startup, room ratings, results, liked-photo rotation, and staff vocabulary editing with the keyboard on both Android and iOS on 17 November 2026. See the [validation record](validation.md) for the exact scope. Other rows in this walkthrough remain acceptance steps; do not treat them as passed solely because the initial checks worked.
