# Inspection App - Installation Instructions

## 📱 APK File Details

**File Name:** `Inspection-App-2026-02-05.apk`  
**Location:** `c:\Inspection_ReactNatvie\Inspection-App-2026-02-05.apk`  
**Size:** ~127 MB (133,151,479 bytes)  
**Build Date:** February 5, 2026

---

## 🔧 Installation Steps

### Method 1: USB Cable Transfer (Recommended)

#### Step 1: Enable Developer Options on Your Phone
1. Open **Settings** on your Android phone
2. Scroll down to **About Phone**
3. Find **Build Number** and tap it **7 times**
4. You'll see a message saying "You are now a developer!"

#### Step 2: Enable USB Debugging
1. Go back to **Settings**
2. Find **Developer Options** (usually under System or Advanced)
3. Enable **USB Debugging**
4. Enable **Install via USB** (if available)

#### Step 3: Transfer the APK
1. Connect your phone to your computer using a USB cable
2. On your phone, allow USB file transfer (select "File Transfer" or "MTP" mode)
3. Copy the APK file from:
   ```
   c:\Inspection_ReactNatvie\Inspection-App-2026-02-05.apk
   ```
4. Paste it to your phone's **Downloads** folder or **Internal Storage**

#### Step 4: Install the APK
1. On your phone, open the **Files** app or **My Files**
2. Navigate to where you copied the APK (usually **Downloads**)
3. Tap on `Inspection-App-2026-02-05.apk`
4. You may see a warning about installing from unknown sources:
   - Tap **Settings**
   - Enable **Allow from this source**
   - Go back and tap **Install**
5. Wait for installation to complete
6. Tap **Open** or find the "Inspection" app in your app drawer

---

### Method 2: ADB Install (Advanced)

If you have Android Debug Bridge (ADB) installed:

```powershell
# Navigate to the project directory
cd c:\Inspection_ReactNatvie

# Install directly to connected device
adb install Inspection-App-2026-02-05.apk
```

---

## 📋 What's Included in This Build

✅ **Barcode Scanning** with symbology prefix cleaning (]IC1, ]C1, etc.)  
✅ **Firebase Integration** for rental agreements and inspection data  
✅ **Inspection Workflow** validation and completion  
✅ **Photo Capture** for inspection evidence  
✅ **Odometer Scanning** with OCR  
✅ **Real-time Dashboard** sync with SRAM project

---

## 🔍 First-Time Setup

### Required Permissions
The app will request these permissions on first launch:
- **Camera** - For barcode scanning and photo capture
- **Storage** - For saving inspection photos
- **Internet** - For Firebase database sync

**Important:** Grant all permissions for full functionality!

### Testing the App

1. **Launch the app** - You'll see the barcode scanner screen
2. **Scan a test barcode** - Try scanning a serial number that has an allocated inspection
3. **Check validation** - The app will verify against the Firebase database
4. **Complete inspection** - Mark items as pass/fail and save

---

## 🐛 Troubleshooting

### "App not installed" Error
- **Cause:** Previous version conflict
- **Solution:** Uninstall any existing "Inspection" app first

### "Parse Error" or "File corrupted"
- **Cause:** Incomplete file transfer
- **Solution:** Re-copy the APK file to your phone

### Camera Permissions Denied
- **Solution:** Go to Settings → Apps → Inspection → Permissions → Enable Camera

### App Crashes on Startup
- **Check:** Ensure your phone has internet connection for Firebase
- **Try:** Clear app data (Settings → Apps → Inspection → Storage → Clear Data)

---

## 🔄 Updating the App

To install a newer version:
1. You don't need to uninstall the old version
2. Simply install the new APK
3. Android will update the app automatically

---

## 📞 Support

If you encounter issues:
1. Check the console logs in the previous development builds
2. Verify Firebase configuration is correct
3. Ensure the device has internet connectivity
4. Check that rental agreements exist in the database with `inspectionWorkflow.status = 'Allocated'`

---

## ✨ New in This Build

**🔧 Fixed:** Barcode symbology prefix issue
- Barcode scanners that add prefixes like `]IC1` now work correctly
- Serial numbers are matched after cleaning the prefix
- Error messages show both original and cleaned values for debugging

**Previous Features:**
- Integration with SRAM dashboard inspection workflow
- Validation of scanned barcodes against rental agreements  
- Real-time status updates to Firebase Realtime Database
- Support for both motor vehicle and refrigeration inspections
