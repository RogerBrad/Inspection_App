import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { rentalAgreementService, RentalAgreement } from '../services/rentalAgreementService';
import NetInfo from "@react-native-community/netinfo";
import { useIsFocused } from '@react-navigation/native';

const InspectionListScreen = ({ navigation }: any) => {
    const [inspections, setInspections] = useState<RentalAgreement[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [isConnected, setIsConnected] = useState<boolean | null>(true);
    const isFocused = useIsFocused();

    // Load initial data
    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            setIsConnected(state.isConnected);
        });

        loadInspections();

        return () => unsubscribe();
    }, []);

    // Reload when screen comes into focus
    useEffect(() => {
        if (isFocused) {
            loadInspections();
        }
    }, [isFocused]);

    const loadInspections = async () => {
        setLoading(true);
        const localData = await rentalAgreementService.getLocalInspections();
        setInspections(localData);
        setLoading(false);
    };

    const handleSync = async () => {
        if (!isConnected) {
            Alert.alert("Offline", "Cannot sync while offline. Please check your internet connection.");
            return;
        }

        setSyncing(true);
        try {
            // 1. Upload Pending
            const uploadResult = await rentalAgreementService.syncUpCompletedInspections();

            // 2. Download Allocated
            // TODO: Get actual current user ID
            const downloadResult = await rentalAgreementService.syncDownAllocatedInspections("USER_001");

            let message = "Sync Complete.\n";
            if (uploadResult.count > 0) message += `Uploaded ${uploadResult.count} completed inspections.\n`;
            if (downloadResult.count > 0) message += `Downloaded ${downloadResult.count} new allocations.`;

            if (uploadResult.count === 0 && downloadResult.count === 0) {
                message = "All up to date.";
            }

            if (uploadResult.errors.length > 0) {
                message += `\n\nWarning: ${uploadResult.errors.length} uploads failed.`;
            }

            Alert.alert("Sync Status", message);

            // Refresh list
            await loadInspections();

        } catch (error) {
            console.error("Sync error:", error);
            Alert.alert("Sync Error", "An error occurred during synchronization.");
        } finally {
            setSyncing(false);
        }
    };

    const renderItem = ({ item }: { item: RentalAgreement }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('Details', {
                data: item.assetDetails?.vin || item.assetDetails?.serialNumber || item.id, // Fallback for barcode param
                assetCategory: item.assetCategory || 'motor_vehicle', // Default or from inspection workflow
                agreement: item
            })}
        >
            <View style={styles.cardHeader}>
                <Text style={styles.assetName}>{item.assetDetails?.assetName || "Unknown Asset"}</Text>
                <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>{item.inspectionWorkflow?.status}</Text>
                </View>
            </View>

            <Text style={styles.detailText}>ID: {item.assetDetails?.vin || item.assetDetails?.serialNumber || item.id}</Text>
            <Text style={styles.detailText}>Customer: {item.parties?.lesseeName || "N/A"}</Text>
            <Text style={styles.detailText}>Date Allocated: {item.inspectionWorkflow?.allocatedAt ? new Date(item.inspectionWorkflow.allocatedAt).toLocaleDateString() : 'N/A'}</Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>My Inspections</Text>
                <TouchableOpacity
                    style={[styles.syncButton, (!isConnected || syncing) && styles.disabledButton]}
                    onPress={handleSync}
                    disabled={!isConnected || syncing}
                >
                    {syncing ? <ActivityIndicator color="#fff" /> : <Text style={styles.syncButtonText}>{isConnected ? "SYNC" : "OFFLINE"}</Text>}
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#3b82f6" />
                </View>
            ) : (
                <FlatList
                    data={inspections}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.list}
                    refreshControl={
                        <RefreshControl refreshing={syncing} onRefresh={handleSync} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No inspections allocated.</Text>
                            <Text style={styles.emptySubText}>Tap SYNC to check for new assignments.</Text>
                        </View>
                    }
                />
            )}

            {/* Floating Action Button for Ad-hoc Scan */}
            <TouchableOpacity
                style={styles.fab}
                onPress={() => navigation.navigate('Scanner')}
            >
                <Text style={styles.fabIcon}>📷</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    header: {
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 20,
        backgroundColor: '#fff',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    syncButton: {
        backgroundColor: '#3b82f6',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
    },
    disabledButton: {
        backgroundColor: '#94a3b8',
    },
    syncButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 12,
    },
    list: {
        padding: 20,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 15,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    assetName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#334155',
        flex: 1,
        marginRight: 10,
    },
    statusBadge: {
        backgroundColor: '#dbeafe',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    statusText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#1e40af',
        textTransform: 'uppercase',
    },
    detailText: {
        fontSize: 14,
        color: '#64748b',
        marginBottom: 4,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: 50,
        padding: 20,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#64748b',
        marginBottom: 8,
    },
    emptySubText: {
        fontSize: 14,
        color: '#94a3b8',
        textAlign: 'center',
    },
    fab: {
        position: 'absolute',
        bottom: 30,
        right: 30,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#0f172a',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
    },
    fabIcon: {
        fontSize: 24,
    }
});

export default InspectionListScreen;
