// Infrastructure: JWT Service

const jwt = require('jsonwebtoken');

class JWTService {
    constructor() {
        this.secret = process.env.JWT_SECRET || 'default-jwt-secret-change-in-production';
        this.expiresIn = process.env.JWT_EXPIRES_IN || '7d';
    }

    generateToken(payload) {
        return jwt.sign(payload, this.secret, {
            expiresIn: this.expiresIn,
        });
    }

    verifyToken(token) {
        try {
            return jwt.verify(token, this.secret);
        } catch (error) {
            return null;
        }
    }

    decodeToken(token) {
        return jwt.decode(token);
    }
}

module.exports = JWTService;

