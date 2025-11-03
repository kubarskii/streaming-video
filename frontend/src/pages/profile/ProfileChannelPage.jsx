// Profile Channel Page - Channel customization settings
import { useState, useEffect } from 'react';
import { useAuth } from '../../shared/context/AuthContext';
import { useAbortController } from '../../shared/lib';
import { channelsAPI } from '../../shared/api/channels';
import { useNavigate } from '@tanstack/react-router';
import { Button, Skeleton } from '../../shared/ui';
import styles from './ProfilePage.module.css';

export const ProfileChannelPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const signal = useAbortController();
    const [channel, setChannel] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showChannelForm, setShowChannelForm] = useState(false);
    const [channelForm, setChannelForm] = useState({
        name: '',
        description: '',
    });

    useEffect(() => {
        loadChannel();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    const loadChannel = async () => {
        try {
            setLoading(true);
            const channelData = await channelsAPI.getChannel({ userId: user.id, signal });
            setChannel(channelData);
            setChannelForm({
                name: channelData.name,
                description: channelData.description || '',
            });
        } catch (err) {
            if (err.name !== 'AbortError' && err.name !== 'CanceledError') {
                setChannel(null);
                setChannelForm({
                    name: user.username || '',
                    description: '',
                });
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCreateChannel = async () => {
        try {
            const newChannel = await channelsAPI.createChannel(channelForm);
            setChannel(newChannel);
            setShowChannelForm(false);
        } catch (err) {
            console.error('Error creating channel:', err);
            alert('Failed to create channel: ' + err.message);
        }
    };

    const handleUpdateChannel = async () => {
        try {
            const updated = await channelsAPI.updateChannel(channel.id, channelForm);
            setChannel(updated);
            setShowChannelForm(false);
        } catch (err) {
            console.error('Error updating channel:', err);
            alert('Failed to update channel: ' + err.message);
        }
    };

    if (loading) {
        return (
            <div className={styles['studio-tab-content']}>
                <div className={styles['studio-header']}>
                    <div>
                        <Skeleton width="200px" height="2rem" />
                        <Skeleton width="300px" height="1rem" />
                    </div>
                </div>
                <div className={styles['channel-form']}>
                    <div className={styles['form-group']}>
                        <Skeleton width="100px" height="1rem" />
                        <Skeleton width="100%" height="40px" />
                    </div>
                    <div className={styles['form-group']}>
                        <Skeleton width="120px" height="1rem" />
                        <Skeleton width="100%" height="100px" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles['studio-tab-content']}>
            <div className={styles['studio-header']}>
                <div>
                    <h1>Channel</h1>
                    <p className={styles['studio-subtitle']}>Manage your channel settings</p>
                </div>
                {channel && (
                    <Button
                        variant="secondary"
                        onClick={() => navigate({ to: `/channel/${user.id}` })}
                    >
                        View Public Channel
                    </Button>
                )}
            </div>

            {!channel ? (
                <div className={styles['studio-form-card']}>
                    <h2>Create Your Channel</h2>
                    <p>Create a channel to make your videos discoverable by others</p>
                    <div className={styles['form-group']}>
                        <label>Channel Name</label>
                        <input
                            type="text"
                            placeholder="Channel Name"
                            value={channelForm.name}
                            onChange={(e) => setChannelForm({ ...channelForm, name: e.target.value })}
                            className={styles['form-input']}
                        />
                    </div>
                    <div className={styles['form-group']}>
                        <label>Description</label>
                        <textarea
                            placeholder="Channel Description"
                            value={channelForm.description}
                            onChange={(e) => setChannelForm({ ...channelForm, description: e.target.value })}
                            className={styles['form-textarea']}
                            rows="4"
                        />
                    </div>
                    <div className={styles['form-actions']}>
                        <Button onClick={handleCreateChannel}>Create Channel</Button>
                    </div>
                </div>
            ) : (
                <div className={styles['studio-form-card']}>
                    <h2>Edit Channel</h2>
                    <div className={styles['form-group']}>
                        <label>Channel Name</label>
                        <input
                            type="text"
                            placeholder="Channel Name"
                            value={channelForm.name}
                            onChange={(e) => setChannelForm({ ...channelForm, name: e.target.value })}
                            className={styles['form-input']}
                        />
                    </div>
                    <div className={styles['form-group']}>
                        <label>Description</label>
                        <textarea
                            placeholder="Channel Description"
                            value={channelForm.description}
                            onChange={(e) => setChannelForm({ ...channelForm, description: e.target.value })}
                            className={styles['form-textarea']}
                            rows="4"
                        />
                    </div>
                    <div className={styles['form-actions']}>
                        <Button onClick={handleUpdateChannel}>Save Changes</Button>
                        <Button variant="secondary" onClick={() => setChannelForm({
                            name: channel.name,
                            description: channel.description || '',
                        })}>
                            Cancel
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

