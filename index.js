import 'react-native-gesture-handler';
// Polyfill crypto.getRandomValues BEFORE any other imports to avoid Firebase crashes
if (typeof global.crypto !== 'object') {
    global.crypto = {};
}
if (!global.crypto.getRandomValues) {
    global.crypto.getRandomValues = (array) => {
        for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 256);
        }
        return array;
    };
}

import 'react-native-url-polyfill/auto';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
