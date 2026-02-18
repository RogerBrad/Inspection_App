import 'react-native-gesture-handler';
import React from 'react';
import AppNavigator from './src/AppNavigator';

function App(): React.JSX.Element {
  console.log('App.tsx: Rendering AppNavigator');
  return <AppNavigator />;
}

export default App;
