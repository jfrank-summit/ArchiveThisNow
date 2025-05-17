import { getAllUnreadMessages, markAsRead, sendReply } from '../lib/twitter/dm-service.js';
import { syncDirectMessages } from '../lib/twitter/dm-service.js';
import { createLogger } from '../utils/logger.js';
import { interpretDM } from '../utils/dmInterpreter.js';
import { uploadTweet } from '../utils/tweetUploader.js';
import { addProcessedTweet, getProcessedTweetCid } from '../lib/db/index.js';

export const dms = async (profile: any, twitterApi: any, autoDriveApi: any) => {
  const logger = createLogger('dms');
  while (true) {
    const newMessagesCount = await syncDirectMessages(twitterApi.scraper, profile.userId || '');

    if (newMessagesCount > 0) {
      logger.info(`Found ${newMessagesCount} new messages during sync`);
    } else {
      logger.info('No new messages found during sync');
    }

    const unreadMessages = await getAllUnreadMessages(twitterApi.scraper, profile.userId || '');

    if (unreadMessages.length > 0) {
      logger.info(`Processing ${unreadMessages.length} unread messages`);

      // Process each unread message
      for (const unreadMessage of unreadMessages) {
        logger.info(
          `New message from @${unreadMessage.senderScreenName}: ${unreadMessage.message.mediaUrls}`,
        );
        const tweetId = interpretDM(unreadMessage.message.mediaUrls?.[0] || '');
        if (tweetId) {
          logger.info(`tweet id: ${tweetId}`);
          const tweet = await twitterApi.scraper.getTweet(tweetId);
          let cid = getProcessedTweetCid(tweetId);
          if (cid) {
            logger.info(`Tweet ${tweetId} already processed. Using existing CID: ${cid}`);
          } else {
            cid = await uploadTweet(tweet, autoDriveApi);
            logger.info(`Uploaded tweet: ${cid}`);
            const _addProcessedTweet = addProcessedTweet(tweetId, cid);
          }
          const _reply = await sendReply(
            twitterApi.scraper,
            unreadMessage.conversationId,
            `Here is the cid: ${cid}, and it is accessible at https://astral.autonomys.xyz/mainnet/permanent-storage/files/${cid}`,
            profile.userId || '',
          );
        } else {
          logger.info(`No interpretation found`);
          const _reply = await sendReply(
            twitterApi.scraper,
            unreadMessage.conversationId,
            `Thanks for your message: "${unreadMessage.message.text}". This is an automated reply. Currently I only can store your sent tweets permanently on blockchain. We can chat later :)`,
            profile.userId || '',
          );
        }
      }
    } else {
      logger.info('No unread messages found in any conversations');
    }
    const _timer = await new Promise(resolve => setTimeout(resolve, parseInt(process.env.DMS_SPAWN_INTERVAL || '900000')));
  }
};
