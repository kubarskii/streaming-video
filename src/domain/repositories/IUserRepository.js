// Repository Interface: IUserRepository

class IUserRepository {
    async save(user) {
        throw new Error('Method not implemented');
    }

    async findById(id) {
        throw new Error('Method not implemented');
    }

    async findByEmail(email) {
        throw new Error('Method not implemented');
    }

    async findByUsername(username) {
        throw new Error('Method not implemented');
    }

    async update(user) {
        throw new Error('Method not implemented');
    }

    async deleteById(id) {
        throw new Error('Method not implemented');
    }
}

module.exports = IUserRepository;

