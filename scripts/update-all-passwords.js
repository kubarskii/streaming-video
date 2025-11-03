#!/usr/bin/env node

/**
 * Development Script: Update All User Passwords
 * 
 * ⚠️  WARNING: This script should ONLY be used in development environments!
 * 
 * Updates all user passwords in the database to a common password for testing.
 * Uses the same PasswordHasher service used by the application.
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const PasswordHasher = require('../src/infrastructure/auth/PasswordHasher');

const prisma = new PrismaClient();
const passwordHasher = new PasswordHasher();

// Configuration
const NEW_PASSWORD = '123321';

async function updateAllPasswords() {
    console.log('🔐 Password Update Script');
    console.log('================================\n');

    // Safety check - ensure we're not in production
    if (process.env.NODE_ENV === 'production') {
        console.error('❌ ERROR: This script cannot be run in production!');
        process.exit(1);
    }

    // Confirmation for non-production environments
    console.log('⚠️  WARNING: This will update ALL user passwords to:', NEW_PASSWORD);
    console.log('Environment:', process.env.NODE_ENV || 'development');
    console.log('Database:', process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'unknown');
    console.log('');

    try {
        // Get all users
        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                username: true,
            },
        });

        if (users.length === 0) {
            console.log('ℹ️  No users found in database.');
            return;
        }

        console.log(`📊 Found ${users.length} user(s) to update\n`);

        // Hash the new password using the application's PasswordHasher
        console.log('🔒 Hashing password with Argon2...');
        const hashedPassword = await passwordHasher.hash(NEW_PASSWORD);
        console.log('✅ Password hashed successfully\n');

        // Update all users
        console.log('📝 Updating users...');
        let successCount = 0;
        let errorCount = 0;

        for (const user of users) {
            try {
                await prisma.user.update({
                    where: { id: user.id },
                    data: { passwordHash: hashedPassword },
                });
                console.log(`  ✓ ${user.username} (${user.email})`);
                successCount++;
            } catch (error) {
                console.error(`  ✗ ${user.username} (${user.email}):`, error.message);
                errorCount++;
            }
        }

        console.log('\n================================');
        console.log('📊 Summary:');
        console.log(`  • Total users: ${users.length}`);
        console.log(`  • Successfully updated: ${successCount}`);
        console.log(`  • Errors: ${errorCount}`);
        console.log('\n✅ Password update complete!');
        console.log(`\nℹ️  All users can now login with password: ${NEW_PASSWORD}`);

    } catch (error) {
        console.error('\n❌ Error updating passwords:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the script
if (require.main === module) {
    updateAllPasswords()
        .then(() => {
            process.exit(0);
        })
        .catch((error) => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { updateAllPasswords };

