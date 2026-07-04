import React, { useEffect, useState, useRef, useMemo } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Camera, useCameraDevice, useCameraPermission, useCameraDevices } from 'react-native-vision-camera';
import { photoService } from '../services/photoService';

const InspectionCameraScreen = ({ route, navigation }: any) => {
    const { vin, registrationNumber, angle = 'front', category = 'motor_vehicle' } = route.params;
    const isFocused = useIsFocused();
    const { hasPermission, requestPermission } = useCameraPermission();

    const [isCapturing, setIsCapturing] = useState(false);
    const [initTimeout, setInitTimeout] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    const camera = useRef<Camera>(null);
    const [ghostImage, setGhostImage] = useState<string | null>(null);

    // Modern v4 way to get the camera device
    const backDevice = useCameraDevice('back');
    const allDevices = useCameraDevices();

    // Priority: 'back' device -> first available device
    const device = useMemo(() => backDevice || allDevices[0], [backDevice, allDevices, refreshKey]);

    const isDefect = angle.startsWith('DEFECT_');

    // Timeout to detect if camera hardware is taking too long
    useEffect(() => {
        let timer: any;
        if (isFocused && !device) {
            timer = setTimeout(() => {
                setInitTimeout(true);
            }, 6000); // 6 seconds before showing troubleshooting
        } else {
            setInitTimeout(false);
        }
        return () => clearTimeout(timer);
    }, [device, isFocused, refreshKey]);

    useEffect(() => {
        (async () => {
            if (!hasPermission) {
                await requestPermission();
            }

            // Only fetch "Ghost" image for standard angles, not defects
            if (hasPermission && !isDefect && vin && vin.trim() !== '') {
                try {
                    console.log(`Fetching ghost for VIN: ${vin}, Angle: ${angle}`);
                    const latest = await photoService.getLatestPhotoByAngle(vin, angle);
                    if (latest && latest.photoUrl) {
                        setGhostImage(latest.photoUrl);
                    }
                } catch (err) {
                    console.warn("Could not load ghost overlay, continuing without it:", err);
                }
            }
        })();
    }, [vin, angle, isDefect, hasPermission]);

    const takePhoto = async () => {
        if (!camera.current || !device) {
            console.error("Camera reference or device is null");
            return;
        }

        setIsCapturing(true);
        try {
            console.log("Starting hardware capture...");
            // Simplified capture options to prevent timeouts
            const photo = await camera.current.takePhoto({
                flash: 'off'
            });

            if (!photo || !photo.path) {
                console.error("CAPTURE ERROR: No photo path returned from camera.");
                setIsCapturing(false);
                return;
            }

            console.log("Photo captured to temporary path:", photo.path);

            // Save the photo to Supabase
            // On Android, the path usually needs a 'file://' prefix for fetch()
            const photoUri = photo.path.startsWith('file://') ? photo.path : `file://${photo.path}`;
            console.log("Attempting upload for URI:", photoUri);

            try {
                await photoService.saveVehiclePhoto(
                    photoUri,
                    { vin, registrationNumber },
                    angle,
                    category
                );

                console.log("Photo saved successfully.");
                Alert.alert("Success", isDefect ? "Defect photo saved." : "Inspection photo saved.", [
                    { text: "OK", onPress: () => navigation.goBack() }
                ]);
            } catch (serviceErr: any) {
                console.error("SERVICE ERROR:", serviceErr);
                Alert.alert("Upload Failed", serviceErr.message || "Could not save photo.");
            }


        } catch (err: any) {
            console.error("CAPTURE FAILURE:", err);
            const errorMsg = err.message || "Unknown error";
            Alert.alert(
                "Capture Failed",
                `Details: ${errorMsg}\n\nPlease Try Again.`
            );
        } finally {
            setIsCapturing(false);
        }
    };

    if (!hasPermission) return <View style={styles.container}><ActivityIndicator color="white" /><Text style={styles.text}>Awaiting Camera Permission...</Text></View>;

    // Show loader while camera hardware is being initialized/found
    if (device == null) return (
        <View style={styles.container}>
            <ActivityIndicator color="white" />
            <Text style={styles.text}>Initializing Camera Sensors...</Text>
            <Text style={[styles.text, { fontSize: 13, marginTop: 10, opacity: 0.7, textAlign: 'center', paddingHorizontal: 40 }]}>
                {allDevices.length > 0 ? `Detected ${allDevices.length} sensors, finalizing...` : "Searching for camera hardware..."}
            </Text>

            {initTimeout && (
                <View style={{ marginTop: 40, alignItems: 'center', width: '100%' }}>
                    <Text style={{ color: '#fb923c', fontWeight: 'bold', marginBottom: 20, textAlign: 'center', paddingHorizontal: 20 }}>
                        Camera hardware is not responding.
                    </Text>
                    <TouchableOpacity
                        onPress={() => setRefreshKey(k => k + 1)}
                        style={{ backgroundColor: '#3b82f6', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 25, marginBottom: 15 }}
                    >
                        <Text style={{ color: 'white', fontWeight: 'bold' }}>RETRY SENSOR DISCOVERY</Text>
                    </TouchableOpacity>
                </View>
            )}

            <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={{ marginTop: initTimeout ? 10 : 30, backgroundColor: 'rgba(255,255,255,0.1)', padding: 15, borderRadius: 10 }}
            >
                <Text style={{ color: '#3b82f6', fontWeight: 'bold' }}>GO BACK</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.container}>
            {device && hasPermission && (
                <Camera
                    ref={camera}
                    style={StyleSheet.absoluteFill}
                    device={device}
                    isActive={isFocused}
                    photo={true}
                    enableZoomGesture={true}
                />
            )}

            {/* Ghost Overlay - Hide when capturing OR if it's a defect photo */}
            {!isDefect && ghostImage && !isCapturing && (
                <View style={styles.ghostContainer} pointerEvents="none">
                    <Image source={{ uri: ghostImage }} style={styles.ghostImage} />
                    <View style={styles.ghostLabel}>
                        <Text style={styles.ghostLabelText}>ALIGN WITH PREVIOUS PHOTO</Text>
                    </View>
                </View>
            )}

            {/* Busy Overlay */}
            {isCapturing && (
                <View style={styles.busyOverlay}>
                    <ActivityIndicator size="large" color="#ff3b30" />
                    <Text style={styles.busyText}>{isDefect ? 'Saving Defect Evidence...' : 'Saving Inspection Photo...'}</Text>
                </View>
            )}

            <View style={styles.overlay}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
                        <Text style={styles.closeText}>✕</Text>
                    </TouchableOpacity>
                    <Text style={styles.angleText}>{angle.toUpperCase()} VIEW</Text>
                </View>

                <View style={styles.footer}>
                    <View style={styles.captureButtonContainer}>
                        <TouchableOpacity
                            disabled={isCapturing}
                            onPress={takePhoto}
                            style={[styles.captureButton, isCapturing && { opacity: 0.5 }]}
                        >
                            <View style={styles.innerCaptureButton} />
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.captureLabel}>CAPTURE</Text>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
    },
    text: {
        color: 'white',
        fontSize: 18,
    },
    ghostContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        opacity: 0.35, // The "Ghost" transparency level
    },
    ghostImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    ghostLabel: {
        position: 'absolute',
        top: '40%',
        backgroundColor: 'rgba(0,123,255,0.7)',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
    },
    ghostLabelText: {
        color: 'white',
        fontWeight: '900',
        fontSize: 12,
        letterSpacing: 1,
    },
    overlay: {
        flex: 1,
        justifyContent: 'space-between',
        padding: 20,
        zIndex: 50, // Ensure controls are above everything
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 40,
    },
    closeButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeText: {
        color: 'white',
        fontSize: 20,
    },
    angleText: {
        color: 'white',
        fontWeight: 'bold',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 15,
        paddingVertical: 5,
        borderRadius: 15,
    },
    footer: {
        marginBottom: 30,
        alignItems: 'center',
    },
    captureButtonContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 4,
        borderColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    captureButton: {
        width: '85%',
        height: '85%',
        borderRadius: 40,
        backgroundColor: '#ff3b30', // Bright Red
    },
    innerCaptureButton: {
        flex: 1,
        margin: 5,
        borderRadius: 40,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    captureLabel: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
        letterSpacing: 1,
        textShadowColor: 'rgba(0,0,0,0.7)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    busyOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100, // Highest priority
    },
    busyText: {
        color: '#ff3b30', // Match button Brand color
        marginTop: 20,
        fontSize: 18,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    }
});

export default InspectionCameraScreen;
