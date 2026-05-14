import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  StyleSheet,
  Platform, // Import Platform
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as Speech from 'expo-speech';
import useAudioRecorder from './useAudioRecorder';
import { uploadAudio } from './uploadAudio';
import { BACKEND_BASE_URL } from '../constants/Backend';

export default function VoiceRecognition() {
  const [message, setMessage] = useState('');
  const [transcription, setTranscription] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [automationOutput, setAutomationOutput] = useState('');

  const {
    recording,
    recordedUri,
    startRecording,
    stopRecording,
    playRecording,
  } = useAudioRecorder();

  const handleStart = () => startRecording(setMessage);

  const handleStop = async () => {
    const uri = await stopRecording(setMessage);
    if (uri) {
      setLoading(true);
      setMessage('📤 Uploading and Transcribing...');
      try {
        const result = await uploadAudio(uri);
        console.log('✅ Upload Result:', result);

        // Safely access transcribed_text
        if (result && result.transcribed_text) {
          const text = result.transcribed_text;
          setTranscription(prev => (prev ? `${prev} ${text}`.trim() : text));
          setMessage('✅ Transcription Complete!');
        } else {
          setMessage(`❌ Transcription failed: ${result?.error || 'No text received'}`);
        }
      } catch (err) {
        console.error(err);
        setMessage('❌ Upload Error');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSend = async () => {
    if (!transcription.trim()) {
      setMessage('⚠️ Please transcribe something first.');
      return;
    }
    if (!selectedAgent) {
      setMessage('⚠️ Please select a target agent.');
      return;
    }

    try {
      setMessage('🤖 Submitting report...');
      setLoading(true);
      setAutomationOutput('');

      const response = await fetch(`${BACKEND_BASE_URL}/submit_report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: transcription,
          agent: selectedAgent,
        }),
      });

      const result = await response.json();
      setLoading(false);

      if (response.ok) {
        setMessage(`✅ Report submitted successfully!`);
        setAutomationOutput(result.message || 'No output received.');
      } else {
        setMessage(`❌ Submission Failed: ${result.message || result.error || 'Unknown Error'}`);
        const errorDetails = `Error: ${result.error || 'N/A'}`;
        setAutomationOutput(errorDetails);
      }
    } catch (error: any) {
      setLoading(false);
      console.error('❌ Submission Network/Fetch Error:', error);
      setMessage(`❌ Network Error: ${error.message}`);
      setAutomationOutput(`Fetch failed: ${error.toString()}`);
    }
  };

  const handleTextToSpeech = () => {
    if (transcription.trim()) {
      setMessage('🔊 Speaking...');
      Speech.speak(transcription, {
        onDone: () => setMessage(''),
      });
    }
  };

  const renderButton = (label: string, onPress: () => void, color: string, disabled = false) => (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: color, opacity: disabled ? 0.5 : 1 }]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>🎙️ Voice-to-Report System</Text>
      <Text style={styles.status}>{message}</Text>

      {loading && <ActivityIndicator size="large" color="#007AFF" style={{ marginBottom: 10 }} />}

      {renderButton(
        recording ? '🔴 Stop Recording' : '🎤 Start Recording',
        recording ? handleStop : handleStart,
        recording ? '#FF3B30' : '#34C759',
        loading
      )}

      {recordedUri && !loading && renderButton('▶️ Play Recording', () => playRecording(setMessage), '#5856D6')}

      <Text style={styles.transcriptionTitle}>📝 Report Description:</Text>
      <TextInput
        style={styles.transcriptionTextInput}
        value={transcription}
        onChangeText={setTranscription}
        multiline
        placeholder="Transcribed text will appear here. You can edit it before submitting."
      />

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.smallButton} onPress={handleTextToSpeech}>
          <Text style={styles.buttonText}>🗣️ Speak</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.smallButton} onPress={() => {
          setTranscription('');
          setAutomationOutput('');
        }}>
          <Text style={styles.buttonText}>🗑️ Clear</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.agentTitle}>🎯 Select Submitting Agent:</Text>
      <View style={styles.dropdownWrapper}>
        <Picker
          selectedValue={selectedAgent}
          onValueChange={(itemValue: string) => setSelectedAgent(itemValue)}
          style={styles.picker}
          enabled={!loading}
        >
          <Picker.Item label="-- Select an Agent --" value="" />
          <Picker.Item label="Agent Smith" value="Agent Smith" />
          <Picker.Item label="Agent Jones" value="Agent Jones" />
          <Picker.Item label="Agent Brown" value="Agent Brown" />
        </Picker>
      </View>

      {renderButton(
        '🚀 Submit Report',
        handleSend,
        '#007AFF',
        loading || !transcription.trim() || !selectedAgent
      )}

      {automationOutput ? (
        <>
          <Text style={styles.transcriptionTitle}>📋 Submission Log:</Text>
          <View style={styles.outputContainer}>
            <ScrollView style={styles.outputScrollView}>
              <Text selectable style={styles.outputText}>
                {automationOutput}
              </Text>
            </ScrollView>
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

// Self-contained styles to prevent file-not-found or missing-style errors
const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F8F8F8',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20,
    marginTop: 30,
    color: '#222',
  },
  status: {
    fontSize: 16,
    color: '#444',
    textAlign: 'center',
    marginBottom: 10,
    minHeight: 25,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginVertical: 10,
    width: '90%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: '600',
  },
  transcriptionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 10,
    color: '#333',
  },
  transcriptionTextInput: {
    width: '100%',
    minHeight: 100,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#333',
    textAlignVertical: 'top',
  },
  outputContainer: {
    width: '100%',
    height: 150,
    marginTop: 10,
    marginBottom: 10,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
    padding: 10,
  },
  outputScrollView: {
    flex: 1,
  },
  outputText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 12,
    color: '#333',
  },
  dropdownWrapper: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    backgroundColor: '#fff',
    width: '100%',
    height: 50,
    justifyContent: 'center',
    marginTop: 10,
  },
  picker: {
    height: 50,
    width: '100%',
    color: '#333',
  },
  agentTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 5,
    color: '#333',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
  },
  smallButton: {
    backgroundColor: '#6c757d',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
  },
});