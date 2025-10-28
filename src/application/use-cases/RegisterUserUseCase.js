// Application: RegisterUserUseCase

const { v4: uuidv4 } = require('uuid');
const User = require('../../domain/entities/User');

class RegisterUserUseCase {
    constructor(userRepository, passwordHasher) {
        this.userRepository = userRepository;
        this.passwordHasher = passwordHasher;
    }

    async execute(input) {
        // Validate input
        if (!input.email) {
            throw new Error('Email is required');
        }
        if (!input.username) {
            throw new Error('Username is required');
        }
        if (!input.password) {
            throw new Error('Password is required');
        }

        // Password strength validation
        if (input.password.length < 8) {
            throw new Error('Password must be at least 8 characters');
        }

        // Check if user already exists
        const existingEmail = await this.userRepository.findByEmail(input.email);
        if (existingEmail) {
            throw new Error('Email already registered');
        }

        const existingUsername = await this.userRepository.findByUsername(input.username);
        if (existingUsername) {
            throw new Error('Username already taken');
        }

        // Hash password
        const passwordHash = await this.passwordHasher.hash(input.password);

        // Create user entity
        const user = new User({
            id: uuidv4(),
            email: input.email.toLowerCase().trim(),
            username: input.username.trim(),
            passwordHash,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        // Save to database
        const savedUser = await this.userRepository.save(user);

        return savedUser;
    }
}

module.exports = RegisterUserUseCase;

