// Application: AuthService

const RegisterUserUseCase = require('../use-cases/RegisterUserUseCase');
const LoginUserUseCase = require('../use-cases/LoginUserUseCase');

class AuthService {
    constructor(userRepository, passwordHasher, jwtService) {
        this.registerUserUseCase = new RegisterUserUseCase(userRepository, passwordHasher);
        this.loginUserUseCase = new LoginUserUseCase(userRepository, passwordHasher, jwtService);
        this.jwtService = jwtService;
        this.userRepository = userRepository;
    }

    async register(input) {
        return await this.registerUserUseCase.execute(input);
    }

    async login(input) {
        return await this.loginUserUseCase.execute(input);
    }

    async verifyToken(token) {
        return this.jwtService.verifyToken(token);
    }

    async getUserFromToken(token) {
        const payload = this.jwtService.verifyToken(token);
        if (!payload) return null;

        return await this.userRepository.findById(payload.userId);
    }
}

module.exports = AuthService;

