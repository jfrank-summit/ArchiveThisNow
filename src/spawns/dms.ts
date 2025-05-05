import { getAllUnreadMessages, markAsRead, sendReply } from '../lib/twitter/dm-service.js';
import { syncDirectMessages } from '../lib/twitter/dm-service.js';
import { createLogger } from '../utils/logger.js';
import { interpretDM } from '../utils/dmInterpreter.js';
import { uploadTweet } from '../utils/tweetUploader.js';

export const dms = async (profile: any, twitterApi: any, autoDriveApi: any) => {
    const logger = createLogger('dms');
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
                const cid = await uploadTweet(tweet, autoDriveApi)
                logger.info(`Uploaded tweet: ${cid}`);
                const _reply = await sendReply(
                    twitterApi.scraper,
                    unreadMessage.conversationId,
                    `Here is the cid: ${cid}, and it is accessible at https://astral.autonomys.xyz/mainnet/permanent-storage/files/${cid}`,
                );
                markAsRead(unreadMessage.conversationId);
            } else {
                logger.info(`No interpretation found`);
                const _reply = await sendReply(
                    twitterApi.scraper,
                    unreadMessage.conversationId,
                    `Thanks for your message: "${unreadMessage.message.text}". This is an automated reply. Currently I only can store your sent tweets permanently on blockchain. We can chat later :)`,
                );
                markAsRead(unreadMessage.conversationId);
            }
        }
    } else {
        logger.info('No unread messages found in any conversations');
    }
};
