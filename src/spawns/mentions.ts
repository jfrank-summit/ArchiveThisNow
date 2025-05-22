import { uploadTweet } from '../utils/tweetUploader.js';
import { TwitterApi } from '../lib/twitter/types.js';
import {
  getProcessedTweetCid,
  addProcessedTweet,
  hasRepliedToMention,
  logMention,
} from '../lib/db/index.js';
import { generateCommentary } from '../lib/llm/service.js';
import { convertTweetToLLMFormat, sanitizeTextForTwitter } from '../utils/tweetConverter.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('mentions');

export const mentions = async (twitterApi: TwitterApi, autoDriveApi: any) => {
  while (true) {
    const tweets = await twitterApi.getUnrepliedMentionsWithRoots(50);
    for (const tweet of tweets) {
      const hasReplied = hasRepliedToMention(tweet.mention.id || '');
      if (hasReplied) {
        console.log(`Tweet ${tweet.mention.id} already replied to, skipping`);
        continue;
      }
      const rootTweetId = tweet.rootTweet.id;

      if (!rootTweetId) {
        console.warn('Root tweet ID is undefined, skipping this mention:', JSON.stringify(tweet));
        continue;
      }

      let cid = getProcessedTweetCid(rootTweetId);
      if (cid) {
        console.log(`Tweet ${rootTweetId} already processed. Using existing CID: ${cid}`);
      } else {
        cid = await uploadTweet(tweet.rootTweet, autoDriveApi);
        const _addProcessedTweet = addProcessedTweet(rootTweetId, cid);
        const _logMention = logMention(
          tweet.mention.id || '',
          tweet.mention.username || '',
          String(tweet.mention.timestamp || ''),
        );
        console.log(`Tweet ${rootTweetId} processed and stored with CID: ${cid}`);
      }

      const _likeMention = await twitterApi.likeTweet(tweet.mention.id || '');
      
      // Generate LLM commentary for the tweet
      let commentary = '';
      try {
        const tweetContent = convertTweetToLLMFormat(tweet.rootTweet);
        const commentaryResponse = await generateCommentary(tweetContent);
        
        if (commentaryResponse.confidence > 0.3) {
          commentary = sanitizeTextForTwitter(commentaryResponse.commentary, 150); // Leave room for the rest of the message
          logger.info(`Generated commentary for tweet ${rootTweetId}: "${commentary}"`);
        } else {
          logger.warn(`Low confidence commentary (${commentaryResponse.confidence}) for tweet ${rootTweetId}, using fallback`);
        }
      } catch (error) {
        logger.error(`Failed to generate commentary for tweet ${rootTweetId}:`, error);
      }
      
      // Construct response tweet with optional commentary
      const autonomysLink = `https://astral.autonomys.xyz/mainnet/permanent-storage/files/${cid}`;
      let responseText: string;
      
      if (commentary) {
        responseText = `@${tweet.mention.username} ${commentary}\n\n🔗 Archived: ${autonomysLink}`;
      } else {
        responseText = `@${tweet.mention.username} Here is the CID: ${cid}, accessible at ${autonomysLink}`;
      }
      
      // Ensure the tweet doesn't exceed Twitter's character limit
      responseText = sanitizeTextForTwitter(responseText, 280);
      
      const sendTweet = {
        text: responseText,
        inReplyTo: tweet.mention.id,
      };
      const reply = await twitterApi.sendTweet(sendTweet.text, sendTweet.inReplyTo);
    }
    const _timer = await new Promise(resolve =>
      setTimeout(resolve, parseInt(process.env.MENTIONS_SPAWN_INTERVAL || '900000')),
    );
  }
};
