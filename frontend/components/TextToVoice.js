import React from 'react';
import { Button, View } from 'react-native';
import axios from 'axios';
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import { Buffer } from 'buffer';
import styles from './VoiceRecognitionStyles'; // Only if you're using styles.speakButtonWrapper

const TextToVoice = ({ text }) => {
  const speakText = async () => {
    try {
      const response = await axios.post(
        'http://localhost:5050/api/speak',
        { text },
        { responseType: 'arraybuffer' }
      );

      const base64Audio = Buffer.from(response.data).toString('base64');
      const fileUri = FileSystem.cacheDirectory + 'tts.mp3';

      await FileSystem.writeAsStringAsync(fileUri, base64Audio, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const { sound } = await Audio.Sound.createAsync({ uri: fileUri });
      await sound.playAsync();
    } catch (err) {
      console.error('❌ Error Speaking:', err.message);
    }
  };

  const renderButton = (label, onPress, color) => (
    <View style={styles?.buttonText || { marginVertical: 10, borderRadius: 10, overflow: 'hidden' }}>
      <Button title={label} onPress={onPress} color={color} />
    </View>
  );

  return renderButton('🔈 Speak', speakText, '#808080');
};

export default TextToVoice;
