// useAudioRecorder.ts
import { useState, useRef } from 'react';
import { Audio } from 'expo-av';

export default function useAudioRecorder() {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  const startRecording = async (onStatusUpdate?: (msg: string) => void) => {
    try {
      onStatusUpdate?.('🎙️ Requesting Microphone Permissions...');
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') throw new Error('Microphone permission denied');

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(recording);
      onStatusUpdate?.('🟢 Recording Start');
    } catch (error) {
      console.error('❌ Failed to Start Recording', error);
      onStatusUpdate?.('❌ Failed to Start Recording');
    }
  };

  const stopRecording = async (onStatusUpdate?: (msg: string) => void) => {
    try {
      if (!recording) return null;

      onStatusUpdate?.('⏹️ Stop Recording...');
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (uri) {
        setRecordedUri(uri);
        onStatusUpdate?.('📤 Audio Ready for Upload');
        return uri;
      }
    } catch (error) {
      console.error('❌ Failed to Stop Recording', error);
      onStatusUpdate?.('❌ Failed to Stop Recording');
    }
    return null;
  };

  const playRecording = async (onStatusUpdate?: (msg: string) => void) => {
    if (!recordedUri) return;

    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      const { sound } = await Audio.Sound.createAsync({ uri: recordedUri });
      soundRef.current = sound;
      await sound.playAsync();
      onStatusUpdate?.('▶️ Play Recording...');
    } catch (error) {
      console.error('❌ Playback error', error);
      onStatusUpdate?.('❌ Could not play recording');
    }
  };

  return {
    recording,
    recordedUri,
    startRecording,
    stopRecording,
    playRecording,
  };
}
