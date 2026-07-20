-- Migration: Auth New Features (Google, Facebook, Passkey, Connected Accounts)
-- Run this migration once against your pet_helper database

-- 1. Allow password to be nullable for OAuth-only users
ALTER TABLE users
  MODIFY COLUMN password VARCHAR(255) NULL;

-- 2. Create user_connections table for OAuth provider linking
-- Replaces the single provider/provider_id column approach for scalability
CREATE TABLE IF NOT EXISTS user_connections (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT NOT NULL,
  provider      VARCHAR(50) NOT NULL COMMENT 'e.g. google, facebook',
  provider_id   VARCHAR(255) NOT NULL COMMENT 'Unique ID from the provider',
  linked_email  VARCHAR(255) DEFAULT NULL COMMENT 'Email of the linked social account',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_conn_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_provider (user_id, provider),
  UNIQUE KEY unique_provider_id (provider, provider_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Create user_passkeys table for WebAuthn/Passkey management
CREATE TABLE IF NOT EXISTS user_passkeys (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT NOT NULL,
  credential_id   VARCHAR(511) NOT NULL COMMENT 'Base64url encoded credential ID',
  public_key      TEXT NOT NULL COMMENT 'Base64 encoded COSE public key',
  counter         BIGINT DEFAULT 0 COMMENT 'Signature counter to detect cloned keys',
  device_type     VARCHAR(100) DEFAULT NULL COMMENT 'e.g. singleDevice, multiDevice',
  backed_up       TINYINT(1) DEFAULT 0 COMMENT '1 if credential is backed up to cloud',
  transports      VARCHAR(255) DEFAULT NULL COMMENT 'JSON array of transports e.g. ["internal"]',
  label           VARCHAR(100) DEFAULT NULL COMMENT 'User-friendly device label',
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_passkey_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_credential_id (credential_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
