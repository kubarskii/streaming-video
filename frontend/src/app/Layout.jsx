// App: Layout Component
import { Outlet } from '@tanstack/react-router';
import { Header } from '../widgets/header';
import '../widgets/header/styles.css';
import './styles/global.css';

export const Layout = () => {
    return (
        <div className="app">
            <Header />
            <main className="main-content">
                <Outlet />
            </main>
        </div>
    );
};
