import React, { useState } from 'react';
import {
    StyleSheet, View, Text, TouchableOpacity,
    ActivityIndicator, Pressable, Dimensions, ScrollView
} from 'react-native';
import Animated, {
    useSharedValue, useAnimatedStyle, withSpring
} from 'react-native-reanimated';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Slider } from '@miblanchard/react-native-slider';

interface Marker {
    id: string;
    x: number;
    y: number;
    type: 'manual' | 'auto';
    confirmed: boolean;
    label?: string;
}

type ActiveMode = 'normal' | 'align' | 'mark';

const PhotoComparisonScreen = ({ route, navigation }: any) => {
    const { photoBefore, photoAfter, vehicleData } = route.params;

    const [loading, setLoading] = useState(true);
    const [markers, setMarkers] = useState<Marker[]>([]);
    const [activeMode, setActiveMode] = useState<ActiveMode>('normal');
    const [isScanning, setIsScanning] = useState(false);
    const [containerSize, setContainerSize] = useState({
        width: Dimensions.get('window').width,
        height: 400
    });

    // ─── Opacity / blend slider ───────────────────────────────────────────────
    const opacity = useSharedValue(0.5);

    // ─── GLOBAL transform (both images move together) ─────────────────────────
    const gScale = useSharedValue(1);
    const gScaleSaved = useSharedValue(1);
    const gX = useSharedValue(0);
    const gXSaved = useSharedValue(0);
    const gY = useSharedValue(0);
    const gYSaved = useSharedValue(0);
    const gRot = useSharedValue(0);
    const gRotSaved = useSharedValue(0);

    // ─── ALIGN transform (overlay/Present image only) ─────────────────────────
    const aScale = useSharedValue(1);
    const aScaleSaved = useSharedValue(1);
    const aX = useSharedValue(0);
    const aXSaved = useSharedValue(0);
    const aY = useSharedValue(0);
    const aYSaved = useSharedValue(0);
    const aRot = useSharedValue(0);
    const aRotSaved = useSharedValue(0);

    // ─── Scan line ────────────────────────────────────────────────────────────
    const scanLineY = useSharedValue(-100);

    const onLayout = (event: any) => {
        const { width, height } = event.nativeEvent.layout;
        setContainerSize({ width, height });
    };

    // ─── Animated Styles ─────────────────────────────────────────────────────
    const globalStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: gX.value },
            { translateY: gY.value },
            { scale: gScale.value },
            { rotate: `${gRot.value}rad` },
        ],
    }));

    const overlayStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [
            { translateX: aX.value },
            { translateY: aY.value },
            { scale: aScale.value },
            { rotate: `${aRot.value}rad` },
        ],
    }));

    const scanLineStyle = useAnimatedStyle(() => ({
        top: scanLineY.value,
        opacity: isScanning ? 1 : 0,
    }));

    // ─── Gestures ─────────────────────────────────────────────────────────────
    const isAlignMode = activeMode === 'align';
    const isMarkMode = activeMode === 'mark';

    const pinchGesture = Gesture.Pinch()
        .enabled(!isMarkMode)
        .onUpdate((e) => {
            if (isAlignMode) {
                aScale.value = aScaleSaved.value * e.scale;
            } else {
                gScale.value = gScaleSaved.value * e.scale;
            }
        })
        .onEnd(() => {
            if (isAlignMode) {
                aScaleSaved.value = aScale.value;
            } else {
                gScaleSaved.value = gScale.value;
            }
        });

    const panGesture = Gesture.Pan()
        .enabled(!isMarkMode)
        .onUpdate((e) => {
            if (isAlignMode) {
                aX.value = aXSaved.value + e.translationX;
                aY.value = aYSaved.value + e.translationY;
            } else {
                gX.value = gXSaved.value + e.translationX;
                gY.value = gYSaved.value + e.translationY;
            }
        })
        .onEnd(() => {
            if (isAlignMode) {
                aXSaved.value = aX.value;
                aYSaved.value = aY.value;
            } else {
                gXSaved.value = gX.value;
                gYSaved.value = gY.value;
            }
        });

    const rotationGesture = Gesture.Rotation()
        .enabled(!isMarkMode)
        .onUpdate((e) => {
            if (isAlignMode) {
                aRot.value = aRotSaved.value + e.rotation;
            } else {
                gRot.value = gRotSaved.value + e.rotation;
            }
        })
        .onEnd(() => {
            if (isAlignMode) {
                aRotSaved.value = aRot.value;
            } else {
                gRotSaved.value = gRot.value;
            }
        });

    const combinedGesture = Gesture.Simultaneous(pinchGesture, panGesture, rotationGesture);

    // ─── Reset Helpers ───────────────────────────────────────────────────────
    const resetGlobal = () => {
        gScale.value = withSpring(1); gScaleSaved.value = 1;
        gX.value = withSpring(0); gXSaved.value = 0;
        gY.value = withSpring(0); gYSaved.value = 0;
        gRot.value = withSpring(0); gRotSaved.value = 0;
    };

    const resetAlignment = () => {
        aScale.value = withSpring(1); aScaleSaved.value = 1;
        aX.value = withSpring(0); aXSaved.value = 0;
        aY.value = withSpring(0); aYSaved.value = 0;
        aRot.value = withSpring(0); aRotSaved.value = 0;
    };

    // ─── Mark Mode Tap ───────────────────────────────────────────────────────
    const handleTap = (event: any) => {
        if (!isMarkMode || isScanning) return;
        const { locationX, locationY } = event.nativeEvent;
        const centerX = containerSize.width / 2;
        const centerY = containerSize.height / 2;
        const x = (locationX - centerX - gX.value) / gScale.value + centerX;
        const y = (locationY - centerY - gY.value) / gScale.value + centerY;
        const newMarker: Marker = {
            id: Math.random().toString(),
            x, y,
            type: 'manual',
            confirmed: true,
            label: `#${markers.filter(m => m.type === 'manual').length + 1}`
        };
        setMarkers(prev => [...prev, newMarker]);
    };

    // ─── Auto Compare (scan animation + simulated diff markers) ──────────────
    const handleAutoCompare = () => {
        if (isScanning) return;
        // Clear previous auto markers
        setMarkers(prev => prev.filter(m => m.type === 'manual'));
        setIsScanning(true);
        opacity.value = withSpring(0.5);

        // Animate scan line top to bottom
        scanLineY.value = -10;
        scanLineY.value = withSpring(containerSize.height + 10, { damping: 20, stiffness: 35 });

        // After scan animation completes, place simulated diff markers
        setTimeout(() => {
            const autoMarkers: Marker[] = [
                {
                    id: Math.random().toString(),
                    x: containerSize.width * 0.25,
                    y: containerSize.height * 0.25,
                    type: 'auto', confirmed: false,
                    label: 'A1'
                },
                {
                    id: Math.random().toString(),
                    x: containerSize.width * 0.65,
                    y: containerSize.height * 0.45,
                    type: 'auto', confirmed: false,
                    label: 'A2'
                },
                {
                    id: Math.random().toString(),
                    x: containerSize.width * 0.40,
                    y: containerSize.height * 0.70,
                    type: 'auto', confirmed: false,
                    label: 'A3'
                },
            ];
            setMarkers(prev => [...prev, ...autoMarkers]);
            setIsScanning(false);
            scanLineY.value = -100;
        }, 2800);
    };

    const handleConfirmMarker = (id: string) => {
        setMarkers(prev => prev.map(m =>
            m.id === id ? { ...m, confirmed: !m.confirmed } : m
        ));
    };

    const removeMarker = (id: string) => {
        setMarkers(prev => prev.filter(m => m.id !== id));
    };

    const modeButton = (label: string, mode: ActiveMode, color: string) => (
        <TouchableOpacity
            style={[styles.modeBtn, activeMode === mode && { backgroundColor: color }]}
            onPress={() => setActiveMode(activeMode === mode ? 'normal' : mode)}
        >
            <Text style={[styles.modeBtnText, activeMode === mode && styles.modeBtnTextActive]}>
                {label}
            </Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            {/* ── Header ─────────────────────────────────────── */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backText}>✕</Text>
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>Visual Compare</Text>
                    <Text style={styles.subtitle}>{vehicleData?.vin || vehicleData?.angle || ''}</Text>
                </View>
                <TouchableOpacity
                    style={[styles.autoBtn, isScanning && { opacity: 0.5 }]}
                    onPress={handleAutoCompare}
                    disabled={isScanning}
                >
                    <Text style={styles.autoBtnText}>
                        {isScanning ? '⏳ Scanning...' : '🔍 Auto Scan'}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* ── Mode Toolbar ───────────────────────────────── */}
            <View style={styles.toolbar}>
                <Text style={styles.toolbarHint}>
                    {activeMode === 'normal'
                        ? '✋ Drag / Pinch / Rotate both images'
                        : activeMode === 'align'
                            ? '🎯 Adjusting Present image only'
                            : '📍 Tap image to mark differences'}
                </Text>
                <View style={styles.toolbarButtons}>
                    {modeButton('🎯 Align', 'align', '#f59e0b')}
                    {modeButton('📍 Mark', 'mark', '#ef4444')}
                </View>
            </View>

            {/* ── Image Area ─────────────────────────────────── */}
            <GestureHandlerRootView style={{ flex: 1 }}>
                <GestureDetector gesture={combinedGesture}>
                    <Pressable
                        style={styles.imageContainer}
                        onPress={handleTap}
                        onLayout={onLayout}
                    >
                        {loading && (
                            <ActivityIndicator size="large" color="#3b82f6" style={styles.loader} />
                        )}

                        {/* Global wrapper — both images transform together */}
                        <Animated.View style={[StyleSheet.absoluteFill, globalStyle]}>

                            {/* PAST photo (base layer) */}
                            <Animated.Image
                                source={{ uri: photoBefore }}
                                style={styles.image}
                                resizeMode="contain"
                                onLoadEnd={() => setLoading(false)}
                            />

                            {/* PRESENT photo (overlay layer, independently alignable) */}
                            <Animated.Image
                                source={{ uri: photoAfter }}
                                style={[StyleSheet.absoluteFill, styles.image, overlayStyle]}
                                resizeMode="contain"
                            />

                            {/* Markers */}
                            {markers.map((marker) => (
                                <TouchableOpacity
                                    key={marker.id}
                                    onPress={() => handleConfirmMarker(marker.id)}
                                    onLongPress={() => removeMarker(marker.id)}
                                    style={[
                                        styles.marker,
                                        {
                                            left: marker.x - 16,
                                            top: marker.y - 16,
                                            borderColor: marker.confirmed ? '#e74c3c' : '#f59e0b',
                                            backgroundColor: marker.confirmed
                                                ? 'rgba(231,76,60,0.35)'
                                                : 'rgba(245,158,11,0.35)',
                                            borderStyle: marker.type === 'auto' && !marker.confirmed ? 'dashed' : 'solid',
                                        }
                                    ]}
                                >
                                    <Text style={styles.markerLabel}>{marker.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </Animated.View>

                        {/* Scan line overlay */}
                        {isScanning && (
                            <Animated.View style={[styles.scanLine, scanLineStyle]} pointerEvents="none">
                                <View style={styles.scanGlow} />
                            </Animated.View>
                        )}

                        {/* Touch capture layer for mark mode */}
                        {isMarkMode && <View style={[StyleSheet.absoluteFill, { zIndex: 5 }]} />}
                    </Pressable>
                </GestureDetector>
            </GestureHandlerRootView>

            {/* ── Controls Panel ─────────────────────────────── */}
            <View style={styles.controls}>
                {/* Image Labels + Opacity Slider */}
                <View style={styles.labelRow}>
                    <View style={styles.imageLabel}>
                        <View style={[styles.labelDot, { backgroundColor: '#fff' }]} />
                        <Text style={styles.sliderLabel}>PAST</Text>
                    </View>
                    <View style={styles.imageLabel}>
                        <View style={[styles.labelDot, { backgroundColor: '#3b82f6' }]} />
                        <Text style={styles.sliderLabel}>PRESENT</Text>
                    </View>
                </View>
                <Slider
                    value={0.5}
                    onValueChange={(val: any) => (opacity.value = val[0])}
                    minimumValue={0}
                    maximumValue={1}
                    trackStyle={styles.track}
                    thumbStyle={styles.thumb}
                    minimumTrackTintColor="#3b82f6"
                />

                {/* Reset buttons row */}
                <View style={styles.resetRow}>
                    <TouchableOpacity style={styles.resetBtn} onPress={resetGlobal}>
                        <Text style={styles.resetBtnText}>↺ Reset View</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.resetBtn} onPress={resetAlignment}>
                        <Text style={styles.resetBtnText}>↺ Reset Align</Text>
                    </TouchableOpacity>
                    {markers.length > 0 && (
                        <TouchableOpacity
                            style={[styles.resetBtn, { backgroundColor: '#7f1d1d' }]}
                            onPress={() => setMarkers([])}
                        >
                            <Text style={styles.resetBtnText}>🗑 Clear ({markers.length})</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Markers list (if any auto-detected pending confirmation) */}
                {markers.some(m => m.type === 'auto' && !m.confirmed) && (
                    <Text style={styles.autoHint}>
                        ⚠️ {markers.filter(m => m.type === 'auto' && !m.confirmed).length} auto-detected difference(s) — tap marker to confirm, long-press to remove
                    </Text>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        paddingTop: 55,
        paddingHorizontal: 20,
        paddingBottom: 15,
        backgroundColor: 'rgba(15,15,15,0.95)',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#222',
    },
    backButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    backText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
    title: { fontSize: 17, fontWeight: 'bold', color: 'white' },
    subtitle: { fontSize: 11, color: '#888', fontFamily: 'monospace' },
    autoBtn: {
        backgroundColor: '#1d4ed8',
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 20,
    },
    autoBtnText: { color: 'white', fontWeight: '700', fontSize: 13 },

    // Toolbar
    toolbar: {
        backgroundColor: '#111',
        paddingHorizontal: 16,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: '#222',
    },
    toolbarHint: { color: '#888', fontSize: 11, flex: 1, marginRight: 10 },
    toolbarButtons: { flexDirection: 'row', gap: 8 },
    modeBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 15,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    modeBtnText: { color: '#aaa', fontSize: 12, fontWeight: '600' },
    modeBtnTextActive: { color: 'white' },

    // Image area
    imageContainer: {
        flex: 1,
        backgroundColor: '#0a0a0a',
        overflow: 'hidden',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    loader: {
        position: 'absolute',
        alignSelf: 'center',
        top: '40%',
        zIndex: 10,
    },
    scanLine: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: 3,
        backgroundColor: '#3b82f6',
        zIndex: 20,
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 8,
        elevation: 10,
    },
    scanGlow: {
        position: 'absolute',
        top: -25,
        left: 0,
        right: 0,
        height: 55,
        backgroundColor: 'rgba(59,130,246,0.15)',
    },

    // Markers
    marker: {
        position: 'absolute',
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    markerLabel: {
        color: 'white',
        fontSize: 9,
        fontWeight: 'bold',
    },

    // Controls panel
    controls: {
        paddingHorizontal: 20,
        paddingTop: 18,
        paddingBottom: 35,
        backgroundColor: '#111',
        borderTopWidth: 1,
        borderTopColor: '#222',
    },
    labelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    imageLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    labelDot: { width: 10, height: 10, borderRadius: 5 },
    sliderLabel: {
        color: '#aaa',
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    track: { height: 6, borderRadius: 3 },
    thumb: {
        width: 24,
        height: 24,
        backgroundColor: '#fff',
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 4,
        elevation: 5,
    },
    resetRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 14,
        flexWrap: 'wrap',
    },
    resetBtn: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#222',
    },
    resetBtnText: { color: '#ccc', fontSize: 12, fontWeight: '600' },
    autoHint: {
        color: '#f59e0b',
        fontSize: 11,
        marginTop: 10,
        fontStyle: 'italic',
        textAlign: 'center',
    },
});

export default PhotoComparisonScreen;
