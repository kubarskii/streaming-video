# Testing Chunked Upload System

This directory contains comprehensive tests for the chunked upload functionality using Vitest and React Testing Library.

## 📦 Installation

First, install the required dependencies:

```bash
cd frontend
npm install --save-dev vitest @vitest/ui @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

## 🧪 Test Files

### 1. ChunkedUploader Tests
**File:** `src/shared/lib/__tests__/ChunkedUploader.test.js`

Tests the core upload logic:
- Initialization with custom options
- File chunking and hash calculation
- Upload session initialization
- Individual chunk uploads with retry logic
- Upload finalization
- Pause/Resume/Cancel functionality
- Progress tracking
- Error handling
- Edge cases (small files, exact chunk sizes, resumable uploads)

### 2. UploadPage Tests
**File:** `src/pages/upload/__tests__/UploadPageChunked.test.jsx`

Tests the UI component:
- Component rendering
- File selection (drag & drop, file input)
- Form validation
- Upload process
- Progress display
- Pause/Resume/Cancel controls
- Error messages
- Channel requirement check

### 3. Test Setup
**File:** `src/__tests__/setup.js`

Global test configuration:
- Jest-DOM matchers
- Mock browser APIs (localStorage, fetch, File, etc.)
- Cleanup utilities

## 🚀 Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm test -- --watch
```

### Run tests with UI
```bash
npm run test:ui
```

### Run tests with coverage
```bash
npm run test:coverage
```

### Run specific test file
```bash
npm test ChunkedUploader.test
```

### Run tests matching pattern
```bash
npm test -- --grep "upload"
```

## 📊 Test Coverage

The tests cover:
- ✅ **ChunkedUploader class** (85%+ coverage)
  - All public methods
  - Error scenarios
  - Edge cases
  - Retry logic
  - Progress tracking

- ✅ **UploadPage component** (80%+ coverage)
  - User interactions
  - Form validation
  - Upload flow
  - Error handling
  - UI state changes

## 🎯 Test Scenarios

### ChunkedUploader Tests

1. **Initialization**
   - Default options
   - Custom options
   - AbortController creation

2. **File Chunking**
   - Normal files
   - Small files (< chunk size)
   - Exact chunk size
   - Large files (> 1GB)

3. **Upload Process**
   - Session initialization
   - Chunk uploads
   - Hash verification
   - Finalization
   - Full upload flow

4. **Resilience**
   - Network failures
   - Retry with exponential backoff
   - Resume from interruption
   - Cancel mid-upload

5. **Progress Tracking**
   - Per-chunk progress
   - Overall progress
   - Speed calculation

### UploadPage Tests

1. **User Interactions**
   - File selection via input
   - File selection via drag & drop
   - Form field inputs
   - Button clicks

2. **Validation**
   - File type validation
   - File size limits
   - Required fields
   - Error messages

3. **Upload Flow**
   - Successful upload
   - Progress display
   - Chunk completion tracking
   - Navigation after success

4. **Controls**
   - Pause button
   - Resume button
   - Cancel button
   - Disabled states

5. **Error Handling**
   - Network errors
   - Server errors
   - Validation errors
   - User cancellation

## 📝 Writing New Tests

### Example: Testing a new feature

```javascript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('MyNewFeature', () => {
  it('should do something', async () => {
    const user = userEvent.setup();
    render(<MyComponent />);
    
    // Interact with component
    await user.click(screen.getByRole('button'));
    
    // Assert
    await waitFor(() => {
      expect(screen.getByText('Expected text')).toBeInTheDocument();
    });
  });
});
```

## 🐛 Debugging Tests

### Run tests in debug mode
```bash
npm test -- --inspect-brk
```

### Use console.log in tests
```javascript
it('should debug', () => {
  const result = someFunction();
  console.log('Debug:', result);
  expect(result).toBe(expected);
});
```

### Use screen.debug()
```javascript
import { screen } from '@testing-library/react';

it('should show DOM', () => {
  render(<MyComponent />);
  screen.debug(); // Prints current DOM
});
```

## 🔧 Common Issues

### Issue: "Cannot find module"
**Solution:** Ensure all dependencies are installed:
```bash
npm install
```

### Issue: "TextEncoder is not defined"
**Solution:** Already handled in `setup.js`, but if persists:
```javascript
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
```

### Issue: Tests timeout
**Solution:** Increase timeout in specific tests:
```javascript
it('long running test', async () => {
  // test code
}, 10000); // 10 second timeout
```

### Issue: "act() warning"
**Solution:** Wrap state updates in `waitFor`:
```javascript
await waitFor(() => {
  expect(screen.getByText('Updated')).toBeInTheDocument();
});
```

## 📈 Coverage Goals

Target coverage for production:
- **Statements:** 80%+
- **Branches:** 75%+
- **Functions:** 85%+
- **Lines:** 80%+

Check coverage report:
```bash
npm run test:coverage
open coverage/index.html
```

## 🎨 Best Practices

1. **Arrange-Act-Assert**
   ```javascript
   it('should test something', () => {
     // Arrange
     const input = 'test';
     
     // Act
     const result = processInput(input);
     
     // Assert
     expect(result).toBe('expected');
   });
   ```

2. **Test user behavior, not implementation**
   ```javascript
   // ✅ Good - tests behavior
   await user.click(screen.getByRole('button', { name: /upload/i }));
   
   // ❌ Bad - tests implementation
   expect(component.state.uploading).toBe(true);
   ```

3. **Use data-testid sparingly**
   ```javascript
   // ✅ Good - semantic queries
   screen.getByRole('button', { name: /submit/i })
   screen.getByLabelText(/email/i)
   
   // ❌ Avoid - too generic
   screen.getByTestId('button-1')
   ```

4. **Mock at the right level**
   ```javascript
   // ✅ Good - mock at API boundary
   vi.mock('../../api/upload');
   
   // ❌ Bad - mock too low
   vi.mock('axios');
   ```

5. **Clean up after tests**
   ```javascript
   afterEach(() => {
     vi.clearAllMocks();
     cleanup();
   });
   ```

## 📚 Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Library Queries](https://testing-library.com/docs/queries/about)
- [User Event API](https://testing-library.com/docs/user-event/intro)
- [Jest DOM Matchers](https://github.com/testing-library/jest-dom)

## 🎯 CI/CD Integration

Add to your CI pipeline:

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test -- --run
      - run: npm run test:coverage
```

## ✅ Test Checklist

Before pushing code:

- [ ] All tests pass
- [ ] New features have tests
- [ ] Coverage maintained or improved
- [ ] No console warnings
- [ ] Tests are fast (< 5 seconds total)
- [ ] Tests are deterministic (no flaky tests)
- [ ] Tests are readable and well-documented

## 🚀 Next Steps

1. Run the tests: `npm test`
2. Check coverage: `npm run test:coverage`
3. Add tests for your custom features
4. Set up CI/CD for automated testing
5. Maintain high test coverage

Happy testing! 🎉

