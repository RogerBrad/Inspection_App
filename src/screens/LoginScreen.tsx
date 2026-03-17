import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Image,
    Dimensions
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { auth, realtimeDb } from '../services/firebaseConfig';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { ref, get } from 'firebase/database';
import { offlineStorage } from '../services/offlineStorage';
import { rentalAgreementService } from '../services/rentalAgreementService';

const { width, height } = Dimensions.get('window');

const LoginScreen = ({ navigation }: any) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        const cleanEmail = email.trim();
        const cleanPassword = password.trim();

        if (!cleanEmail || !cleanPassword) {
            Alert.alert('Error', 'Please enter both email and password.');
            return;
        }

        setLoading(true);
        
        // Connectivity check
        const netState = await NetInfo.fetch();
        if (!netState.isConnected) {
            Alert.alert('Network Error', 'No internet connection detected. Please check your Wi-Fi or mobile data.');
            setLoading(false);
            return;
        }

        console.log('Attempting login for:', cleanEmail);
        try {
            // 1. Firebase Auth Sign In
            const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, cleanPassword);
            const user = userCredential.user;

            console.log('Auth success, UID:', user.uid);

            // 2. Fetch User Profile from RTDB to get the technician info
            const userRef = ref(realtimeDb, `User/${user.uid}`);
            const snapshot = await get(userRef);

            if (snapshot.exists()) {
                const userData = snapshot.val();
                console.log('User profile found (UID match):', userData.firstName, userData.surname);

                // 3. Save to local storage for persistent session
                await offlineStorage.setUserId(user.uid);
                await offlineStorage.setUserEmail(user.email || '');

                // 4. Trigger immediate sync of allocated inspections
                console.log('Syncing inspections for:', user.email);
                try {
                    await rentalAgreementService.syncDownAllocatedInspections(user.email || cleanEmail);
                } catch (syncError) {
                    console.error('Initial sync failed:', syncError);
                }
            } else {
                console.log('No profile at /User/[UID], trying search by Email...');
                
                // Fallback: Search all users for a matching email address
                const usersRef = ref(realtimeDb, 'User');
                const allUsersSnapshot = await get(usersRef);
                
                let foundByEmail = false;
                if (allUsersSnapshot.exists()) {
                    const allUsers = allUsersSnapshot.val();
                    for (const uid in allUsers) {
                        if (allUsers[uid].email?.toLowerCase() === user.email?.toLowerCase()) {
                            console.log('User profile found (Email match):', allUsers[uid].firstName);
                            await offlineStorage.setUserId(uid);
                            await offlineStorage.setUserEmail(allUsers[uid].email);
                            foundByEmail = true;
                            break;
                        }
                    }
                }

                if (!foundByEmail) {
                    console.warn('Auth user exists but no profile found in /User node (neither UID nor Email)');
                    // Even if profile missing, we can use the Auth UID as a placeholder
                    await offlineStorage.setUserId(user.uid);
                    await offlineStorage.setUserEmail(user.email || '');
                }

                // Trigger sync anyway since we have an email
                if (user.email) {
                    try {
                        await rentalAgreementService.syncDownAllocatedInspections(user.email);
                    } catch (syncError) {
                        console.error('Initial sync failed:', syncError);
                    }
                }
            }
        } catch (error: any) {
            console.error('Login error code:', error.code);
            console.error('Login error message:', error.message);

            let message = 'An error occurred during login.';
            if (error.code === 'auth/user-not-found') message = 'No user found with this email.';
            if (error.code === 'auth/wrong-password') message = 'Incorrect password.';
            if (error.code === 'auth/invalid-email') message = 'Invalid email address.';
            if (error.code === 'auth/invalid-credential') message = 'Invalid email or password.';
            if (error.code === 'auth/too-many-requests') message = 'Too many failed attempts. Please try again later.';
            if (error.code === 'auth/network-request-failed') message = 'Network request failed. Please check your internet connection and try again.';

            Alert.alert(
                'Login Failed', 
                `${message}\n\nTechnical Error: ${error.code}`,
                [{ text: "OK" }]
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <ScrollView contentContainerStyle={styles.scrollContainer} bounces={false}>
                <View style={styles.headerContainer}>
                    <View style={styles.logoCircle}>
                        <Text style={styles.logoEmoji}>📦</Text>
                    </View>
                    <Text style={styles.appTitle}>CReAMer v26-NET-FIX</Text>
                    <Text style={styles.appSubtitle}>Inspection Management System</Text>
                </View>

                <View style={styles.formContainer}>
                    <View style={styles.card}>
                        <Text style={styles.loginHeader}>Welcome Back</Text>
                        <Text style={styles.loginSubheader}>Signin to continue</Text>

                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="john.doe@example.com"
                                placeholderTextColor="#94a3b8"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                value={email}
                                onChangeText={setEmail}
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>PASSWORD</Text>
                            <View style={styles.passwordInputContainer}>
                                <TextInput
                                    style={styles.passwordInput}
                                    placeholder="••••••••"
                                    placeholderTextColor="#94a3b8"
                                    secureTextEntry={!showPassword}
                                    value={password}
                                    onChangeText={setPassword}
                                />
                                <TouchableOpacity 
                                    onPress={() => setShowPassword(!showPassword)}
                                    style={styles.eyeIconContainer}
                                >
                                    <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[styles.loginButton, loading && styles.disabledButton]}
                            onPress={handleLogin}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.loginButtonText}>LOG IN</Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.forgotBtn}>
                            <Text style={styles.forgotText}>Forgot Password?</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.footer}>
                    <Text style={styles.versionText}>v26-STABLE | Network Guard Enabled</Text>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    scrollContainer: {
        flexGrow: 1,
        justifyContent: 'space-between',
        paddingBottom: 30,
    },
    headerContainer: {
        alignItems: 'center',
        paddingTop: 80,
        paddingBottom: 40,
    },
    logoCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(59, 130, 246, 0.3)',
    },
    logoEmoji: {
        fontSize: 50,
    },
    appTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#fff',
        letterSpacing: 2,
    },
    appSubtitle: {
        fontSize: 14,
        color: '#94a3b8',
        marginTop: 5,
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    formContainer: {
        paddingHorizontal: 25,
    },
    card: {
        backgroundColor: 'rgba(30, 41, 59, 0.7)',
        borderRadius: 24,
        padding: 30,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    loginHeader: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 5,
    },
    loginSubheader: {
        fontSize: 14,
        color: '#94a3b8',
        marginBottom: 30,
    },
    inputContainer: {
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#3b82f6',
        marginBottom: 8,
        letterSpacing: 1,
    },
    input: {
        backgroundColor: '#1e293b',
        borderRadius: 12,
        paddingHorizontal: 15,
        paddingVertical: 12,
        color: '#fff',
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#334155',
    },
    passwordInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1e293b',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#334155',
    },
    passwordInput: {
        flex: 1,
        paddingHorizontal: 15,
        paddingVertical: 12,
        color: '#fff',
        fontSize: 16,
    },
    eyeIconContainer: {
        padding: 10,
    },
    eyeIcon: {
        fontSize: 20,
    },
    loginButton: {
        backgroundColor: '#3b82f6',
        borderRadius: 12,
        paddingVertical: 15,
        alignItems: 'center',
        marginTop: 10,
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    disabledButton: {
        backgroundColor: '#1d4ed8',
        opacity: 0.7,
    },
    loginButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    forgotBtn: {
        marginTop: 20,
        alignItems: 'center',
    },
    forgotText: {
        color: '#94a3b8',
        fontSize: 14,
    },
    footer: {
        alignItems: 'center',
        marginTop: 40,
    },
    versionText: {
        color: '#475569',
        fontSize: 12,
    },
});

export default LoginScreen;
