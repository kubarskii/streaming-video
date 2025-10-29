// @ts-check
// Presentation: SubscriptionController
// HTTP request handlers for subscription operations

class SubscriptionController {
    constructor(
        subscribeToChannelUseCase,
        unsubscribeFromChannelUseCase,
        getUserSubscriptionsUseCase,
        checkSubscriptionStatusUseCase
    ) {
        this.subscribeToChannelUseCase = subscribeToChannelUseCase;
        this.unsubscribeFromChannelUseCase = unsubscribeFromChannelUseCase;
        this.getUserSubscriptionsUseCase = getUserSubscriptionsUseCase;
        this.checkSubscriptionStatusUseCase = checkSubscriptionStatusUseCase;
    }

    /**
     * Subscribe to a channel
     */
    async subscribe(req, res) {
        try {
            if (!req.user) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Not authenticated' }));
            }

            const body = await this.parseJSON(req);
            const { channelId } = body;

            if (!channelId) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Channel ID is required' }));
            }

            const subscription = await this.subscribeToChannelUseCase.execute({
                userId: req.user.id,
                channelId
            });

            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(subscription.toObject()));
        } catch (error) {
            console.error('Error subscribing to channel:', error);

            if (error.message === 'Channel not found') {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: error.message }));
            }

            if (error.message.includes('Already subscribed') || error.message.includes('own channel')) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: error.message }));
            }

            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
        }
    }

    /**
     * Unsubscribe from a channel
     */
    async unsubscribe(req, res, channelId) {
        try {
            if (!req.user) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Not authenticated' }));
            }

            await this.unsubscribeFromChannelUseCase.execute({
                userId: req.user.id,
                channelId
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Unsubscribed successfully' }));
        } catch (error) {
            console.error('Error unsubscribing from channel:', error);

            if (error.message.includes('Not subscribed')) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: error.message }));
            }

            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
        }
    }

    /**
     * Get user's subscriptions
     */
    async getSubscriptions(req, res, queryParams) {
        try {
            if (!req.user) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Not authenticated' }));
            }

            const limit = parseInt(queryParams.limit || '20', 10);
            const offset = parseInt(queryParams.offset || '0', 10);

            const subscriptions = await this.getUserSubscriptionsUseCase.execute({
                userId: req.user.id,
                limit,
                offset
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                subscriptions: subscriptions.map(s => s.toObject()),
                limit,
                offset
            }));
        } catch (error) {
            console.error('Error getting subscriptions:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
        }
    }

    /**
     * Check subscription status
     */
    async checkStatus(req, res, channelId) {
        try {
            if (!req.user) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Not authenticated' }));
            }

            const result = await this.checkSubscriptionStatusUseCase.execute({
                userId: req.user.id,
                channelId
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
        } catch (error) {
            console.error('Error checking subscription status:', error);
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

module.exports = SubscriptionController;

