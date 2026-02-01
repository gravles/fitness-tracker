import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Cleanup after each test case
afterEach(() => {
    cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});

// Mock IntersectionObserver
class MockIntersectionObserver {
    observe = vi.fn();
    disconnect = vi.fn();
    unobserve = vi.fn();
}
Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    value: MockIntersectionObserver,
});

// Mock ResizeObserver
class MockResizeObserver {
    observe = vi.fn();
    disconnect = vi.fn();
    unobserve = vi.fn();
}
Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    value: MockResizeObserver,
});

// Mock SpeechRecognition for WorkoutSpotter tests
class MockSpeechRecognition {
    continuous = false;
    interimResults = false;
    lang = 'en-US';
    onstart = vi.fn();
    onend = vi.fn();
    onresult = vi.fn();
    onerror = vi.fn();
    start = vi.fn();
    stop = vi.fn();
    abort = vi.fn();
}
Object.defineProperty(window, 'SpeechRecognition', {
    writable: true,
    value: MockSpeechRecognition,
});
Object.defineProperty(window, 'webkitSpeechRecognition', {
    writable: true,
    value: MockSpeechRecognition,
});

// Mock SpeechSynthesis
Object.defineProperty(window, 'speechSynthesis', {
    writable: true,
    value: {
        speak: vi.fn(),
        cancel: vi.fn(),
        getVoices: vi.fn().mockReturnValue([]),
    },
});
