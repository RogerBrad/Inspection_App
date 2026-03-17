import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { onAuthStateChanged, signOut } from 'firebase/auth';
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
import HelpScreen from './screens/HelpScreen';

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
                    // CRITICAL: Check if we have the mapped profile (Email)
                    // If we have a user token but NO email in storage, it's likely a 
                    // restored session from a backup. We must force a logout 
                    // to ensure they go through the LoginScreen profile search.
                    const userEmail = await offlineStorage.getUserEmail();
                    
                    if (!userEmail) {
                        console.warn('AppNavigator: User detected but no profile email in storage. Forcing Logout.');
                        await signOut(auth);
                        await offlineStorage.setUserId('');
                        await offlineStorage.setUserEmail('');
                        setIsLoggedIn(false);
                    } else {
                        console.log('AppNavigator: Valid technician session confirmed:', userEmail);
                        setIsLoggedIn(true);
                    }
                } else {
                    console.log('AppNavigator: No user found, showing Login.');
                    await offlineStorage.setUserId('');
                    await offlineStorage.setUserEmail('');
                    setIsLoggedIn(false);
                }
            } catch (err) {
                console.error('AppNavigator: Session validation error:', err);
                setIsLoggedIn(false);
            } finally {
                setLoading(false);
                clearTimeout(timer);
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
                        <Stack.Screen
                            name="Help"
                            component={HelpScreen}
                            options={{ headerShown: false }}
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
