import * as React from 'react';
import { cn } from '@/shared/lib/cn';

// A native <select> styled to match shadcn/ui's input language. The real shadcn/ui
// Select is Radix-based (for custom-styled option lists); this app's selects are
// short, plain option lists, so a styled native element covers the need without
// pulling in @radix-ui/react-select.
const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = 'Select';

export { Select };
