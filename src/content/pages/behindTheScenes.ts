// Copy for the Behind the Scenes page (/behind-the-scenes): how this site is
// built by a team of AI agents. The section text is Chris's approved draft
// (BACKLOG.md, V0.21); Chris will edit it later. The diagram data feeds the
// StoryFlowDiagram and BranchDiagram components (V0.20).

import type { BranchLevel, FlowLoop, FlowStage } from '../../components/ui'
import type { PageMetaCopy } from '../types'

/**
 * The source repository. Defined once here; the repo link appears only on
 * this page (Chris's decision, V0.21).
 */
export const repoUrl = 'https://github.com/Noctrom/agentBuildWebsite'

/** One member of the agent team, e.g. "dev-1" and what it owns. */
export interface TeamMember {
  /** Shown in bold, e.g. "Leader". */
  name: string
  description: string
}

export interface BehindTheScenesPageCopy {
  /** Document title and meta description for `PageMeta`. */
  meta: PageMetaCopy
  /** Page heading (the page's h1). */
  title: string
  intro: string
  whyTitle: string
  whyIntro: string
  teamTitle: string
  team: TeamMember[]
  /** Paragraph after the team list. */
  teamOutro: string
  /** Accessible label for the team list. */
  teamLabel: string
  flowTitle: string
  flowIntro: string
  /** Diagram A: how one story moves through the team. */
  flowDiagram: {
    label: string
    stages: FlowStage[]
    loop: FlowLoop
  }
  branchesTitle: string
  branchesIntro: string
  /** Diagram B: git branch levels and who may change each. */
  branchDiagram: {
    label: string
    accessLabel: string
    levels: BranchLevel[]
  }
  stackTitle: string
  stackIntro: string
  howTitle: string
  howIntro: string
  sourceTitle: string
  sourceIntro: string
  /** Text of the button linking to `repoUrl`. */
  sourceButtonLabel: string
}

export const behindTheScenesPage: BehindTheScenesPageCopy = {
  meta: {
    title: 'Behind the Scenes',
    description:
      'How this site was planned, built and reviewed by a team of AI agents: roles, story flow, branches and reviews.',
  },
  title: 'Behind the Scenes',
  intro:
    "This site has two jobs. It's my personal website, and it's a working example of how I build software with a team of AI agents. Everything here, from the first scaffold to this page, was planned, built and reviewed through the process below.",

  whyTitle: 'Why build it this way',
  whyIntro:
    'AI coding agents are fast, but speed without structure produces messy code and surprises. I wanted to show that agents can work the way a good engineering team does: clear requirements, owned areas of the codebase, small reviewable changes, and a human who signs off on what ships. This site is small enough to follow end to end and real enough to prove the point.',

  teamTitle: 'The team',
  teamLabel: 'Team members and their roles',
  team: [
    {
      name: 'Me',
      description:
        'product owner and final reviewer. I decide what gets built and I approve every change that reaches production.',
    },
    {
      name: 'Story writer',
      description:
        'talks with me about what I want and turns it into user stories with clear, testable acceptance criteria.',
    },
    {
      name: 'Leader',
      description:
        "plans the backlog, assigns stories, reviews every change, merges approved work and reports progress back to me. It doesn't write feature code.",
    },
    {
      name: 'dev-1',
      description: 'owns the foundation and design system: layout, theme, and reusable components.',
    },
    {
      name: 'dev-2',
      description: 'owns the pages and content.',
    },
  ],
  teamOutro:
    "Each agent has a written role definition, owned folders it stays inside, and rules it follows. If a dev needs a change in someone else's area, it reports back instead of making it.",

  flowTitle: 'How work flows',
  flowIntro:
    'Every change starts as a user story ("As a visitor, I want…") with acceptance criteria. The leader assigns it to one developer, who builds it on its own branch in an isolated copy of the repo, checks that the build and linter pass, and writes a log file for the story explaining what it did and why. The leader reviews the work against the criteria and either sends it back with requested changes or merges it.',
  flowDiagram: {
    label: 'How a story moves through the team, from idea to the live site',
    stages: [
      {
        label: 'Plan',
        steps: [
          { id: 'chris-idea', label: 'Chris', detail: 'Decides what gets built' },
          { id: 'story-writer', label: 'Story writer', detail: 'Interviews and drafts stories' },
          { id: 'inbox', label: 'Story inbox', detail: 'Drafts wait for triage' },
          { id: 'leader-assign', label: 'Leader', detail: 'Triages and assigns' },
        ],
      },
      {
        label: 'Build',
        steps: [
          { id: 'dev', label: 'dev-1 / dev-2', detail: 'Build on a story branch' },
          {
            id: 'review',
            label: 'Leader review',
            detail: 'Build + lint, approve or send back',
          },
          { id: 'leader-branch', label: 'leader', detail: 'Approved work merged', kind: 'branch' },
        ],
      },
      {
        label: 'Ship',
        steps: [
          { id: 'pr', label: 'Pull request', detail: 'leader → main' },
          { id: 'chris-merge', label: 'Chris', detail: 'Reviews and merges' },
          { id: 'main', label: 'main', detail: 'Production branch', kind: 'branch' },
          { id: 'deploy', label: 'Vercel', detail: 'Deploys the live site' },
        ],
      },
    ],
    loop: {
      from: 'review',
      to: 'dev',
      label: 'Send back for fixes',
      description:
        'If changes are needed, the leader sends the story back to the same developer, who fixes it on the same branch and reports again.',
    },
  },

  branchesTitle: 'Branches and reviews',
  branchesIntro:
    'No agent can push to production. Developers commit only to their story branch. Only the leader merges into the integration branch. Changes reach main, and the live site, only through a pull request that I review and merge myself.',
  branchDiagram: {
    label: 'Git branches and who can change them',
    accessLabel: 'Who can change it',
    levels: [
      {
        id: 'main',
        name: 'main',
        description: 'Production: the live site.',
        access: 'Only Chris, by merging a pull request from leader.',
      },
      {
        id: 'leader',
        name: 'leader',
        description: 'Integration: reviewed stories come together here.',
        access: 'Only the leader, by merging reviewed story branches.',
        mergeLabel: 'Pull request, reviewed and merged by Chris',
      },
      {
        id: 'story',
        name: 'story/v0.xx-<slug>',
        description: 'One branch per story, in its own isolated copy of the repo.',
        access: 'Only the developer assigned the story. No pushing or merging.',
        mergeLabel: 'Merged by the leader after review',
        examples: ['story/v0.20-workflow-diagrams', 'story/v0.21-behind-the-scenes'],
      },
    ],
  },

  stackTitle: 'The stack',
  stackIntro:
    'React and TypeScript, built with Vite, styled with Tailwind CSS, routed with React Router, and deployed as a static site on Vercel. The agents run in Claude Code.',

  howTitle: 'How the site works',
  howIntro:
    'All text and data, including this page, lives in typed content files, separate from the page code. Pages are assembled from a small set of shared components (buttons, cards, sections, tags), so the design stays consistent and updating content never means touching layout code.',

  sourceTitle: 'See for yourself',
  sourceIntro:
    "The full repository is public: the backlog, every agent's role definition, their story logs, and the commit history showing each story from branch to merge.",
  sourceButtonLabel: 'View the source on GitHub',
}
