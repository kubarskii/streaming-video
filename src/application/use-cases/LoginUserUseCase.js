// Application: LoginUserUseCase

class LoginUserUseCase {
    constructor(userRepository, passwordHasher, jwtService) {
        this.userRepository = userRepository;
        this.passwordHasher = passwordHasher;
        this.jwtService = jwtService;
    }

    async execute(input) {
        // Validate input
        if (!input.emailOrUsername) {
            throw new Error('Email or username is required');
        }
        if (!input.password) {
            throw new Error('Password is required');
        }

        // Find user by email or username
        const emailOrUsername = input.emailOrUsername.trim();
        let user = null;

        // Try email first
        if (emailOrUsername.includes('@')) {
            user = await this.userRepository.findByEmail(emailOrUsername.toLowerCase());
        } else {
            user = await this.userRepository.findByUsername(emailOrUsername);
        }

        if (!user) {
            throw new Error('Invalid credentials');
        }

        // Verify password
        const isPasswordValid = await this.passwordHasher.verify(
            user.passwordHash,
            input.password
        );

        if (!isPasswordValid) {
            throw new Error('Invalid credentials');
        }

        // Generate JWT token
        const token = this.jwtService.generateToken({
            userId: user.id,
            email: user.email,
            username: user.username,
        });

        return {
            user: user.toPublicObject(),
            token,
        };
    }
}

module.exports = LoginUserUseCase;

