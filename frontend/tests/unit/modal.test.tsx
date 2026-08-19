import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from '@/shared/components/ui/modal';

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(
      <Modal open={false} onClose={() => {}}>
        <p>content</p>
      </Modal>,
    );
    expect(screen.queryByText('content')).not.toBeInTheDocument();
  });

  it('renders its content as a dialog when open', () => {
    render(
      <Modal open onClose={() => {}}>
        <p>content</p>
      </Modal>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('calls onClose on backdrop click', async () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal open onClose={onClose}>
        <p>content</p>
      </Modal>,
    );
    // The backdrop is the dialog's parent — clicking it (not the panel) dismisses.
    await userEvent.click(container.firstElementChild as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when clicking inside the panel', async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose}>
        <p>content</p>
      </Modal>,
    );
    await userEvent.click(screen.getByText('content'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose on Escape key', async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose}>
        <p>content</p>
      </Modal>,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});
