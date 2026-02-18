import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { getDatabase, ref, get } from 'firebase/database';
import { offlineStorage } from '../services/offlineStorage';

const DebugScreen = () => {
    const [allocatedInspections, setAllocatedInspections] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUserId, setCurrentUserId] = useState<string>('USER_001');

    useEffect(() => {
        const init = async () => {
            const id = await offlineStorage.getUserId();
            setCurrentUserId(id);
            await fetchDebugData();
        };
        init();
    }, []);

    async function handleSetUser(uid: string) {
        await offlineStorage.setUserId(uid);
        setCurrentUserId(uid);
        Alert.alert('User Updated', `Technician ID set to: ${uid}`);
    }

    async function fetchDebugData() {
        setLoading(true);
        try {
            const db = getDatabase();

            // Fetch rental agreements with allocated inspections
            const raSnapshot = await get(ref(db, 'rentalAgreements'));
            if (raSnapshot.exists()) {
                const data = raSnapshot.val();
                const allocated = Object.entries(data)
                    .filter(([_, val]: [string, any]) =>
                        val.inspectionWorkflow?.status === 'Allocated'
                    )
                    .map(([id, val]: [string, any]) => ({
                        id,
                        assetName: val.assetDetails?.assetName,
                        serialNumber: val.assetDetails?.serialNumber,
                        vin: val.assetDetails?.vin,
                        technicianId: val.inspectionWorkflow?.technicianId,
                        technicianName: val.inspectionWorkflow?.technicianName,
                    }));
                setAllocatedInspections(allocated);
            }

            // Fetch users
            const userSnapshot = await get(ref(db, 'User'));
            if (userSnapshot.exists()) {
                const userData = userSnapshot.val();
                const userList = Object.entries(userData).map(([uid, val]: [string, any]) => ({
                    uid,
                    name: `${val.firstName || ''} ${val.surname || ''}`.trim(),
                    email: val.email,
                }));
                setUsers(userList);
            }
        } catch (error) {
            console.error('Debug fetch error:', error);
            Alert.alert('Error', 'Failed to fetch debug data');
        } finally {
            setLoading(false);
        }
    }

    return (
        <ScrollView style={styles.container}>
            <View style={styles.section}>
                <Text style={styles.title}>🔧 Debug Information</Text>

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Current User Configuration</Text>
                    <View style={styles.infoRow}>
                        <Text style={styles.label}>App User ID:</Text>
                        <Text style={[styles.value, styles.highlight]}>{currentUserId}</Text>
                    </View>
                    <Text style={styles.warningText}>
                        ⚠️ This is the ID used to filter "My Inspections"
                    </Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Allocated Inspections ({allocatedInspections.length})</Text>
                    {loading ? (
                        <Text style={styles.loadingText}>Loading...</Text>
                    ) : allocatedInspections.length === 0 ? (
                        <Text style={styles.emptyText}>No inspections allocated</Text>
                    ) : (
                        allocatedInspections.map((item, idx) => (
                            <TouchableOpacity
                                key={idx}
                                onPress={() => item.technicianId && handleSetUser(item.technicianId)}
                                style={[
                                    styles.inspectionItem,
                                    item.technicianId === currentUserId && styles.matchedItem
                                ]}
                            >
                                <Text style={styles.itemTitle}>{item.assetName || 'Unknown Asset'}</Text>
                                <View style={styles.itemDetails}>
                                    <Text style={styles.itemText}>ID: {item.id}</Text>
                                    <Text style={styles.itemText}>Serial: {item.serialNumber || 'N/A'}</Text>
                                    <Text style={styles.itemText}>VIN: {item.vin || 'N/A'}</Text>
                                    <Text style={styles.itemText}>
                                        Technician: {item.technicianName || 'Unknown'}
                                    </Text>
                                    <Text style={[
                                        styles.itemText,
                                        item.technicianId === currentUserId ? styles.matchText : styles.mismatchText
                                    ]}>
                                        Tech ID: {item.technicianId}
                                        {item.technicianId === currentUserId ? ' ✅ MATCH' : ' 👈 Tap to Select'}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        ))
                    )}
                </View>

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Available Users ({users.length})</Text>
                    {loading ? (
                        <Text style={styles.loadingText}>Loading...</Text>
                    ) : users.length === 0 ? (
                        <Text style={styles.emptyText}>No users found</Text>
                    ) : (
                        users.map((user, idx) => (
                            <TouchableOpacity
                                key={idx}
                                onPress={() => handleSetUser(user.uid)}
                                style={[
                                    styles.userItem,
                                    user.uid === currentUserId && styles.matchedItem
                                ]}
                            >
                                <Text style={styles.itemTitle}>
                                    {user.name || user.email}
                                    {user.uid === currentUserId && ' ✅'}
                                </Text>
                                <Text style={styles.itemText}>UID: {user.uid}</Text>
                                <Text style={styles.itemText}>Email: {user.email}</Text>
                                {user.uid !== currentUserId && <Text style={{ fontSize: 10, color: '#3b82f6', marginTop: 5 }}>Tap to set as current user</Text>}
                            </TouchableOpacity>
                        ))
                    )}
                </View>

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>📝 Troubleshooting Steps</Text>
                    <View style={styles.stepContainer}>
                        <Text style={styles.stepNumber}>1.</Text>
                        <Text style={styles.stepText}>
                            Allocated inspections are only shown on "My Inspections" if the Tech ID matches exactly.
                        </Text>
                    </View>
                    <View style={styles.stepContainer}>
                        <Text style={styles.stepNumber}>2.</Text>
                        <Text style={styles.stepText}>
                            Tap any User or Allocated Inspection above to switch identity.
                        </Text>
                    </View>
                    <View style={styles.stepContainer}>
                        <Text style={styles.stepNumber}>3.</Text>
                        <Text style={styles.stepText}>
                            Go back to the list and tap SYNC.
                        </Text>
                    </View>
                </View>

                <TouchableOpacity style={styles.refreshButton} onPress={fetchDebugData}>
                    <Text style={styles.refreshButtonText}>🔄 Refresh Data</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    section: {
        padding: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 20,
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 10,
        padding: 15,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1e40af',
        marginBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
        paddingBottom: 5,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    label: {
        fontSize: 14,
        color: '#6b7280',
        fontWeight: '600',
    },
    value: {
        fontSize: 14,
        color: '#111827',
        fontFamily: 'monospace',
    },
    highlight: {
        backgroundColor: '#fef3c7',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        fontWeight: 'bold',
    },
    warningText: {
        fontSize: 12,
        color: '#f59e0b',
        fontStyle: 'italic',
        marginTop: 5,
    },
    loadingText: {
        fontSize: 14,
        color: '#6b7280',
        fontStyle: 'italic',
        textAlign: 'center',
        paddingVertical: 10,
    },
    emptyText: {
        fontSize: 14,
        color: '#9ca3af',
        textAlign: 'center',
        paddingVertical: 10,
    },
    inspectionItem: {
        backgroundColor: '#f9fafb',
        borderRadius: 8,
        padding: 12,
        marginBottom: 10,
        borderWidth: 2,
        borderColor: '#e5e7eb',
    },
    matchedItem: {
        backgroundColor: '#d1fae5',
        borderColor: '#10b981',
    },
    userItem: {
        backgroundColor: '#f9fafb',
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    itemTitle: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 5,
    },
    itemDetails: {
        marginTop: 5,
    },
    itemText: {
        fontSize: 12,
        color: '#4b5563',
        marginBottom: 3,
        fontFamily: 'monospace',
    },
    matchText: {
        color: '#059669',
        fontWeight: 'bold',
    },
    mismatchText: {
        color: '#dc2626',
        fontWeight: 'bold',
    },
    stepContainer: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    stepNumber: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#3b82f6',
        marginRight: 8,
        width: 20,
    },
    stepText: {
        fontSize: 13,
        color: '#374151',
        flex: 1,
    },
    refreshButton: {
        backgroundColor: '#3b82f6',
        borderRadius: 10,
        padding: 15,
        alignItems: 'center',
        marginTop: 10,
    },
    refreshButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default DebugScreen;
