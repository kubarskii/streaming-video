-- CreateTable
CREATE TABLE "Playlist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "slug" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT,
    CONSTRAINT "Playlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlaylistVideo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playlistId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlaylistVideo_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "Playlist" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlaylistVideo_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Playlist_slug_key" ON "Playlist"("slug");

-- CreateIndex
CREATE INDEX "Playlist_userId_idx" ON "Playlist"("userId");

-- CreateIndex
CREATE INDEX "Playlist_isPublic_idx" ON "Playlist"("isPublic");

-- CreateIndex
CREATE INDEX "Playlist_createdAt_idx" ON "Playlist"("createdAt");

-- CreateIndex
CREATE INDEX "PlaylistVideo_videoId_idx" ON "PlaylistVideo"("videoId");

-- CreateIndex
CREATE INDEX "PlaylistVideo_playlistId_position_idx" ON "PlaylistVideo"("playlistId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "PlaylistVideo_playlistId_videoId_key" ON "PlaylistVideo"("playlistId", "videoId");
