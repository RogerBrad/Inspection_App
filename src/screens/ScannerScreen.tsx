import React, { useEffect, useState, useMemo } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Camera, useCameraDevice, useCodeScanner, useCameraPermission, useCameraDevices } from 'react-native-vision-camera';
import { Slider } from '@miblanchard/react-native-slider';
import { rentalAgreementService } from '../services/rentalAgreementService';

import { supabase } from '../services/supabaseClient';
import { offlineStorage } from '../services/offlineStorage';

const ScannerScreen = ({ route, navigation }: any) => {
    // optional params when coming from Inspection List
    const { expectedId, agreement, assetCategory: paramCategory } = route.params || {};

    // Some devices have multiple back cameras (wide, telephoto), 
    const isFocused = useIsFocused();
    const { hasPermission, requestPermission } = useCameraPermission();

    const [currentUserId, setCurrentUserId] = useState<string>('');
    const [initTimeout, setInitTimeout] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    const backDevice = useCameraDevice('back');
    const allDevices = useCameraDevices();
    const device = useMemo(() => backDevice || allDevices[0], [backDevice, allDevices, refreshKey]);

    const [torch, setTorch] = useState<'off' | 'on'>('off');
    const [exposure, setExposure] = useState(0);
    const [isValidating, setIsValidating] = useState(false);

    useEffect(() => {
        const fetchUser = async () => {
            const id = await offlineStorage.getUserId();
            setCurrentUserId(id);
        };
        fetchUser();
    }, []);

    useEffect(() => {
        let timer: any;
        if (isFocused && !device) {
            timer = setTimeout(() => {
                setInitTimeout(true);
            }, 6000);
        } else {
            setInitTimeout(false);
        }
        return () => clearTimeout(timer);
    }, [device, isFocused, refreshKey]);

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

                // Clean the barcode value for comparison
                const cleanedValue = scannedValue.replace(/^\][A-Z0-9]{1,3}/, '').trim();

                console.log('=== BARCODE SCAN DEBUG ===');
                console.log('Raw:', scannedValue, 'Cleaned:', cleanedValue, 'Type:', scannedType);

                // If we are expecting a specific ID (from the List), check it now
                try {
                    // 1. Direct key match if we are coming from an allocated inspection
                    if (expectedId) {
                        if (cleanedValue !== expectedId) {
                            Alert.alert(
                                'Incorrect Asset',
                                `You scanned: ${cleanedValue}\nExpected: ${expectedId}`,
                                [{ text: 'OK', onPress: () => setIsValidating(false) }]
                            );
                            return;
                        }
                        console.log('Match confirmed for expected ID:', expectedId);
                        
                        navigation.navigate('Details', {
                            data: cleanedValue,
                            scannedType: scannedType,
                            assetCategory: paramCategory || 'motor_vehicle',
                            agreement: agreement
                        });
                        setIsValidating(false);
                        return;
                    }

                    // 2. Fallback for Ad-hoc scanning (no expectedId)
                    // Skip database lookup as per user request to allow ad-hoc inspections (Step Id: 957)
                    navigation.navigate('Details', {
                        data: cleanedValue,
                        scannedType: scannedType,
                        assetCategory: paramCategory || 'motor_vehicle',
                        agreement: null // Ad-hoc scans don't have a pre-linked agreement
                    });
                    setIsValidating(false);
                } catch (error) {
                    console.error('Scanner error:', error);
                    setIsValidating(false);
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
            <Text style={[styles.text, { fontSize: 13, marginTop: 10, opacity: 0.7, textAlign: 'center', paddingHorizontal: 40 }]}>
                {allDevices.length > 0 ? `Detected ${allDevices.length} camera(s), finalizing...` : "Detecting camera hardware..."}
            </Text>

            {initTimeout && (
                <View style={{ marginTop: 40, alignItems: 'center', width: '100%' }}>
                    <Text style={{ color: '#fb923c', fontWeight: 'bold', marginBottom: 20, textAlign: 'center', paddingHorizontal: 20 }}>
                        Hardware discovery is taking longer than usual.
                    </Text>
                    <TouchableOpacity
                        onPress={() => setRefreshKey(k => k + 1)}
                        style={{ backgroundColor: '#3b82f6', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 25, marginBottom: 15 }}
                    >
                        <Text style={{ color: 'white', fontWeight: 'bold' }}>RETRY SENSOR SCAN</Text>
                    </TouchableOpacity>
                </View>
            )}

            <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={{ marginTop: initTimeout ? 10 : 40, padding: 15 }}
            >
                <Text style={{ color: '#9ca3af', fontWeight: 'bold', letterSpacing: 1 }}>CANCEL & GO BACK</Text>
            </TouchableOpacity>
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
                <View style={{ position: 'absolute', top: 10, alignSelf: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 10, opacity: 0.8, backgroundColor: 'rgba(0,0,0,0.5)', padding: 4, borderRadius: 10 }}>BUILD: v25-BUNDLE-STABLE</Text>
                </View>
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

                    {/* EMERGENCY RESET BUTTON */}
                    <TouchableOpacity
                        style={[styles.torchBtn, { backgroundColor: 'rgba(239, 68, 68, 0.8)', marginLeft: 10 }]}
                        onPress={async () => {
                            await supabase.auth.signOut();
                            await offlineStorage.setUserId('');
                            await offlineStorage.setUserEmail('');
                            // AppNavigator will handle the rest
                        }}
                    >
                        <Text style={styles.torchIcon}>🚪</Text>
                        <Text style={styles.torchText}>RESET / LOGOUT</Text>
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
