# Development Scripts

This directory contains utility scripts for development and maintenance tasks.

## Available Scripts

### Update All User Passwords

**File:** `update-all-passwords.js`

**Purpose:** Updates all user passwords in the database to a common password for testing purposes.

**Usage:**
```bash
npm run script:update-passwords
```

Or directly:
```bash
node scripts/update-all-passwords.js
```

**Details:**
- Sets all user passwords to: `123321`
- Uses proper Argon2 password hashing (same as production)
- Cannot be run in production environment (safety check)
- Shows detailed progress and summary

**Security Notes:**
- ⚠️ This script should ONLY be used in development/testing environments
- The script will refuse to run if `NODE_ENV=production`
- All passwords are properly hashed using Argon2 with the application's security settings
- No plaintext passwords are stored

**Example Output:**
```
🔐 Password Update Script
================================

⚠️  WARNING: This will update ALL user passwords to: 123321
Environment: development
Database: localhost

📊 Found 5 user(s) to update

🔒 Hashing password with Argon2...
✅ Password hashed successfully

📝 Updating users...
  ✓ admin (admin@example.com)
  ✓ user1 (user1@example.com)
  ✓ user2 (user2@example.com)
  ✓ user3 (user3@example.com)
  ✓ testuser (test@example.com)

================================
📊 Summary:
  • Total users: 5
  • Successfully updated: 5
  • Errors: 0

✅ Password update complete!

ℹ️  All users can now login with password: 123321
```

## Adding New Scripts

When adding new scripts to this directory:

1. Add proper documentation in this README
2. Include error handling and user feedback
3. Add safety checks for production environments
4. Use existing infrastructure services (PasswordHasher, Prisma, etc.)
5. Add an npm script command in `package.json` if appropriate
6. Follow the naming convention: `script-name.js`

## Environment Variables

Scripts use the same environment variables as the main application:
- `DATABASE_URL` - PostgreSQL connection string
- `NODE_ENV` - Environment name (development/production)
- Other variables as defined in `.env`

Make sure your `.env` file is properly configured before running scripts.

