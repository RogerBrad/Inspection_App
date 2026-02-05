import React, { useEffect, useState, useMemo } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Camera, useCameraDevice, useCodeScanner, useCameraPermission, useCameraDevices } from 'react-native-vision-camera';
import { Slider } from '@miblanchard/react-native-slider';
import { rentalAgreementService } from '../services/rentalAgreementService';

// Note: User authentication is not currently implemented
// Any technician can scan any inspection that has "Allocated" status
const CURRENT_USER_ID = 'USER_001'; // Placeholder for future auth implementation

const ScannerScreen = ({ navigation }: any) => {
    // Some devices have multiple back cameras (wide, telephoto), 
    // we want to ensure we get a valid one.
    const isFocused = useIsFocused();
    const { hasPermission, requestPermission } = useCameraPermission();

    // Modern v4 way to get the camera device
    const backDevice = useCameraDevice('back');
    const allDevices = useCameraDevices();

    // Priority: 'back' device -> first available device
    const device = useMemo(() => backDevice || allDevices[0], [backDevice, allDevices]);

    const [torch, setTorch] = useState<'off' | 'on'>('off');
    const [exposure, setExposure] = useState(0);
    const [isValidating, setIsValidating] = useState(false);

    useEffect(() => {
        if (!hasPermission) {
            requestPermission();
        }
    }, [hasPermission]);

    const codeScanner = useCodeScanner({
        codeTypes: ['pdf-417', 'code-128', 'ean-13', 'qr'],
        onCodeScanned: async (codes) => {
            if (isFocused && codes.length > 0 && codes[0].value && !isValidating) {
                setIsValidating(true);
                const scannedValue = codes[0].value;
                const scannedType = codes[0].type;
                const assetCategory = scannedType === 'pdf-417' ? 'motor_vehicle' : 'refrigeration';

                try {
                    // Validate against rental agreements
                    console.log('=== BARCODE SCAN DEBUG ===');
                    console.log('Raw scanned value:', scannedValue);
                    console.log('Barcode type:', scannedType);
                    console.log('Current user ID:', CURRENT_USER_ID);

                    let validation: { valid: boolean; agreement?: any; error?: string } = { valid: true };

                    // Only validate against DB if NOT a PDF417 (driver's license)
                    if (scannedType !== 'pdf-417') {
                        validation = await rentalAgreementService.validateAndGetAgreement(
                            scannedValue,
                            CURRENT_USER_ID
                        );

                        console.log('Validation result:', validation);

                        if (!validation.valid) {
                            const cleaned = scannedValue.replace(/^\][A-Z0-9]{1,3}/, '').trim();
                            // Show error alert with both raw and cleaned values
                            Alert.alert(
                                'Inspection Not Available',
                                `Raw Scanned: "${scannedValue}"\n` +
                                `Cleaned ID: "${cleaned}"\n\n` +
                                `${validation.error || 'This asset cannot be inspected at this time.'}`,
                                [
                                    {
                                        text: 'OK',
                                        onPress: () => setIsValidating(false)
                                    }
                                ]
                            );
                            return;
                        }
                    } else {
                        console.log('PDF-417 detected - skipping DB validation');
                    }

                    // Valid - proceed to details screen
                    navigation.navigate('Details', {
                        data: scannedValue,
                        scannedType: scannedType,
                        assetCategory: assetCategory,
                        agreement: validation.agreement
                    });

                    setIsValidating(false);
                } catch (error) {
                    console.error('Validation error:', error);
                    Alert.alert(
                        'Error',
                        'Failed to validate barcode. Please try again.',
                        [{ text: 'OK', onPress: () => setIsValidating(false) }]
                    );
                }
            }
        }
    });

    if (!hasPermission) return <View style={styles.container}><ActivityIndicator color="white" /><Text style={styles.text}>Requesting camera...</Text></View>;

    // If 'back' camera is null, it might be that the devices are still loading 
    // or the device doesn't exactly match 'back'
    if (device == null) return (
        <View style={styles.container}>
            <ActivityIndicator color="white" />
            <Text style={styles.text}>Initializing Camera Sensors...</Text>
            <Text style={[styles.text, { fontSize: 12, marginTop: 10, opacity: 0.7 }]}>
                {allDevices.length > 0 ? `Detected ${allDevices.length} camera(s)` : "Detecting camera hardware..."}
            </Text>
        </View>
    );

    return (
        <View style={styles.container}>
            <Camera
                style={StyleSheet.absoluteFill}
                device={device}
                isActive={isFocused}
                codeScanner={codeScanner}
                torch={torch}
                exposure={exposure}
            />

            <View style={styles.overlay}>
                <View style={styles.topControls}>
                    <TouchableOpacity
                        style={styles.debugBtn}
                        onPress={() => navigation.navigate('Debug')}
                    >
                        <Text style={styles.debugIcon}>🔧</Text>
                        <Text style={styles.debugText}>DEBUG</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.torchBtn, torch === 'on' && styles.torchBtnActive]}
                        onPress={() => setTorch(t => t === 'on' ? 'off' : 'on')}
                    >
                        <Text style={styles.torchIcon}>{torch === 'on' ? '🔦' : '💡'}</Text>
                        <Text style={styles.torchText}>{torch === 'on' ? 'LIGHT ON' : 'TURN LIGHT ON'}</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.scanGuidance}>
                    <Text style={styles.scanText}>Position Barcode within frame</Text>
                    <Text style={styles.subScanText}>PDF417 for Vehicles | Standard for Units</Text>
                    <View style={styles.guideBox} />
                </View>

                <View style={styles.bottomControls}>
                    <View style={styles.sliderContainer}>
                        <Text style={styles.sliderLabel}>Brightness / Exposure</Text>
                        <Slider
                            value={exposure}
                            minimumValue={-2}
                            maximumValue={2}
                            step={0.1}
                            onValueChange={(val: any) => setExposure(val[0])}
                            thumbStyle={styles.thumb}
                            trackStyle={styles.track}
                            minimumTrackTintColor="#3b82f6"
                        />
                    </View>
                </View>
            </View>

            {/* Validation Overlay */}
            {isValidating && (
                <View style={styles.validationOverlay}>
                    <ActivityIndicator size="large" color="#3b82f6" />
                    <Text style={styles.validationText}>Validating Inspection...</Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        color: 'white',
        fontSize: 18,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'space-between',
        paddingVertical: 50,
        paddingHorizontal: 20,
    },
    topControls: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    debugBtn: {
        backgroundColor: 'rgba(251,146,60,0.8)',
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    debugIcon: {
        fontSize: 18,
        marginRight: 10,
    },
    debugText: {
        color: 'white',
        fontWeight: '900',
        fontSize: 12,
    },
    torchBtn: {
        backgroundColor: 'rgba(0,0,0,0.6)',
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    torchBtnActive: {
        backgroundColor: '#3b82f6',
        borderColor: '#fff',
    },
    torchIcon: {
        fontSize: 18,
        marginRight: 10,
    },
    torchText: {
        color: 'white',
        fontWeight: '900',
        fontSize: 12,
    },
    scanGuidance: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    scanText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 15,
        paddingTop: 10,
        borderTopLeftRadius: 10,
        borderTopRightRadius: 10,
    },
    subScanText: {
        color: '#00ff00',
        fontSize: 12,
        marginBottom: 20,
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 15,
        paddingBottom: 10,
        borderBottomLeftRadius: 10,
        borderBottomRightRadius: 10,
    },
    guideBox: {
        width: 300,
        height: 150,
        borderWidth: 2,
        borderColor: '#00ff00',
        backgroundColor: 'transparent',
        borderRadius: 10,
    },
    bottomControls: {
        width: '100%',
        alignItems: 'center',
    },
    sliderContainer: {
        width: '80%',
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: 15,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    sliderLabel: {
        color: 'white',
        fontSize: 12,
        fontWeight: '800',
        marginBottom: 5,
        textAlign: 'center',
    },
    thumb: {
        width: 24,
        height: 24,
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 3,
        borderColor: '#3b82f6',
    },
    track: {
        height: 4,
        borderRadius: 2,
    },
    validationOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100,
    },
    validationText: {
        color: '#3b82f6',
        marginTop: 20,
        fontSize: 16,
        fontWeight: 'bold',
    }
});

export default ScannerScreen;
