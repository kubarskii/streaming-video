// @ts-check
// Presentation: ChannelController
// HTTP request handlers for channel operations

class ChannelController {
    constructor(
        createChannelUseCase,
        getChannelUseCase,
        updateChannelUseCase,
        listChannelsUseCase
    ) {
        this.createChannelUseCase = createChannelUseCase;
        this.getChannelUseCase = getChannelUseCase;
        this.updateChannelUseCase = updateChannelUseCase;
        this.listChannelsUseCase = listChannelsUseCase;
    }

    /**
     * Create a new channel
     */
    async createChannel(req, res) {
        try {
            if (!req.user) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Not authenticated' }));
            }

            const body = await this.parseJSON(req);
            const { name, description, avatarUrl, bannerUrl } = body;

            if (!name) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Channel name is required' }));
            }

            const channel = await this.createChannelUseCase.execute({
                userId: req.user.id,
                name,
                description,
                avatarUrl,
                bannerUrl
            });

            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(channel.toObject()));
        } catch (error) {
            console.error('Error creating channel:', error);

            if (error.message.includes('already has a channel')) {
                res.writeHead(409, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: error.message }));
            }

            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
        }
    }

    /**
     * Get channel by ID or user ID
     */
    async getChannel(req, res, queryParams) {
        try {
            const { channelId, userId } = queryParams;

            const channel = await this.getChannelUseCase.execute({
                channelId,
                userId
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(channel.toObject()));
        } catch (error) {
            console.error('Error getting channel:', error);

            if (error.message === 'Channel not found') {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: error.message }));
            }

            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
        }
    }

    /**
     * Update channel
     */
    async updateChannel(req, res, channelId) {
        try {
            if (!req.user) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Not authenticated' }));
            }

            const body = await this.parseJSON(req);
            const { name, description, avatarUrl, bannerUrl } = body;

            const channel = await this.updateChannelUseCase.execute({
                channelId,
                userId: req.user.id,
                name,
                description,
                avatarUrl,
                bannerUrl
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(channel.toObject()));
        } catch (error) {
            console.error('Error updating channel:', error);

            if (error.message === 'Channel not found') {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: error.message }));
            }

            if (error.message.includes('Unauthorized')) {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: error.message }));
            }

            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
        }
    }

    /**
     * List channels
     */
    async listChannels(req, res, queryParams) {
        try {
            const limit = parseInt(queryParams.limit || '20', 10);
            const offset = parseInt(queryParams.offset || '0', 10);
            const sortBy = queryParams.sortBy || 'subscriberCount';

            const channels = await this.listChannelsUseCase.execute({
                limit,
                offset,
                sortBy
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                channels: channels.map(c => c.toObject()),
                limit,
                offset
            }));
        } catch (error) {
            console.error('Error listing channels:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
        }
    }

    /**
     * Parse JSON body from request
     * @param {import('http').IncomingMessage} req - The HTTP request object
     * @returns {Promise<Object>} Parsed JSON object from request body
     * @throws {Error} If the request body is not valid JSON
     */
    parseJSON(req) {
        return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
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

module.exports = ChannelController;

