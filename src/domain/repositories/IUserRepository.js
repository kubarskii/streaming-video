// @ts-check
// Repository Interface: IUserRepository

/**
 * @typedef {import('../entities/User')} User
 */

class IUserRepository {
    /**
     * @param {User} user
     * @returns {Promise<User>}
     */
    async save(user) {
        throw new Error('Method not implemented');
    }

    /**
     * @param {string} id
     * @returns {Promise<User|null>}
     */
    async findById(id) {
        throw new Error('Method not implemented');
    }

    /**
     * @param {string} email
     * @returns {Promise<User|null>}
     */
    async findByEmail(email) {
        throw new Error('Method not implemented');
    }

    /**
     * @param {string} username
     * @returns {Promise<User|null>}
     */
    async findByUsername(username) {
        throw new Error('Method not implemented');
    }

    /**
     * @param {User} user
     * @returns {Promise<User>}
     */
    async update(user) {
        throw new Error('Method not implemented');
    }

    /**
     * @param {string} id
     * @returns {Promise<boolean>}
     */
    async deleteById(id) {
        throw new Error('Method not implemented');
    }
}

module.exports = IUserRepository;

