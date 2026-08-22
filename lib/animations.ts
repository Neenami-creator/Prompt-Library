/**
 * Animation utilities for world-class UI interactions
 * Centralized stagger, timing, and animation helpers
 */

export const staggerDelay = (index: number, baseDelay = 50) => `${index * baseDelay}ms`;

export const animationTimings = {
  fast: 'var(--dur-fast)',
  medium: 'var(--dur-med)',
  slow: 'var(--dur-slow)',
  easing: 'var(--ease)',
};

export type AnimationState = 'entering' | 'exiting' | 'idle';

export interface AnimationConfig {
  delay?: number;
  duration?: 'fast' | 'medium' | 'slow';
  easing?: string;
}

/**
 * Get CSS animation values for card entrance/exit
 */
export function getCardAnimation(
  state: AnimationState,
  index?: number,
  config?: AnimationConfig,
) {
  const delay = config?.delay ?? (index ? staggerDelay(index, 50) : '0ms');
  const duration = config?.duration ?? 'medium';
  const easing = config?.easing ?? animationTimings.easing;
  const dur = animationTimings[duration];

  if (state === 'entering') {
    return {
      animation: `cardEnter ${dur} ${easing} both`,
      animationDelay: delay,
    };
  }

  if (state === 'exiting') {
    return {
      animation: `cardExit var(--dur-fast) ${easing} both`,
    };
  }

  return {};
}

/**
 * Get CSS animation values for list items (staggered)
 */
export function getListItemAnimation(index: number, duration: 'fast' | 'medium' | 'slow' = 'medium') {
  return {
    animation: `listItemEnter var(--${duration === 'fast' ? 'dur-fast' : duration === 'medium' ? 'dur-med' : 'dur-slow'}) var(--ease) both`,
    animationDelay: staggerDelay(index, 40),
  };
}

/**
 * Get CSS animation for search result highlighting
 */
export function getSearchHighlightAnimation() {
  return {
    animation: 'searchHighlightPulse var(--dur-slow) var(--ease) infinite',
  };
}

/**
 * Generate CSS keyframes as a string
 */
export const keyframes = `
  @keyframes cardEnter {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(12px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  @keyframes cardExit {
    from {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
    to {
      opacity: 0;
      transform: scale(0.95) translateY(-12px);
    }
  }

  @keyframes listItemEnter {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes copyPulse {
    0%, 100% {
      box-shadow: 0 0 0 0 rgba(200, 169, 75, 0.7);
    }
    50% {
      box-shadow: 0 0 0 8px rgba(200, 169, 75, 0);
    }
  }

  @keyframes starPulse {
    0%, 100% {
      transform: scale(1) rotate(0deg);
    }
    50% {
      transform: scale(1.2) rotate(10deg);
    }
  }

  @keyframes searchHighlightPulse {
    0%, 100% {
      background-color: rgba(200, 169, 75, 0.3);
    }
    50% {
      background-color: rgba(200, 169, 75, 0.5);
    }
  }

  @keyframes ripple {
    to {
      transform: scale(4);
      opacity: 0;
    }
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-12px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes slideUp {
    from {
      opacity: 1;
      transform: translateY(0);
    }
    to {
      opacity: 0;
      transform: translateY(-12px);
    }
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes fadeOut {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }

  @keyframes shimmer {
    0% {
      background-position: -1200px 0;
    }
    100% {
      background-position: 100% 0;
    }
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  @keyframes borderGlow {
    0%, 100% {
      box-shadow: 0 0 0 0 currentColor;
    }
    50% {
      box-shadow: 0 0 0 4px rgba(200, 169, 75, 0.4);
    }
  }
`;
