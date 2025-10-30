import React from 'react';
import { FaTimes } from 'react-icons/fa';
import './KeyboardShortcuts.css';

export const KeyboardShortcuts = ({ onClose, show }) => {
    if (!show) return null;

    const shortcuts = [
        { key: 'Space / K', description: 'Play/Pause' },
        { key: '← / →', description: 'Seek backward/forward 5s' },
        { key: 'J / L', description: 'Seek backward/forward 10s' },
        { key: '↑ / ↓', description: 'Volume up/down' },
        { key: 'M', description: 'Mute/Unmute' },
        { key: 'F', description: 'Fullscreen' },
        { key: 'N', description: 'Next video (if available)' },
        { key: 'P', description: 'Previous video (if available)' },
        { key: '?', description: 'Show shortcuts' },
    ];

    return (
        <div className="keyboard-shortcuts-overlay" onClick={onClose}>
            <div className="keyboard-shortcuts-modal" onClick={(e) => e.stopPropagation()}>
                <div className="shortcuts-header">
                    <h3>Keyboard Shortcuts</h3>
                    <button className="close-button" onClick={onClose}>
                        <FaTimes />
                    </button>
                </div>
                <div className="shortcuts-list">
                    {shortcuts.map(({ key, description }) => (
                        <div key={key} className="shortcut-item">
                            <kbd className="shortcut-key">{key}</kbd>
                            <span className="shortcut-description">{description}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default KeyboardShortcuts;

