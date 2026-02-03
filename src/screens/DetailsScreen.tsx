import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator, Alert } from 'react-native';
import { photoService, VehiclePhoto } from '../services/photoService';

const DetailsScreen = ({ route, navigation }: any) => {
    const { data } = route.params;
    const [historyPhotos, setHistoryPhotos] = useState<{ [key: string]: VehiclePhoto | null }>({
        front: null,
        rear: null,
        left: null,
        right: null
    });
    const [loadingHistory, setLoadingHistory] = useState(true);

    // Split the data by the % delimiter
    const segments = data.split('%').filter((s: string) => s !== '');

    // According to fieldLabels: index 9 is VIN (segments[9])
    const vin = segments[9];
    const registrationNumber = segments[5];

    const angles = ['front', 'rear', 'left', 'right'];

    useEffect(() => {
        async function checkAllHistory() {
            if (vin && vin.trim() !== '') {
                try {
                    const results: any = {};
                    await Promise.all(angles.map(async (angle) => {
                        results[angle] = await photoService.getLatestPhotoByAngle(vin, angle);
                    }));
                    setHistoryPhotos(results);
                } catch (error) {
                    console.error("History check failed:", error);
                }
            } else {
                console.warn("VIN is empty, skipping history check.");
            }
            setLoadingHistory(false);
        }
        checkAllHistory();
    }, [vin]);

    const handleCompare = async (angle: string) => {
        try {
            // Fetch the history for this specific vehicle and angle
            const allPhotos = await photoService.getPhotosByVehicle(vin);
            const anglePhotos = allPhotos.filter(p => p.angle === angle);

            if (anglePhotos.length < 1) {
                Alert.alert("No History", "You need at least one photo to compare.");
                return;
            }

            // We compare the ABSOLUTE LATEST with the one IMMEDIATELY BEFORE it (if exists)
            // If only one exists, we compare it against itself or show a placeholder?
            // Usually, comparison is LATEST vs PREVIOUS.
            const photoNow = anglePhotos[0]; // Descending order, so index 0 is newest
            const photoThen = anglePhotos.length > 1 ? anglePhotos[1] : anglePhotos[0];

            navigation.navigate('PhotoComparison', {
                photoBefore: photoThen.photoUrl, // Past
                photoAfter: photoNow.photoUrl,   // Present
                vehicleData: { vin, registrationNumber, angle }
            });
        } catch (error) {
            Alert.alert("Error", "Could not load comparison history.");
        }
    };

    const handleTakePhoto = (angle: string) => {
        navigation.navigate('InspectionCamera', {
            vin,
            registrationNumber,
            angle
        });
    };

    const fieldLabels = [
        'Doc Type',
        'Format',
        'Code',
        'Issue Number',
        'Control Number',
        'Vehicle Register Number',
        'Vehicle Description',
        'Make',
        'Series Name',
        'VIN',
        'Vehicle Status',
        'Liable for Registration',
        'Index',
        'Identification Number',
        'Name'
    ];

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
            <View style={styles.header}>
                <Text style={styles.title}>Vehicle Details</Text>
                <Text style={styles.subtitle}>{registrationNumber || 'Scanned Registration Disc'}</Text>
            </View>

            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* Visual Audit Section */}
                <View style={styles.auditSection}>
                    <Text style={styles.sectionTitle}>Visual Inspection Audit</Text>
                    {loadingHistory ? (
                        <ActivityIndicator color="#007bff" style={{ marginVertical: 20 }} />
                    ) : (
                        <View style={styles.angleGrid}>
                            {angles.map((angle) => (
                                <View key={angle} style={styles.angleCard}>
                                    <View style={styles.angleHeader}>
                                        <Text style={styles.angleLabel}>{angle.toUpperCase()}</Text>
                                        {historyPhotos[angle] && (
                                            <View style={styles.historyDot} />
                                        )}
                                    </View>

                                    <TouchableOpacity
                                        style={styles.angleCaptureBtn}
                                        onPress={() => handleTakePhoto(angle)}
                                    >
                                        <Text style={styles.btnTextLower}>📸 Capture</Text>
                                    </TouchableOpacity>

                                    {historyPhotos[angle] ? (
                                        <TouchableOpacity
                                            style={styles.angleCompareBtn}
                                            onPress={() => handleCompare(angle)}
                                        >
                                            <Text style={styles.compareBtnTextSmall}>🔍 Compare</Text>
                                        </TouchableOpacity>
                                    ) : (
                                        <View style={styles.noHistoryBadge}>
                                            <Text style={styles.noHistoryTextSmall}>No History</Text>
                                        </View>
                                    )}
                                </View>
                            ))}
                        </View>
                    )}
                </View>

                <View style={styles.divider} />
                <Text style={styles.sectionTitle}>System Records</Text>

                {fieldLabels.map((label, index) => (
                    <View key={label} style={styles.fieldCard}>
                        <Text style={styles.label}>{label}</Text>
                        <Text style={styles.value}>
                            {segments[index] || 'N/A'}
                        </Text>
                    </View>
                ))}

                <View style={[styles.fieldCard, styles.rawCard]}>
                    <Text style={[styles.label, { color: '#999' }]}>Raw Data</Text>
                    <Text style={[styles.value, styles.rawText]}>{data}</Text>
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={styles.button}
                    onPress={() => navigation.goBack()}
                    activeOpacity={0.8}
                >
                    <Text style={styles.buttonText}>Scan Another Disc</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    header: {
        paddingTop: 60,
        paddingHorizontal: 25,
        paddingBottom: 20,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: '#1a1a1a',
    },
    subtitle: {
        fontSize: 14,
        color: '#666',
        marginTop: 4,
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    auditSection: {
        marginBottom: 25,
        backgroundColor: 'white',
        padding: 15,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#444',
        marginBottom: 15,
        marginLeft: 5,
    },
    angleGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 12,
    },
    angleCard: {
        width: '48%',
        backgroundColor: '#f8f9fa',
        borderRadius: 15,
        padding: 12,
        borderWidth: 1,
        borderColor: '#eee',
    },
    angleHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    angleLabel: {
        fontSize: 11,
        fontWeight: '900',
        color: '#888',
        letterSpacing: 0.5,
    },
    historyDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#007bff',
    },
    angleCaptureBtn: {
        backgroundColor: '#1a1a1a',
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: 'center',
        marginBottom: 8,
    },
    angleCompareBtn: {
        backgroundColor: '#e7f3ff',
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#007bff',
    },
    btnTextLower: {
        color: 'white',
        fontSize: 12,
        fontWeight: '700',
    },
    compareBtnTextSmall: {
        color: '#007bff',
        fontSize: 12,
        fontWeight: '700',
    },
    noHistoryBadge: {
        paddingVertical: 10,
        alignItems: 'center',
    },
    noHistoryTextSmall: {
        fontSize: 10,
        color: '#ccc',
        fontWeight: '600',
    },
    divider: {
        height: 1,
        backgroundColor: '#eee',
        marginVertical: 20,
        marginHorizontal: 10,
    },
    fieldCard: {
        backgroundColor: 'white',
        padding: 16,
        borderRadius: 15,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
        borderLeftWidth: 4,
        borderLeftColor: '#007bff',
    },
    label: {
        fontSize: 12,
        fontWeight: '700',
        color: '#007bff',
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    value: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
    },
    rawCard: {
        marginTop: 20,
        borderLeftWidth: 0,
        backgroundColor: '#f1f3f5',
    },
    rawText: {
        fontSize: 12,
        fontWeight: '400',
        color: '#666',
        fontFamily: 'monospace',
    },
    footer: {
        padding: 20,
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    button: {
        backgroundColor: '#1a1a1a',
        paddingVertical: 18,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6,
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
});

export default DetailsScreen;
