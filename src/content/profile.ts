import type { Profile } from './types'

// Real profile, wording approved by Chris (V0.51).
// PLACEHOLDER: the photo below is still the placeholder until V0.54.
export const profile: Profile = {
  name: 'Christopher Waldriff',
  title: 'Computer Science Student at University of Minnesota Duluth',
  pitch:
    'Computer science student at the University of Minnesota Duluth, looking for a software internship to put my skills to work on real-world projects.',
  bio: [
    "I'm a computer science student at the University of Minnesota Duluth, working toward a B.S. with a Math minor (expected May 2028). My coursework covers database management, software engineering, machine learning, data mining and computer vision.",
    "I'm looking for an internship where I can apply those skills in a professional environment. I love problem-solving, and in 2025 I spoke at AIR RES, an international conference on the AI revolution: research, ethics and society.",
    "Outside class I lead a construction crew at Four Seasons Renovators. I work with homeowners to plan projects and coordinate the team to get them done on time, so I'm used to gathering requirements from clients and keeping a team moving.",
  ],
  contactCta:
    "I'm looking for a software internship. Email is the quickest way to reach me, and you can also find me on LinkedIn and GitHub.",
  location: 'Duluth, Minnesota',
  links: {
    email: 'christopherwaldriff@gmail.com',
    github: 'https://github.com/Noctrom',
    linkedin: 'https://www.linkedin.com/in/christopher-waldriff-401b20400/',
  },
  photo: '/photo-placeholder.svg',
  photoAlt: 'Placeholder portrait',
  resumeUrl: '/resume.pdf',
}
