import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator, Alert, TextInput, Image, Modal, Pressable } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { photoService, VehiclePhoto } from '../services/photoService';
import { inspectionService, InspectionConfig, InspectionType } from '../services/inspectionService';

const DetailsScreen = ({ route, navigation }: any) => {
    const { data, assetCategory = 'motor_vehicle' } = route.params;

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
    const isFocused = useIsFocused();

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
            try {
                // 1. Load Config from Firestore
                const configData = await inspectionService.getConfigByCategory(assetCategory);
                setConfig(configData);

                if (configData && configData.inspectionTypes.length > 0) {
                    setSelectedType(configData.inspectionTypes[0]);
                }

                // 2. Load Photo History
                await refreshPhotos();
            } catch (error) {
                console.error("Initialization failed:", error);
                Alert.alert("Error", "Could not load inspection details.");
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

        setIsSaving(true);
        try {
            const results: any[] = [];
            let passCount = 0;
            let failCount = 0;

            // Iterate through the actual items from the selected config to capture results
            selectedType.items.forEach(mainItem => {
                mainItem.subItems.forEach(sub => {
                    const key = `${mainItem.label}_${sub}`;
                    const status = subItemStatus[key];

                    if (status === 'pass') passCount++;
                    if (status === 'fail') failCount++;

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

            if (results.length === 0) {
                Alert.alert("Incomplete", "Please complete at least one inspection item.");
                setIsSaving(false);
                return;
            }

            await inspectionService.saveInspection({
                assetId: vin,
                assetCategory: assetCategory,
                inspectionTypeId: selectedType.id,
                inspectionTypeLabel: selectedType.label,
                results: results,
                odometer: isVehicle ? odometer : undefined,
                summary: { passCount, failCount }
            });

            Alert.alert("Success", "Inspection saved successfully.", [
                { text: "OK", onPress: () => navigation.navigate('Scanner') }
            ]);
        } catch (error) {
            console.error("Save failed:", error);
            Alert.alert("Error", "Could not save inspection.");
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

            <ScrollView showsVerticalScrollIndicator={false}>
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
                                            const defectAngle = `DEFECT_${sub.replace(/\s+/g, '_')}`;
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
                                                                                angle: defectAngle
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
                                    onPress={() => navigation.navigate('InspectionCamera', { vin, registrationNumber, angle: area })}
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

            {/* Photo Viewer Modal */}
            <Modal
                visible={!!viewerUrl}
                transparent={true}
                onRequestClose={() => setViewerUrl(null)}
                animationType="fade"
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={() => setViewerUrl(null)}
                >
                    <View style={styles.modalContent}>
                        <Image
                            source={{ uri: viewerUrl || '' }}
                            style={styles.fullImage}
                            resizeMode="contain"
                        />
                        <TouchableOpacity
                            style={styles.closeModalBtn}
                            onPress={() => setViewerUrl(null)}
                        >
                            <Text style={styles.closeModalBtnText}>CLOSE</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
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
        fontSize: 16,
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
        fontSize: 10,
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
        fontSize: 24,
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
        fontSize: 12,
        fontWeight: '800',
        color: '#3b82f6',
    },
    identifierText: {
        fontSize: 14,
        color: '#64748b',
        fontFamily: 'monospace',
    },
    regBadge: {
        backgroundColor: '#fef3c7',
        color: '#92400e',
        fontSize: 14,
        fontWeight: '800',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#fde68a',
    },
    sectionTitle: {
        fontSize: 14,
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
        fontSize: 14,
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
        fontSize: 15,
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
        fontSize: 14,
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
        fontSize: 10,
        fontWeight: 'bold',
    },
    photoToggleText: {
        fontSize: 12,
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
        fontSize: 12,
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
        fontSize: 12,
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
        fontSize: 14,
    },
    subItemText: {
        flex: 1,
        fontSize: 14,
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
        fontSize: 10,
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
        fontSize: 11,
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
        fontSize: 12,
        fontWeight: '700',
    },
    compareBtnTextSmall: {
        color: '#3b82f6',
        fontSize: 12,
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
        fontSize: 16,
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
        fontSize: 10,
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
        fontSize: 20,
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
        fontSize: 12,
    },
    odoHint: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 12,
        fontStyle: 'italic',
    },
});

export default DetailsScreen;
