import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { rentalAgreementService, RentalAgreement } from '../services/rentalAgreementService';
import NetInfo from "@react-native-community/netinfo";
import { useIsFocused } from '@react-navigation/native';
import { offlineStorage } from '../services/offlineStorage';

import { auth } from '../services/firebaseConfig';
import { signOut } from 'firebase/auth';

const InspectionListScreen = ({ navigation }: any) => {
    const [inspections, setInspections] = useState<RentalAgreement[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [isConnected, setIsConnected] = useState<boolean | null>(true);
    const [currentUserId, setCurrentUserId] = useState<string>('');
    const isFocused = useIsFocused();

    // Load initial data
    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            setIsConnected(state.isConnected);
        });

        const init = async () => {
            const userId = await offlineStorage.getUserId();
            const userEmailFromStorage = await offlineStorage.getUserEmail();
            setCurrentUserId(userId);
            
            // Load what we have locally first for immediate UI
            await loadInspections();
            
            // Then trigger a background sync to ensure data is fresh
            const emailToSync = auth.currentUser?.email || userEmailFromStorage;
            if (emailToSync) {
                console.log('InspectionListScreen: Performing auto-sync for:', emailToSync);
                handleSync(true); 
            }
        };
        init();

        return () => unsubscribe();
    }, []);

    // Reload when screen comes into focus
    useEffect(() => {
        if (isFocused) {
            const refresh = async () => {
                const userId = auth.currentUser?.uid || await offlineStorage.getUserId();
                const userEmail = auth.currentUser?.email || await offlineStorage.getUserEmail();
                setCurrentUserId(userId);
                await loadInspections();
            };
            refresh();
        }
    }, [isFocused]);

    const handleLogout = async () => {
        Alert.alert(
            "Logout",
            "Are you sure you want to log out?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Logout",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await signOut(auth);
                            // Navigation handled by AppNavigator's onAuthStateChanged
                        } catch (error) {
                            console.error("Logout error:", error);
                        }
                    }
                }
            ]
        );
    };

    const loadInspections = async () => {
        setLoading(true);
        const localData = await rentalAgreementService.getLocalInspections();
        setInspections(localData);
        setLoading(false);
    };

    const handleSync = async (silent: boolean = false) => {
        if (!isConnected) {
            if (!silent) Alert.alert("Offline", "Cannot sync while offline. Please check your internet connection.");
            return;
        }

        setSyncing(true);
        try {
            const userId = auth.currentUser?.uid || await offlineStorage.getUserId();
            const userEmail = auth.currentUser?.email || await offlineStorage.getUserEmail();
            console.log('Sync: Starting sync for Email:', userEmail);

            if (!userEmail) {
                if (!silent) Alert.alert("Sync Error", "Email not found. Please log out and back in.");
                setSyncing(false);
                return;
            }

            setCurrentUserId(userId);

            // 1. Upload Pending
            const uploadResult = await rentalAgreementService.syncUpCompletedInspections();
            console.log('Sync: Upload result:', uploadResult.count);

            // 2. Download Allocated
            const downloadResult = await rentalAgreementService.syncDownAllocatedInspections(userEmail);
            console.log('Sync: Download result:', downloadResult.count);

            let message = `Sync Complete.\n\n`;
            message += `User Email: ${userEmail}\n`;
            message += `DB Total: ${downloadResult.totalInDb}\n`;

            if (uploadResult.count > 0) message += `Uploaded: ${uploadResult.count}\n`;
            if (downloadResult.count > 0) {
                message += `Downloaded: ${downloadResult.count} new allocations.`;
            } else {
                message += `Allocations: 0 (No matches found for this ID)`;
            }

            if (!silent) {
                Alert.alert("Sync Status", message);
            }

            // Refresh list from storage regardless of silent mode
            const updatedLocalData = await rentalAgreementService.getLocalInspections();
            setInspections(updatedLocalData);

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
            onPress={() => navigation.navigate('Scanner', {
                expectedId: item.assetDetails?.serialNumber || item.assetDetails?.vin || item.id,
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
                <View>
                    <Text style={styles.title}>My Inspections</Text>
                    <Text style={styles.subtitle}>{currentUserId || 'Technician'} | {auth.currentUser?.email || 'Syncing...'}</Text>
                </View>
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        style={[styles.syncButton, (!isConnected || syncing) && styles.disabledButton]}
                        onPress={() => handleSync(false)}
                        disabled={!isConnected || syncing}
                    >
                        {syncing ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.syncButtonText}>{isConnected ? "SYNC" : "OFFLINE"}</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.logoutButton}
                        onPress={handleLogout}
                    >
                        <Text style={styles.logoutIcon}>🚪</Text>
                    </TouchableOpacity>
                </View>
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
                        <RefreshControl refreshing={syncing} onRefresh={() => handleSync(false)} />
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
    subtitle: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '500',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    syncButton: {
        backgroundColor: '#3b82f6',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 20,
        marginRight: 10,
    },
    disabledButton: {
        backgroundColor: '#94a3b8',
    },
    logoutButton: {
        backgroundColor: '#f1f5f9',
        padding: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoutIcon: {
        fontSize: 16,
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
