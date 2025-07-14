# Vapi-Kokoro TTS Middleware Environment Configuration
# Copy this file to .env and update with your actual values

# Server Configuration
PORT=3000
NODE_ENV=production

# Vapi Configuration
VAPI_SECRET=your-vapi-webhook-secret
VAPI_API_KEY=445a1e08-666d-47ea-abdd-cc0ac09d23bc
VAPI_PUBLIC_KEY=16c71f6e-10ce-47b2-b03c-033f3534fc0c

# Kokoro TTS Configuration
# For local Kokoro instance
KOKORO_BASE_URL=http://localhost:5173/api/v1
KOKORO_API_KEY=no-key

# For hosted Kokoro instance (example)
# KOKORO_BASE_URL=https://your-kokoro-instance.com/api/v1
# KOKORO_API_KEY=your-kokoro-api-key

# Twilio Configuration
TWILIO_ACCOUNT_SID=AC39ed37a2d9e427ea7aeb4c27aa368110
TWILIO_AUTH_TOKEN=d7d4ac037e8d18c541d5c40ef31c08b7
TWILIO_PHONE_NUMBER=+15617826702
TWILIO_PHONE_SID=PN88b66d9b79efb4f772cae45dc25a2875

# Audio Processing Configuration
DEFAULT_VOICE=af_heart
DEFAULT_MODEL=model_q8f16
DEFAULT_SPEED=1.0

# Performance Configuration
REQUEST_TIMEOUT=30000
MAX_REQUEST_SIZE=50mb
ENABLE_REQUEST_LOGGING=true

# Security Configuration
ENABLE_CORS=true
ALLOWED_ORIGINS=*
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX_REQUESTS=100