import { Link } from '@tanstack/react-router';
import { Avatar } from '../../../shared/ui';
import { UserIcon, LogoutIcon } from '../../../shared/ui';

export const UserMenu = ({ user, onLogout }) => {
  if (!user) return null;

  return (
    <div className="header-user-menu">
      <button 
        className="header-user-btn" 
        aria-label="User menu"
        aria-haspopup="true"
        title={user.username}
      >
        <Avatar name={user.username} size="small" />
      </button>
      <div className="header-user-dropdown" role="menu">
        <div className="header-dropdown-header">
          <Avatar name={user.username} size="medium" />
          <div className="header-user-info">
            <div className="header-user-name">{user.username}</div>
            <div className="header-user-email">{user.email}</div>
          </div>
        </div>
        <div className="header-dropdown-divider" />
        <Link to="/profile" className="header-dropdown-item" role="menuitem">
          <UserIcon size={20} />
          <span>Your videos</span>
        </Link>
        <div className="header-dropdown-divider" />
        <button onClick={onLogout} className="header-dropdown-item header-dropdown-item--logout" role="menuitem">
          <LogoutIcon size={20} />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );
};

