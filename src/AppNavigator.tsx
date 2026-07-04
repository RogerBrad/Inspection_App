import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { supabase } from './services/supabaseClient';
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

        const handleUserSession = async (user: any) => {
            try {
                if (user) {
                    // CRITICAL: Check local storage for the technician's profile
                    let userEmail = await offlineStorage.getUserEmail();
                    
                    // If storage is empty, we check if this is a fresh login attempt 
                    // where user.email is present. We'll give it a moment or trust the auth state.
                    if (!userEmail && user.email) {
                        console.log('AppNavigator: Storage empty but Supabase user has email. Initializing session...');
                        await offlineStorage.setUserEmail(user.email);
                        await offlineStorage.setUserId(user.id);
                        userEmail = user.email;
                    }

                    if (!userEmail) {
                        console.warn('AppNavigator: User detected but no profile email available. Forcing Logout.');
                        await supabase.auth.signOut();
                        setIsLoggedIn(false);
                    } else {
                        console.log('AppNavigator: Valid technician session confirmed:', userEmail);
                        setIsLoggedIn(true);
                    }
                } else {
                    console.log('AppNavigator: No user found, showing Login.');
                    // Don't clear storage here to avoid losing email for the next attempt if it was a transient logout
                    setIsLoggedIn(false);
                }
            } catch (err) {
                console.error('AppNavigator: Session validation error:', err);
                setIsLoggedIn(false);
            } finally {
                setLoading(false);
            }
        };

        // Initialize session check
        supabase.auth.getSession().then(({ data: { session } }) => {
            handleUserSession(session?.user || null);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('AppNavigator: Auth state changed. Event:', event, 'User:', session?.user ? session.user.id : 'null');
            await handleUserSession(session?.user || null);
        });

        return () => {
            subscription.unsubscribe();
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
