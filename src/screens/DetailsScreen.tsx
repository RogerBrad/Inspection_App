import React, { useEffect, useState, useMemo, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator, Alert, TextInput, Image, Modal, Pressable } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { photoService, VehiclePhoto } from '../services/photoService';
import { inspectionService, InspectionConfig, InspectionType } from '../services/inspectionService';
import { rentalAgreementService } from '../services/rentalAgreementService';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';

const DetailsScreen = ({ route, navigation }: any) => {
    const { data, assetCategory = 'motor_vehicle', agreement } = route.params;

    // UI State
    const [config, setConfig] = useState<InspectionConfig | null>(null);
    const [selectedType, setSelectedType] = useState<InspectionType | null>(null);
    const [subItemStatus, setSubItemStatus] = useState<{ [key: string]: 'pass' | 'fail' | null }>({});
    const [comments, setComments] = useState<{ [key: string]: string }>({});
    const [failPhotos, setFailPhotos] = useState<{ [key: string]: boolean }>({});
    const [historyPhotos, setHistoryPhotos] = useState<{ [key: string]: VehiclePhoto | null }>({});
    const [viewerUrl, setViewerUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [odometer, setOdometer] = useState('');
    const [isAtBottom, setIsAtBottom] = useState(false);
    const [globalFontScale, setGlobalFontScale] = useState(1);
    const isFocused = useIsFocused();

    const startScale = useRef(1);
    const screenPinchGesture = Gesture.Pinch()
        .enabled(!viewerUrl)
        .onStart(() => {
            startScale.current = globalFontScale;
        })
        .onUpdate((e) => {
            const newScale = startScale.current * e.scale;
            // Limit scale between 0.6x and 2.0x
            const clampedScale = Math.max(0.6, Math.min(2.0, newScale));
            setGlobalFontScale(clampedScale);
        })
        .runOnJS(true);

    const styles = useMemo(() => getStyles(globalFontScale), [globalFontScale]);

    // Zoom and Pan for Single Photo Viewer
    const scale = useSharedValue(1);
    const savedScale = useSharedValue(1);
    const translateX = useSharedValue(0);
    const savedTranslateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const savedTranslateY = useSharedValue(0);

    const imageAnimatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { scale: scale.value },
        ],
    }));

    const pinchGesture = Gesture.Pinch()
        .onUpdate((e) => {
            scale.value = savedScale.value * e.scale;
        })
        .onEnd(() => {
            savedScale.value = scale.value;
        });

    const panGesture = Gesture.Pan()
        .onUpdate((e) => {
            translateX.value = savedTranslateX.value + e.translationX;
            translateY.value = savedTranslateY.value + e.translationY;
        })
        .onEnd(() => {
            savedTranslateX.value = translateX.value;
            savedTranslateY.value = translateY.value;
        });

    const combinedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

    const resetViewerAlignment = () => {
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        savedTranslateX.value = 0;
        translateY.value = withSpring(0);
        savedTranslateY.value = 0;
    };

    const closeViewer = () => {
        setViewerUrl(null);
        resetViewerAlignment();
    };

    // Parsing Logic
    const cleanData = (data || '').trim();
    const isVehicle = assetCategory === 'motor_vehicle';
    const segments = isVehicle ? cleanData.split('%').filter((s: string) => s !== '') : [];

    // Intelligent VIN Extraction (Standard VIN is 17 chars)
    let extractedVin = '';
    if (isVehicle) {
        // Look for the first 17-character alphanumeric segment
        const vinCandidate = segments.find((s: string) => s.length === 17);
        extractedVin = vinCandidate || segments[9] || segments[0] || 'UNKNOWN';
    } else {
        extractedVin = cleanData;
    }

    const vin = extractedVin.trim();
    const registrationNumber = isVehicle ? (segments[5] || 'N/A').trim() : 'N/A';
    const assetTitle = isVehicle ? (segments[7] || 'Vehicle').trim() : 'Refrigeration Unit';

    const refreshPhotos = async () => {
        if (!vin) return;
        try {
            const allPhotos = await photoService.getPhotosByVehicle(vin);
            const historyMap: any = {};
            allPhotos.forEach(p => {
                if (!historyMap[p.angle]) {
                    historyMap[p.angle] = p;
                }
            });
            setHistoryPhotos(historyMap);
        } catch (error) {
            console.error("Refresh failed:", error);
        }
    };

    useEffect(() => {
        async function initialize() {
            setLoading(true);
            console.log(`[Details] Initializing for asset: ${vin}, Category: ${assetCategory}`);
            
            try {
                // 1. Try to fetch primary config
                console.log(`[Details] Fetching primary config: ${assetCategory}...`);
                let configData = await inspectionService.getConfigByCategory(assetCategory);
                
                // 2. Try secondary category if primary failed
                if (!configData) {
                    const backupCat = assetCategory === 'motor_vehicle' ? 'refrigeration' : 'motor_vehicle';
                    console.log(`[Details] Primary empty, trying backup: ${backupCat}...`);
                    configData = await inspectionService.getConfigByCategory(backupCat);
                }

                // 3. Last ditch effort: static fallback from code
                if (!configData) {
                    console.log(`[Details] All DB attempts failed. Using static emergency fallback.`);
                    configData = inspectionService.getStaticFallbackConfig(assetCategory);
                }

                if (!configData) {
                    throw new Error("Generic failure to generate inspection checklist.");
                }

                console.log(`[Details] Config ready:`, configData.inspectionTypes.map(t => t.label));
                setConfig(configData);

                if (configData.inspectionTypes.length > 0) {
                    setSelectedType(configData.inspectionTypes[0]);
                }

                // 4. Load Photo History (Non-critical, don't throw if it fails)
                try {
                    await refreshPhotos();
                } catch (pe) {
                    console.warn("[Details] Photo history failed to load:", pe);
                }

            } catch (error: any) {
                console.error("[Details] Initialization FAILED:", error);
                Alert.alert(
                    "Note", 
                    "Using local inspection templates (Offline Mode). Some historical data might be unavailable."
                );
                // Force a local fallback if we haven't already
                const emergencyConfig = inspectionService.getStaticFallbackConfig(assetCategory);
                setConfig(emergencyConfig);
                if (emergencyConfig.inspectionTypes.length > 0) {
                    setSelectedType(emergencyConfig.inspectionTypes[0]);
                }
            } finally {
                setLoading(false);
            }
        }
        initialize();
    }, [vin, assetCategory]);

    useEffect(() => {
        if (isFocused) {
            refreshPhotos();
        }
    }, [isFocused]);

    const handleCompare = async (angle: string) => {
        try {
            const allPhotos = await photoService.getPhotosByVehicle(vin);
            const areaPhotos = allPhotos.filter(p => p.angle === angle);

            if (areaPhotos.length < 1) {
                Alert.alert("No History", "You need at least one photo to compare.");
                return;
            }

            const photoNow = areaPhotos[0];
            const photoThen = areaPhotos.length > 1 ? areaPhotos[1] : areaPhotos[0];

            navigation.navigate('PhotoComparison', {
                photoBefore: photoThen.photoUrl,
                photoAfter: photoNow.photoUrl,
                vehicleData: { vin, registrationNumber, angle }
            });
        } catch (error) {
            Alert.alert("Error", "Could not load comparison history.");
        }
    };

    const setStatus = (itemLabel: string, subItemLabel: string, status: 'pass' | 'fail') => {
        const key = `${itemLabel}_${subItemLabel}`;
        setSubItemStatus(prev => ({
            ...prev,
            [key]: prev[key] === status ? null : status
        }));
    };

    const updateComment = (key: string, text: string) => {
        setComments(prev => ({ ...prev, [key]: text }));
    };

    const toggleFailPhoto = (key: string) => {
        setFailPhotos(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSaveInspection = async () => {
        if (!selectedType) return;

        // Calculate counts for confirmation
        let passCount = 0;
        let failCount = 0;
        selectedType.items.forEach(mainItem => {
            mainItem.subItems.forEach(sub => {
                const key = `${mainItem.label}_${sub}`;
                const status = subItemStatus[key];
                if (status === 'pass') passCount++;
                if (status === 'fail') failCount++;
            });
        });

        const totalItems = selectedType.items.reduce((acc, item) => acc + item.subItems.length, 0);
        const completedItems = passCount + failCount;

        if (completedItems === 0) {
            Alert.alert("Incomplete", "Please complete at least one inspection item.");
            return;
        }

        // Require odometer for vehicle inspections
        if (isVehicle && !odometer) {
            Alert.alert("Odometer Required", "Please enter the odometer reading before saving.");
            return;
        }

        Alert.alert(
            "Finish & Save?",
            `Summary of Inspection:\n\n` +
            `✅ Passed: ${passCount}\n` +
            `⚠️ Failed: ${failCount}\n` +
            `Total Items: ${completedItems} / ${totalItems}\n\n` +
            `Are you sure you have completed the inspection items?`,
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Save & Submit", 
                    onPress: () => performSave(passCount, failCount)
                }
            ]
        );
    };

    const performSave = async (passCount: number, failCount: number) => {
        if (!selectedType) return;

        setIsSaving(true);
        try {
            const results: any[] = [];
            
            // Re-capture results for the save payload
            selectedType.items.forEach(mainItem => {
                mainItem.subItems.forEach(sub => {
                    const key = `${mainItem.label}_${sub}`;
                    const status = subItemStatus[key];

                    if (status) {
                        results.push({
                            label: sub,
                            parentItem: mainItem.label,
                            status: status,
                            comment: comments[key] || ''
                        });
                    }
                });
            });

            // Determine overall pass/fail
            const overallPassed = failCount === 0;
            const inspectionNotes = `${passCount} items passed, ${failCount} items failed. ${selectedType.label} completed via mobile app.`;

            // Build inspection record (only include odometer if it has a value)
            const inspectionRecord: any = {
                assetId: vin,
                assetCategory: assetCategory,
                inspectionTypeId: selectedType.id,
                inspectionTypeLabel: selectedType.label,
                results: results,
                summary: { passCount, failCount }
            };

            // Only add odometer if it's a vehicle AND has a value
            if (isVehicle && odometer) {
                inspectionRecord.odometer = odometer;
            }

            // Save to Supabase (inspection history)
            await inspectionService.saveInspection(inspectionRecord);

            // Update Rental Agreement Workflow (if agreement exists)
            let updateResult;
            if (agreement && agreement.id) {
                updateResult = await rentalAgreementService.updateInspectionResult(
                    agreement.id,
                    overallPassed,
                    inspectionNotes,
                    results
                );

                if (!updateResult.success) {
                    console.error('Failed to update workflow:', updateResult.error);
                    Alert.alert(
                        "Warning",
                        "Inspection saved locally, but failed to update the main system. Please contact support.",
                        [{ text: "OK", onPress: () => navigation.navigate('Scanner') }]
                    );
                    return;
                }
            }

            // Show success confirmation
            if (updateResult?.offline) {
                Alert.alert(
                    "Saved Offline",
                    "You are offline. The inspection has been saved locally and will be synced when you are back online.",
                    [{ text: "OK", onPress: () => navigation.navigate('InspectionList') }]
                );
            } else {
                Alert.alert(
                    overallPassed ? "✅ Inspection Passed" : "⚠️ Inspection Failed",
                    agreement
                        ? `The inspection has been completed and the database has been updated.\n\n` +
                        `Result: ${overallPassed ? 'PASSED' : 'FAILED'}\n` +
                        `${passCount} items passed\n` +
                        `${failCount} items failed\n\n` +
                        `The office will be notified of this ${overallPassed ? 'successful' : 'failed'} inspection.`
                        : `Inspection saved successfully.\n\n` +
                        `Result: ${overallPassed ? 'PASSED' : 'FAILED'}\n` +
                        `${passCount} items passed\n` +
                        `${failCount} items failed`,
                    [
                        { text: "OK", onPress: () => navigation.navigate('InspectionList') }
                    ]
                );
            }
        } catch (error) {
            console.error("Save failed:", error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            Alert.alert(
                "Error",
                `Could not save inspection. ${errorMessage}\n\nPlease try again or contact support if the problem persists.`
            );
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) return (
        <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loadingText}>Loading Configuration...</Text>
        </View>
    );

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <GestureDetector gesture={screenPinchGesture}>
                <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#fff" />

            {/* Header Area */}
            <View style={styles.header}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.categoryLabel}>{isVehicle ? 'MOTOR VEHICLE' : 'REFRIGERATION UNIT'}</Text>
                    <View style={styles.titleRow}>
                        <Text style={styles.title}>{assetTitle}</Text>
                        <TouchableOpacity
                            style={styles.historyNavBtn}
                            onPress={() => navigation.navigate('History', { assetId: vin, assetCategory })}
                        >
                            <Text style={styles.historyNavBtnText}>📜 History</Text>
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.identifierText}>{isVehicle ? `VIN: ${vin}` : `Serial: ${data}`}</Text>
                </View>
                {isVehicle && <Text style={styles.regBadge}>{registrationNumber}</Text>}
            </View>

            <ScrollView 
                showsVerticalScrollIndicator={false}
                onScroll={(e) => {
                    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
                    const paddingToBottom = 100; // Trigger slightly before the very end
                    const atBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
                    if (atBottom !== isAtBottom) {
                        setIsAtBottom(atBottom);
                    }
                }}
                scrollEventThrottle={16}
            >
                {/* 1. Inspection Type Selector */}
                <View style={styles.tabsContainer}>
                    <Text style={styles.sectionTitle}>Select Inspection Type</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
                        {config?.inspectionTypes.map((type) => (
                            <TouchableOpacity
                                key={type.id}
                                style={[styles.tab, selectedType?.id === type.id && styles.activeTab]}
                                onPress={() => {
                                    setSelectedType(type);
                                    setSubItemStatus({}); // Reset statuses when changing type
                                }}
                            >
                                <Text style={[styles.tabText, selectedType?.id === type.id && styles.activeTabText]}>
                                    {type.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* 2. Inspection Items (Expanded with Sub-items and Radio Buttons) */}
                {selectedType && (
                    <View style={styles.itemsSection}>
                        <Text style={styles.sectionTitle}>Inspection Checklist</Text>
                        <View style={styles.checklistGrid}>
                            {selectedType.items.map((item, idx) => (
                                <View key={`item-${idx}`} style={styles.mainItemContainer}>
                                    <View style={styles.mainItemHeader}>
                                        <Text style={styles.mainItemLabel}>{item.label}</Text>
                                    </View>

                                    <View style={styles.subItemsList}>
                                        {item.subItems.map((sub, subIdx) => {
                                            const key = `${item.label}_${sub}`;
                                            const status = subItemStatus[key];
                                            const comment = comments[key] || '';
                                            const needsPhoto = failPhotos[key] || false;
                                            const defectAngle = `DEFECT_${sub.replace(/[\s\/]+/g, '_')}`;
                                            const defectPhoto = historyPhotos[defectAngle];

                                            return (
                                                <View key={`sub-${subIdx}`} style={styles.subItemWrapper}>
                                                    <View style={styles.subItemRow}>
                                                        <Text style={styles.subItemText}>{sub}</Text>
                                                        <View style={styles.radioGroup}>
                                                            <TouchableOpacity
                                                                style={[
                                                                    styles.radioButton,
                                                                    styles.passButton,
                                                                    status === 'pass' && styles.passActive
                                                                ]}
                                                                onPress={() => setStatus(item.label, sub, 'pass')}
                                                            >
                                                                <Text style={[styles.radioText, status === 'pass' && styles.radioTextActive]}>PASS</Text>
                                                            </TouchableOpacity>

                                                            <TouchableOpacity
                                                                style={[
                                                                    styles.radioButton,
                                                                    styles.failButton,
                                                                    status === 'fail' && styles.failActive
                                                                ]}
                                                                onPress={() => setStatus(item.label, sub, 'fail')}
                                                            >
                                                                <Text style={[styles.radioText, status === 'fail' && styles.radioTextActive]}>FAIL</Text>
                                                            </TouchableOpacity>
                                                        </View>
                                                    </View>

                                                    {status === 'fail' && (
                                                        <View style={styles.failActionContainer}>
                                                            <TextInput
                                                                style={styles.commentInput}
                                                                placeholder="Describe the problem..."
                                                                placeholderTextColor="#94a3b8"
                                                                value={comment}
                                                                onChangeText={(text) => updateComment(key, text)}
                                                                multiline
                                                            />

                                                            <View style={styles.failPhotoRow}>
                                                                <TouchableOpacity
                                                                    style={[styles.photoToggle, needsPhoto && styles.photoToggleActive]}
                                                                    onPress={() => toggleFailPhoto(key)}
                                                                >
                                                                    <View style={[styles.photoCheckbox, needsPhoto && styles.photoCheckboxActive]}>
                                                                        {needsPhoto && <Text style={styles.checkMarkSmall}>✓</Text>}
                                                                    </View>
                                                                    <Text style={[styles.photoToggleText, needsPhoto && styles.photoToggleTextActive]}>
                                                                        Evidence photo
                                                                    </Text>
                                                                </TouchableOpacity>

                                                                <View style={styles.failActionButtons}>
                                                                    {needsPhoto && (
                                                                        <TouchableOpacity
                                                                            style={styles.captureDefectBtn}
                                                                            onPress={() => navigation.navigate('InspectionCamera', {
                                                                                 vin,
                                                                                 registrationNumber,
                                                                                 angle: defectAngle,
                                                                                 category: assetCategory
                                                                             })}
                                                                        >
                                                                            <Text style={styles.captureDefectBtnText}>📸 Capture</Text>
                                                                        </TouchableOpacity>
                                                                    )}

                                                                    {defectPhoto && (
                                                                        <TouchableOpacity
                                                                            style={styles.viewDefectBtn}
                                                                            onPress={() => setViewerUrl(defectPhoto.photoUrl)}
                                                                        >
                                                                            <Text style={styles.viewDefectBtnText}>👁️ View</Text>
                                                                        </TouchableOpacity>
                                                                    )}
                                                                </View>
                                                            </View>
                                                        </View>
                                                    )}
                                                </View>
                                            );
                                        })}
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* 3. Inspection Areas (The "Areas held in DB" requirement) */}
                <View style={styles.areasSection}>
                    <Text style={styles.sectionTitle}>Photographic Audit</Text>
                    <View style={styles.angleGrid}>
                        {config?.areas.map((area) => (
                            <View key={area} style={styles.angleCard}>
                                <View style={styles.angleHeader}>
                                    <Text style={styles.angleLabel}>{area.toUpperCase()}</Text>
                                    {historyPhotos[area] && <View style={styles.historyDot} />}
                                </View>

                                <TouchableOpacity
                                    style={styles.angleCaptureBtn}
                                    onPress={() => navigation.navigate('InspectionCamera', { vin, registrationNumber, angle: area, category: assetCategory })}
                                >
                                    <Text style={styles.btnTextLower}>📸 Capture</Text>
                                </TouchableOpacity>

                                {historyPhotos[area] && (
                                    <TouchableOpacity
                                        style={styles.angleCompareBtn}
                                        onPress={() => handleCompare(area)}
                                    >
                                        <Text style={styles.compareBtnTextSmall}>🔍 Compare</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        ))}
                    </View>
                </View>

                {/* 4. Odometer Reading (Motor Vehicle Only) */}
                {isVehicle && (
                    <View style={styles.odometerSection}>
                        <Text style={styles.sectionTitle}>Final Details</Text>
                        <View style={styles.odometerCard}>
                            <Text style={styles.odoLabel}>ODOMETER READING</Text>
                            <View style={styles.odoInputRow}>
                                <TextInput
                                    style={styles.odoInput}
                                    placeholder="Enter mileage..."
                                    placeholderTextColor="#94a3b8"
                                    value={odometer}
                                    onChangeText={setOdometer}
                                    keyboardType="numeric"
                                />
                                <TouchableOpacity
                                    style={styles.odoScanBtn}
                                    onPress={() => navigation.navigate('OdometerScan', { onScan: (val: string) => setOdometer(val) })}
                                >
                                    <Text style={styles.odoScanBtnText}>📸 SCAN</Text>
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.odoHint}>Use the camera to automatically read the numbers from the dashboard.</Text>
                        </View>
                    </View>
                )}

                {/* Footer Padding */}
                <View style={{ height: 100 }} />
            </ScrollView>

            {isAtBottom && (
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.mainButton, isSaving && { opacity: 0.7 }]}
                        onPress={handleSaveInspection}
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.mainButtonText}>Finish & Save Inspection</Text>
                        )}
                    </TouchableOpacity>
                </View>
            )}

            {/* Photo Viewer Modal */}
            <Modal
                visible={!!viewerUrl}
                transparent={true}
                onRequestClose={closeViewer}
                animationType="fade"
            >
                <GestureHandlerRootView style={{ flex: 1 }}>
                    <Pressable
                        style={styles.modalOverlay}
                        onPress={closeViewer}
                    >
                        <View style={styles.modalContent}>
                            <GestureDetector gesture={combinedGesture}>
                                <Animated.Image
                                    source={{ uri: viewerUrl || '' }}
                                    style={[styles.fullImage, imageAnimatedStyle]}
                                    resizeMode="contain"
                                />
                            </GestureDetector>
                            <TouchableOpacity
                                style={styles.closeModalBtn}
                                onPress={closeViewer}
                            >
                                <Text style={styles.closeModalBtnText}>CLOSE</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </GestureHandlerRootView>
            </Modal>
                </View>
            </GestureDetector>
        </GestureHandlerRootView>
    );
};

const getStyles = (fs: number) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    loadingText: {
        marginTop: 15,
        fontSize: 16 * fs,
        color: '#64748b',
        fontWeight: '500',
    },
    header: {
        paddingTop: 60,
        paddingHorizontal: 25,
        paddingBottom: 25,
        backgroundColor: '#fff',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    categoryLabel: {
        fontSize: 10 * fs,
        fontWeight: '900',
        color: '#3b82f6',
        letterSpacing: 1.5,
        marginBottom: 8,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    title: {
        flex: 1,
        fontSize: 24 * fs,
        fontWeight: '800',
        color: '#0f172a',
    },
    historyNavBtn: {
        backgroundColor: '#eff6ff',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#3b82f6',
        marginLeft: 10,
    },
    historyNavBtnText: {
        fontSize: 12 * fs,
        fontWeight: '800',
        color: '#3b82f6',
    },
    identifierText: {
        fontSize: 14 * fs,
        color: '#64748b',
        fontFamily: 'monospace',
    },
    regBadge: {
        backgroundColor: '#fef3c7',
        color: '#92400e',
        fontSize: 14 * fs,
        fontWeight: '800',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#fde68a',
    },
    sectionTitle: {
        fontSize: 14 * fs,
        fontWeight: '700',
        color: '#475569',
        marginBottom: 16,
        paddingHorizontal: 25,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    tabsContainer: {
        marginTop: 25,
    },
    tabScroll: {
        paddingLeft: 20,
    },
    tab: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 25,
        backgroundColor: '#fff',
        marginRight: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    activeTab: {
        backgroundColor: '#0f172a',
        borderColor: '#0f172a',
    },
    tabText: {
        fontSize: 14 * fs,
        fontWeight: '600',
        color: '#64748b',
    },
    activeTabText: {
        color: '#fff',
    },
    itemsSection: {
        marginTop: 35,
    },
    checklistGrid: {
        paddingHorizontal: 20,
    },
    mainItemContainer: {
        backgroundColor: '#fff',
        borderRadius: 20,
        marginBottom: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
    },
    mainItemHeader: {
        backgroundColor: '#f8fafc',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    mainItemLabel: {
        fontSize: 15 * fs,
        fontWeight: '800',
        color: '#334155',
        letterSpacing: 0.5,
    },
    subItemsList: {
        padding: 5,
    },
    subItemWrapper: {
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    subItemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 15,
    },
    failActionContainer: {
        paddingHorizontal: 15,
        paddingBottom: 15,
        backgroundColor: '#fff1f2',
    },
    commentInput: {
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 12,
        fontSize: 14 * fs,
        color: '#1e293b',
        borderWidth: 1,
        borderColor: '#fecaca',
        minHeight: 60,
        textAlignVertical: 'top',
        marginBottom: 12,
    },
    failPhotoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    failActionButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    photoToggle: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    photoToggleActive: {
        // Active container style if needed
    },
    photoCheckbox: {
        width: 18,
        height: 18,
        borderRadius: 4,
        borderWidth: 2,
        borderColor: '#fca5a5',
        marginRight: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    photoCheckboxActive: {
        backgroundColor: '#ef4444',
        borderColor: '#ef4444',
    },
    checkMarkSmall: {
        color: '#fff',
        fontSize: 10 * fs,
        fontWeight: 'bold',
    },
    photoToggleText: {
        fontSize: 12 * fs,
        color: '#94a3b8',
        fontWeight: '600',
    },
    photoToggleTextActive: {
        color: '#ef4444',
    },
    captureDefectBtn: {
        backgroundColor: '#ef4444',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 8,
    },
    captureDefectBtnText: {
        color: '#fff',
        fontSize: 12 * fs,
        fontWeight: '700',
    },
    viewDefectBtn: {
        backgroundColor: '#3b82f6',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 8,
    },
    viewDefectBtnText: {
        color: '#fff',
        fontSize: 12 * fs,
        fontWeight: '700',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.9)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    fullImage: {
        width: '90%',
        height: '70%',
        borderRadius: 15,
    },
    closeModalBtn: {
        marginTop: 30,
        backgroundColor: '#fff',
        paddingHorizontal: 30,
        paddingVertical: 12,
        borderRadius: 25,
    },
    closeModalBtnText: {
        color: '#000',
        fontWeight: '900',
        fontSize: 14 * fs,
    },
    subItemText: {
        flex: 1,
        fontSize: 14 * fs,
        color: '#475569',
        fontWeight: '500',
    },
    radioGroup: {
        flexDirection: 'row',
        gap: 8,
    },
    radioButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        backgroundColor: '#fff',
    },
    radioText: {
        fontSize: 10 * fs,
        fontWeight: '900',
        color: '#94a3b8',
    },
    passButton: {
        borderColor: '#e2e8f0',
    },
    failButton: {
        borderColor: '#e2e8f0',
    },
    passActive: {
        backgroundColor: '#dcfce7',
        borderColor: '#22c55e',
    },
    failActive: {
        backgroundColor: '#fee2e2',
        borderColor: '#ef4444',
    },
    radioTextActive: {
        color: '#0f172a',
    },
    areasSection: {
        marginTop: 35,
    },
    angleGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        gap: 12,
    },
    angleCard: {
        width: '48%',
        backgroundColor: '#fff',
        borderRadius: 15,
        padding: 15,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    angleHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    angleLabel: {
        fontSize: 11 * fs,
        fontWeight: '800',
        color: '#64748b',
    },
    historyDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#3b82f6',
    },
    angleCaptureBtn: {
        backgroundColor: '#0f172a',
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: 'center',
        marginBottom: 8,
    },
    angleCompareBtn: {
        backgroundColor: '#eff6ff',
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#3b82f6',
    },
    btnTextLower: {
        color: '#fff',
        fontSize: 12 * fs,
        fontWeight: '700',
    },
    compareBtnTextSmall: {
        color: '#3b82f6',
        fontSize: 12 * fs,
        fontWeight: '700',
    },
    footer: {
        padding: 20,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    mainButton: {
        backgroundColor: '#3b82f6',
        paddingVertical: 18,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
    },
    mainButtonText: {
        color: '#fff',
        fontSize: 16 * fs,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    odometerSection: {
        marginTop: 35,
    },
    odometerCard: {
        backgroundColor: '#fff',
        marginHorizontal: 20,
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        elevation: 2,
    },
    odoLabel: {
        fontSize: 10 * fs,
        fontWeight: '900',
        color: '#64748b',
        marginBottom: 12,
        letterSpacing: 1,
    },
    odoInputRow: {
        flexDirection: 'row',
        gap: 12,
        alignItems: 'center',
    },
    odoInput: {
        flex: 1,
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 15,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        fontSize: 20 * fs,
        fontWeight: '700',
        color: '#0f172a',
    },
    odoScanBtn: {
        backgroundColor: '#0f172a',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderRadius: 12,
    },
    odoScanBtnText: {
        color: '#fff',
        fontWeight: '800',
        fontSize: 12 * fs,
    },
    odoHint: {
        fontSize: 12 * fs,
        color: '#94a3b8',
        marginTop: 12,
        fontStyle: 'italic',
    },
});

export default DetailsScreen;
