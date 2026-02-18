import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './services/firebaseConfig';
import { offlineStorage } from './services/offlineStorage';

import LoginScreen from './screens/LoginScreen';
import InspectionListScreen from './screens/InspectionListScreen';
import ScannerScreen from './screens/ScannerScreen';
import DetailsScreen from './screens/DetailsScreen';
import PhotoComparisonScreen from './screens/PhotoComparisonScreen';
import InspectionCameraScreen from './screens/InspectionCameraScreen';
import HistoryScreen from './screens/HistoryScreen';
import OdometerScanScreen from './screens/OdometerScanScreen';
import DebugScreen from './screens/DebugScreen';

const Stack = createStackNavigator();

const AppNavigator = () => {
    const [loading, setLoading] = useState(true);
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        console.log('AppNavigator: Initializing Auth Listener...');

        // Safety timeout: stop loading after 5 seconds no matter what
        const timer = setTimeout(() => {
            if (loading) {
                console.warn('AppNavigator: Auth listener timed out. Forcing load.');
                setLoading(false);
            }
        }, 5000);

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            console.log('AppNavigator: Auth state changed. User:', user ? user.uid : 'null');
            try {
                if (user) {
                    await offlineStorage.setUserId(user.uid);
                    setIsLoggedIn(true);
                } else {
                    setIsLoggedIn(false);
                }
            } catch (err) {
                console.error('AppNavigator: Error updating offline storage:', err);
            } finally {
                setLoading(false);
                clearTimeout(timer);
                console.log('AppNavigator: Loading set to false');
            }
        });

        return () => {
            unsubscribe();
            clearTimeout(timer);
        };
    }, []);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text style={{ color: '#94a3b8', marginTop: 15 }}>Establishing Secure Session...</Text>
            </View>
        );
    }

    return (
        <NavigationContainer key={isLoggedIn ? 'authed' : 'guest'}>
            <Stack.Navigator initialRouteName={isLoggedIn ? "InspectionList" : "Login"}>
                {!isLoggedIn ? (
                    <Stack.Screen
                        name="Login"
                        component={LoginScreen}
                        options={{ headerShown: false }}
                    />
                ) : (
                    <>
                        <Stack.Screen
                            name="InspectionList"
                            component={InspectionListScreen}
                            options={{ title: 'My Inspections', headerShown: false }}
                        />
                        <Stack.Screen
                            name="Scanner"
                            component={ScannerScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="Details"
                            component={DetailsScreen}
                            options={{ title: 'Scan Result' }}
                        />
                        <Stack.Screen
                            name="PhotoComparison"
                            component={PhotoComparisonScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="InspectionCamera"
                            component={InspectionCameraScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="History"
                            component={HistoryScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="OdometerScan"
                            component={OdometerScanScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="Debug"
                            component={DebugScreen}
                            options={{ title: '🔧 Debug Info', headerStyle: { backgroundColor: '#3b82f6' }, headerTintColor: '#fff' }}
                        />
                    </>
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
};

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0f172a',
    },
});

export default AppNavigator;
