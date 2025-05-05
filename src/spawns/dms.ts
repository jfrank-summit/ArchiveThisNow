import { getAllUnreadMessages, markAsRead, sendReply } from '../lib/twitter/dm-service.js';
import { syncDirectMessages } from '../lib/twitter/dm-service.js';
import { createLogger } from '../utils/logger.js';

export const dms = async (profile: any, twitterApi: any, autoDriveApi: any) => {
  const logger = createLogger('dms');
  // First sync to make sure our database is up to date
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
    // for (const unreadMessage of unreadMessages) {
    //     logger.info(`New message from @${unreadMessage.senderScreenName}: ${unreadMessage.message.text}`);

    //     // Example: Respond to each unread message
    //     await sendReply(
    //     twitterApi.scraper,
    //     unreadMessage.conversationId,
    //     `Thanks for your message: "${unreadMessage.message.text}". This is an automated reply.`
    //     );
    // }

    // for (const unreadMessage of unreadMessages) {
    //     markAsRead(unreadMessage.conversationId);
    //     logger.info(`Marked conversation with @${unreadMessage.senderScreenName} as read`);
    // }
  } else {
    logger.info('No unread messages found in any conversations');
  }
};
