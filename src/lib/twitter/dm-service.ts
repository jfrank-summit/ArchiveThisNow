import { Scraper } from 'agent-twitter-client';
import * as db from '../db/index.js';
import { createLogger } from '../../utils/logger.js';
import { UnreadMessage, DirectMessageConversation } from './types.js';
const logger = createLogger('dm-service');

/**
 * Fetch all direct messages and update the database with new messages
 */
export async function syncDirectMessages(scraper: Scraper, userId: string): Promise<number> {
  try {
    logger.info('Syncing direct messages');
    const response = await scraper.getDirectMessageConversations(userId);

    let newMessagesCount = 0;

    for (const conversation of response.conversations) {
      if (!conversation.messages || conversation.messages.length === 0) continue;
      let hasUnreadMessages = 0;
      // Sort messages by their id (newest first)
      const sortedMessages = [...conversation.messages].sort((a, b) => b.id.localeCompare(a.id));
      // find the last messages from our user if any!
      const ourMessages = sortedMessages.filter(msg => msg.senderId === userId);
      const lastOurMessage = ourMessages.length > 0 ? ourMessages[0] : null;
      const latestMessage = sortedMessages[0];
      hasUnreadMessages = sortedMessages[0]?.senderId !== userId ? 1 : 0;

      if (!latestMessage) continue;

      // Determine the sender and recipient for this message
      const sender = response.users.find(user => user.id === latestMessage.senderId);
      const recipient = response.users.find(user => user.id === latestMessage.recipientId);
      const existingConversation = db.getConversation(conversation.conversationId);
      if (
        existingConversation?.last_message_id !== latestMessage.id ||
        existingConversation.our_last_message_id !== lastOurMessage?.id
      ) {
        console.log('updating db');
        const _updateDb = db.upsertConversation(
          conversation.conversationId,
          latestMessage.id,
          latestMessage.createdAt,
          lastOurMessage?.id || '0',
          latestMessage.senderId,
          sender?.screenName || '',
          latestMessage.recipientId,
          recipient?.screenName || '',
          hasUnreadMessages,
        );
      }
      // If this is a new message and it's not from us, count it as new
      if (latestMessage.senderId !== userId) {
        newMessagesCount++;
      }
    }

    logger.info(`Sync complete, found ${newMessagesCount} new messages`);
    return newMessagesCount;
  } catch (error) {
    logger.error('Error syncing direct messages:', error);
    return 0;
  }
}

/**
 * Get all unread conversations
 */
export function getUnreadConversations() {
  return db.getUnreadConversations();
}

/**
 * Mark a conversation as read
 */
export function markAsRead(conversationId: string) {
  db.markConversationAsRead(conversationId);
}

/**
 * Send a direct message reply and mark the conversation as read
 */
export async function sendReply(
  scraper: Scraper,
  conversationId: string,
  text: string,
  userId: string,
): Promise<void> {
  try {
    const _reply = await scraper.sendDirectMessage(conversationId, text);
    const _markAsRead = db.markConversationAsRead(conversationId);
    // fallback to syncDirectMessages
    if (!_reply) {
      await syncDirectMessages(scraper, userId);
    }
    logger.info('Replied to conversation', { conversationId });
  } catch (error) {
    logger.error('Error sending direct message reply:', error);
    throw error;
  }
}

/**
 * Get full conversation details from Twitter
 */
export async function getConversationDetails(
  scraper: Scraper,
  userId: string,
  conversationId: string,
): Promise<DirectMessageConversation | null> {
  try {
    const response = await scraper.getDirectMessageConversations(userId);
    return response.conversations.find(conv => conv.conversationId === conversationId) || null;
  } catch (error) {
    logger.error('Error getting conversation details:', error);
    return null;
  }
}

/**
 * Get all unread messages from all unread conversations
 * This function fetches fresh data from Twitter for each unread conversation
 * and returns all messages that are newer than the last read message
 */
export async function getAllUnreadMessages(
  scraper: Scraper,
  userId: string,
): Promise<UnreadMessage[]> {
  try {
    logger.info('Fetching all unread messages');

    // First get all unread conversations from the database
    const unreadConversations = db.getUnreadConversations();

    if (unreadConversations.length === 0) {
      return [];
    }

    // Get the latest DM data from Twitter
    const response = await scraper.getDirectMessageConversations(userId);
    const unreadMessages: UnreadMessage[] = [];

    // For each unread conversation, find the messages that are newer than the last read message
    for (const dbConversation of unreadConversations) {
      const twitterConversation = response.conversations.find(
        conv => conv.conversationId === dbConversation.conversation_id,
      );

      if (
        !twitterConversation ||
        !twitterConversation.messages ||
        twitterConversation.messages.length === 0
      ) {
        logger.warn(`No messages found for conversation ${dbConversation.conversation_id}`);
        continue;
      }

      // Sort messages chronologically based on their ID not timestamp
      const sortedMessages = [...twitterConversation.messages].sort((a, b) =>
        a.id.localeCompare(b.id),
      );

      // Get our last message ID from the database
      const ourLastMessageId = dbConversation.our_last_message_id || '0';

      // Messages to process are all messages that are:
      // 1. Not from our user
      // 2. And either have arrived after our last message or there is no last message from us
      const messagesToProcess = sortedMessages.filter(
        msg => msg.senderId !== userId && msg.id > ourLastMessageId,
      );

      // Add all unread messages to our result array with conversation context
      for (const message of messagesToProcess) {
        const sender = response.users.find(user => user.id === message.senderId);
        const recipient = response.users.find(user => user.id === message.recipientId);

        unreadMessages.push({
          conversationId: twitterConversation.conversationId,
          message: message,
          senderScreenName: sender?.screenName || dbConversation.sender_screen_name,
          recipientScreenName: recipient?.screenName || dbConversation.recipient_screen_name,
        });
      }
    }

    logger.info(`Found ${unreadMessages.length} unread messages across all conversations`);
    return unreadMessages;
  } catch (error) {
    logger.error('Error fetching unread messages:', error);
    return [];
  }
}
