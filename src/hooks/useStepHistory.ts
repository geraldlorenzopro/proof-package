import { useEffect, useCallback, useRef } from 'react';

/**
 * Syncs a numeric step index with the browser history stack so that
 * mobile swipe-back gestures (and the browser back button) move to the
 * previous step instead of navigating away from the tool entirely.
 *
 * Usage:
 *   const { goNext, goBack } = useStepHistory(currentStep, setCurrentStep, maxStep);
 *
 * Call goNext() / goBack() instead of manually updating the step.
 * The hook also intercepts popstate (browser back) automatically.
 */
export function useStepHistory(
  currentStep: number,
  setCurrentStep: (s: number | ((prev: number) => number)) => void,
  maxStep: number,
) {
  const stepRef = useRef(currentStep);
  stepRef.current = currentStep;

  // Push an initial history entry when the wizard mounts so there's
  // something to "pop" without leaving the page.
  useEffect(() => {
    // Replace current entry with step 0 marker
    window.history.replaceState({ wizardStep: 0 }, '');

    const handlePopState = (e: PopStateEvent) => {
      const target = e.state?.wizardStep as number | undefined;
      if (typeof target === 'number') {
        setCurrentStep(target);
      } else if (stepRef.current > 0) {
        // Went back past the wizard – push state back to keep user in wizard
        window.history.pushState({ wizardStep: 0 }, '');
        setCurrentStep(0);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goNext = useCallback(() => {
    const next = stepRef.current + 1;
    if (next <= maxStep) {
      window.history.pushState({ wizardStep: next }, '');
      setCurrentStep(next);
    }
  }, [maxStep, setCurrentStep]);

  const goBack = useCallback(() => {
    if (stepRef.current > 0) {
      window.history.back(); // will trigger popstate → setCurrentStep
    }
  }, []);

  return { goNext, goBack };
}

