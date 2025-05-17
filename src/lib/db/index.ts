import Database from 'better-sqlite3';
import path from 'path';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('dm-database');
let db: Database.Database | null = null;

// Define interface for a conversation record
interface ConversationRecord {
  conversation_id: string;
  last_message_id: string;
  last_message_timestamp: string;
  sender_id: string;
  sender_screen_name: string;
  recipient_id: string;
  recipient_screen_name: string;
  our_last_message_id: string | null;
  has_unread_messages: number;
  updated_at: string;
}

/**
 * Initialize the database connection and schema
 */
export const initializeDatabase = (dbPath: string): Database.Database => {
  if (db) return db;

  db = new Database(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      conversation_id TEXT PRIMARY KEY,
      last_message_id TEXT NOT NULL,
      last_message_timestamp TEXT NOT NULL,
      sender_id TEXT,
      sender_screen_name TEXT,
      recipient_id TEXT,
      recipient_screen_name TEXT,
      our_last_message_id TEXT,
      has_unread_messages BOOLEAN NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS processed_tweets (
      tweet_id TEXT PRIMARY KEY,
      cid TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS mentions_log (
      tweet_id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      tweet_timestamp TEXT NOT NULL,
      logged_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  logger.info('Database initialized');
  return db;
};

/**
 * Get database instance, initializing if necessary
 */
export const getDatabase = (): Database.Database => {
  if (!db) {
    const dbPath = path.resolve(process.cwd(), 'data', 'dm-conversations.db');
    return initializeDatabase(dbPath);
  }
  return db;
};

/**
 * Update or insert a conversation with its latest message
 */
export const upsertConversation = (
  conversationId: string,
  lastMessageId: string,
  lastMessageTimestamp: string,
  our_last_message_id: string,
  senderId: string,
  senderScreenName: string,
  recipientId: string,
  recipientScreenName: string,
  hasUnreadMessages: number,
): void => {
  const db = getDatabase();
  const upsertStmt = db.prepare(`
    INSERT INTO conversations (
      conversation_id, last_message_id, last_message_timestamp, sender_id, sender_screen_name,
      recipient_id, recipient_screen_name, our_last_message_id, has_unread_messages, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(conversation_id) DO UPDATE SET
      last_message_id = excluded.last_message_id,
      last_message_timestamp = excluded.last_message_timestamp,
      sender_id = excluded.sender_id,
      sender_screen_name = excluded.sender_screen_name,
      recipient_id = excluded.recipient_id,
      recipient_screen_name = excluded.recipient_screen_name,
      our_last_message_id = excluded.our_last_message_id,
      has_unread_messages = excluded.has_unread_messages,
      updated_at = datetime('now')
  `);

  upsertStmt.run(
    conversationId,
    lastMessageId,
    lastMessageTimestamp,
    senderId,
    senderScreenName,
    recipientId,
    recipientScreenName,
    our_last_message_id,
    hasUnreadMessages,
  );
};

/**
 * Mark a conversation as read
 */
export const markConversationAsRead = (conversationId: string): void => {
  const db = getDatabase();
  const stmt = db.prepare(`
    UPDATE conversations 
    SET has_unread_messages = 0,
        updated_at = datetime('now')
    WHERE conversation_id = ?
  `);

  stmt.run(conversationId);
};

/**
 * Get all conversations with unread messages
 */
export const getUnreadConversations = (): ConversationRecord[] => {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM conversations 
    WHERE has_unread_messages = 1
    ORDER BY last_message_timestamp DESC
  `);

  return stmt.all() as ConversationRecord[];
};

/**
 * Get a single conversation by ID
 */
export const getConversation = (conversationId: string): ConversationRecord | undefined => {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM conversations 
    WHERE conversation_id = ?
  `);

  return stmt.get(conversationId) as ConversationRecord | undefined;
};

/**
 * Get the CID of a processed tweet.
 * @param tweetId The ID of the tweet to check.
 * @returns The CID if the tweet has been processed, otherwise null.
 */
export const getProcessedTweetCid = (tweetId: string): string | null => {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT cid FROM processed_tweets
    WHERE tweet_id = ?
  `);
  const result = stmt.get(tweetId) as { cid: string } | undefined;
  return result ? result.cid : null;
};

/**
 * Add a processed tweet to the database.
 * @param tweetId The ID of the tweet.
 * @param cid The CID associated with the tweet.
 */
export const addProcessedTweet = (tweetId: string, cid: string): void => {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO processed_tweets (tweet_id, cid)
    VALUES (?, ?)
    ON CONFLICT(tweet_id) DO NOTHING;
  `);
  stmt.run(tweetId, cid);
};

/**
 * Log a mention tweet.
 * @param tweetId The ID of the mention tweet.
 * @param username The username of the user who sent the mention.
 * @param tweetTimestamp The timestamp of when the mention tweet was created.
 */
export const logMention = (tweetId: string, username: string, tweetTimestamp: string): void => {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO mentions_log (tweet_id, username, tweet_timestamp)
    VALUES (?, ?, ?)
    ON CONFLICT(tweet_id) DO NOTHING;
  `);
  stmt.run(tweetId, username, tweetTimestamp);
};

/**
 * Check if a mention tweet has already been replied to.
 * @param tweetId The ID of the mention tweet to check.
 * @returns True if the tweet has been replied to, false otherwise.
 */
export const hasRepliedToMention = (tweetId: string): boolean => {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT 1 FROM mentions_log
    WHERE tweet_id = ?
  `);
  const result = stmt.get(tweetId);
  return !!result;
};

/**
 * Get all conversations
 */
export const getAllConversations = (): ConversationRecord[] => {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM conversations 
    ORDER BY last_message_timestamp DESC
  `);

  return stmt.all() as ConversationRecord[];
};

/**
 * Close the database connection
 */
export const closeDatabase = (): void => {
  if (db) {
    db.close();
    db = null;
  }
};
