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
export function initializeDatabase(dbPath: string): Database.Database {
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

  logger.info('Database initialized');
  return db;
}

/**
 * Get database instance, initializing if necessary
 */
export function getDatabase(): Database.Database {
  if (!db) {
    const dbPath = path.resolve(process.cwd(), 'data', 'dm-conversations.db');
    return initializeDatabase(dbPath);
  }
  return db;
}

/**
 * Update or insert a conversation with its latest message
 */
export function upsertConversation(
  conversationId: string,
  lastMessageId: string,
  lastMessageTimestamp: string,
  our_last_message_id: string,
  senderId: string,
  senderScreenName: string,
  recipientId: string,
  recipientScreenName: string,
  hasUnreadMessages: number,
): void {
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
}

/**
 * Mark a conversation as read
 */
export function markConversationAsRead(conversationId: string): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    UPDATE conversations 
    SET has_unread_messages = 0,
        updated_at = datetime('now')
    WHERE conversation_id = ?
  `);

  stmt.run(conversationId);
}

/**
 * Get all conversations with unread messages
 */
export function getUnreadConversations(): ConversationRecord[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM conversations 
    WHERE has_unread_messages = 1
    ORDER BY last_message_timestamp DESC
  `);

  return stmt.all() as ConversationRecord[];
}

/**
 * Get a single conversation by ID
 */
export function getConversation(conversationId: string): ConversationRecord | undefined {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM conversations 
    WHERE conversation_id = ?
  `);

  return stmt.get(conversationId) as ConversationRecord | undefined;
}

/**
 * Get all conversations
 */
export function getAllConversations(): ConversationRecord[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM conversations 
    ORDER BY last_message_timestamp DESC
  `);

  return stmt.all() as ConversationRecord[];
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
