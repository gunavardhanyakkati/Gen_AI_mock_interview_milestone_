import { client } from "@gradio/client"; 

// --- CONFIGURATION ---
const HF_SPACE_ID = 'sritej15/mini-wav2vec2-asr'; 

// 🚨 FINAL FIX: The API documentation confirms the correct identifier is '/predict'.
const API_NAME = '/predict'; 

// The PROXY_ROOT_URL construction is now confirmed to be correct for absolute URL usage.
const PROXY_HOST = import.meta.env.VITE_DEV_SERVER_HOST || 'http://localhost:5173';
const PROXY_ROOT_URL = `${PROXY_HOST}/hf-proxy`; 

export interface TranscriptionResult {
    text: string;
}

/**
 * Core utility to initialize the client and handle the prediction call.
 */
const transcribeAudioSource = async (
    audioSource: File | Blob, 
    fileName: string
): Promise<TranscriptionResult> => {

    try {
        // 1. Initialize the client using the ABSOLUTE PROXY URL
        const resolvedClient = await client(
            PROXY_ROOT_URL, 
            {} // Empty options object is required by TypeScript
        ); 

        // 2. Prepare the File object
        const fileForClient = new File([audioSource], fileName, { 
            type: audioSource.type || 'audio/webm' 
        });

        // 3. Call predict using the correct API_NAME
        // Gradio client automatically handles file upload and replaces the input with a server-side path.
        const response = await resolvedClient.predict(
            API_NAME, // ⬅️ The correct API name
            [fileForClient] // ⬅️ The single input parameter array
        );
        
        // 4. Check the response structure
        const responseData = response.data as unknown[];

        if (responseData && typeof responseData[0] === 'string') {
            return { text: responseData[0] };
        } else {
            throw new Error(`Invalid response format from ASR model: ${JSON.stringify(response.data)}`);
        }

    } catch (error) {
        console.error('Final API Error (Using /predict):', error);
        
        throw new Error("Transcription failed due to a final communication error. Check your network tab for the server's response.");
    }
};

// --- EXPORTED FUNCTIONS (Unified API) ---

export const transcribeAudio = (audioFile: File): Promise<TranscriptionResult> => {
    return transcribeAudioSource(audioFile, audioFile.name);
};

export const transcribeLiveAudio = (audioBlob: Blob): Promise<TranscriptionResult> => {
    return transcribeAudioSource(audioBlob, 'live_recording.webm');
};