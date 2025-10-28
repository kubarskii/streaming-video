// Domain Entity: User
// Represents a user in our domain with business rules

class User {
    constructor({
        id,
        email,
        username,
        passwordHash,
        createdAt,
        updatedAt
    }) {
        this.id = id;
        this.email = email;
        this.username = username;
        this.passwordHash = passwordHash;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;

        this.validate();
    }

    validate() {
        if (!this.id) {
            throw new Error('User ID is required');
        }
        if (!this.email) {
            throw new Error('Email is required');
        }
        if (!this.username) {
            throw new Error('Username is required');
        }
        if (!this.passwordHash) {
            throw new Error('Password hash is required');
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(this.email)) {
            throw new Error('Invalid email format');
        }

        // Username validation (alphanumeric, underscore, 3-20 chars)
        const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
        if (!usernameRegex.test(this.username)) {
            throw new Error('Username must be 3-20 characters (letters, numbers, underscore)');
        }
    }

    toObject() {
        return {
            id: this.id,
            email: this.email,
            username: this.username,
            passwordHash: this.passwordHash,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    toPublicObject() {
        return {
            id: this.id,
            email: this.email,
            username: this.username,
            createdAt: this.createdAt
        };
    }

    static fromDatabase(dbRecord) {
        return new User({
            id: dbRecord.id,
            email: dbRecord.email,
            username: dbRecord.username,
            passwordHash: dbRecord.passwordHash,
            createdAt: dbRecord.createdAt,
            updatedAt: dbRecord.updatedAt
        });
    }
}

module.exports = User;

