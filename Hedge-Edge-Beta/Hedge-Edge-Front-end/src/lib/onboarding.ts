/**
 * Onboarding state helpers — shared between Onboarding page and App router.
 */

const ONBOARDING_COMPLETE_KEY = 'hedge_edge_onboarding_complete';

export function isOnboardingComplete(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_COMPLETE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function markOnboardingComplete(): void {
  try {
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
  } catch {
    // localStorage may be unavailable
  }
}
