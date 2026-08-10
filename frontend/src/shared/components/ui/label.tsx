import * as React from 'react';
import { cn } from '@/shared/lib/cn';

const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn('mb-1 block text-sm font-medium leading-none text-foreground', className)}
      {...props}
    />
  ),
);
Label.displayName = 'Label';

export { Label };
