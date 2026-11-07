import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

function SetupExample() {
  return <h1>ReviewLens is ready!</h1>;
}

describe('Frontend testing setup', () => {
  it('renders a React component successfully', () => {
    render(<SetupExample />);

    expect(
      screen.getByRole('heading', { name: 'ReviewLens is ready!' }),
    ).toBeInTheDocument();
  });
});