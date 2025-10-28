import { Logo } from './Logo';
import { SearchBar } from './SearchBar';
import { Navigation } from './Navigation';
import { UserMenu } from './UserMenu';
import { MobileMenu } from './MobileMenu';
import { useHeader } from '../model/useHeader';
import { MenuIcon, CloseIcon } from '../../../shared/ui';

export const Header = () => {
    const {
        user,
        isAuthenticated,
        mobileMenuOpen,
        toggleMobileMenu,
        closeMobileMenu,
        handleLogout,
    } = useHeader();

    return (
        <header className="header">
            <div className="header-container">
                {/* Logo - Fixed width, no shrink */}
                <div className="header-left">
                    <Logo />
                </div>

                {/* Search - Flexible, can shrink */}
                <div className="header-center">
                    <SearchBar />
                </div>

                {/* Navigation - Fixed width, no shrink */}
                <div className="header-right">
                    {isAuthenticated ? (
                        <>
                            <Navigation isAuthenticated={true} />
                            <UserMenu user={user} onLogout={handleLogout} />
                        </>
                    ) : (
                        <Navigation isAuthenticated={false} />
                    )}
                </div>

                {/* Mobile menu button */}
                <button
                    className="header-mobile-btn"
                    onClick={toggleMobileMenu}
                    aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                    aria-expanded={mobileMenuOpen}
                >
                    {mobileMenuOpen ? <CloseIcon size={28} /> : <MenuIcon size={28} />}
                </button>
            </div>

            <MobileMenu
                isOpen={mobileMenuOpen}
                isAuthenticated={isAuthenticated}
                user={user}
                onClose={closeMobileMenu}
                onLogout={handleLogout}
            />
        </header>
    );
};

