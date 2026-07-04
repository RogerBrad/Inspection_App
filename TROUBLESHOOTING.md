# Barcode Scanning Troubleshooting Guide

## Issue: "Inspection not Available" Error

### What Changed in the Latest Build

The new APK (`Inspection-App-DEBUG-2026-02-05-*.apk`) now includes:

1. **Enhanced Error Messages** - Shows the actual barcode value that was scanned
2. **Debug Logging** - Outputs detailed information to help diagnose the issue

---

---

## NEW: Built-in Debug Screen 🔧

**The easiest way to diagnose issues is now built into the app!**

### How to Access:
1. Open the Inspection app
2. Look for the **orange "DEBUG" button** in the top-left corner next to the flashlight button
3. Tap it to open the Debug Screen

### What the Debug Screen Shows:
- **Current User Configuration**: Shows the app's hardcoded user ID (currently `USER_001`)
- **Allocated Inspections**: Lists ALL inspections with "Allocated" status
  - Shows which technician each inspection is assigned to
  - Highlights in **GREEN** if the inspection matches your app user ID (✅ MATCH)
  - Shows in **RED** if there's a mismatch (❌ NO MATCH)
- **Available Users**: Lists all users in the database with their UIDs
- **Troubleshooting Steps**: Quick guide on how to fix mismatches

### Quick Fix Using Debug Screen:
1. Tap the **DEBUG** button on the scanner screen
2. Look at "Allocated Inspections"
3. If you see **"❌ NO MATCH"** on the inspection you're trying to scan:
   - Note the "Tech ID" shown (e.g., `u5xK8FmP3TYQZnOqR9C1L2Ws3Xt4`)
   - This is the ACTUAL user ID that the inspection was allocated to
   - The app is using `USER_001` which doesn't match
4. **Solution**: Update the code:
   - Edit `src/screens/ScannerScreen.tsx`
   - Change line ~13 from `const CURRENT_USER_ID = 'USER_001';`
   - To: `const CURRENT_USER_ID = 'u5xK8FmP3TYQZnOqR9C1L2Ws3Xt4';` (use the actual ID from step 3)
   - Rebuild: `npm run android`

---

## How to View Debug Logs

### Method 1: Using ADB (Android Debug Bridge)

1. **Enable USB Debugging** on your phone (if not already done)
2. **Connect your phone** to the computer via USB
3. **Open PowerShell** and run:
   ```powershell
   cd c:\Inspection_ReactNatvie
   adb logcat -s ReactNativeJS:V
   ```
4. **Scan a barcode** on your phone
5. **Watch the logs** - you should see:
   ```
   === BARCODE SCAN DEBUG ===
   Raw scanned value: ]IC1123456789
   Barcode type: pdf-417
   Current user ID: USER_001
   Validation result: { valid: false, error: "..." }
   ```

### Method 2: Check the Error Message on Phone

The new version will now show you the scanned barcode in the alert:
```
Inspection Not Available

Scanned: "]IC1123456789"

No rental agreement found for ID: 123456789 (original: ]IC1123456789)
```

---

## Common Causes & Solutions

### 1. No Matching Rental Agreement in Database

**Symptom:** Error says "No rental agreement found for ID: XXXXX"

**Check:**
- Does a rental agreement with this serial number exist in the backend database?
- Path: `rentalAgreements/{agreementId}/assetDetails/serialNumber`

**Solution:**
- Create a test rental agreement in the database
- OR allocate an inspection to an existing agreement that matches the scanned serial number

---

### 2. No Inspection Allocated

**Symptom:** Error says "No inspection has been allocated for this asset"

**Check:**
- Does the rental agreement have `inspectionWorkflow` data?
- Path: `rentalAgreements/{agreementId}/inspectionWorkflow/status`

**Solution:**
- Go to SRAM Dashboard → Inspection Management
- Find the rental agreement
- Click "Manage" and allocate it to a technician

---

### 3. Wrong Technician Allocated

**Symptom:** Error says "This inspection is allocated to [someone else]"

**Current User ID:** `USER_001` (hardcoded in app)

**Check:**
- Does `inspectionWorkflow.technicianId` match `USER_001`?
- Path: `rentalAgreements/{agreementId}/inspectionWorkflow/technicianId`

**Solution Option 1 - Change allocation in dashboard:**
- Go to SRAM Dashboard → Inspection Management
- Re-allocate the inspection to the user with ID `USER_001`

**Solution Option 2 - Match the technician ID in database:**
- Find the user in the backend that should match
- Update `inspectionWorkflow.technicianId` to match that user's actual ID

---

### 4. Inspection Status Not "Allocated"

**Symptom:** Error says 'Inspection status is "[STATUS]". Only "Allocated" inspections can be performed.'

**Check:**
- What is `inspectionWorkflow.status`?
- Valid initial status must be: `"Allocated"`

**Solution:**
- In SRAM Dashboard, ensure the status is "Allocated" not "Due", "Passed", "Failed", or "Completed"

---

## Testing with a Sample Rental Agreement

### Step 1: Create Test Data in the backend database

Add this to `rentalAgreements` in the backend database:

```json
{
  "TEST_AGREEMENT_001": {
    "id": "TEST_AGREEMENT_001",
    "status": "active",
    "parties": {
      "lesseeName": "Test Customer"
    },
    "assetDetails": {
      "assetName": "Test Vehicle",
      "vin": "TEST123456",
      "serialNumber": "123456"
    },
    "endOfRental": {
      "inspectionDate": "2026-02-10"
    },
    "inspectionWorkflow": {
      "status": "Allocated",
      "technicianId": "USER_001",
      "technicianName": "Test Technician",
      "allocatedAt": 1738758000000
    }
  }
}
```

### Step 2: Create a Test Barcode

- Serial Number to scan: `123456`
- Or with prefix: `]IC1123456`
- The app will clean `]IC1` and match against `123456`

### Step 3: Test Scan

1. Install the new DEBUG APK
2. Scan the test barcode
3. Should navigate to inspection screen successfully

---

## Quick Diagnosis Checklist

Run through these checks:

- [ ] Barcode value shows in error message (new feature)
- [ ] Check the backend database for matching `serialNumber` or `vin`
- [ ] Verify `inspectionWorkflow` exists on that agreement
- [ ] Confirm `technicianId` is `USER_001`
- [ ] Confirm `status` is `"Allocated"`
- [ ] Check ADB logs for detailed debug output

---

## Expected Console Log Output (Success)

```
=== BARCODE SCAN DEBUG ===
Raw scanned value: ]IC1123456
Barcode type: pdf-417
Current user ID: USER_001
Barcode cleaned: "]IC1123456" -> "123456"
Validation result: { valid: true, agreement: {...} }
```

## Expected Console Log Output (Failure)

```
=== BARCODE SCAN DEBUG ===
Raw scanned value: ]IC1999999
Barcode type: pdf-417
Current user ID: USER_001
Barcode cleaned: "]IC1999999" -> "999999"
Validation result: { 
  valid: false, 
  error: "No rental agreement found for ID: 999999 (original: ]IC1999999)" 
}
```

---

## Next Steps

1. Install the new DEBUG APK: `Inspection-App-DEBUG-2026-02-05-*.apk`
2. Scan a barcode and note the exact error message (including the scanned value)
3. Use ADB logcat to view detailed logs
4. Check the backend database to verify the data exists and matches
5. Report back with:
   - The scanned barcode value shown in error
   - The exact error message
   - Whether the serial number exists in the backend database

This will help us pinpoint exactly where the validation is failing!
