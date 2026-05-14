import axios from 'axios';
import { Platform } from 'react-native';
import { BACKEND_BASE_URL } from '../constants/Backend';

export const uploadAudio = async (uri) => {
  try {
    console.log('📤 Starting upload for URI:', uri);
    console.log('📱 Platform:', Platform.OS);
    
    const formData = new FormData();
    
    if (Platform.OS === 'web') {
      // For web platform, convert blob URI to file object
      console.log('🌐 Web platform detected - converting blob URI to file');
      
      try {
        // Fetch the blob from the URI
        const response = await fetch(uri);
        const blob = await response.blob();
        
        // Create a file object from the blob
        const file = new File([blob], 'audio.m4a', { type: 'audio/m4a' });
        console.log('📄 File object created from blob:', file);
        
        formData.append('audio', file);
      } catch (blobError) {
        console.error('❌ Error converting blob to file:', blobError);
        throw new Error('Failed to convert audio to file for upload');
      }
    } else {
      // For mobile platforms (iOS/Android)
      const filename = uri.split('/').pop() || 'audio.m4a';
      console.log('📁 Filename:', filename);
      
      // Create proper file object for React Native mobile
      const file = {
        uri: uri,
        type: 'audio/m4a',
        name: filename,
      };
      
      console.log('📄 File object:', file);
      formData.append('audio', file);
    }
    
    console.log('📦 FormData created');

    const response = await fetch(`${BACKEND_BASE_URL}/upload`, {
      method: 'POST',
      body: formData,
    });

    console.log('📡 Response status:', response.status);
    console.log('📡 Response ok:', response.ok);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Server error response:', errorData);
      throw new Error(errorData.error || 'Upload failed');
    }

    const data = await response.json();
    console.log('✅ Upload successful:', data);
    return data;
  } catch (error) {
    console.error('❌ Upload error:', error);
    if (error.response) {
      console.error('📡 Server responded with:', error.response.status);
      console.error('🧾 Response data:', error.response.data);
    } else if (error.request) {
      console.error('🚫 No response received. Request:', error.request);
    } else {
      console.error('🛠️ Error setting up request:', error.message);
    }
    throw error;
  }
};
