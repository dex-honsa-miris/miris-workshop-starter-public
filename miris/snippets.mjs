/* Filled by plan 2. The four maps must stay key-for-key identical: a fill id
   present in three of them and absent from PARTS crashes the sidebar.

   SNIPPETS is cumulative: entries sharing a marker contain all previous ones.
   The Fill button writes the cumulative block; the card shows only the part.

   CLEARS_TO steps back one: a marker-wide clear returns to the step before it,
   or null if there is nothing before it (the block returns to blank). */
export const SNIPPETS = {};
export const PARTS = {};
export const CLEARS_TO = {};
export const MARKER_FOR = {};
