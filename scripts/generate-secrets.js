// Generate secure secrets for production deployment
const crypto = require('crypto');

console.log('🔐 Generate Production Secrets\n');
console.log('Copy these to your deployment platform:\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const jwtSecret = crypto.randomBytes(32).toString('base64');
const argonSecret = crypto.randomBytes(32).toString('base64');

console.log(`JWT_SECRET=${jwtSecret}`);
console.log(`ARGON2_SECRET=${argonSecret}`);

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('✅ Keep these secrets safe!');
console.log('⚠️  Never commit them to git!\n');

