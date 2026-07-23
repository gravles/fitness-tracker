import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Sparkline } from '@/components/kinetic/Sparkline';

describe('Sparkline', () => {
  it('renders a polyline with one point per value', () => {
    const { container } = render(<Sparkline points={[1, 2, 3, 2, 5]} color="#e0b35a" />);
    const polyline = container.querySelector('polyline');
    expect(polyline).not.toBeNull();
    expect(polyline!.getAttribute('points')!.split(' ')).toHaveLength(5);
    expect(polyline).toHaveAttribute('stroke', '#e0b35a');
  });

  it('renders nothing with fewer than 2 points', () => {
    const { container } = render(<Sparkline points={[42]} color="#fff" />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('handles a flat series without dividing by zero', () => {
    const { container } = render(<Sparkline points={[5, 5, 5]} color="#fff" />);
    expect(container.querySelector('polyline')!.getAttribute('points')).not.toContain('NaN');
  });

  it('is labelled for screen readers', () => {
    render(<Sparkline points={[1, 2]} color="#fff" aria-label="Weight 7-day trend" />);
    expect(screen.getByRole('img', { name: 'Weight 7-day trend' })).toBeInTheDocument();
  });
});
