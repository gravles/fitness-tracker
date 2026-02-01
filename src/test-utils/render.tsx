import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';

/**
 * Custom render function that wraps components with providers if needed
 */
function customRender(
    ui: ReactElement,
    options?: Omit<RenderOptions, 'wrapper'>
) {
    return render(ui, { ...options });
}

// Re-export everything from RTL
export * from '@testing-library/react';
export { customRender as render };
