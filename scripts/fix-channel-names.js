#!/usr/bin/env node
/**
 * Script to fix channels with missing or invalid names
 * 
 * This script can be run on the deployed server to permanently fix
 * channels that have null or empty names in the database.
 * 
 * Usage:
 *   node scripts/fix-channel-names.js
 * 
 * Or on Railway/Render/Heroku:
 *   Run as a one-off command in your deployment platform
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixChannelNames() {
    try {
        console.log('=== Channel Name Fixer ===\n');
        console.log('Checking channels...');
        
        // Get all channels with user information
        const channels = await prisma.channel.findMany({
            include: {
                user: true
            }
        });
        
        console.log(`Found ${channels.length} total channels`);
        
        // Find channels without valid names
        const channelsWithoutNames = channels.filter(ch => 
            !ch.name || ch.name.trim().length === 0 || ch.name.trim().length < 3
        );
        
        console.log(`Channels needing fixes: ${channelsWithoutNames.length}`);
        
        if (channelsWithoutNames.length > 0) {
            console.log('\n--- Fixing channels ---\n');
            
            let fixedCount = 0;
            let failedCount = 0;
            
            for (const channel of channelsWithoutNames) {
                try {
                    // Generate a valid name
                    let newName;
                    if (channel.user && channel.user.username) {
                        newName = channel.user.username;
                    } else {
                        newName = `Channel_${channel.id.substring(0, 8)}`;
                    }
                    
                    // Ensure name is between 3-50 characters
                    if (newName.length < 3) {
                        newName = `Channel_${newName}`;
                    }
                    if (newName.length > 50) {
                        newName = newName.substring(0, 50);
                    }
                    
                    console.log(`  ✓ Updating channel ${channel.id}`);
                    console.log(`    Old name: "${channel.name || '(empty)'}"`);
                    console.log(`    New name: "${newName}"`);
                    
                    await prisma.channel.update({
                        where: { id: channel.id },
                        data: { name: newName }
                    });
                    
                    fixedCount++;
                } catch (error) {
                    console.error(`  ✗ Failed to update channel ${channel.id}:`, error.message);
                    failedCount++;
                }
            }
            
            console.log(`\n--- Results ---`);
            console.log(`✓ Fixed: ${fixedCount} channels`);
            if (failedCount > 0) {
                console.log(`✗ Failed: ${failedCount} channels`);
            }
        } else {
            console.log('\n✓ All channels have valid names!');
        }
        
        // Verify all channels now have valid names
        console.log('\n--- Verification ---');
        const allChannels = await prisma.channel.findMany({
            select: {
                id: true,
                userId: true,
                name: true,
                subscriberCount: true,
                videoCount: true
            }
        });
        
        const stillInvalid = allChannels.filter(ch => 
            !ch.name || ch.name.trim().length < 3
        );
        
        if (stillInvalid.length === 0) {
            console.log('✓ All channels verified! All have valid names.\n');
        } else {
            console.log(`⚠ Warning: ${stillInvalid.length} channels still have invalid names\n`);
        }
        
        console.log('Current channels:');
        console.table(allChannels);
        
        console.log('\n=== Done ===\n');
        
    } catch (error) {
        console.error('\n❌ Error:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the script
fixChannelNames().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});

