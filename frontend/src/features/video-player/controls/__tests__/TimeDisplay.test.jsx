/**
 * TimeDisplay Component Tests
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { TimeDisplay } from '../TimeDisplay/TimeDisplay';

describe('TimeDisplay', () => {
    describe('Rendering', () => {
        it('should render with current time and duration', () => {
            const { container } = render(
                <TimeDisplay currentTime={30} duration={120} />
            );
            const display = container.querySelector('.time-display');
            expect(display).toBeInTheDocument();
        });

        it('should format time correctly (minutes:seconds)', () => {
            const { container } = render(
                <TimeDisplay currentTime={90} duration={180} />
            );
            const current = container.querySelector('.time-display__current');
            const duration = container.querySelector('.time-display__duration');
            
            expect(current?.textContent).toBe('1:30');
            expect(duration?.textContent).toBe('3:00');
        });

        it('should format time with hours', () => {
            const { container } = render(
                <TimeDisplay currentTime={3665} duration={7200} />
            );
            const current = container.querySelector('.time-display__current');
            const duration = container.querySelector('.time-display__duration');
            
            expect(current?.textContent).toBe('1:01:05');
            expect(duration?.textContent).toBe('2:00:00');
        });

        it('should show separator between times', () => {
            const { container } = render(
                <TimeDisplay currentTime={30} duration={120} />
            );
            const separator = container.querySelector('.time-display__separator');
            expect(separator?.textContent).toBe(' / ');
        });
    });

    describe('Default Values', () => {
        it('should handle zero currentTime', () => {
            const { container } = render(
                <TimeDisplay currentTime={0} duration={120} />
            );
            const current = container.querySelector('.time-display__current');
            expect(current?.textContent).toBe('0:00');
        });

        it('should handle zero duration', () => {
            const { container } = render(
                <TimeDisplay currentTime={30} duration={0} />
            );
            const duration = container.querySelector('.time-display__duration');
            expect(duration?.textContent).toBe('0:00');
        });

        it('should use defaults when no props provided', () => {
            const { container } = render(<TimeDisplay />);
            const current = container.querySelector('.time-display__current');
            const duration = container.querySelector('.time-display__duration');
            
            expect(current?.textContent).toBe('0:00');
            expect(duration?.textContent).toBe('0:00');
        });
    });

    describe('Props', () => {
        it('should apply custom className', () => {
            const { container } = render(
                <TimeDisplay 
                    currentTime={30} 
                    duration={120} 
                    className="custom-class"
                />
            );
            const display = container.querySelector('.time-display');
            expect(display?.className).toContain('custom-class');
        });

        it('should apply collapsed class when collapsed', () => {
            const { container } = render(
                <TimeDisplay 
                    currentTime={30} 
                    duration={120} 
                    collapsed={true}
                />
            );
            const display = container.querySelector('.time-display');
            expect(display?.className).toContain('collapsed');
        });

        it('should not apply collapsed class by default', () => {
            const { container } = render(
                <TimeDisplay currentTime={30} duration={120} />
            );
            const display = container.querySelector('.time-display');
            expect(display?.className).not.toContain('collapsed');
        });
    });

    describe('Accessibility', () => {
        it('should have aria-live attribute', () => {
            const { container } = render(
                <TimeDisplay currentTime={30} duration={120} />
            );
            const display = container.querySelector('.time-display');
            expect(display).toHaveAttribute('aria-live', 'polite');
        });

        it('should have aria-atomic attribute', () => {
            const { container } = render(
                <TimeDisplay currentTime={30} duration={120} />
            );
            const display = container.querySelector('.time-display');
            expect(display).toHaveAttribute('aria-atomic', 'true');
        });
    });

    describe('Time Formatting Edge Cases', () => {
        it('should handle single-digit seconds', () => {
            const { container } = render(
                <TimeDisplay currentTime={5} duration={65} />
            );
            const current = container.querySelector('.time-display__current');
            const duration = container.querySelector('.time-display__duration');
            
            expect(current?.textContent).toBe('0:05');
            expect(duration?.textContent).toBe('1:05');
        });

        it('should handle exactly one minute', () => {
            const { container } = render(
                <TimeDisplay currentTime={60} duration={60} />
            );
            const current = container.querySelector('.time-display__current');
            const duration = container.querySelector('.time-display__duration');
            
            expect(current?.textContent).toBe('1:00');
            expect(duration?.textContent).toBe('1:00');
        });

        it('should handle exactly one hour', () => {
            const { container } = render(
                <TimeDisplay currentTime={3600} duration={3600} />
            );
            const current = container.querySelector('.time-display__current');
            const duration = container.querySelector('.time-display__duration');
            
            expect(current?.textContent).toBe('1:00:00');
            expect(duration?.textContent).toBe('1:00:00');
        });

        it('should handle fractional seconds by truncating', () => {
            const { container } = render(
                <TimeDisplay currentTime={30.7} duration={120.9} />
            );
            const current = container.querySelector('.time-display__current');
            const duration = container.querySelector('.time-display__duration');
            
            expect(current?.textContent).toBe('0:30');
            expect(duration?.textContent).toBe('2:00');
        });

        it('should handle very long durations', () => {
            const { container } = render(
                <TimeDisplay currentTime={36000} duration={36000} />
            );
            const current = container.querySelector('.time-display__current');
            const duration = container.querySelector('.time-display__duration');
            
            expect(current?.textContent).toBe('10:00:00');
            expect(duration?.textContent).toBe('10:00:00');
        });
    });

    describe('Dynamic Updates', () => {
        it('should update when currentTime changes', () => {
            const { container, rerender } = render(
                <TimeDisplay currentTime={30} duration={120} />
            );
            
            let current = container.querySelector('.time-display__current');
            expect(current?.textContent).toBe('0:30');

            rerender(<TimeDisplay currentTime={60} duration={120} />);
            
            current = container.querySelector('.time-display__current');
            expect(current?.textContent).toBe('1:00');
        });

        it('should update when duration changes', () => {
            const { container, rerender } = render(
                <TimeDisplay currentTime={30} duration={120} />
            );
            
            let duration = container.querySelector('.time-display__duration');
            expect(duration?.textContent).toBe('2:00');

            rerender(<TimeDisplay currentTime={30} duration={180} />);
            
            duration = container.querySelector('.time-display__duration');
            expect(duration?.textContent).toBe('3:00');
        });

        it('should toggle collapsed state', () => {
            const { container, rerender } = render(
                <TimeDisplay currentTime={30} duration={120} collapsed={false} />
            );
            
            let display = container.querySelector('.time-display');
            expect(display?.className).not.toContain('collapsed');

            rerender(<TimeDisplay currentTime={30} duration={120} collapsed={true} />);
            
            display = container.querySelector('.time-display');
            expect(display?.className).toContain('collapsed');
        });
    });

    describe('Structure', () => {
        it('should have correct CSS structure', () => {
            const { container } = render(
                <TimeDisplay currentTime={30} duration={120} />
            );

            expect(container.querySelector('.time-display')).toBeInTheDocument();
            expect(container.querySelector('.time-display__current')).toBeInTheDocument();
            expect(container.querySelector('.time-display__separator')).toBeInTheDocument();
            expect(container.querySelector('.time-display__duration')).toBeInTheDocument();
        });
    });
});

