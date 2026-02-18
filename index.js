import 'react-native-gesture-handler';
console.log('Index.js: Starting polyfills...');
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
console.log('Index.js: Polyfills and gesture-handler loaded.');
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

console.log('Index.js: Registering Component:', appName);
AppRegistry.registerComponent(appName, () => App);
console.log('Index.js: Registration complete.');
