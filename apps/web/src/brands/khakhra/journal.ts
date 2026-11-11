import type { BrandJournal } from "../contract";

/**
 * Khakhra House publishes no Journal: `features.journal` is false in the
 * profile and this list is empty, so `routeEnabled('/journal')` is false, the
 * nav never links to it and the section never renders. Articles written later
 * are added here (fixed ISO dates, token-only cover tones — see the contract).
 */
export const journal = [] satisfies BrandJournal;
