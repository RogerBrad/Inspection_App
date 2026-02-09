import React, { useState, useRef, useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Alert, StatusBar } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Camera, useCameraDevice, useCameraPermission, useCameraDevices } from 'react-native-vision-camera';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { Slider } from '@miblanchard/react-native-slider';

const OdometerScanScreen = ({ navigation, route }: any) => {
    const { onScan } = route.params;
    const isFocused = useIsFocused();
    const { hasPermission, requestPermission } = useCameraPermission();

    // Modern v4 way to get the camera device
    const backDevice = useCameraDevice('back');
    const allDevices = useCameraDevices();

    // Priority: 'back' device -> first available device
    const device = useMemo(() => backDevice || allDevices[0], [backDevice, allDevices]);

    const camera = useRef<Camera>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [torch, setTorch] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [minZoom, setMinZoom] = useState(1);
    const [maxZoom, setMaxZoom] = useState(6);

    useEffect(() => {
        if (device) {
            setMinZoom(device.minZoom || 1);
            setMaxZoom(Math.min(device.maxZoom || 10, 8)); // Cap it at 8x for stability
        }
    }, [device]);

    useEffect(() => {
        if (!hasPermission) {
            requestPermission();
        }
    }, [hasPermission]);

    const handleCapture = async () => {
        if (!camera.current || !device) return;

        let photo: any = null;
        try {
            // Give the camera a brief moment to settle
            await new Promise(resolve => setTimeout(resolve, 100));

            // Take the photo while isActive is definitely true
            const photoData = await camera.current.takePhoto({
                flash: torch ? 'on' : 'off',
                enableAutoRedEyeReduction: true
            });

            // NOW we stop the feed and show the spinner
            setIsProcessing(true);
            photo = photoData;

            // On Android, ML Kit often works best with just the absolute path
            const imagePath = photo.path.startsWith('/') ? photo.path : `/${photo.path}`;
            const uri = `file://${imagePath}`;

            let result;
            try {
                result = await TextRecognition.recognize(uri);
            } catch (e) {
                // Fallback for some Android versions/library versions
                console.log("Retrying OCR without file:// prefix");
                result = await TextRecognition.recognize(imagePath);
            }

            // Logic to find the odometer reading
            const rawText = result.text || '';
            const lines = rawText.split('\n');
            let candidates: string[] = [];

            console.log("Full OCR Output:", rawText);

            // 1. Extract all potential numeric sequences from all lines
            for (const line of lines) {
                // Remove letters and symbols, keep only digits and decimal points (sometimes trip has decimals)
                const cleanLine = line.replace(/[a-zA-Z\s]/g, '').trim();

                // Match patterns like 12345, 123456, 1234.5
                const matches = cleanLine.match(/\d+([.,]\d+)?/g);
                if (matches) {
                    candidates.push(...matches);
                }
            }

            // 2. Refine candidates: convert to pure numbers, filtered by length
            let filtered = candidates
                .map(c => c.replace(/[.,]/g, '')) // Remove decimals for comparison
                .filter(c => c.length >= 4 && c.length <= 8); // Odos are usually 4-7 digits

            // 3. Selection Strategy:
            // - Prefer numbers with 6 digits (very common)
            // - Otherwise pick the largest number found (Trip meters are almost always smaller than ODOs)
            let foundOdo = '';
            if (filtered.length > 0) {
                // Sort by length first (desc), then value (desc)
                filtered.sort((a, b) => b.length - a.length || parseInt(b) - parseInt(a));
                foundOdo = filtered[0];
            }

            if (foundOdo) {
                console.log(`OCR Success. Candidate: ${foundOdo}`);
                onScan(foundOdo);
                navigation.goBack();
            } else {
                const debugSnippet = rawText.substring(0, 150).replace(/\n/g, ' ');
                Alert.alert("OCR Failed", `Found text: "${debugSnippet}..." \n\nNo valid odometer (4-7 digits) could be identified. Please try again or enter manually.`, [
                    { text: "Manual Entry", onPress: () => navigation.goBack() },
                    { text: "Try Again", onPress: () => setIsProcessing(false) }
                ]);
            }
        } catch (error: any) {
            console.error("OCR Error:", error);
            Alert.alert("Error", `Optical recognition failed: ${error.message || 'Unknown error'}\n\nPath: ${photo?.path || 'No path'}`);
            setIsProcessing(false);
        }
    };

    if (!hasPermission) {
        return (
            <View style={styles.center}>
                <Text>Camera permission is required.</Text>
            </View>
        );
    }

    if (!device) {
        return (
            <View style={styles.center}>
                <ActivityIndicator color="#3b82f6" />
                <Text style={{ marginTop: 20 }}>Initializing Odometer Camera...</Text>
                <Text style={{ fontSize: 12, marginTop: 10, opacity: 0.7 }}>
                    {allDevices.length > 0 ? `Found ${allDevices.length} sensors...` : "Searching for camera..."}
                </Text>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 30 }}>
                    <Text style={{ color: '#3b82f6', fontWeight: 'bold' }}>GO BACK</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            <Camera
                ref={camera}
                style={StyleSheet.absoluteFill}
                device={device}
                isActive={isFocused && !isProcessing}
                photo={true}
                torch={torch ? 'on' : 'off'}
                zoom={zoom}
                enableZoomGesture={true}
            />

            <View style={styles.overlay}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Text style={styles.backBtnText}>✕ CANCEL</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>SCAN ODOMETER</Text>
                    <TouchableOpacity onPress={() => setTorch(!torch)} style={styles.torchBtn}>
                        <Text style={styles.torchBtnText}>{torch ? '🔦 ON' : '🔦 OFF'}</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.viewfinderContainer}>
                    <View style={styles.viewfinder}>
                        <View style={styles.cornerTopLeft} />
                        <View style={styles.cornerTopRight} />
                        <View style={styles.cornerBottomLeft} />
                        <View style={styles.cornerBottomRight} />
                        <Text style={styles.guideText}>ALIGN ODOMETER HERE</Text>
                    </View>

                    {/* Zoom Slider */}
                    <View style={styles.zoomContainer}>
                        <Text style={styles.zoomText}>ZOOM</Text>
                        <View style={styles.sliderWrapper}>
                            <Slider
                                value={zoom}
                                onValueChange={(val: any) => setZoom(val[0])}
                                minimumValue={minZoom}
                                maximumValue={maxZoom}
                                step={0.1}
                                thumbStyle={styles.zoomThumb}
                                trackStyle={styles.zoomTrack}
                                minimumTrackTintColor="#3b82f6"
                            />
                        </View>
                        <Text style={styles.zoomValue}>{zoom.toFixed(1)}x</Text>
                    </View>
                </View>

                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.captureBtn, isProcessing && styles.captureBtnDisabled]}
                        onPress={handleCapture}
                        disabled={isProcessing}
                    >
                        {isProcessing ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <View style={styles.captureBtnInner} />
                        )}
                    </TouchableOpacity>
                    <Text style={styles.instructionText}>
                        {isProcessing ? 'Processing Image...' : 'Center the odometer in the frame and tap capture'}
                    </Text>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    overlay: {
        flex: 1,
        justifyContent: 'space-between',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 60,
        paddingHorizontal: 20,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: 1,
    },
    backBtn: {
        padding: 10,
    },
    backBtnText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 12,
    },
    viewfinderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    viewfinder: {
        width: 280,
        height: 100,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cornerTopLeft: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: 30,
        height: 30,
        borderTopWidth: 4,
        borderLeftWidth: 4,
        borderColor: '#3b82f6',
    },
    cornerTopRight: {
        position: 'absolute',
        top: 0,
        right: 0,
        width: 30,
        height: 30,
        borderTopWidth: 4,
        borderRightWidth: 4,
        borderColor: '#3b82f6',
    },
    cornerBottomLeft: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: 30,
        height: 30,
        borderBottomWidth: 4,
        borderLeftWidth: 4,
        borderColor: '#3b82f6',
    },
    cornerBottomRight: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 30,
        height: 30,
        borderBottomWidth: 4,
        borderRightWidth: 4,
        borderColor: '#3b82f6',
    },
    guideText: {
        color: '#3b82f6',
        fontWeight: '900',
        fontSize: 12,
        letterSpacing: 2,
    },
    footer: {
        paddingBottom: 60,
        alignItems: 'center',
        gap: 20,
    },
    captureBtn: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    captureBtnDisabled: {
        opacity: 0.5,
    },
    captureBtnInner: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#fff',
    },
    instructionText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
        textAlign: 'center',
        paddingHorizontal: 40,
    },
    torchBtn: {
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        minWidth: 60,
        alignItems: 'center',
    },
    torchBtnText: {
        color: '#fff',
        fontWeight: '800',
        fontSize: 11,
    },
    zoomContainer: {
        width: '80%',
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 15,
        padding: 10,
        marginTop: 40,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    zoomText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '900',
    },
    zoomValue: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '900',
        minWidth: 30,
    },
    sliderWrapper: {
        flex: 1,
    },
    zoomThumb: {
        width: 16,
        height: 16,
        backgroundColor: '#fff',
    },
    zoomTrack: {
        height: 4,
        borderRadius: 2,
    }
});

export default OdometerScanScreen;
