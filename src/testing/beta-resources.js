/**
 * TEMPORARY OFFLINE BETA TEST RESOURCES.
 * Disable before public launch; remove the tester-only UI/command and ensure
 * no beta save is migrated into paid, competitive or production accounts.
 * These values never represent premium currency or server entitlements.
 */
export const BETA_TEST_MODE = true;
export const BETA_TEST_WALLET_FLOOR = Object.freeze({
  gold: 500000,
  essence: 500000,
  research: 500000,
  dust: 500000,
});
export const BETA_TEST_SHARD_FLOOR = 50000;
export const BETA_TEST_FRAGMENT_FLOOR = 50000;
// Existing progression checks unlock special slots and heroes by run count.
// These are labelled *simulated beta access* and MUST NOT be submitted as wins.
export const BETA_TEST_RUN_ACCESS = 5;
