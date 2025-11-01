/**
 * LocalStorage utilities for video player
 */

/**
 * Safely get item from localStorage
 * @param {string} key - Storage key
 * @param {*} defaultValue - Default value if not found
 * @returns {*} Stored value or default
 */
export const getStorageItem = (key, defaultValue = null) => {
    try {
        const item = localStorage.getItem(key);
        return item !== null ? JSON.parse(item) : defaultValue;
    } catch (error) {
        console.error(`Error reading from localStorage (${key}):`, error);
        return defaultValue;
    }
};

/**
 * Safely set item in localStorage
 * @param {string} key - Storage key
 * @param {*} value - Value to store
 * @returns {boolean} Success status
 */
export const setStorageItem = (key, value) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        console.error(`Error writing to localStorage (${key}):`, error);
        return false;
    }
};

/**
 * Safely remove item from localStorage
 * @param {string} key - Storage key
 * @returns {boolean} Success status
 */
export const removeStorageItem = (key) => {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (error) {
        console.error(`Error removing from localStorage (${key}):`, error);
        return false;
    }
};

/**
 * Check if localStorage is available
 * @returns {boolean}
 */
export const isStorageAvailable = () => {
    try {
        const test = '__storage_test__';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
    } catch (error) {
        return false;
    }
};

/**
 * Get number value from storage
 * @param {string} key - Storage key
 * @param {number} defaultValue - Default value
 * @returns {number}
 */
export const getStorageNumber = (key, defaultValue = 0) => {
    const value = getStorageItem(key, defaultValue);
    return typeof value === 'number' ? value : defaultValue;
};

/**
 * Get boolean value from storage
 * @param {string} key - Storage key
 * @param {boolean} defaultValue - Default value
 * @returns {boolean}
 */
export const getStorageBoolean = (key, defaultValue = false) => {
    const value = getStorageItem(key, defaultValue);
    return typeof value === 'boolean' ? value : defaultValue;
};

/**
 * Get string value from storage
 * @param {string} key - Storage key
 * @param {string} defaultValue - Default value
 * @returns {string}
 */
export const getStorageString = (key, defaultValue = '') => {
    const value = getStorageItem(key, defaultValue);
    return typeof value === 'string' ? value : defaultValue;
};

