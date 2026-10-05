// PLACEHOLDER: UI labels used by more than one page. Page-specific copy lives
// in pages/<page>.ts; anything shared goes here so it is defined only once.

export interface SharedLabels {
  /** Card action label for a project's repository link (Home, Projects). */
  projectRepo: string
  /** Card action label for a project's live demo link (Home, Projects). */
  projectDemo: string
  /** End of an open-ended date range (`end: null`), e.g. "Mar 2023 – Present". */
  present: string
}

export const sharedLabels: SharedLabels = {
  projectRepo: 'Code',
  projectDemo: 'Live demo',
  present: 'Present',
}
