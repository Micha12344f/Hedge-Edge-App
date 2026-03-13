import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { LicenseGate } from '@/components/LicenseGate';

// Provide minimal framer-motion mock so AnimatePresence/motion don't break jsdom
vi.mock('motion/react', async () => {
  const actual = await vi.importActual<typeof import('motion/react')>('motion/react');
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: new Proxy(
      {},
      {
        get: (_target, prop) => {
          // Return a simple wrapper for every HTML element
          return ({ children, ...rest }: Record<string, unknown> & { children?: React.ReactNode }) => {
            const Tag = prop as keyof JSX.IntrinsicElements;
            return <Tag {...rest}>{children}</Tag>;
          };
        },
      }
    ),
  };
});

/** Helper to set window.electronAPI with proper typing */
function setElectronAPI(api: Partial<Window['electronAPI']> | undefined) {
  Object.defineProperty(window, 'electronAPI', { value: api, writable: true, configurable: true });
}

describe('LicenseGate', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows loading state initially', () => {
    setElectronAPI({
      isElectron: true,
      license: {
        getStatus: vi.fn().mockReturnValue(new Promise(() => {})),
      } as unknown as Window['electronAPI'] extends undefined ? never : NonNullable<Window['electronAPI']>['license'],
    });

    render(<LicenseGate><div data-testid="child">Protected Content</div></LicenseGate>);
    expect(screen.queryByTestId('child')).toBeNull();
  });

  it('renders children when license is valid', async () => {
    setElectronAPI({
      isElectron: true,
      license: {
        getStatus: vi.fn().mockResolvedValue({
          success: true,
          data: { status: 'valid', plan: 'pro', expiresAt: '2026-01-01' },
        }),
      } as unknown as NonNullable<Window['electronAPI']>['license'],
    });

    render(<LicenseGate><div data-testid="child">Protected Content</div></LicenseGate>);
    await waitFor(() => {
      expect(screen.getByTestId('child')).toBeInTheDocument();
    });
  });

  it('shows license input when no license configured', async () => {
    setElectronAPI({
      isElectron: true,
      license: {
        getStatus: vi.fn().mockResolvedValue({
          success: true,
          data: { status: 'not-configured' },
        }),
      } as unknown as NonNullable<Window['electronAPI']>['license'],
    });

    render(<LicenseGate><div data-testid="child">Protected</div></LicenseGate>);
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/XXXX/)).toBeInTheDocument();
    });
    expect(screen.queryByTestId('child')).toBeNull();
  });

  it('shows error when license is expired', async () => {
    setElectronAPI({
      isElectron: true,
      license: {
        getStatus: vi.fn().mockResolvedValue({
          success: true,
          data: { status: 'expired' },
        }),
      } as unknown as NonNullable<Window['electronAPI']>['license'],
    });

    render(<LicenseGate><div>Protected</div></LicenseGate>);
    await waitFor(() => {
      expect(screen.getByText(/expired/i)).toBeInTheDocument();
    });
  });

  it('calls activate when form submitted', async () => {
    const activateMock = vi.fn().mockResolvedValue({
      success: true,
      license: { status: 'valid', plan: 'pro' },
    });

    setElectronAPI({
      isElectron: true,
      license: {
        getStatus: vi.fn().mockResolvedValue({
          success: true,
          data: { status: 'not-configured' },
        }),
        activate: activateMock,
      } as unknown as NonNullable<Window['electronAPI']>['license'],
    });

    render(<LicenseGate><div data-testid="child">Protected</div></LicenseGate>);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/XXXX/)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/XXXX/);
    fireEvent.change(input, { target: { value: 'ABCD-1234-EFGH-5678' } });

    // Wait for React state update, then click the submit button
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /activate/i });
      expect(btn).not.toBeDisabled();
    });
    fireEvent.click(screen.getByRole('button', { name: /activate/i }));

    await waitFor(() => {
      expect(activateMock).toHaveBeenCalledWith('ABCD-1234-EFGH-5678');
    });
  });

  it('shows error when not running in Electron', async () => {
    setElectronAPI(undefined);

    render(<LicenseGate><div>Protected</div></LicenseGate>);
    await waitFor(() => {
      expect(screen.getByText(/desktop application/i)).toBeInTheDocument();
    });
  });
});
