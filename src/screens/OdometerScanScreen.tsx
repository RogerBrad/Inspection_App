import React, { useState, useRef, useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Alert, StatusBar } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Camera, useCameraDevice, useCameraPermission, useCameraDevices } from 'react-native-vision-camera';
import TextRecognition from '@react-native-ml-kit/text-recognition';

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

            // Logic to find the odometer reading: usually looks for a 5-7 digit number
            const lines = result.text.split('\n');
            let foundOdo = '';
            let rawDetected = result.text.substring(0, 100); // For debugging if it fails

            // Try to find a sequence of 3-8 digits (being more lenient now)
            for (const line of lines) {
                // Remove spaces and alphabets
                const cleanLine = line.replace(/[a-zA-Z\s,]/g, '').trim();
                // Find first number that is 3-8 digits long
                const match = cleanLine.match(/\d{3,8}/);
                if (match) {
                    foundOdo = match[0];
                    break;
                }
            }

            if (foundOdo) {
                onScan(foundOdo);
                navigation.goBack();
            } else {
                Alert.alert("OCR Failed", `Could not find a clear number in: "${rawDetected}..." \n\nPlease try again or enter manually.`, [
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
                        <Text style={styles.guideText}>ALIGN NUMBERS HERE</Text>
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
    }
});

export default OdometerScanScreen;
