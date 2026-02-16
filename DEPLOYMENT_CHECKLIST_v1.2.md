# Deployment Checklist - v1.2 Offline Release

## Pre-Deployment
- [ ] **Verify Build**: Ensure `app-release.apk` is generated successfully.
- [ ] **Check Signing**: If releasing to Play Store, ensure keys are correct. For direct distribution, Debug/Unsigned is okay for internal testing.
- [ ] **Update Documentation**: Distribute `RELEASE_NOTES_v1.2.md` to field technicians.

## Installation Steps (Technicians)
1. **Uninstall Old Version**: To avoid cache conflicts, recommend uninstalling v1.0/v1.1 first.
2. **Install APK**: Copy `app-release.apk` to device and install.
3. **Grant Permissions**: Camera and Storage permissions must be granted on first launch.

## Post-Deployment Validation
- [ ] **Initial Sync**: Connect to Wi-Fi/Data. Tap SYNC. Verify "Download Successful" or similar message.
- [ ] **Offline Test**: Turn off Wi-Fi/Data. Create a test inspection. Save. Verify "Saved Offline" alert.
- [ ] **Re-Sync**: Turn on Wi-Fi/Data. Tap SYNC. Verify "Uploaded 1 inspection" message.
- [ ] **Verify Database**: Check Firebase Console -> `rentalAgreements/{id}/inspectionWorkflow` to see the update.

## Troubleshooting
- **Sync Fails**: Ensure good internet connection. Check if `google-services.json` is correct for the build type.
- **App Crashes**: Check Logcat for native crashes (e.g. `adb logcat | grep "AndroidRuntime"`).
- **Camera Error**: Ensure camera permission is granted in Android Settings -> Apps -> Inspection -> Permissions.
