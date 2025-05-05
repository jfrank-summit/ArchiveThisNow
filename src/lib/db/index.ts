import Database from 'better-sqlite3';
import path from 'path';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('dm-database');
let db: Database.Database | null = null;

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
  senderId: string,
  senderScreenName: string,
  recipientId: string,
  recipientScreenName: string,
): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO conversations 
      (conversation_id, last_message_id, last_message_timestamp, sender_id, sender_screen_name, recipient_id, recipient_screen_name, has_unread_messages, updated_at)
    VALUES 
      (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
    ON CONFLICT(conversation_id) DO UPDATE SET
      last_message_id = CASE WHEN last_message_id < ? THEN ? ELSE last_message_id END,
      last_message_timestamp = CASE WHEN last_message_id < ? THEN ? ELSE last_message_timestamp END,
      sender_id = CASE WHEN last_message_id < ? THEN ? ELSE sender_id END,
      sender_screen_name = CASE WHEN last_message_id < ? THEN ? ELSE sender_screen_name END,
      has_unread_messages = CASE WHEN last_message_id < ? THEN 1 ELSE has_unread_messages END,
      updated_at = datetime('now')
  `);

  stmt.run(
    conversationId,
    lastMessageId,
    lastMessageTimestamp,
    senderId,
    senderScreenName,
    recipientId,
    recipientScreenName,
    lastMessageId,
    lastMessageId,
    lastMessageId,
    lastMessageTimestamp,
    lastMessageId,
    senderId,
    lastMessageId,
    senderScreenName,
    lastMessageId,
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
export function getUnreadConversations(): any[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM conversations 
    WHERE has_unread_messages = 1
    ORDER BY last_message_timestamp DESC
  `);

  return stmt.all();
}

/**
 * Get a single conversation by ID
 */
export function getConversation(conversationId: string): any {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM conversations 
    WHERE conversation_id = ?
  `);

  return stmt.get(conversationId);
}

/**
 * Get all conversations
 */
export function getAllConversations(): any[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM conversations 
    ORDER BY last_message_timestamp DESC
  `);

  return stmt.all();
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
