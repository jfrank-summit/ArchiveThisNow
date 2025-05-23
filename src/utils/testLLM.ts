import dotenv from 'dotenv';
import { generateCommentary, testConnection } from '../lib/llm/service.js';
import { createLogger } from './logger.js';

dotenv.config();

const logger = createLogger('llm-test');

export const testLLMConfiguration = async (): Promise<boolean> => {
  try {
    logger.info('Testing LLM configuration...');
    
    // Test connection
    const connectionTest = await testConnection();
    if (!connectionTest) {
      logger.error('LLM connection test failed');
      return false;
    }
    
    // Test commentary generation with sample tweet
    const sampleTweet = {
      text: 'Just discovered this amazing new technology for decentralized storage!',
      username: 'testuser',
      timestamp: new Date().toISOString(),
    };
    
    const commentary = await generateCommentary(sampleTweet);
    
    logger.info(`Test commentary generated: "${commentary.commentary}"`);
    logger.info(`Confidence: ${commentary.confidence}`);
    logger.info(`Topics: ${commentary.topics.join(', ')}`);
    
    if (commentary.commentary && commentary.commentary.length > 0) {
      logger.info('✅ LLM service is working correctly');
      return true;
    } else {
      logger.error('❌ LLM service returned empty commentary');
      return false;
    }
    
  } catch (error) {
    logger.error('❌ LLM test failed:', error);
    return false;
  }
}

// Allow running this test directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testLLMConfiguration()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test failed:', error);
      process.exit(1);
    });
} 