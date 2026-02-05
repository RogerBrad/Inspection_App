import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, Alert, StatusBar, FlatList } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { inspectionService, InspectionRecord } from '../services/inspectionService';

const HistoryScreen = ({ route, navigation }: any) => {
    const { assetId, assetCategory } = route.params;
    const cleanId = (assetId || '').trim();
    const [history, setHistory] = useState<InspectionRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const isFocused = useIsFocused();

    useEffect(() => {
        if (isFocused) {
            setLoading(true);
            fetchHistory();
        }
    }, [cleanId, isFocused]);

    const fetchHistory = async () => {
        try {
            console.log(`[History] Querying for ID: "${cleanId}"`);
            const data = await inspectionService.getInspectionsByAsset(cleanId);
            console.log(`[History] Found ${data.length} records`);
            setHistory(data);
        } catch (error) {
            console.error("History fetch failed:", error);
            Alert.alert("Error", "Could not load inspection history.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        fetchHistory();
    };

    const formatDate = (timestamp: any) => {
        if (!timestamp) return 'N/A';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const renderItem = ({ item: record }: { item: InspectionRecord }) => (
        <View key={record.id} style={styles.recordCard}>
            <View style={styles.recordHeader}>
                <View>
                    <Text style={styles.recordType}>{record.inspectionTypeLabel}</Text>
                    <Text style={styles.recordDate}>{formatDate(record.timestamp)}</Text>
                    {record.odometer && (
                        <View style={styles.odoHistoryTag}>
                            <Text style={styles.odoHistoryText}>🚗 ODO: {record.odometer}</Text>
                        </View>
                    )}
                </View>
                <View style={[styles.statusBadge, record.summary.failCount > 0 ? styles.failBadge : styles.passBadge]}>
                    <Text style={styles.statusBadgeText}>
                        {record.summary.failCount > 0 ? `${record.summary.failCount} ISSUES` : 'CLEAN'}
                    </Text>
                </View>
            </View>

            <View style={styles.resultsList}>
                {record.results.filter(r => r.status === 'fail').map((res, idx) => (
                    <View key={idx} style={styles.issueRow}>
                        <View style={styles.issueHeader}>
                            <Text style={styles.issueLabel}>{res.label}</Text>
                            <Text style={styles.issueParent}>{res.parentItem}</Text>
                        </View>
                        {res.comment && (
                            <Text style={styles.issueComment}>"{res.comment}"</Text>
                        )}
                    </View>
                ))}
                {record.summary.failCount === 0 && (
                    <Text style={styles.successNote}>✓ All items passed successfully.</Text>
                )}
            </View>
        </View>
    );

    if (loading && !refreshing) return (
        <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loadingText}>Fetching History...</Text>
        </View>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backBtnText}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Inspection History</Text>
                <View style={{ width: 60 }} />
            </View>

            <View style={styles.assetBar}>
                <Text style={styles.assetIdLabel}>{assetCategory === 'motor_vehicle' ? 'VIN:' : 'SERIAL:'}</Text>
                <Text style={styles.assetIdValue}>{assetId}</Text>
            </View>

            <FlatList
                data={history}
                keyExtractor={(item) => item.id || Math.random().toString()}
                renderItem={renderItem}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                onRefresh={handleRefresh}
                refreshing={refreshing}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No previous inspections found for asset ID:</Text>
                        <Text style={[styles.emptyText, { fontWeight: 'bold', color: '#0f172a', marginTop: 10 }]}>{cleanId}</Text>
                        <Text style={[styles.emptyText, { fontSize: 13, marginTop: 20 }]}>Try pulling down to refresh if you just saved an inspection.</Text>
                    </View>
                }
            />
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
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 50,
        paddingBottom: 20,
        paddingHorizontal: 20,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0f172a',
    },
    backBtn: {
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    backBtnText: {
        color: '#3b82f6',
        fontWeight: '700',
    },
    assetBar: {
        flexDirection: 'row',
        padding: 15,
        backgroundColor: '#eff6ff',
        alignItems: 'center',
    },
    assetIdLabel: {
        fontSize: 12,
        fontWeight: '800',
        color: '#3b82f6',
        marginRight: 8,
    },
    assetIdValue: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1e40af',
    },
    scrollContent: {
        padding: 20,
    },
    recordCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        elevation: 2,
    },
    recordHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 15,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f8fafc',
    },
    recordType: {
        fontSize: 16,
        fontWeight: '800',
        color: '#334155',
        marginBottom: 4,
    },
    recordDate: {
        fontSize: 12,
        color: '#94a3b8',
        fontWeight: '500',
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    passBadge: {
        backgroundColor: '#dcfce7',
    },
    failBadge: {
        backgroundColor: '#fee2e2',
    },
    statusBadgeText: {
        fontSize: 10,
        fontWeight: '900',
        color: '#0f172a',
    },
    resultsList: {
        gap: 12,
    },
    issueRow: {
        backgroundColor: '#fff9f9',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#fee2e2',
    },
    issueHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    issueLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: '#b91c1c',
    },
    issueParent: {
        fontSize: 11,
        fontWeight: '600',
        color: '#94a3b8',
    },
    issueComment: {
        fontSize: 13,
        color: '#475569',
        fontStyle: 'italic',
        marginTop: 4,
    },
    successNote: {
        fontSize: 14,
        color: '#059669',
        fontWeight: '600',
        fontStyle: 'italic',
    },
    emptyContainer: {
        marginTop: 100,
        alignItems: 'center',
    },
    emptyText: {
        color: '#94a3b8',
        fontSize: 16,
        textAlign: 'center',
        paddingHorizontal: 40,
    },
    odoHistoryTag: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        marginTop: 6,
        alignSelf: 'flex-start',
    },
    odoHistoryText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#475569',
    }
});

export default HistoryScreen;
