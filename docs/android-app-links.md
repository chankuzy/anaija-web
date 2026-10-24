# Android App Links contract (web <-> Anaija Android app)

STATUS: web side prepared, native side NOT implemented, nothing verified on a device.

## Routes the app must open (HTTPS only)

| URL                                   | Opens                | Notes                                     |
|---------------------------------------|----------------------|-------------------------------------------|
| /p/{id}                               | post / reel viewer   | `?comment={id}` focuses that comment      |
| /l/{id}                               | listing detail       |                                           |
| /u/{username}                         | profile              |                                           |
| /listing/{id}, /marketplace/{id}      | same as /l/{id}      | legacy; the web 308-redirects them        |
| /posts/{id}                           | same as /p/{id}      | legacy; the web 308-redirects it          |

Anything else must not be claimed by the app. Unknown or unavailable content opens the app's normal "not available" state.

## Android manifest (inside MainActivity, alongside the launcher filter). DOMAIN = the production host.

    <intent-filter android:autoVerify="true">
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data android:scheme="https" android:host="DOMAIN" />
        <data android:pathPrefix="/p/" />
        <data android:pathPrefix="/l/" />
        <data android:pathPrefix="/u/" />
        <data android:pathPrefix="/listing/" />
        <data android:pathPrefix="/marketplace/" />
        <data android:pathPrefix="/posts/" />
    </intent-filter>

The app routes links with the app_links package (already in pubspec). If Flutter's built-in deep linking is on for the
Flutter version in use, disable it so the two don't both handle the link:
`<meta-data android:name="flutter_deeplinking_enabled" android:value="false" />`. MainActivity is `singleTop`,
so links arriving while the app is open come through the stream (`uriLinkStream`); cold starts use `getInitialLink`.

## Digital Asset Links

Served at https://DOMAIN/.well-known/assetlinks.json, requirements:
- HTTPS, status 200, `application/json`, no redirect (apex vs www matters), no auth, same host as the manifest.
- package_name = com.anaija.app (from android/app/build.gradle).
- sha256_cert_fingerprints = the certificate that signs the APK the user installs. List every one that is in use:
  - Google Play with Play App Signing: Play Console -> Test and release -> App integrity -> App signing key certificate.
  - APKs you sign yourself and distribute directly: that keystore's fingerprint.
  - Debug builds: `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android`
    (differs per machine; only for testing against a real HTTPS domain).
- Generate the file with `scripts/make-assetlinks.sh <fingerprint> [...]`.

## Verifying (on a real device, with a build signed by a listed certificate)

    curl -sI https://DOMAIN/.well-known/assetlinks.json
    curl -s "https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://DOMAIN&relation=delegate_permission/common.handle_all_urls"
    adb shell pm get-app-links com.anaija.app          # expect: DOMAIN: verified
    adb shell am start -a android.intent.action.VIEW -d "https://DOMAIN/p/1" com.anaija.app

Expected behaviour to test: tapping a link inside WhatsApp or Telegram opens the app on that content; typing the URL
in Chrome's address bar or using "open in Chrome" opens the web page (Android allows that); with the app uninstalled
the link opens the web page. Users can also turn "open supported links" off per app.

## Changing domain later

Each host needs its own assetlinks.json and its own intent filter, and only an app update can add a host. Keep the old
host serving assetlinks.json and listed in the manifest for as long as old app versions are in use.
