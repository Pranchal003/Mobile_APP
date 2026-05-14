import React from 'react';
import { SafeAreaView } from 'react-native';
import VoiceRecognition from '../../components/VoiceRecognition';

const App = () => {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <VoiceRecognition />
    </SafeAreaView>
  );
};

export default App;
