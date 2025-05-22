import dotenv from 'dotenv';
import { createTwitterApi } from './lib/twitter/client.js';
import { createLogger } from './utils/logger.js';
import { createAutoDriveApi } from '@autonomys/auto-drive';
import { mentions } from './spawns/mentions.js';
import { dms } from './spawns/dms.js';
import { testLLMConfiguration } from './utils/testLLM.js';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const logger = createLogger('main');

// Ensure the data directory exists
const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const main = async () => {
  try {
    const twitterApi = await createTwitterApi(
      process.env.TWITTER_USERNAME || '',
      process.env.TWITTER_PASSWORD || '',
      'cookies.json',
    );

    const autoDriveApi = createAutoDriveApi({
      apiKey: process.env.AUTO_DRIVE_API_KEY || '',
      network: 'mainnet',
    });

    // Test LLM configuration
    const llmWorking = await testLLMConfiguration();
    if (!llmWorking) {
      logger.warn('LLM service is not working correctly. Commentary features will be disabled.');
    }

    const myProfile = await twitterApi.scraper.getProfile(process.env.TWITTER_USERNAME || '');

    // Spawn tasks in parallel without waiting
    Promise.all([
      mentions(twitterApi, autoDriveApi),
      dms(myProfile, twitterApi, autoDriveApi),
    ]).catch(error => {
      logger.error('Error in spawned tasks:', error);
    });
  } catch (error) {
    logger.error('Error in main:', error);
  }
};

main().catch(error => {
  logger.error('Unhandled error in main:', error);
});
