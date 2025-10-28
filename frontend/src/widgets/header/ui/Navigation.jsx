import { Link } from '@tanstack/react-router';
import { Button } from '../../../shared/ui';
import { UploadIcon, UserIcon } from '../../../shared/ui';

export const Navigation = ({ isAuthenticated }) => {
  if (!isAuthenticated) {
    return (
      <div className="header-auth">
        <Link to="/login">
          <Button variant="secondary" size="small" icon={<UserIcon size={18} />}>
            Sign in
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <nav className="header-nav">
      <Link to="/upload" className="header-icon-btn" title="Upload video" aria-label="Upload video">
        <UploadIcon size={24} />
      </Link>
    </nav>
  );
};

