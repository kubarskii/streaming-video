/**
 * TimeDisplay Component
 * Shows current time and total duration
 */
import PropTypes from 'prop-types';
import { formatTime } from '../../../../shared/lib/utils';
import './TimeDisplay.css';

/**
 * Time display component
 * @param {Object} props - Component props
 * @param {number} props.currentTime - Current playback time in seconds
 * @param {number} props.duration - Total duration in seconds
 * @param {string} props.className - Additional CSS class
 * @param {boolean} props.collapsed - Whether to collapse on mobile
 */
export const TimeDisplay = ({
  currentTime = 0,
  duration = 0,
  className = '',
  collapsed = false,
}) => {
  const current = formatTime(currentTime);
  const total = formatTime(duration);

  return (
    <div
      className={`time-display ${collapsed ? 'collapsed' : ''} ${className}`}
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="time-display__current">{current}</span>
      <span className="time-display__separator"> / </span>
      <span className="time-display__duration">{total}</span>
    </div>
  );
};

TimeDisplay.propTypes = {
  currentTime: PropTypes.number,
  duration: PropTypes.number,
  className: PropTypes.string,
  collapsed: PropTypes.bool,
};

