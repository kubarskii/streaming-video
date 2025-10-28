# Header Widget

A comprehensive header component following Feature-Sliced Design (FSD) architecture.

## Structure

```
header/
├── ui/                    # UI components
│   ├── Header.jsx        # Main header component
│   ├── Logo.jsx          # Logo component
│   ├── SearchBar.jsx     # Search bar with form handling
│   ├── Navigation.jsx    # Desktop navigation
│   ├── UserMenu.jsx      # User dropdown menu
│   └── MobileMenu.jsx    # Mobile navigation
├── model/                # Business logic
│   └── useHeader.js      # Custom hook for header state
├── styles.css            # Styles
├── index.js              # Public API
└── README.md             # Documentation
```

## Features

- **Responsive Design**: Adapts seamlessly from mobile to desktop
- **Search Functionality**: Integrated search bar with URL parameter support
- **User Authentication**: Shows appropriate UI based on auth state
- **Mobile Menu**: Hamburger menu for mobile devices
- **Accessibility**: Full keyboard navigation and ARIA labels
- **Modern UI**: YouTube-inspired clean and professional design

## Usage

```jsx
import { Header } from '@/widgets/header';

function App() {
  return (
    <div>
      <Header />
      {/* Your content */}
    </div>
  );
}
```

## Components

### Header (Main)
The main header component that orchestrates all sub-components.

### Logo
Displays the app logo and brand name with link to home.

### SearchBar
Search input with form handling that navigates to home page with query params.

### Navigation
Shows authenticated user actions (upload button) or sign-in button.

### UserMenu
Dropdown menu with user info, profile link, and logout action.

### MobileMenu
Slide-down mobile navigation with all actions and user info.

## Dependencies

- `@tanstack/react-router` - Routing and navigation
- `../../shared/context/AuthContext` - Authentication state

## Styling

All styles are contained in `styles.css` and follow a component-based approach with BEM-like naming conventions.

### CSS Variables Used
- `--text-primary`
- `--text-secondary`
- `--border-color`
- `--primary-color`

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Responsive breakpoints: 768px, 480px
- Supports prefers-reduced-motion

