-- Create chat_locks table
CREATE TABLE IF NOT EXISTS chat_locks (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    conversation_id VARCHAR(255) NOT NULL,
    locked_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lock_type VARCHAR(20) NOT NULL DEFAULT 'auto', -- 'auto' or 'manual'
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, conversation_id)
);

-- Create chat_exclusions table
CREATE TABLE IF NOT EXISTS chat_exclusions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    conversation_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, project_id, conversation_id)
);

-- Add optional conversation_id column to chat_history (nullable for backward compatibility)
ALTER TABLE chat_history ADD COLUMN IF NOT EXISTS conversation_id VARCHAR(255);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chat_locks_project ON chat_locks(project_id);
CREATE INDEX IF NOT EXISTS idx_chat_locks_conversation ON chat_locks(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_locks_user ON chat_locks(locked_by_user_id);
CREATE INDEX IF NOT EXISTS idx_chat_locks_expires ON chat_locks(expires_at);
CREATE INDEX IF NOT EXISTS idx_chat_exclusions_user ON chat_exclusions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_exclusions_project ON chat_exclusions(project_id);
CREATE INDEX IF NOT EXISTS idx_chat_exclusions_conversation ON chat_exclusions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_conversation ON chat_history(conversation_id);
