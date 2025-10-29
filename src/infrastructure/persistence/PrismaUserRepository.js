// @ts-check
// Infrastructure: PrismaUserRepository

const IUserRepository = require('../../domain/repositories/IUserRepository');
const User = require('../../domain/entities/User');

class PrismaUserRepository extends IUserRepository {
    constructor(prismaClient) {
        super();
        this.prisma = prismaClient;
    }

    async save(user) {
        const data = {
            id: user.id,
            email: user.email,
            username: user.username,
            passwordHash: user.passwordHash,
            createdAt: user.createdAt,
        };

        const saved = await this.prisma.user.create({
            data,
        });

        return User.fromDatabase(saved);
    }

    async findById(id) {
        const record = await this.prisma.user.findUnique({
            where: { id },
        });

        return record ? User.fromDatabase(record) : null;
    }

    async findByEmail(email) {
        const record = await this.prisma.user.findUnique({
            where: { email },
        });

        return record ? User.fromDatabase(record) : null;
    }

    async findByUsername(username) {
        const record = await this.prisma.user.findUnique({
            where: { username },
        });

        return record ? User.fromDatabase(record) : null;
    }

    async update(user) {
        const data = {
            email: user.email,
            username: user.username,
            passwordHash: user.passwordHash,
            updatedAt: user.updatedAt,
        };

        const updated = await this.prisma.user.update({
            where: { id: user.id },
            data,
        });

        return User.fromDatabase(updated);
    }

    async deleteById(id) {
        try {
            await this.prisma.user.delete({
                where: { id },
            });
            return true;
        } catch (error) {
            console.error('Error deleting user:', error);
            return false;
        }
    }
}

module.exports = PrismaUserRepository;

