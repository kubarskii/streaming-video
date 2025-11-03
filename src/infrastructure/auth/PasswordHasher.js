// @ts-check
// Infrastructure: PasswordHasher using Argon2

const argon2 = require('argon2');

class PasswordHasher {
    constructor() {
        this.options = {
            type: argon2.argon2id,
            memoryCost: 65536, // 64 MB
            timeCost: 3,
            parallelism: 4,
        };
    }

    async hash(password) {
        return await argon2.hash(password, this.options);
    }

    async verify(hash, password) {
        try {
            return await argon2.verify(hash, password);
        } catch (error) {
            console.error('Password verification error:', error);
            return false;
        }
    }
}

module.exports = PasswordHasher;

