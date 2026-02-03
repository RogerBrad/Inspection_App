import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Camera, useCameraDevice, CameraPermissionStatus } from 'react-native-vision-camera';
import { photoService } from '../services/photoService';

const InspectionCameraScreen = ({ route, navigation }: any) => {
    const { vin, registrationNumber, angle = 'front' } = route.params;
    const isFocused = useIsFocused();
    const device = useCameraDevice('back');
    const camera = useRef<Camera>(null);

    const [permission, setPermission] = useState<CameraPermissionStatus>('not-determined');
    const [ghostImage, setGhostImage] = useState<string | null>(null);
    const [isCapturing, setIsCapturing] = useState(false);

    useEffect(() => {
        (async () => {
            const status = await Camera.requestCameraPermission();
            setPermission(status);
            if (status !== 'granted') return;

            // Try to fetch the "Ghost" image safely
            if (vin && vin.trim() !== '') {
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
    }, [vin, angle]);

    const takePhoto = async () => {
        if (!camera.current) {
            console.error("Camera reference is null");
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

            // Save the photo to Firebase
            // On Android, the path usually needs a 'file://' prefix for fetch()
            const photoUri = photo.path.startsWith('file://') ? photo.path : `file://${photo.path}`;
            console.log("Attempting upload for URI:", photoUri);

            try {
                await photoService.saveVehiclePhoto(
                    photoUri,
                    { vin, registrationNumber },
                    angle
                );

                console.log("Photo saved successfully.");
                Alert.alert("Success", "Photo saved.", [
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

    if (permission === 'not-determined') return <View style={styles.container}><ActivityIndicator color="white" /></View>;
    if (permission === 'denied') return <View style={styles.container}><Text style={styles.text}>No camera permission.</Text></View>;

    // Show loader while camera hardware is being initialized/found
    if (device == null) return (
        <View style={styles.container}>
            <ActivityIndicator color="white" />
            <Text style={styles.text}>Initializing Camera...</Text>
        </View>
    );

    return (
        <View style={styles.container}>
            {device && permission === 'granted' && (
                <Camera
                    ref={camera}
                    style={StyleSheet.absoluteFill}
                    device={device}
                    isActive={isFocused}
                    photo={true}
                    enableZoomGesture={false}
                />
            )}

            {/* Ghost Overlay - Hide when capturing */}
            {ghostImage && !isCapturing && (
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
                    <Text style={styles.busyText}>Saving Inspection Photo...</Text>
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
