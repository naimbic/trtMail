ALTER TABLE users ADD COLUMN totp_secret text;
ALTER TABLE users ADD COLUMN totp_enabled integer DEFAULT false NOT NULL;
ALTER TABLE users ADD COLUMN two_factor_required integer DEFAULT false NOT NULL;
ALTER TABLE users ADD COLUMN backup_codes text;
