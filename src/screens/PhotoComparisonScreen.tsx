import React, { useState } from 'react';
import {
    StyleSheet, View, Text, TouchableOpacity,
    ActivityIndicator, Pressable, Dimensions, Alert, ScrollView, Modal
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Slider } from '@miblanchard/react-native-slider';
import {
    visionComparisonService,
    DetectedDifference,
} from '../services/visionComparisonService';

interface Marker {
    id: string;
    x: number;
    y: number;
    type: 'manual' | 'auto';
    confirmed: boolean;
    label?: string;
    description?: string;
    severity?: string;
}

type ActiveMode = 'normal' | 'align' | 'mark';

const PhotoComparisonScreen = ({ route, navigation }: any) => {
    const { photoBefore, photoAfter, vehicleData } = route.params;

    const [loading, setLoading] = useState(true);
    const [markers, setMarkers] = useState<Marker[]>([]);
    const [activeMode, setActiveMode] = useState<ActiveMode>('normal');
    const [isScanning, setIsScanning] = useState(false);
    const [showGrid, setShowGrid] = useState(false);
    const [aiSummary, setAiSummary] = useState<string | null>(null);
    const [showResults, setShowResults] = useState(false);
    const [containerSize, setContainerSize] = useState({
        width: Dimensions.get('window').width,
        height: 400
    });

    // ─── Opacity / blend ──────────────────────────────────────────────────
    const opacity = useSharedValue(0.5);

    // ─── GLOBAL transform (both images) ───────────────────────────────────
    const gScale = useSharedValue(1);
    const gScaleSaved = useSharedValue(1);
    const gX = useSharedValue(0);
    const gXSaved = useSharedValue(0);
    const gY = useSharedValue(0);
    const gYSaved = useSharedValue(0);
    const gRot = useSharedValue(0);
    const gRotSaved = useSharedValue(0);

    // ─── ALIGN transform (Present image only) ────────────────────────────
    const aScale = useSharedValue(1);
    const aScaleSaved = useSharedValue(1);
    const aX = useSharedValue(0);
    const aXSaved = useSharedValue(0);
    const aY = useSharedValue(0);
    const aYSaved = useSharedValue(0);
    const aRot = useSharedValue(0);
    const aRotSaved = useSharedValue(0);

    const onLayout = (event: any) => {
        const { width, height } = event.nativeEvent.layout;
        setContainerSize({ width, height });
    };

    // ─── Animated Styles ─────────────────────────────────────────────────
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

    // ─── Gestures ─────────────────────────────────────────────────────────
    const isAlignMode = activeMode === 'align';
    const isMarkMode = activeMode === 'mark';

    const pinchGesture = Gesture.Pinch()
        .enabled(!isMarkMode)
        .onUpdate((e) => {
            if (isAlignMode) { aScale.value = aScaleSaved.value * e.scale; }
            else { gScale.value = gScaleSaved.value * e.scale; }
        })
        .onEnd(() => {
            if (isAlignMode) { aScaleSaved.value = aScale.value; }
            else { gScaleSaved.value = gScale.value; }
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
            if (isAlignMode) { aXSaved.value = aX.value; aYSaved.value = aY.value; }
            else { gXSaved.value = gX.value; gYSaved.value = gY.value; }
        });

    const rotationGesture = Gesture.Rotation()
        .enabled(!isMarkMode)
        .onUpdate((e) => {
            if (isAlignMode) { aRot.value = aRotSaved.value + e.rotation; }
            else { gRot.value = gRotSaved.value + e.rotation; }
        })
        .onEnd(() => {
            if (isAlignMode) { aRotSaved.value = aRot.value; }
            else { gRotSaved.value = gRot.value; }
        });

    const combinedGesture = Gesture.Simultaneous(pinchGesture, panGesture, rotationGesture);

    // ─── Reset Helpers ───────────────────────────────────────────────────
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
    const autoCentre = () => {
        // Reset both global and alignment so images are centred and overlapping
        resetGlobal();
        resetAlignment();
        opacity.value = withSpring(0.5);
    };

    // ─── Mark Mode Tap ───────────────────────────────────────────────────
    const handleTap = (event: any) => {
        if (!isMarkMode || isScanning) return;
        const { locationX, locationY } = event.nativeEvent;
        const centerX = containerSize.width / 2;
        const centerY = containerSize.height / 2;
        const x = (locationX - centerX - gX.value) / gScale.value + centerX;
        const y = (locationY - centerY - gY.value) / gScale.value + centerY;
        const newMarker: Marker = {
            id: Math.random().toString(), x, y,
            type: 'manual', confirmed: true,
            label: `#${markers.filter(m => m.type === 'manual').length + 1}`
        };
        setMarkers(prev => [...prev, newMarker]);
    };

    // ─── Real AI Scan ────────────────────────────────────────────────────
    const handleAIScan = async () => {
        if (isScanning) return;

        if (!visionComparisonService.isConfigured()) {
            Alert.alert(
                'API Key Required',
                'To use real AI comparison, add a Gemini or OpenAI API key in:\n\nsrc/services/visionComparisonService.ts\n\nGet a free Gemini key from:\nhttps://aistudio.google.com/app/apikey',
                [{ text: 'OK' }]
            );
            return;
        }

        // Clear previous auto markers
        setMarkers(prev => prev.filter(m => m.type === 'manual'));
        setIsScanning(true);
        setAiSummary(null);

        try {
            const result = await visionComparisonService.comparePhotos(photoBefore, photoAfter);

            if (!result.success) {
                Alert.alert('AI Scan Failed', result.error || 'Unknown error occurred.');
                setIsScanning(false);
                return;
            }

            // Map AI-detected differences to markers
            const aiMarkers: Marker[] = result.differences.map((diff: DetectedDifference) => ({
                id: diff.id,
                x: (diff.xPercent / 100) * containerSize.width,
                y: (diff.yPercent / 100) * containerSize.height,
                type: 'auto' as const,
                confirmed: false,
                label: diff.id.replace('ai_', 'AI-'),
                description: diff.description,
                severity: diff.severity,
            }));

            setMarkers(prev => [...prev, ...aiMarkers]);
            setAiSummary(result.summary);
            setShowResults(true);
            setIsScanning(false);

        } catch (err: any) {
            Alert.alert('AI Scan Error', err.message || 'Failed to analyse photos.');
            setIsScanning(false);
        }
    };

    const handleConfirmMarker = (id: string) => {
        setMarkers(prev => prev.map(m => m.id === id ? { ...m, confirmed: !m.confirmed } : m));
    };
    const removeMarker = (id: string) => {
        setMarkers(prev => prev.filter(m => m.id !== id));
    };

    const severityColor = (s?: string) => {
        switch (s) {
            case 'high': return '#ef4444';
            case 'medium': return '#f59e0b';
            default: return '#3b82f6';
        }
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

    // ─── Grid overlay lines ──────────────────────────────────────────────
    const renderGrid = () => {
        if (!showGrid) return null;
        const cols = 4;
        const rows = 4;
        const lines = [];
        for (let i = 1; i < cols; i++) {
            const x = (containerSize.width / cols) * i;
            lines.push(
                <View key={`vc_${i}`} style={[styles.gridLine, { left: x, top: 0, width: 1, height: '100%' }]} />
            );
        }
        for (let i = 1; i < rows; i++) {
            const y = (containerSize.height / rows) * i;
            lines.push(
                <View key={`hr_${i}`} style={[styles.gridLine, { left: 0, top: y, width: '100%', height: 1 }]} />
            );
        }
        // Crosshair centre
        lines.push(
            <View key="cx" style={[styles.gridCentre, { left: containerSize.width / 2 - 12, top: containerSize.height / 2 - 12 }]}>
                <View style={styles.gridCentreH} />
                <View style={styles.gridCentreV} />
            </View>
        );
        return <View style={[StyleSheet.absoluteFill, { zIndex: 4 }]} pointerEvents="none">{lines}</View>;
    };

    return (
        <View style={styles.container}>

            {/* ── Header ──────────────────────────────────────── */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backText}>✕</Text>
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>Visual Compare</Text>
                    <Text style={styles.subtitle}>{vehicleData?.vin || vehicleData?.angle || ''}</Text>
                </View>
                <View style={styles.headerRight}>
                    <TouchableOpacity style={styles.helpBtn} onPress={() => navigation.navigate('Help')}>
                        <Text style={styles.helpBtnText}>❓</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.aiBtn, isScanning && { opacity: 0.5 }]}
                        onPress={handleAIScan}
                        disabled={isScanning}
                    >
                        {isScanning ? (
                            <View style={styles.aiBtnInner}>
                                <ActivityIndicator color="#fff" size="small" />
                                <Text style={styles.aiBtnText}> Analysing...</Text>
                            </View>
                        ) : (
                            <Text style={styles.aiBtnText}>🤖 AI Scan</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── Mode Toolbar ────────────────────────────────── */}
            <View style={styles.toolbar}>
                <Text style={styles.toolbarHint}>
                    {activeMode === 'normal'
                        ? '✋ Drag / Pinch / Rotate both images'
                        : activeMode === 'align'
                            ? '🎯 Adjusting Present image only'
                            : '📍 Tap to mark differences'}
                </Text>
                <View style={styles.toolbarButtons}>
                    <TouchableOpacity
                        style={[styles.modeBtn, showGrid && { backgroundColor: '#6366f1' }]}
                        onPress={() => setShowGrid(!showGrid)}
                    >
                        <Text style={[styles.modeBtnText, showGrid && styles.modeBtnTextActive]}>#</Text>
                    </TouchableOpacity>
                    {modeButton('🎯 Align', 'align', '#f59e0b')}
                    {modeButton('📍 Mark', 'mark', '#ef4444')}
                </View>
            </View>

            {/* ── Image Area ──────────────────────────────────── */}
            <GestureHandlerRootView style={{ flex: 1 }}>
                <GestureDetector gesture={combinedGesture}>
                    <Pressable style={styles.imageContainer} onPress={handleTap} onLayout={onLayout}>
                        {loading && (
                            <ActivityIndicator size="large" color="#3b82f6" style={styles.loader} />
                        )}

                        {/* Global wrapper */}
                        <Animated.View style={[StyleSheet.absoluteFill, globalStyle]}>
                            {/* PAST photo */}
                            <Animated.Image
                                source={{ uri: photoBefore }}
                                style={styles.image}
                                resizeMode="contain"
                                onLoadEnd={() => setLoading(false)}
                            />
                            {/* PRESENT photo (overlay) */}
                            <Animated.Image
                                source={{ uri: photoAfter }}
                                style={[StyleSheet.absoluteFill, styles.image, overlayStyle]}
                                resizeMode="contain"
                            />
                            {/* Markers */}
                            {markers.map((marker) => (
                                <TouchableOpacity
                                    key={marker.id}
                                    onPress={() => marker.description
                                        ? Alert.alert(
                                            marker.label || 'Difference',
                                            `${marker.description}\n\nSeverity: ${marker.severity || 'N/A'}\n\nTap OK, then long-press marker to remove.`,
                                            [
                                                { text: 'Confirm', onPress: () => handleConfirmMarker(marker.id) },
                                                { text: 'OK' },
                                            ]
                                        )
                                        : handleConfirmMarker(marker.id)
                                    }
                                    onLongPress={() => removeMarker(marker.id)}
                                    style={[
                                        styles.marker,
                                        {
                                            left: marker.x - 18,
                                            top: marker.y - 18,
                                            borderColor: marker.type === 'auto'
                                                ? severityColor(marker.severity)
                                                : (marker.confirmed ? '#e74c3c' : '#f59e0b'),
                                            backgroundColor: marker.confirmed
                                                ? 'rgba(231,76,60,0.35)'
                                                : marker.type === 'auto'
                                                    ? `${severityColor(marker.severity)}40`
                                                    : 'rgba(245,158,11,0.35)',
                                            borderStyle: marker.type === 'auto' && !marker.confirmed ? 'dashed' : 'solid',
                                        }
                                    ]}
                                >
                                    <Text style={styles.markerLabel}>{marker.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </Animated.View>

                        {/* Grid overlay */}
                        {renderGrid()}

                        {/* Scanning overlay */}
                        {isScanning && (
                            <View style={styles.scanOverlay}>
                                <ActivityIndicator size="large" color="#3b82f6" />
                                <Text style={styles.scanText}>AI is analysing both images...</Text>
                                <Text style={styles.scanSubText}>This may take 10-20 seconds</Text>
                            </View>
                        )}

                        {isMarkMode && <View style={[StyleSheet.absoluteFill, { zIndex: 5 }]} />}
                    </Pressable>
                </GestureDetector>
            </GestureHandlerRootView>

            {/* ── Controls ────────────────────────────────────── */}
            <View style={styles.controls}>
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
                <View style={styles.resetRow}>
                    <TouchableOpacity style={styles.actionBtn} onPress={autoCentre}>
                        <Text style={styles.actionBtnText}>⊞ Auto-Centre</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.resetBtn} onPress={resetGlobal}>
                        <Text style={styles.resetBtnText}>↺ View</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.resetBtn} onPress={resetAlignment}>
                        <Text style={styles.resetBtnText}>↺ Align</Text>
                    </TouchableOpacity>
                    {markers.length > 0 && (
                        <TouchableOpacity
                            style={[styles.resetBtn, { backgroundColor: '#7f1d1d' }]}
                            onPress={() => setMarkers([])}
                        >
                            <Text style={styles.resetBtnText}>🗑 {markers.length}</Text>
                        </TouchableOpacity>
                    )}
                </View>
                {/* AI summary bar */}
                {aiSummary && (
                    <TouchableOpacity style={styles.summaryBar} onPress={() => setShowResults(true)}>
                        <Text style={styles.summaryText}>🤖 {aiSummary}</Text>
                        <Text style={styles.summaryTap}>TAP FOR DETAILS ▸</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* ── AI Results Modal ─────────────────────────────── */}
            <Modal
                visible={showResults}
                transparent
                animationType="slide"
                onRequestClose={() => setShowResults(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>🤖 AI Scan Results</Text>
                            <TouchableOpacity onPress={() => setShowResults(false)}>
                                <Text style={styles.modalClose}>✕</Text>
                            </TouchableOpacity>
                        </View>
                        {aiSummary && <Text style={styles.modalSummary}>{aiSummary}</Text>}
                        <ScrollView style={styles.modalScroll}>
                            {markers.filter(m => m.type === 'auto').map((marker) => (
                                <View key={marker.id} style={styles.resultItem}>
                                    <View style={[styles.severityDot, { backgroundColor: severityColor(marker.severity) }]} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.resultLabel}>{marker.label}</Text>
                                        <Text style={styles.resultDesc}>{marker.description}</Text>
                                        <Text style={styles.resultSeverity}>
                                            Severity: {marker.severity?.toUpperCase()}
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        style={[styles.confirmBtn, marker.confirmed && styles.confirmedBtn]}
                                        onPress={() => handleConfirmMarker(marker.id)}
                                    >
                                        <Text style={styles.confirmBtnText}>
                                            {marker.confirmed ? '✓' : '?'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                            {markers.filter(m => m.type === 'auto').length === 0 && (
                                <Text style={styles.noResults}>No differences detected by AI</Text>
                            )}
                        </ScrollView>
                        <TouchableOpacity style={styles.modalDone} onPress={() => setShowResults(false)}>
                            <Text style={styles.modalDoneText}>DONE</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },

    // Header
    header: {
        paddingTop: 55, paddingHorizontal: 16, paddingBottom: 12,
        backgroundColor: 'rgba(15,15,15,0.95)',
        flexDirection: 'row', alignItems: 'center', gap: 10,
        borderBottomWidth: 1, borderBottomColor: '#222',
    },
    backButton: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center', alignItems: 'center',
    },
    backText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
    title: { fontSize: 16, fontWeight: 'bold', color: 'white' },
    subtitle: { fontSize: 10, color: '#666', fontFamily: 'monospace' },
    headerRight: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    helpBtn: {
        width: 34, height: 34, borderRadius: 17,
        backgroundColor: 'rgba(255,255,255,0.08)',
        justifyContent: 'center', alignItems: 'center',
    },
    helpBtnText: { fontSize: 16 },
    aiBtn: {
        backgroundColor: '#7c3aed',
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18,
    },
    aiBtnInner: { flexDirection: 'row', alignItems: 'center' },
    aiBtnText: { color: 'white', fontWeight: '700', fontSize: 13 },

    // Toolbar
    toolbar: {
        backgroundColor: '#111', paddingHorizontal: 12, paddingVertical: 8,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        borderBottomWidth: 1, borderBottomColor: '#222',
    },
    toolbarHint: { color: '#666', fontSize: 10, flex: 1, marginRight: 8 },
    toolbarButtons: { flexDirection: 'row', gap: 6 },
    modeBtn: {
        paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    modeBtnText: { color: '#888', fontSize: 11, fontWeight: '600' },
    modeBtnTextActive: { color: 'white' },

    // Image area
    imageContainer: { flex: 1, backgroundColor: '#0a0a0a', overflow: 'hidden' },
    image: { width: '100%', height: '100%' },
    loader: { position: 'absolute', alignSelf: 'center', top: '40%', zIndex: 10 },

    // Grid
    gridLine: { position: 'absolute', backgroundColor: 'rgba(99,102,241,0.3)' },
    gridCentre: { position: 'absolute', width: 24, height: 24 },
    gridCentreH: { position: 'absolute', top: 11, left: 0, width: 24, height: 2, backgroundColor: 'rgba(99,102,241,0.6)' },
    gridCentreV: { position: 'absolute', top: 0, left: 11, width: 2, height: 24, backgroundColor: 'rgba(99,102,241,0.6)' },

    // Scanning
    scanOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center', alignItems: 'center', zIndex: 20,
    },
    scanText: { color: '#3b82f6', fontSize: 15, fontWeight: '700', marginTop: 16 },
    scanSubText: { color: '#666', fontSize: 12, marginTop: 6 },

    // Markers
    marker: {
        position: 'absolute', width: 36, height: 36, borderRadius: 18,
        borderWidth: 2.5, justifyContent: 'center', alignItems: 'center', zIndex: 10,
    },
    markerLabel: { color: 'white', fontSize: 8, fontWeight: 'bold' },

    // Controls
    controls: {
        paddingHorizontal: 16, paddingTop: 14, paddingBottom: 30,
        backgroundColor: '#111', borderTopWidth: 1, borderTopColor: '#222',
    },
    labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    imageLabel: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    labelDot: { width: 9, height: 9, borderRadius: 5 },
    sliderLabel: { color: '#888', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
    track: { height: 5, borderRadius: 3 },
    thumb: {
        width: 22, height: 22, backgroundColor: '#fff', borderRadius: 11,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4, shadowRadius: 4, elevation: 5,
    },
    resetRow: { flexDirection: 'row', gap: 6, marginTop: 12, flexWrap: 'wrap' },
    actionBtn: {
        paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
        backgroundColor: '#1e3a5f', borderWidth: 1, borderColor: '#3b82f6',
    },
    actionBtnText: { color: '#93c5fd', fontSize: 11, fontWeight: '700' },
    resetBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: '#1a1a1a' },
    resetBtnText: { color: '#888', fontSize: 11, fontWeight: '600' },

    // AI Summary bar
    summaryBar: {
        marginTop: 12, backgroundColor: '#1a1030',
        borderRadius: 10, padding: 12,
        borderWidth: 1, borderColor: '#7c3aed',
    },
    summaryText: { color: '#c4b5fd', fontSize: 12, lineHeight: 18 },
    summaryTap: { color: '#7c3aed', fontSize: 10, fontWeight: '800', marginTop: 6, letterSpacing: 1 },

    // Results Modal
    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'flex-end',
    },
    modalCard: {
        backgroundColor: '#1a1a2e', borderTopLeftRadius: 20, borderTopRightRadius: 20,
        maxHeight: '70%', paddingBottom: 30,
    },
    modalHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, paddingVertical: 16,
        borderBottomWidth: 1, borderBottomColor: '#333',
    },
    modalTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
    modalClose: { color: '#888', fontSize: 22, fontWeight: 'bold' },
    modalSummary: {
        color: '#c4b5fd', fontSize: 13, lineHeight: 20,
        paddingHorizontal: 20, paddingVertical: 12,
        backgroundColor: '#1a1030',
    },
    modalScroll: { paddingHorizontal: 20 },
    resultItem: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#222',
    },
    severityDot: { width: 12, height: 12, borderRadius: 6, flexShrink: 0 },
    resultLabel: { color: '#fff', fontSize: 13, fontWeight: '700' },
    resultDesc: { color: '#aaa', fontSize: 12, marginTop: 3, lineHeight: 18 },
    resultSeverity: { color: '#666', fontSize: 10, fontWeight: '700', marginTop: 4, letterSpacing: 1 },
    confirmBtn: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: '#333', justifyContent: 'center', alignItems: 'center',
        borderWidth: 2, borderColor: '#555',
    },
    confirmedBtn: { backgroundColor: '#166534', borderColor: '#22c55e' },
    confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    noResults: { color: '#555', fontSize: 13, textAlign: 'center', paddingVertical: 30 },
    modalDone: {
        marginHorizontal: 20, marginTop: 16,
        backgroundColor: '#7c3aed', paddingVertical: 14, borderRadius: 12, alignItems: 'center',
    },
    modalDoneText: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 1 },
});

export default PhotoComparisonScreen;
