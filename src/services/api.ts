const API_BASE_URL = 'http://127.0.0.1:5050';

export const transcribeAudio = async (audioFile: File): Promise<{ text: string }> => {
  const formData = new FormData();
  formData.append('file', audioFile);

  try {
    const response = await fetch(`${API_BASE_URL}/transcribe`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error transcribing audio file:', error);
    // Mock response for development
    await new Promise(resolve => setTimeout(resolve, 2000));
    return {
      text: `Mock transcription for file: ${audioFile.name}. This is a sample transcription that would come from your backend ML model. The actual implementation will connect to your Speech-to-Text API endpoint.`
    };
  }
};

export const transcribeLiveAudio = async (audioBlob: Blob): Promise<{ text: string }> => {
  const formData = new FormData();
  formData.append('file', audioBlob);

  try {
    const response = await fetch(`${API_BASE_URL}/transcribe`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error transcribing live audio:', error);
    // Mock response for development
    await new Promise(resolve => setTimeout(resolve, 3000));
    return {
      text: "Mock transcription from live recording. This is what your Speech-to-Text model would return after processing the recorded audio. The transcription accuracy will depend on your backend ML model implementation."
    };
  }
};