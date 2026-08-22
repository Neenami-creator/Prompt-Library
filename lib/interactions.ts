/**
 * Interaction feedback utilities
 * Haptic feedback, ripple effects, and gesture handling
 */

/**
 * Trigger haptic feedback on mobile devices
 */
export function triggerHaptic(pattern: number | number[] = 10) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}

/**
 * Standard haptic patterns
 */
export const hapticPatterns = {
  light: 10,
  medium: 20,
  strong: 30,
  success: [10, 20, 10], // tap-gap-tap
  error: [30, 10, 30], // long-gap-long
  notification: [15, 10, 15], // medium-gap-medium
};

/**
 * Create ripple effect on click
 */
export function createRipple(event: React.MouseEvent<HTMLElement>) {
  const button = event.currentTarget;
  const ripple = document.createElement('span');

  const rect = button.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const x = event.clientX - rect.left - size / 2;
  const y = event.clientY - rect.top - size / 2;

  ripple.style.width = ripple.style.height = size + 'px';
  ripple.style.left = x + 'px';
  ripple.style.top = y + 'px';
  ripple.className = 'ripple';

  button.appendChild(ripple);

  setTimeout(() => ripple.remove(), 600);
}

/**
 * Trigger copy feedback animation
 */
export function triggerCopyFeedback(element: HTMLElement) {
  const originalText = element.textContent;
  element.textContent = '✓ Copied';
  element.style.animation = 'copyPulse 0.3s var(--ease)';

  setTimeout(() => {
    element.style.animation = '';
    element.textContent = originalText;
  }, 1500);
}

/**
 * Trigger star favorite animation
 */
export function triggerStarAnimation(element: HTMLElement) {
  element.style.animation = 'starPulse 0.4s var(--ease)';

  setTimeout(() => {
    element.style.animation = '';
  }, 400);
}

/**
 * Show scroll restoration with smooth behavior
 */
export function smoothScrollTo(element: HTMLElement | null, options?: ScrollIntoViewOptions) {
  if (!element) return;

  element.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
    ...options,
  });
}

/**
 * Detect if device prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Detect if device prefers high contrast
 */
export function prefersHighContrast(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-contrast: more)').matches;
}

/**
 * Get safe animation duration based on motion preferences
 */
export function getSafeAnimationDuration(
  normalDuration: string,
  reducedDuration: string = '0ms',
): string {
  return prefersReducedMotion() ? reducedDuration : normalDuration;
}

/**
 * Debounced animation frame callback
 */
export function debounceAnimationFrame(callback: () => void, delay: number = 100) {
  let timeoutId: NodeJS.Timeout | null = null;

  return function (...args: unknown[]) {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(callback, delay);
  };
}

/**
 * Watch for element visibility
 */
export function observeElementVisibility(
  element: HTMLElement | null,
  callback: (isVisible: boolean) => void,
) {
  if (!element || typeof IntersectionObserver === 'undefined') {
    callback(true);
    return () => {};
  }

  const observer = new IntersectionObserver(([entry]) => {
    callback(entry.isIntersecting);
  });

  observer.observe(element);

  return () => observer.disconnect();
}

/**
 * Keyboard event utilities
 */
export const keys = {
  ESCAPE: 'Escape',
  ENTER: 'Enter',
  SPACE: ' ',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  TAB: 'Tab',
  K: 'k',
};

/**
 * Check if Command/Ctrl+K was pressed
 */
export function isCommandPaletteKey(event: KeyboardEvent): boolean {
  return (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
}

/**
 * Check if Escape was pressed
 */
export function isEscapeKey(event: KeyboardEvent): boolean {
  return event.key === keys.ESCAPE;
}
