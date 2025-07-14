// Comprehensive Integration Testing Suite
// Validates Vapi-Kokoro TTS Middleware functionality

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Test Configuration
const TEST_CONFIG = {
  MIDDLEWARE_URL: process.env.MIDDLEWARE_URL || 'http://localhost:3000',
  VAPI_SECRET: process.env.VAPI_SECRET || 'your-vapi-webhook-secret',
  TEST_TIMEOUT: 60000
};

// Test Suite Class
class IntegrationTestSuite {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
  }

  // Log test results
  log(testName, status, details = '') {
    const result = {
      testName,
      status,
      details,
      timestamp: new Date().toISOString()
    };
    this.results.push(result);
    console.log(`[${status}] ${testName} ${details ? '- ' + details : ''}`);
  }

  // Test 1: Server Health Check
  async testServerHealth() {
    try {
      const response = await axios.get(`${TEST_CONFIG.MIDDLEWARE_URL}/api/status`);
      
      if (response.data.status === 'operational') {
        this.log('Server Health Check', 'PASS', 'Server is operational');
        return true;
      } else {
        this.log('Server Health Check', 'FAIL', 'Server not operational');
        return false;
      }
    } catch (error) {
      this.log('Server Health Check', 'FAIL', error.message);
      return false;
    }
  }

  // Test 2: Voice Listing
  async testVoiceListing() {
    try {
      const response = await axios.get(`${TEST_CONFIG.MIDDLEWARE_URL}/api/voices`);
      
      if (Array.isArray(response.data) && response.data.length > 0) {
        this.log('Voice Listing', 'PASS', `Found ${response.data.length} voices`);
        return true;
      } else {
        this.log('Voice Listing', 'FAIL', 'No voices found');
        return false;
      }
    } catch (error) {
      this.log('Voice Listing', 'FAIL', error.message);
      return false;
    }
  }

  // Test 3: TTS Synthesis
  async testTTSSynthesis() {
    try {
      const testPayload = {
        message: {
          type: 'voice-request',
          text: 'Hello, this is a test of the Vapi Kokoro integration.',
          sampleRate: 24000,
          timestamp: Date.now(),
          assistant: {
            id: 'test-assistant',
            name: 'Test Assistant'
          }
        }
      };

      const response = await axios.post(
        `${TEST_CONFIG.MIDDLEWARE_URL}/api/synthesize`,
        testPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-VAPI-SECRET': TEST_CONFIG.VAPI_SECRET
          },
          responseType: 'arraybuffer',
          timeout: 30000
        }
      );

      if (response.data && response.data.length > 0) {
        // Save test audio
        const outputPath = path.join(__dirname, 'test-output.pcm');
        fs.writeFileSync(outputPath, response.data);
        
        this.log('TTS Synthesis', 'PASS', 
          `Generated ${response.data.length} bytes of PCM audio`);
        return true;
      } else {
        this.log('TTS Synthesis', 'FAIL', 'No audio data received');
        return false;
      }
    } catch (error) {
      this.log('TTS Synthesis', 'FAIL', error.message);
      return false;
    }
  }

  // Test 4: Authentication
  async testAuthentication() {
    try {
      const testPayload = {
        message: {
          type: 'voice-request',
          text: 'Test',
          sampleRate: 24000
        }
      };

      // Test with invalid secret
      try {
        await axios.post(
          `${TEST_CONFIG.MIDDLEWARE_URL}/api/synthesize`,
          testPayload,
          {
            headers: {
              'Content-Type': 'application/json',
              'X-VAPI-SECRET': 'invalid-secret'
            }
          }
        );
        this.log('Authentication', 'FAIL', 'Invalid secret was accepted');
        return false;
      } catch (error) {
        if (error.response && error.response.status === 401) {
          this.log('Authentication', 'PASS', 'Invalid secret correctly rejected');
          return true;
        } else {
          this.log('Authentication', 'FAIL', 'Unexpected error');
          return false;
        }
      }
    } catch (error) {
      this.log('Authentication', 'FAIL', error.message);
      return false;
    }
  }

  // Test 5: Error Handling
  async testErrorHandling() {
    try {
      // Test with empty text
      const emptyTextPayload = {
        message: {
          type: 'voice-request',
          text: '',
          sampleRate: 24000
        }
      };

      const response = await axios.post(
        `${TEST_CONFIG.MIDDLEWARE_URL}/api/synthesize`,
        emptyTextPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-VAPI-SECRET': TEST_CONFIG.VAPI_SECRET
          }
        }
      );

      this.log('Error Handling', 'FAIL', 'Empty text was accepted');
      return false;
    } catch (error) {
      if (error.response && error.response.status === 400) {
        this.log('Error Handling', 'PASS', 'Empty text correctly rejected');
        return true;
      } else {
        this.log('Error Handling', 'FAIL', 'Unexpected error response');
        return false;
      }
    }
  }

  // Test 6: Performance Test
  async testPerformance() {
    try {
      const iterations = 5;
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        
        const testPayload = {
          message: {
            type: 'voice-request',
            text: `Performance test iteration ${i + 1}`,
            sampleRate: 24000
          }
        };

        await axios.post(
          `${TEST_CONFIG.MIDDLEWARE_URL}/api/synthesize`,
          testPayload,
          {
            headers: {
              'Content-Type': 'application/json',
              'X-VAPI-SECRET': TEST_CONFIG.VAPI_SECRET
            },
            responseType: 'arraybuffer'
          }
        );

        const duration = Date.now() - startTime;
        times.push(duration);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      
      if (avgTime < 5000) { // Less than 5 seconds average
        this.log('Performance Test', 'PASS', 
          `Average response time: ${avgTime.toFixed(0)}ms`);
        return true;
      } else {
        this.log('Performance Test', 'WARN', 
          `High average response time: ${avgTime.toFixed(0)}ms`);
        return true;
      }
    } catch (error) {
      this.log('Performance Test', 'FAIL', error.message);
      return false;
    }
  }

  // Generate test report
  generateReport() {
    const duration = Date.now() - this.startTime;
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const warnings = this.results.filter(r => r.status === 'WARN').length;

    const report = {
      summary: {
        totalTests: this.results.length,
        passed,
        failed,
        warnings,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      },
      results: this.results
    };

    // Save report
    fs.writeFileSync(
      path.join(__dirname, 'test-report.json'),
      JSON.stringify(report, null, 2)
    );

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${this.results.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Warnings: ${warnings}`);
    console.log(`Duration: ${duration}ms`);
    console.log('='.repeat(60));

    return report;
  }

  // Run all tests
  async runAllTests() {
    console.log('Starting Vapi-Kokoro Integration Tests...\n');

    await this.testServerHealth();
    await this.testVoiceListing();
    await this.testAuthentication();
    await this.testErrorHandling();
    await this.testTTSSynthesis();
    await this.testPerformance();

    return this.generateReport();
  }
}

// Execute tests
async function main() {
  const testSuite = new IntegrationTestSuite();
  
  try {
    const report = await testSuite.runAllTests();
    
    if (report.summary.failed > 0) {
      console.log('\n❌ Some tests failed. Check test-report.json for details.');
      process.exit(1);
    } else {
      console.log('\n✅ All tests passed successfully!');
      process.exit(0);
    }
  } catch (error) {
    console.error('Test suite error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = IntegrationTestSuite;