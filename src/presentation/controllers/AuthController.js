// Presentation: AuthController

class AuthController {
    constructor(authService) {
        this.authService = authService;
    }

    async register(req, res) {
        try {
            const body = await this.parseJSON(req);

            const user = await this.authService.register({
                email: body.email,
                username: body.username,
                password: body.password,
            });

            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                message: 'User registered successfully',
                user: user.toPublicObject(),
            }));
        } catch (error) {
            console.error('Registration error:', error);
            const statusCode = error.message.includes('already') ? 409 : 400;
            res.writeHead(statusCode, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
    }

    async login(req, res) {
        try {
            const body = await this.parseJSON(req);

            const result = await this.authService.login({
                emailOrUsername: body.emailOrUsername,
                password: body.password,
            });

            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Set-Cookie': `token=${result.token}; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax`,
            });
            res.end(JSON.stringify({
                message: 'Login successful',
                user: result.user,
                token: result.token,
            }));
        } catch (error) {
            console.error('Login error:', error);
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
    }

    async logout(req, res) {
        res.writeHead(200, {
            'Content-Type': 'application/json',
            'Set-Cookie': 'token=; HttpOnly; Path=/; Max-Age=0',
        });
        res.end(JSON.stringify({ message: 'Logged out successfully' }));
    }

    async me(req, res) {
        try {
            if (!req.user) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Not authenticated' }));
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ user: req.user.toPublicObject() }));
        } catch (error) {
            console.error('Get me error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
        }
    }

    parseJSON(req) {
        return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', chunk => (body += chunk.toString()));
            req.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (error) {
                    reject(new Error('Invalid JSON'));
                }
            });
            req.on('error', reject);
        });
    }
}

module.exports = AuthController;

