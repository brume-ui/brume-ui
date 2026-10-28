import type { ReactNode } from 'react';
import { cn } from '../cn';

export interface CardProps {
  title?: string;
  children: ReactNode;
  padding?: 'md' | 'none';
}

export function Card({ title, children, padding = 'md' }: CardProps) {
  return (
    <section className="br:overflow-hidden br:rounded-card br:bg-surface br:shadow-flat br:transition-shadow br:duration-base br:ease-out br:hover:shadow-row">
      {title ? (
        <h2
          className={cn(
            'br:text-base br:font-semibold br:text-text',
            padding === 'md' ? 'br:px-5 br:pt-5' : 'br:px-5 br:py-4',
          )}
        >
          {title}
        </h2>
      ) : null}
      <div className={cn(padding === 'md' && 'br:p-5', title && padding === 'md' && 'br:pt-3')}>
        {children}
      </div>
    </section>
  );
}
