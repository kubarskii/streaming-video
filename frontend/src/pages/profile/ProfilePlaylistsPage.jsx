// Profile Playlists Page - Manage playlists with card layout
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../shared/context/AuthContext';
import { useAbortController } from '../../shared/lib';
import { videosAPI } from '../../shared/api/videos';
import { playlistsAPI } from '../../shared/api/playlists';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Button, EmptyState, VideoEmptyIcon, EditIcon, DeleteIcon, PlaylistCardSkeleton } from '../../shared/ui';
import { formatDate } from '../../shared/lib';
import styles from './ProfilePage.module.css';

export const ProfilePlaylistsPage = () => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const navigate = useNavigate();
    const signal = useAbortController();
    
    const [playlists, setPlaylists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showPlaylistForm, setShowPlaylistForm] = useState(false);
    const [editingPlaylist, setEditingPlaylist] = useState(null);
    const [playlistForm, setPlaylistForm] = useState({
        title: '',
        description: '',
        isPublic: true,
    });
    const [creatingPlaylist, setCreatingPlaylist] = useState(false);
    const [updatingPlaylist, setUpdatingPlaylist] = useState(null);
    const [deletingPlaylist, setDeletingPlaylist] = useState(null);

    useEffect(() => {
        loadUserPlaylists();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    const loadUserPlaylists = async () => {
        try {
            setLoading(true);
            const data = await playlistsAPI.getPlaylists({
                userId: user.id,
                includeVideos: true
            }, signal);
            setPlaylists(data.playlists || []);
        } catch (err) {
            if (err.name !== 'AbortError' && err.name !== 'CanceledError') {
                console.error('Error loading playlists:', err);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCreatePlaylist = async () => {
        try {
            setCreatingPlaylist(true);
            await playlistsAPI.createPlaylist({
                title: playlistForm.title.trim(),
                description: playlistForm.description.trim() || null,
                isPublic: playlistForm.isPublic,
                userId: user.id,
            });
            setPlaylistForm({ title: '', description: '', isPublic: true });
            setShowPlaylistForm(false);
            await loadUserPlaylists();
        } catch (err) {
            console.error('Error creating playlist:', err);
            alert('Failed to create playlist: ' + err.message);
        } finally {
            setCreatingPlaylist(false);
        }
    };

    const handleUpdatePlaylist = async (playlistId, updates) => {
        try {
            setUpdatingPlaylist(playlistId);
            await playlistsAPI.updatePlaylist(playlistId, updates);
            await loadUserPlaylists();
            setEditingPlaylist(null);
            setShowPlaylistForm(false);
        } catch (err) {
            console.error('Error updating playlist:', err);
            alert('Failed to update playlist: ' + err.message);
        } finally {
            setUpdatingPlaylist(null);
        }
    };

    const handleDeletePlaylist = async (playlistId) => {
        if (!window.confirm('Are you sure you want to delete this playlist?')) {
            return;
        }
        try {
            setDeletingPlaylist(playlistId);
            await playlistsAPI.deletePlaylist(playlistId);
            await loadUserPlaylists();
        } catch (err) {
            console.error('Error deleting playlist:', err);
            alert('Failed to delete playlist: ' + err.message);
        } finally {
            setDeletingPlaylist(null);
        }
    };

    const handleManagePlaylist = (playlistId) => {
        navigate({ to: `/playlist/${playlistId}/manage` });
    };

    if (loading) {
        return (
            <div className={styles['studio-tab-content']}>
                <div className={styles['studio-header']}>
                    <h1>Playlists</h1>
                </div>
                <div className={styles['playlists-grid']}>
                    {Array.from({ length: 4 }).map((_, index) => (
                        <PlaylistCardSkeleton key={index} />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className={styles['studio-tab-content']}>
            <div className={styles['studio-header']}>
                <div>
                    <h1>Playlists</h1>
                    <p className={styles['studio-subtitle']}>
                        {playlists.length} {playlists.length === 1 ? 'playlist' : 'playlists'}
                    </p>
                </div>
                <Button
                    variant="primary"
                    onClick={() => {
                        setShowPlaylistForm(true);
                        setEditingPlaylist(null);
                        setPlaylistForm({ title: '', description: '', isPublic: true });
                    }}
                >
                    Create Playlist
                </Button>
            </div>

            {showPlaylistForm && (
                <div className={styles['studio-form-card']}>
                    <h3>{editingPlaylist ? 'Edit Playlist' : 'Create Playlist'}</h3>
                    <div className={styles['form-group']}>
                        <input
                            type="text"
                            placeholder="Playlist Title"
                            value={playlistForm.title}
                            onChange={(e) => setPlaylistForm({ ...playlistForm, title: e.target.value })}
                            className={styles['form-input']}
                        />
                    </div>
                    <div className={styles['form-group']}>
                        <textarea
                            placeholder="Description (optional)"
                            value={playlistForm.description}
                            onChange={(e) => setPlaylistForm({ ...playlistForm, description: e.target.value })}
                            className={styles['form-textarea']}
                            rows="3"
                        />
                    </div>
                    <label className={styles['form-checkbox']}>
                        <input
                            type="checkbox"
                            checked={playlistForm.isPublic}
                            onChange={(e) => setPlaylistForm({ ...playlistForm, isPublic: e.target.checked })}
                        />
                        <span>Public playlist</span>
                    </label>
                    <div className={styles['form-actions']}>
                        <Button
                            onClick={() => {
                                if (editingPlaylist) {
                                    handleUpdatePlaylist(editingPlaylist.id, playlistForm);
                                } else {
                                    handleCreatePlaylist();
                                }
                            }}
                            disabled={creatingPlaylist || updatingPlaylist === editingPlaylist?.id}
                        >
                            {(creatingPlaylist || updatingPlaylist === editingPlaylist?.id) ? 'Saving...' : (editingPlaylist ? 'Save' : 'Create')}
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() => {
                                setShowPlaylistForm(false);
                                setEditingPlaylist(null);
                                setPlaylistForm({ title: '', description: '', isPublic: true });
                            }}
                            disabled={creatingPlaylist || updatingPlaylist === editingPlaylist?.id}
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            )}

            {playlists.length === 0 && !showPlaylistForm ? (
                <EmptyState
                    icon={<VideoEmptyIcon />}
                    title="No playlists yet"
                    description="Create a playlist to organize your videos"
                    action={
                        <Button
                            variant="primary"
                            onClick={() => {
                                setShowPlaylistForm(true);
                                setEditingPlaylist(null);
                                setPlaylistForm({ title: '', description: '', isPublic: true });
                            }}
                        >
                            Create Playlist
                        </Button>
                    }
                />
            ) : (
                <div className={styles['playlists-grid']}>
                    {playlists.map(playlist => (
                        <div key={playlist.id} className={styles['playlist-card']}>
                            <div className={styles['playlist-card-thumbnail']}>
                                <img
                                    src={playlist.videos?.[0]?.video?.thumbnailUrl || '/placeholder-video.png'}
                                    alt={playlist.title}
                                />
                                <div className={styles['playlist-overlay']}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M4 2h16a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm0 2v16h16V4H4zm2 2h12v2H6V6zm0 4h12v2H6v-2zm0 4h12v2H6v-2z" />
                                    </svg>
                                    <span>{playlist.videos?.length || 0} videos</span>
                                </div>
                            </div>
                            
                            <div className={styles['playlist-card-info']}>
                                <div className={styles['playlist-card-title']}>{playlist.title}</div>
                                {playlist.description && (
                                    <div className={styles['playlist-card-description']}>
                                        {playlist.description}
                                    </div>
                                )}
                                <div className={styles['playlist-card-meta']}>
                                    <span className={`${styles['visibility-badge']} ${playlist.isPublic ? styles['public'] : styles['private']}`}>
                                        {playlist.isPublic ? 'Public' : 'Private'}
                                    </span>
                                    <span>•</span>
                                    <span>{formatDate(playlist.createdAt)}</span>
                                </div>
                            </div>
                            
                            <div className={styles['playlist-card-actions']}>
                                <Button
                                    variant="ghost"
                                    size="small"
                                    onClick={() => handleManagePlaylist(playlist.id)}
                                    title="Manage"
                                >
                                    Manage
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="small"
                                    onClick={() => {
                                        setEditingPlaylist(playlist);
                                        setPlaylistForm({
                                            title: playlist.title,
                                            description: playlist.description || '',
                                            isPublic: playlist.isPublic,
                                        });
                                        setShowPlaylistForm(true);
                                    }}
                                    title="Edit"
                                >
                                    <EditIcon size={16} />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="small"
                                    onClick={() => handleDeletePlaylist(playlist.id)}
                                    disabled={deletingPlaylist === playlist.id}
                                    title="Delete"
                                >
                                    <DeleteIcon size={16} />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
