// Vapi-Kokoro TTS Middleware Server
// Comprehensive integration solution for Vapi, Twilio, and Kokoro TTS

const express = require('express');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const stream = require('stream');
const crypto = require('crypto');

// Server Configuration
const app = express();
app.use(express.json({ limit: '50mb' }));

// Configuration Constants
const CONFIG = {
  // Server Settings
  PORT: process.env.PORT || 3000,
  VAPI_SECRET: process.env.VAPI_SECRET || 'your-vapi-webhook-secret',
  
  // Kokoro TTS Settings
  KOKORO_BASE_URL: process.env.KOKORO_BASE_URL || 'http://localhost:5173/api/v1',
  KOKORO_API_KEY: process.env.KOKORO_API_KEY || 'no-key',
  
  // Vapi Credentials
  VAPI_API_KEY: '445a1e08-666d-47ea-abdd-cc0ac09d23bc',
  VAPI_PUBLIC_KEY: '16c71f6e-10ce-47b2-b03c-033f3534fc0c',
  
  // Twilio Credentials
  TWILIO_ACCOUNT_SID: 'AC39ed37a2d9e427ea7aeb4c27aa368110',
  TWILIO_AUTH_TOKEN: 'd7d4ac037e8d18c541d5c40ef31c08b7',
  TWILIO_PHONE_NUMBER: '+15617826702',
  
  // Audio Processing
  SUPPORTED_SAMPLE_RATES: [8000, 16000, 22050, 24000, 44100],
  DEFAULT_VOICE: 'af_heart',
  DEFAULT_MODEL: 'model_q8f16'
};

// Request tracking for debugging
const requestTracker = new Map();

// Authentication Middleware
function authenticateVapi(req, res, next) {
  const secret = req.headers['x-vapi-secret'];
  
  if (!secret || secret !== CONFIG.VAPI_SECRET) {
    console.error('Authentication failed:', secret);
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  next();
}

// Main TTS Endpoint
app.post('/api/synthesize', authenticateVapi, async (req, res) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  
  // Set timeout protection
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(408).json({ error: 'Request timeout' });
    }
  }, 30000);
  
  try {
    console.log(`[${requestId}] TTS request started`);
    requestTracker.set(requestId, { startTime, body: req.body });
    
    // Extract and validate request
    const { message } = req.body;
    
    if (!message || message.type !== 'voice-request') {
      clearTimeout(timeout);
      return res.status(400).json({ error: 'Invalid request format' });
    }
    
    const { text, sampleRate } = message;
    
    // Validate inputs
    if (!text || text.trim().length === 0) {
      clearTimeout(timeout);
      return res.status(400).json({ error: 'Empty text provided' });
    }
    
    if (!CONFIG.SUPPORTED_SAMPLE_RATES.includes(sampleRate)) {
      clearTimeout(timeout);
      return res.status(400).json({
        error: 'Unsupported sample rate',
        supportedRates: CONFIG.SUPPORTED_SAMPLE_RATES
      });
    }
    
    console.log(`[${requestId}] Processing: "${text.substring(0, 50)}..." @ ${sampleRate}Hz`);
    
    // Call Kokoro TTS
    const kokoroAudio = await callKokoroTTS(text, message);
    
    // Convert to PCM
    const pcmBuffer = await convertToPCM(kokoroAudio, sampleRate);
    
    clearTimeout(timeout);
    
    // Send PCM audio response
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', pcmBuffer.length);
    res.write(pcmBuffer);
    res.end();
    
    const duration = Date.now() - startTime;
    console.log(`[${requestId}] Completed in ${duration}ms, ${pcmBuffer.length} bytes`);
    requestTracker.delete(requestId);
    
  } catch (error) {
    clearTimeout(timeout);
    console.error(`[${requestId}] Error:`, error.message);
    requestTracker.delete(requestId);
    
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'TTS synthesis failed', 
        requestId,
        details: error.message 
      });
    }
  }
});

// Call Kokoro TTS API
async function callKokoroTTS(text, message) {
  try {
    // Determine voice based on assistant or use default
    const voice = determineVoice(message);
    
    const response = await axios.post(
      `${CONFIG.KOKORO_BASE_URL}/audio/speech`,
      {
        model: CONFIG.DEFAULT_MODEL,
        voice: voice,
        input: text,
        response_format: 'wav', // WAV is easier to convert to PCM
        speed: 1.0
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CONFIG.KOKORO_API_KEY}`
        },
        responseType: 'arraybuffer',
        timeout: 25000
      }
    );
    
    return Buffer.from(response.data);
  } catch (error) {
    console.error('Kokoro TTS Error:', error.response?.data || error.message);
    throw new Error(`Kokoro TTS failed: ${error.message}`);
  }
}

// Convert audio to PCM format
async function convertToPCM(audioBuffer, targetSampleRate) {
  return new Promise((resolve, reject) => {
    const bufferStream = new stream.PassThrough();
    bufferStream.end(audioBuffer);
    
    const chunks = [];
    
    ffmpeg(bufferStream)
      .toFormat('s16le') // 16-bit signed little-endian PCM
      .audioChannels(1)   // Mono
      .audioFrequency(targetSampleRate)
      .on('error', (err) => {
        console.error('FFmpeg error:', err);
        reject(new Error(`Audio conversion failed: ${err.message}`));
      })
      .on('end', () => {
        const pcmBuffer = Buffer.concat(chunks);
        resolve(pcmBuffer);
      })
      .pipe()
      .on('data', (chunk) => {
        chunks.push(chunk);
      });
  });
}

// Determine voice based on context
function determineVoice(message) {
  // You can implement logic to select voice based on:
  // - Assistant configuration
  // - Customer preferences
  // - Language/accent requirements
  
  if (message.assistant?.voice) {
    return message.assistant.voice;
  }
  
  return CONFIG.DEFAULT_VOICE;
}

// Admin endpoints
app.get('/api/status', (req, res) => {
  res.json({
    status: 'operational',
    activeRequests: requestTracker.size,
    config: {
      kokoroUrl: CONFIG.KOKORO_BASE_URL,
      supportedRates: CONFIG.SUPPORTED_SAMPLE_RATES
    }
  });
});

// Voice listing endpoint
app.get('/api/voices', async (req, res) => {
  try {
    const response = await axios.get(`${CONFIG.KOKORO_BASE_URL}/audio/voices`);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch voices' });
  }
});

// Create Vapi Assistant Configuration
app.post('/api/create-assistant', async (req, res) => {
  try {
    const assistantConfig = {
      name: req.body.name || 'Kokoro Voice Assistant',
      model: {
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 0.7
      },
      voice: {
        provider: 'custom-voice',
        server: {
          url: `${req.protocol}://${req.get('host')}/api/synthesize`,
          secret: CONFIG.VAPI_SECRET,
          timeoutSeconds: 30
        },
        fallbackPlan: {
          voices: [{
            provider: 'eleven-labs',
            voiceId: '21m00Tcm4TlvDq8ikWAM'
          }]
        }
      },
      firstMessage: req.body.firstMessage || 'Hello! How can I help you today?',
      systemPrompt: req.body.systemPrompt || 'You are a helpful assistant.'
    };
    
    const response = await axios.post(
      'https://api.vapi.ai/assistant',
      assistantConfig,
      {
        headers: {
          'Authorization': `Bearer ${CONFIG.VAPI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    res.json({
      success: true,
      assistant: response.data
    });
  } catch (error) {
    console.error('Assistant creation error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to create assistant',
      details: error.response?.data || error.message
    });
  }
});

// Create outbound call
app.post('/api/create-call', async (req, res) => {
  try {
    const { assistantId, customerNumber } = req.body;
    
    if (!assistantId || !customerNumber) {
      return res.status(400).json({ 
        error: 'Missing assistantId or customerNumber' 
      });
    }
    
    const callData = {
      assistant: { id: assistantId },
      phoneNumberId: CONFIG.TWILIO_PHONE_NUMBER,
      customer: { number: customerNumber }
    };
    
    const response = await axios.post(
      'https://api.vapi.ai/call',
      callData,
      {
        headers: {
          'Authorization': `Bearer ${CONFIG.VAPI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    res.json({
      success: true,
      call: response.data
    });
  } catch (error) {
    console.error('Call creation error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to create call',
      details: error.response?.data || error.message
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const server = app.listen(CONFIG.PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║     Vapi-Kokoro TTS Middleware Server                  ║
║     Version: 1.0.0                                     ║
╠════════════════════════════════════════════════════════╣
║     Server running on port ${CONFIG.PORT}                      ║
║     Kokoro URL: ${CONFIG.KOKORO_BASE_URL}                      ║
║     Status endpoint: http://localhost:${CONFIG.PORT}/api/status║
╚════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = app;