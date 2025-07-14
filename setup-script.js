// Automated Setup Script for Vapi-Kokoro Integration
// Comprehensive deployment automation framework

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

// Setup Configuration
class SetupOrchestrator {
  constructor() {
    this.config = {};
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  // Utility: Prompt user for input
  prompt(question) {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer);
      });
    });
  }

  // Phase 1: System Prerequisites Check
  async checkPrerequisites() {
    console.log('\n📋 PHASE 1: SYSTEM PREREQUISITES CHECK\n');
    
    const checks = [
      { name: 'Node.js', command: 'node --version', minVersion: 'v14' },
      { name: 'npm', command: 'npm --version', minVersion: '6' },
      { name: 'FFmpeg', command: 'ffmpeg -version', minVersion: null }
    ];

    let allPassed = true;

    for (const check of checks) {
      try {
        const { stdout } = await execPromise(check.command);
        console.log(`✅ ${check.name}: ${stdout.trim()}`);
      } catch (error) {
        console.log(`❌ ${check.name}: Not installed`);
        allPassed = false;
      }
    }

    if (!allPassed) {
      console.log('\n⚠️  Some prerequisites are missing. Please install them before continuing.');
      console.log('\nFFmpeg installation:');
      console.log('  - Ubuntu/Debian: sudo apt-get install ffmpeg');
      console.log('  - macOS: brew install ffmpeg');
      console.log('  - Windows: Download from https://ffmpeg.org/download.html');
      return false;
    }

    return true;
  }

  // Phase 2: Configuration Collection
  async collectConfiguration() {
    console.log('\n🔧 PHASE 2: CONFIGURATION COLLECTION\n');

    // Kokoro Configuration
    console.log('📡 Kokoro TTS Configuration:');
    const kokoroChoice = await this.prompt(
      'Are you using a local Kokoro instance? (yes/no): '
    );

    if (kokoroChoice.toLowerCase() === 'yes') {
      this.config.KOKORO_BASE_URL = 'http://localhost:5173/api/v1';
      this.config.KOKORO_API_KEY = 'no-key';
    } else {
      this.config.KOKORO_BASE_URL = await this.prompt(
        'Enter Kokoro API Base URL: '
      );
      this.config.KOKORO_API_KEY = await this.prompt(
        'Enter Kokoro API Key: '
      );
    }

    // Vapi Configuration
    console.log('\n🔑 Vapi Configuration:');
    const useProvidedKeys = await this.prompt(
      'Use provided Vapi keys? (yes/no): '
    );

    if (useProvidedKeys.toLowerCase() === 'yes') {
      this.config.VAPI_API_KEY = '445a1e08-666d-47ea-abdd-cc0ac09d23bc';
      this.config.VAPI_PUBLIC_KEY = '16c71f6e-10ce-47b2-b03c-033f3534fc0c';
    } else {
      this.config.VAPI_API_KEY = await this.prompt('Enter Vapi API Key: ');
      this.config.VAPI_PUBLIC_KEY = await this.prompt('Enter Vapi Public Key: ');
    }

    this.config.VAPI_SECRET = await this.prompt(
      'Enter webhook secret for Vapi (press Enter for auto-generated): '
    ) || this.generateSecret();

    // Twilio Configuration
    console.log('\n📞 Twilio Configuration:');
    const useTwilioKeys = await this.prompt(
      'Use provided Twilio credentials? (yes/no): '
    );

    if (useTwilioKeys.toLowerCase() === 'yes') {
      this.config.TWILIO_ACCOUNT_SID = 'AC39ed37a2d9e427ea7aeb4c27aa368110';
      this.config.TWILIO_AUTH_TOKEN = 'd7d4ac037e8d18c541d5c40ef31c08b7';
      this.config.TWILIO_PHONE_NUMBER = '+15617826702';
    } else {
      this.config.TWILIO_ACCOUNT_SID = await this.prompt('Enter Twilio Account SID: ');
      this.config.TWILIO_AUTH_TOKEN = await this.prompt('Enter Twilio Auth Token: ');
      this.config.TWILIO_PHONE_NUMBER = await this.prompt('Enter Twilio Phone Number: ');
    }

    // Server Configuration
    console.log('\n🖥️  Server Configuration:');
    this.config.PORT = await this.prompt('Enter server port (default: 3000): ') || '3000';
    this.config.NODE_ENV = await this.prompt('Enter environment (development/production): ') || 'development';

    return true;
  }

  // Phase 3: Environment Setup
  async setupEnvironment() {
    console.log('\n🚀 PHASE 3: ENVIRONMENT SETUP\n');

    // Create .env file
    const envContent = this.generateEnvFile();
    fs.writeFileSync('.env', envContent);
    console.log('✅ Created .env file');

    // Install dependencies
    console.log('\n📦 Installing dependencies...');
    try {
      await execPromise('npm install');
      console.log('✅ Dependencies installed');
    } catch (error) {
      console.error('❌ Failed to install dependencies:', error.message);
      return false;
    }

    // Create necessary directories
    const directories = ['logs', 'temp', 'audio-cache'];
    directories.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✅ Created ${dir} directory`);
      }
    });

    return true;
  }

  // Phase 4: Kokoro Connection Test
  async testKokoroConnection() {
    console.log('\n🔌 PHASE 4: KOKORO CONNECTION TEST\n');

    try {
      console.log('Testing Kokoro API connection...');
      
      const response = await axios.get(
        `${this.config.KOKORO_BASE_URL}/audio/voices`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.KOKORO_API_KEY}`
          },
          timeout: 10000
        }
      );

      if (response.data && Array.isArray(response.data)) {
        console.log(`✅ Kokoro API connected successfully`);
        console.log(`   Found ${response.data.length} available voices`);
        
        // Display sample voices
        const sampleVoices = response.data.slice(0, 5);
        console.log('\n   Sample voices:');
        sampleVoices.forEach(voice => {
          console.log(`   - ${voice.id}: ${voice.name} (${voice.lang.name})`);
        });
        
        return true;
      }
    } catch (error) {
      console.error('❌ Failed to connect to Kokoro API:', error.message);
      console.log('\n   Please check:');
      console.log('   1. Kokoro service is running');
      console.log('   2. Base URL is correct');
      console.log('   3. API key is valid (if required)');
      return false;
    }
  }

  // Phase 5: Create Vapi Assistant
  async createVapiAssistant() {
    console.log('\n🤖 PHASE 5: VAPI ASSISTANT CREATION\n');

    const createAssistant = await this.prompt(
      'Would you like to create a test Vapi assistant? (yes/no): '
    );

    if (createAssistant.toLowerCase() !== 'yes') {
      return true;
    }

    const assistantName = await this.prompt('Enter assistant name: ');
    const firstMessage = await this.prompt('Enter first message: ');

    try {
      const serverUrl = await this.prompt(
        `Enter your server's public URL (e.g., https://your-domain.com): `
      );

      const assistantConfig = {
        name: assistantName,
        model: {
          provider: 'openai',
          model: 'gpt-4o',
          temperature: 0.7
        },
        voice: {
          provider: 'custom-voice',
          server: {
            url: `${serverUrl}/api/synthesize`,
            secret: this.config.VAPI_SECRET,
            timeoutSeconds: 30
          }
        },
        firstMessage: firstMessage,
        systemPrompt: 'You are a helpful assistant powered by Kokoro TTS.'
      };

      const response = await axios.post(
        'https://api.vapi.ai/assistant',
        assistantConfig,
        {
          headers: {
            'Authorization': `Bearer ${this.config.VAPI_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`✅ Assistant created successfully!`);
      console.log(`   Assistant ID: ${response.data.id}`);
      console.log(`   Name: ${response.data.name}`);
      
      // Save assistant info
      fs.writeFileSync(
        'assistant-config.json',
        JSON.stringify(response.data, null, 2)
      );
      
      return true;
    } catch (error) {
      console.error('❌ Failed to create assistant:', error.response?.data || error.message);
      return false;
    }
  }

  // Utility: Generate secure secret
  generateSecret() {
    return require('crypto').randomBytes(32).toString('hex');
  }

  // Utility: Generate .env file content
  generateEnvFile() {
    return `# Vapi-Kokoro TTS Middleware Configuration
# Generated on ${new Date().toISOString()}

# Server Configuration
PORT=${this.config.PORT}
NODE_ENV=${this.config.NODE_ENV}

# Vapi Configuration
VAPI_SECRET=${this.config.VAPI_SECRET}
VAPI_API_KEY=${this.config.VAPI_API_KEY}
VAPI_PUBLIC_KEY=${this.config.VAPI_PUBLIC_KEY}

# Kokoro TTS Configuration
KOKORO_BASE_URL=${this.config.KOKORO_BASE_URL}
KOKORO_API_KEY=${this.config.KOKORO_API_KEY}

# Twilio Configuration
TWILIO_ACCOUNT_SID=${this.config.TWILIO_ACCOUNT_SID}
TWILIO_AUTH_TOKEN=${this.config.TWILIO_AUTH_TOKEN}
TWILIO_PHONE_NUMBER=${this.config.TWILIO_PHONE_NUMBER}

# Default Settings
DEFAULT_VOICE=af_heart
DEFAULT_MODEL=model_q8f16
DEFAULT_SPEED=1.0
`;
  }

  // Main orchestration
  async run() {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║     VAPI-KOKORO TTS INTEGRATION SETUP WIZARD               ║
║     Automated Deployment Framework v1.0                    ║
╚════════════════════════════════════════════════════════════╝
    `);

    try {
      // Execute setup phases
      if (!await this.checkPrerequisites()) {
        throw new Error('Prerequisites check failed');
      }

      if (!await this.collectConfiguration()) {
        throw new Error('Configuration collection failed');
      }

      if (!await this.setupEnvironment()) {
        throw new Error('Environment setup failed');
      }

      if (!await this.testKokoroConnection()) {
        console.log('\n⚠️  Kokoro connection test failed, but continuing setup...');
      }

      await this.createVapiAssistant();

      // Final summary
      console.log('\n' + '='.repeat(60));
      console.log('✅ SETUP COMPLETED SUCCESSFULLY!');
      console.log('='.repeat(60));
      console.log('\nNext steps:');
      console.log('1. Start the server: npm start');
      console.log('2. Run integration tests: npm test');
      console.log('3. Configure your Vapi webhooks to point to your server');
      console.log('4. Update Twilio phone number webhook if needed');
      console.log('\nImportant files created:');
      console.log('- .env (configuration)');
      console.log('- assistant-config.json (if assistant was created)');
      console.log('\nServer will be available at:');
      console.log(`- Local: http://localhost:${this.config.PORT}`);
      console.log('- Remember to use HTTPS in production!');

    } catch (error) {
      console.error('\n❌ Setup failed:', error.message);
      process.exit(1);
    } finally {
      this.rl.close();
    }
  }
}

// Execute setup
if (require.main === module) {
  const setup = new SetupOrchestrator();
  setup.run();
}

module.exports = SetupOrchestrator;