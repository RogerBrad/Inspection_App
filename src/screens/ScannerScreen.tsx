import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Camera, useCameraDevice, useCodeScanner, CameraPermissionStatus } from 'react-native-vision-camera';

const ScannerScreen = ({ navigation }: any) => {
    // Some devices have multiple back cameras (wide, telephoto), 
    // we want to ensure we get a valid one.
    const isFocused = useIsFocused();
    const device = useCameraDevice('back');
    const [permission, setPermission] = useState<CameraPermissionStatus>('not-determined');

    useEffect(() => {
        (async () => {
            const status = await Camera.requestCameraPermission();
            console.log("Camera Permission Status:", status);
            setPermission(status);
        })();
    }, []);

    const codeScanner = useCodeScanner({
        codeTypes: ['pdf-417'],
        onCodeScanned: (codes) => {
            if (codes.length > 0 && codes[0].value) {
                navigation.navigate('Details', { data: codes[0].value });
            }
        }
    });

    if (permission === 'not-determined') return <View style={styles.container}><ActivityIndicator color="white" /><Text style={styles.text}>Requesting camera...</Text></View>;
    if (permission === 'denied') return <View style={styles.container}><Text style={styles.text}>No camera permission. Please enable in settings.</Text></View>;

    // If 'back' camera is null, it might be that the devices are still loading 
    // or the device doesn't exactly match 'back'
    if (device == null) return (
        <View style={styles.container}>
            <ActivityIndicator color="white" />
            <Text style={styles.text}>Initializing Camera Sensors...</Text>
        </View>
    );

    return (
        <View style={styles.container}>
            <Camera
                style={StyleSheet.absoluteFill}
                device={device}
                isActive={isFocused}
                codeScanner={codeScanner}
            />
            <View style={styles.overlay}>
                <Text style={styles.scanText}>Position PDF417 Barcode within frame</Text>
                <View style={styles.guideBox} />
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
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scanText: {
        color: 'white',
        fontSize: 16,
        marginBottom: 20,
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: 10,
        borderRadius: 5,
    },
    guideBox: {
        width: 300,
        height: 150,
        borderWidth: 2,
        borderColor: '#00ff00',
        backgroundColor: 'transparent',
        borderRadius: 10,
    },
});

export default ScannerScreen;
