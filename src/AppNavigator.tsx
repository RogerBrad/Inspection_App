import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import ScannerScreen from './screens/ScannerScreen';
import DetailsScreen from './screens/DetailsScreen';
import PhotoComparisonScreen from './screens/PhotoComparisonScreen';
import InspectionCameraScreen from './screens/InspectionCameraScreen';
import HistoryScreen from './screens/HistoryScreen';

const Stack = createStackNavigator();

const AppNavigator = () => {
    return (
        <NavigationContainer>
            <Stack.Navigator initialRouteName="Scanner">
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
            </Stack.Navigator>
        </NavigationContainer>
    );
};

export default AppNavigator;
