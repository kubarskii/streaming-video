// @ts-check
// Domain Entity: Playlist
// Represents a curated list of videos that can be shared or grouped together

class Playlist {
    constructor({
        id,
        title,
        description = null,
        isPublic = true,
        slug = null,
        userId = null,
        createdAt = new Date(),
        updatedAt = new Date(),
        videos = [],
        user = null
    }) {
        this.id = id;
        this.title = title;
        this.description = description;
        this.isPublic = isPublic;
        this.slug = slug;
        this.userId = userId;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.videos = videos;
        this.user = user;

        this.validate();
    }

    validate() {
        if (!this.id) {
            throw new Error('Playlist ID is required');
        }
        if (!this.title || typeof this.title !== 'string') {
            throw new Error('Playlist title is required');
        }
    }

    rename(newTitle) {
        if (!newTitle || typeof newTitle !== 'string') {
            throw new Error('Playlist title is required');
        }
        this.title = newTitle;
        this.touch();
    }

    updateDescription(newDescription) {
        this.description = newDescription ?? null;
        this.touch();
    }

    setVisibility(isPublic) {
        this.isPublic = Boolean(isPublic);
        this.touch();
    }

    updateSlug(newSlug) {
        this.slug = newSlug || null;
        this.touch();
    }

    touch() {
        this.updatedAt = new Date();
    }

    toObject() {
        return {
            id: this.id,
            title: this.title,
            description: this.description,
            isPublic: this.isPublic,
            slug: this.slug,
            userId: this.userId,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    static fromDatabase(dbRecord) {
        return new Playlist({
            id: dbRecord.id,
            title: dbRecord.title,
            description: dbRecord.description,
            isPublic: dbRecord.isPublic,
            slug: dbRecord.slug,
            userId: dbRecord.userId,
            createdAt: dbRecord.createdAt,
            updatedAt: dbRecord.updatedAt,
            videos: dbRecord.videos || [],
            user: dbRecord.user || null
        });
    }
}

module.exports = Playlist;

