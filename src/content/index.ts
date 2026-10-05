export type * from './types'
// Data
export { profile } from './profile'
export { projects, featuredProjects, projectTags } from './projects'
export { experience } from './experience'
export { education } from './education'
export { skills } from './skills'
// Page copy (one file per page, see pages/index.ts) and labels shared by pages
export * from './pages'
export { sharedLabels, type SharedLabels } from './labels'
// Helpers
export { formatYearMonth, formatDateRange } from './format'
