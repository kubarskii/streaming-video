import { Link } from '@tanstack/react-router';
import { Button } from '../../../shared/ui';
import { UserIcon } from '../../../shared/ui';

/**
 * Navigation component that displays navigation links
 * @param {Object} props
 * @param {boolean} props.isAuthenticated - Whether user is authenticated
 */
export const Navigation = ({ isAuthenticated }) => {

  if (!isAuthenticated) {
    return (
      <div className="header-auth">
        <Link to="/channels">
          <Button variant="ghost" size="small">
            Channels
          </Button>
        </Link>
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
      <Link to="/channels">
        <Button variant="ghost" size="small">
          Channels
        </Button>
      </Link>
      <Link to="/subscriptions">
        <Button variant="ghost" size="small">
          Subscriptions
        </Button>
      </Link>
    </nav>
  );
};

