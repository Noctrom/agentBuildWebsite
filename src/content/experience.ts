import type { Experience } from './types'

// Work history, most recent first. Wording approved by Chris (V0.52).
export const experience: Experience[] = [
  {
    id: 'four-seasons-renovators',
    role: 'Lead Construction Laborer',
    company: 'Four Seasons Renovators',
    location: 'Duluth, MN',
    start: '2024-05',
    end: null,
    summary:
      'Lead a renovation crew, from planning with homeowners to finishing projects on schedule.',
    highlights: [
      'Lead a team to complete projects on time.',
      'Manage projects and team collaboration.',
      'Make sure the crew has the tools, supplies and equipment it needs.',
      'Work with homeowners to take inventory and plan construction.',
    ],
  },
  {
    id: 'grandmas-restaurant',
    role: 'Line Cook',
    company: "Grandma's Restaurant",
    location: 'Duluth, MN',
    start: '2023-07',
    end: '2024-05',
    summary: "Worked the line at one of Duluth's busiest restaurants.",
    highlights: [
      'Managed multiple orders during peak hours.',
      'Adapted quickly to new recipes and techniques.',
    ],
  },
]
