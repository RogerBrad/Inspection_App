import React, { useState } from 'react';
import { StyleSheet, View, Image, Text, TouchableOpacity, ActivityIndicator, Pressable, Dimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Slider } from '@miblanchard/react-native-slider';

interface Marker {
    x: number;
    y: number;
}

const PhotoComparisonScreen = ({ route, navigation }: any) => {
    const { photoBefore, photoAfter, vehicleData } = route.params;
    const opacity = useSharedValue(0.5);
    const [loading, setLoading] = useState(true);
    const [markers, setMarkers] = useState<Marker[]>([]);
    const [isMarkingMode, setIsMarkingMode] = useState(false);
    const [isAlignMode, setIsAlignMode] = useState(false);
    const [containerSize, setContainerSize] = useState({ width: Dimensions.get('window').width, height: 400 });

    const onLayout = (event: any) => {
        const { width, height } = event.nativeEvent.layout;
        setContainerSize({ width, height });
    };

    // Alignment Shared Values (Relative to Base)
    const alignScale = useSharedValue(1);
    const savedAlignScale = useSharedValue(1);
    const alignX = useSharedValue(0);
    const savedAlignX = useSharedValue(0);
    const alignY = useSharedValue(0);
    const savedAlignY = useSharedValue(0);

    // Global Zoom Shared Values (Moving everything together)
    const globalScale = useSharedValue(1);
    const savedGlobalScale = useSharedValue(1);
    const globalX = useSharedValue(0);
    const savedGlobalX = useSharedValue(0);
    const globalY = useSharedValue(0);
    const savedGlobalY = useSharedValue(0);

    const globalStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: globalX.value },
            { translateY: globalY.value },
            { scale: globalScale.value },
        ],
    }));

    const overlayStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [
            { translateX: alignX.value },
            { translateY: alignY.value },
            { scale: alignScale.value },
        ],
    }));

    const baseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: 1 }],
    }));

    // Gestures
    const pinchGesture = Gesture.Pinch()
        .enabled(!isMarkingMode)
        .onUpdate((e) => {
            if (isAlignMode) {
                alignScale.value = savedAlignScale.value * e.scale;
            } else {
                globalScale.value = savedGlobalScale.value * e.scale;
            }
        })
        .onEnd(() => {
            if (isAlignMode) {
                savedAlignScale.value = alignScale.value;
            } else {
                savedGlobalScale.value = globalScale.value;
            }
        });

    const panGesture = Gesture.Pan()
        .enabled(!isMarkingMode)
        .onUpdate((e) => {
            if (isAlignMode) {
                alignX.value = savedAlignX.value + e.translationX;
                alignY.value = savedAlignY.value + e.translationY;
            } else {
                globalX.value = savedGlobalX.value + e.translationX;
                globalY.value = savedGlobalY.value + e.translationY;
            }
        })
        .onEnd(() => {
            if (isAlignMode) {
                savedAlignX.value = alignX.value;
                savedAlignY.value = alignY.value;
            } else {
                savedGlobalX.value = globalX.value;
                savedGlobalY.value = globalY.value;
            }
        });

    const combinedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

    const resetAlignment = () => {
        if (isAlignMode) {
            alignScale.value = withSpring(1);
            savedAlignScale.value = 1;
            alignX.value = withSpring(0);
            savedAlignX.value = 0;
            alignY.value = withSpring(0);
            savedAlignY.value = 0;
        } else {
            globalScale.value = withSpring(1);
            savedGlobalScale.value = 1;
            globalX.value = withSpring(0);
            savedGlobalX.value = 0;
            globalY.value = withSpring(0);
            savedGlobalY.value = 0;
        }
    };

    const handleTap = (event: any) => {
        if (!isMarkingMode) return;

        const { locationX, locationY } = event.nativeEvent;

        // Calculate the center of the container
        const centerX = containerSize.width / 2;
        const centerY = containerSize.height / 2;

        // Transform screen coordinates back to the global image space
        // x' = (x - centerX) * scale + centerX + translateX
        // x = (x' - centerX - translateX) / scale + centerX
        const x = (locationX - centerX - globalX.value) / globalScale.value + centerX;
        const y = (locationY - centerY - globalY.value) / globalScale.value + centerY;

        setMarkers([...markers, { x, y }]);
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backText}>✕</Text>
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>Damage Comparison</Text>
                    <Text style={styles.subtitle}>{vehicleData.vin}</Text>
                </View>
                <View style={{ flexDirection: 'row' }}>
                    <TouchableOpacity
                        style={[styles.toolButton, isAlignMode && styles.toolButtonActive]}
                        onPress={() => {
                            setIsAlignMode(!isAlignMode);
                            setIsMarkingMode(false);
                        }}
                    >
                        <Text style={[styles.toolText, isAlignMode && styles.toolTextActive]}>
                            {isAlignMode ? 'Done' : 'Align'}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.toolButton, isMarkingMode && styles.toolButtonActive]}
                        onPress={() => {
                            setIsMarkingMode(!isMarkingMode);
                            setIsAlignMode(false);
                        }}
                    >
                        <Text style={[styles.toolText, isMarkingMode && styles.toolTextActive]}>
                            {isMarkingMode ? 'Done' : 'Mark'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            <GestureHandlerRootView style={{ flex: 1 }}>
                <GestureDetector gesture={combinedGesture}>
                    <Pressable
                        style={styles.imageContainer}
                        onPress={handleTap}
                        onLayout={onLayout}
                    >
                        {loading && (
                            <ActivityIndicator size="large" color="#007bff" style={styles.loader} />
                        )}

                        {/* Global Transform Wrapper */}
                        <Animated.View style={[{ width: '100%', height: '100%' }, globalStyle]}>
                            {/* Earlier Photo (Base) */}
                            <Animated.Image
                                source={{ uri: photoBefore }}
                                style={[styles.image, baseStyle]}
                                onLoadEnd={() => setLoading(false)}
                            />

                            {/* Current Photo (Overlay) */}
                            <Animated.Image
                                source={{ uri: photoAfter }}
                                style={[styles.image, styles.overlay, overlayStyle]}
                            />

                            {/* Render Markers (Anchored to the global transformation) */}
                            {markers.map((marker, index) => (
                                <View
                                    key={index}
                                    style={[
                                        styles.marker,
                                        {
                                            left: marker.x - 15,
                                            top: marker.y - 15,
                                        }
                                    ]}
                                >
                                    <View style={styles.markerInner} />
                                </View>
                            ))}
                        </Animated.View>

                        {/* Touch Interceptor specifically for marking */}
                        {isMarkingMode && <View style={styles.touchTarget} />}
                    </Pressable>
                </GestureDetector>
            </GestureHandlerRootView>

            <View style={styles.controls}>
                {isMarkingMode ? (
                    <View style={styles.markingControls}>
                        <Text style={styles.markingHint}>Tap on the image to mark defects</Text>
                        <TouchableOpacity style={styles.clearButton} onPress={() => setMarkers([])}>
                            <Text style={styles.clearButtonText}>Clear Markers ({markers.length})</Text>
                        </TouchableOpacity>
                    </View>
                ) : isAlignMode ? (
                    <View style={styles.markingControls}>
                        <Text style={styles.markingHint}>Pinch to Zoom & Drag to Align Present with Past</Text>
                        <TouchableOpacity style={styles.clearButton} onPress={resetAlignment}>
                            <Text style={styles.clearButtonText}>Reset Alignment</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        <View style={styles.labelRow}>
                            <Text style={styles.sliderLabel}>Past</Text>
                            <Text style={styles.sliderLabel}>Present</Text>
                        </View>
                        <Slider
                            value={0.5}
                            onValueChange={(val: any) => (opacity.value = val[0])}
                            minimumValue={0}
                            maximumValue={1}
                            trackStyle={styles.track}
                            thumbStyle={styles.thumb}
                            minimumTrackTintColor="#007bff"
                        />
                        <Text style={styles.hint}>Pinch to Zoom / Slide to reveal differences</Text>
                        <TouchableOpacity
                            style={[styles.clearButton, { alignSelf: 'center', marginTop: 10 }]}
                            onPress={resetAlignment}
                        >
                            <Text style={styles.clearButtonText}>Reset Zoom</Text>
                        </TouchableOpacity>
                    </>
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
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 10,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    backText: {
        color: 'white',
        fontSize: 20,
        fontWeight: 'bold',
    },
    toolButton: {
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginLeft: 10,
    },
    toolButtonActive: {
        backgroundColor: '#e74c3c', // Red when active
    },
    toolText: {
        color: 'white',
        fontWeight: '600',
    },
    toolTextActive: {
        color: 'white',
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: 'white',
    },
    subtitle: {
        fontSize: 12,
        color: '#aaa',
    },
    imageContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#111',
        overflow: 'hidden',
    },
    image: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    overlay: {
        position: 'absolute',
    },
    touchTarget: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 5,
    },
    marker: {
        position: 'absolute',
        width: 30,
        height: 30,
        borderRadius: 15,
        borderWidth: 2,
        borderColor: 'red',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
        backgroundColor: 'rgba(255, 0, 0, 0.2)',
    },
    markerInner: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: 'red',
    },
    loader: {
        position: 'absolute',
        zIndex: 1,
    },
    controls: {
        padding: 30,
        paddingBottom: 50,
        backgroundColor: '#1a1a1a',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
    },
    markingControls: {
        alignItems: 'center',
        paddingVertical: 10,
    },
    markingHint: {
        color: '#aaa',
        marginBottom: 15,
    },
    clearButton: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: '#333',
    },
    clearButtonText: {
        color: 'white',
        fontWeight: 'bold',
    },
    labelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    sliderLabel: {
        color: '#888',
        fontSize: 12,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    track: {
        height: 8,
        borderRadius: 4,
    },
    thumb: {
        width: 24,
        height: 24,
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
    },
    hint: {
        textAlign: 'center',
        color: '#555',
        fontSize: 12,
        marginTop: 15,
    }
});

export default PhotoComparisonScreen;
