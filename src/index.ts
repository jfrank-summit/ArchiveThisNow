import dotenv from 'dotenv';
import { createTwitterApi } from './lib/twitter/client.js';
import { createLogger } from './utils/logger.js';

dotenv.config();

const logger = createLogger('main');

const main = async () => {
  try {
    // Initialize the Twitter API client
    // Replace with your actual Twitter credentials
    const twitterApi = await createTwitterApi(
      process.env.TWITTER_USERNAME || '',
      process.env.TWITTER_PASSWORD || '',
      'cookies.json',
    );

    const tweets = await twitterApi.getUnrepliedMentionsWithRoots(10);
    tweets.forEach(tweet => {
      console.log(tweet.mention);
      console.log(tweet.rootTweet);
    });

    //   // The example tweet ID from the thread
    //   const tweetId = '1918147057245884897';

    //   // Method 1: Using conversationId explicitly
    //   logger.info('Method 1: Using conversationId and getHeadOfConversation');
    //   const tweet = await twitterApi.getTweet(tweetId);

    //   if (!tweet) {
    //     logger.error(`Tweet not found: ${tweetId}`);
    //     return;
    //   }

    //   if (tweet.conversationId) {
    //     const rootTweet = await twitterApi.getHeadOfConversation(tweet.conversationId);

    //     logger.info('Thread root tweet found:', {
    //       id: rootTweet.id,
    //       conversationId: rootTweet.conversationId,
    //       text: rootTweet.text?.substring(0, 50) + '...',
    //     });
    //   }

    //   // Method 2: Using findConversationRoot (simpler)
    //   logger.info('Method 2: Using findConversationRoot');
    //   const rootTweet = await twitterApi.findConversationRoot(tweet);

    //   logger.info('Thread root tweet found:', {
    //     tweet: rootTweet,
    //   });

    //   return rootTweet;
    // } catch (error) {
    //   logger.error('Error retrieving thread root:', error);
    // }
  } catch (error) {
    logger.error('Error in main:', error);
  }
};

// Run the main function
main().catch(error => {
  logger.error('Unhandled error in main:', error);
});
