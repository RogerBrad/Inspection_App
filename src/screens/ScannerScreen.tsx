import React, { useEffect, useState, useMemo } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Camera, useCameraDevice, useCodeScanner, useCameraPermission, useCameraDevices } from 'react-native-vision-camera';
import { Slider } from '@miblanchard/react-native-slider';

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

    useEffect(() => {
        if (!hasPermission) {
            requestPermission();
        }
    }, [hasPermission]);

    const codeScanner = useCodeScanner({
        codeTypes: ['pdf-417', 'code-128', 'ean-13', 'qr'],
        onCodeScanned: (codes) => {
            if (isFocused && codes.length > 0 && codes[0].value) {
                const scannedType = codes[0].type;
                const assetCategory = scannedType === 'pdf-417' ? 'motor_vehicle' : 'refrigeration';

                navigation.navigate('Details', {
                    data: codes[0].value,
                    scannedType: scannedType,
                    assetCategory: assetCategory
                });
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
        alignItems: 'flex-end',
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
});

export default ScannerScreen;
