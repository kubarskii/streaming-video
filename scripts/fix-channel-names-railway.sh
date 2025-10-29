#!/bin/bash
# Railway deployment script to fix channel names
# This runs as part of a one-time deployment

echo "Starting channel name fix..."
node scripts/fix-channel-names.js
echo "Channel fix completed!"

