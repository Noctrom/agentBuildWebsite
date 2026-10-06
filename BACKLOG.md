# Backlog

Index of every story. Full story text lives in batch files under [`docs/backlog/`](docs/backlog/), 25 versions per file, one folder per whole number (`v0/`, `v1/`, …).

Status: `todo` · `in progress` · `review` · `done` · `blocked`

**Versions:** each story is one step of +0.01 (V0.01, V0.02, …). V0.00 is the starting point, not a story. The story-writer gives a story the next free version when Chris approves it; if the leader splits a story, the extra parts take the next free versions. Batch files: `v0.00-v0.24`, `v0.25-v0.49`, `v0.50-v0.74`, `v0.75-v0.99`; V1.00 opens `v1/`.

| Version | Story | Owner | Depends on | Status |
|---------|-------|-------|------------|--------|
| [V0.01](docs/backlog/v0/v0.00-v0.24.md#v001--project-scaffold) | Project scaffold | dev-1 | — | done |
| [V0.02](docs/backlog/v0/v0.00-v0.24.md#v002--theme--dark-mode) | Theme & dark mode | dev-1 | V0.01 | done |
| [V0.03](docs/backlog/v0/v0.00-v0.24.md#v003--site-layout) | Site layout (header/footer) | dev-1 | V0.01 | done |
| [V0.04](docs/backlog/v0/v0.00-v0.24.md#v004--core-ui-components) | Core UI components | dev-1 | V0.02 | done |
| [V0.05](docs/backlog/v0/v0.00-v0.24.md#v005--content-model--placeholders) | Content model & placeholders | dev-2 | V0.01 | done |
| [V0.06](docs/backlog/v0/v0.00-v0.24.md#v006--home-page) | Home page | dev-2 | V0.03, V0.04, V0.05 | done |
| [V0.07](docs/backlog/v0/v0.00-v0.24.md#v007--about-page) | About page | dev-2 | V0.03, V0.04, V0.05 | done |
| [V0.08](docs/backlog/v0/v0.00-v0.24.md#v008--projects-page) | Projects page | dev-2 | V0.03, V0.04, V0.05 | done |
| [V0.09](docs/backlog/v0/v0.00-v0.24.md#v009--resume-page) | Resume page | dev-2 | V0.03, V0.04, V0.05 | done |
| [V0.10](docs/backlog/v0/v0.00-v0.24.md#v010--contact-page) | Contact page | dev-2 | V0.03, V0.04, V0.05 | done |
| [V0.11](docs/backlog/v0/v0.00-v0.24.md#v011--seo-metadata-foundation) | SEO metadata foundation | dev-1 | V0.03 | done |
| [V0.12](docs/backlog/v0/v0.00-v0.24.md#v012--deploy-to-vercel) | Deploy to Vercel | leader | all | todo |
| [V0.13](docs/backlog/v0/v0.00-v0.24.md#v013--align-header-with-page-content) | Align header with page content | dev-1 | V0.03 | done |
| [V0.14](docs/backlog/v0/v0.00-v0.24.md#v014--card--tag-background-tones) | Card & Tag background tones | dev-1 | V0.04 | done |
| [V0.15](docs/backlog/v0/v0.00-v0.24.md#v015--consistent-page-copy-in-content) | Consistent page copy in content | dev-2 | V0.06–V0.10 | done |
| [V0.16](docs/backlog/v0/v0.00-v0.24.md#v016--home-hero-uses-shared-container) | Home hero uses shared Container | dev-2 | V0.13, V0.15 | done |
| [V0.17](docs/backlog/v0/v0.00-v0.24.md#v017--live-reload-on-wsl) | Live reload on WSL | dev-1 | V0.01 | done |
| [V0.18](docs/backlog/v0/v0.00-v0.24.md#v018--about-skill-tags-use-tone-prop) | About skill tags use tone prop | dev-2 | V0.14 | done |
| [V0.19](docs/backlog/v0/v0.00-v0.24.md#v019--404-page--per-page-metadata) | 404 page & per-page metadata | dev-2 | V0.11, V0.18 | done |
| [V0.20](docs/backlog/v0/v0.00-v0.24.md#v020--workflow-diagrams) | Workflow diagrams | dev-1 | V0.04 | done |
| [V0.21](docs/backlog/v0/v0.00-v0.24.md#v021--behind-the-scenes-page) | Behind the Scenes page | dev-2 | V0.15, V0.19, V0.20 | done |
| [V0.22](docs/backlog/v0/v0.00-v0.24.md#v022--behind-the-scenes-nav-link) | Behind the Scenes nav link | dev-1 | V0.21, V0.23 | done |
| [V0.23](docs/backlog/v0/v0.00-v0.24.md#v023--space-palette--typography-always-dark) | Space palette, always dark | dev-1 | PR #2 | done |
| [V0.24](docs/backlog/v0/v0.00-v0.24.md#v024--animated-space-background) | Animated space background | dev-1 | V0.23 | done |
| [V0.25](docs/backlog/v0/v0.25-v0.49.md#v025--space-styled-components--layout) | Space-styled components | dev-1 | V0.23, V0.24 | done |
| [V0.26](docs/backlog/v0/v0.25-v0.49.md#v026--showpiece-scenes-solar-system--black-hole) | Scenes: solar system, black hole | dev-2 | V0.21, V0.24 | done |
| [V0.27](docs/backlog/v0/v0.25-v0.49.md#v027--remaining-page-scenes) | Remaining page scenes | dev-2 | V0.26 | done |
| [V0.28](docs/backlog/v0/v0.25-v0.49.md#v028--pages-fitted-to-the-space-theme) | Pages fitted to space theme | dev-2 | V0.25, V0.26 | done |
| [V0.29](docs/backlog/v0/v0.25-v0.49.md#v029--scene-engine-follow-ups) | Scene engine follow-ups | dev-1 | V0.27 | done |
| [V0.30](docs/backlog/v0/v0.25-v0.49.md#v030--space-themed-favicon--og-image) | Space-themed favicon & OG image | dev-2 | V0.23 | done |
| [V0.31](docs/backlog/v0/v0.25-v0.49.md#v031--nebula--sun-scenes-build-incrementally) | Nebula & sun build incrementally | dev-2 | V0.29 | done |
| [V0.32](docs/backlog/v0/v0.25-v0.49.md#v032--brighter-space-background) | Brighter space background | dev-1 | — | done |
| [V0.33](docs/backlog/v0/v0.25-v0.49.md#v033--snappier-scene-changes-between-pages) | Snappier scene changes | dev-1 | V0.32 | done |
| [V0.34](docs/backlog/v0/v0.25-v0.49.md#v034--version-numbers-and-batched-docs) | Version numbers & batched docs | leader | V0.33 | done |
| [V0.35](docs/backlog/v0/v0.25-v0.49.md#v035--sticky-header) | Sticky header | dev-1 | V0.34 | done |
| [V0.36](docs/backlog/v0/v0.25-v0.49.md#v036--black-hole-clear-of-text-at-tablet-width) | Black hole clear of text at tablet width | dev-2 | V0.34 | done |
| [V0.37](docs/backlog/v0/v0.25-v0.49.md#v037--behind-the-scenes-shows-version-ids) | Behind the Scenes shows version ids | dev-2 | V0.34 | done |
| [V0.38](docs/backlog/v0/v0.25-v0.49.md#v038--vertical-navigation-rail-with-bubble-hover) | Vertical navigation rail with bubble hover | dev-1 | V0.35 | done |
| [V0.39](docs/backlog/v0/v0.25-v0.49.md#v039--contact-galaxy-swirls) | Contact galaxy swirls | dev-2 | — | done |
| [V0.40](docs/backlog/v0/v0.25-v0.49.md#v040--contact-galaxy-core-breathes-and-stars-twinkle) | Contact galaxy core breathes and stars twinkle | dev-2 | V0.39 | done |
| [V0.41](docs/backlog/v0/v0.25-v0.49.md#v041--animation-onoff-control-in-the-footer) | Animation on/off control in the footer | dev-1 | V0.38 | done |
| [V0.42](docs/backlog/v0/v0.25-v0.49.md#v042--auto-pause-animation-on-low-powered-devices) | Auto-pause animation on low-powered devices | dev-1 | V0.41 | done |
| [V0.43](docs/backlog/v0/v0.25-v0.49.md#v043--behind-the-scenes-black-hole-moves-to-the-center) | Behind the Scenes black hole moves to the center | dev-2 | V0.46, V0.47 | todo |
| [V0.44](docs/backlog/v0/v0.25-v0.49.md#v044--behind-the-scenes-black-hole-comes-alive) | Behind the Scenes black hole comes alive | dev-2 | V0.43 | todo |
| [V0.45](docs/backlog/v0/v0.25-v0.49.md#v045--blue-gas-giant-orbits-the-black-hole) | Blue gas giant orbits the black hole | dev-2 | V0.44 | todo |
| [V0.46](docs/backlog/v0/v0.25-v0.49.md#v046--behind-the-scenes-one-band-tighter-even-spacing) | Behind the Scenes: one band, tighter even spacing | dev-2 | — | in progress |
| [V0.47](docs/backlog/v0/v0.25-v0.49.md#v047--slim-see-through-nav-rail-with-short-labels) | Slim, see-through nav rail with short labels | dev-1 | V0.49 | done |
| [V0.48](docs/backlog/v0/v0.25-v0.49.md#v048--phone-top-bar-shows-the-space-background) | Phone top bar shows the space background | dev-1 | V0.47 | done |
| [V0.49](docs/backlog/v0/v0.25-v0.49.md#v049--animation-switch-also-controls-ui-motion) | Animation switch also controls UI motion | dev-1 | V0.42 | done |
| [V0.50](docs/backlog/v0/v0.50-v0.74.md#v050--see-through-footer-with-the-animation-switch-on-the-right) | See-through footer with the Animation switch on the right | dev-1 | — | done |
| [V0.51](docs/backlog/v0/v0.50-v0.74.md#v051--real-profile-name-title-links-bio) | Real profile: name, title, links, bio | dev-2 | — | done |
| [V0.52](docs/backlog/v0/v0.50-v0.74.md#v052--real-education-and-work-history) | Real education and work history | dev-2 | — | done |
| [V0.53](docs/backlog/v0/v0.50-v0.74.md#v053--real-projects-and-skills) | Real projects and skills | dev-2 | — | done |
| [V0.54](docs/backlog/v0/v0.50-v0.74.md#v054--real-photo-and-resume-pdf) | Real photo and resume PDF | dev-2 | V0.51 | done |

## Old ids

Before V0.34, stories had `S<n>` ids in the backlog and `D<n>` ids in the story inbox. Commit messages and branch names from that time keep the old ids (published history is never rewritten).

| Old S id | Old D id | Version | Story |
|----------|----------|---------|-------|
| S1 | — | V0.01 | Project scaffold |
| S2 | — | V0.02 | Theme & dark mode |
| S3 | — | V0.03 | Site layout |
| S4 | — | V0.04 | Core UI components |
| S5 | — | V0.05 | Content model & placeholders |
| S6 | — | V0.06 | Home page |
| S7 | — | V0.07 | About page |
| S8 | — | V0.08 | Projects page |
| S9 | — | V0.09 | Resume page |
| S10 | — | V0.10 | Contact page |
| S11 | — | V0.11 | SEO metadata foundation |
| S12 | — | V0.12 | Deploy to Vercel |
| S13 | — | V0.13 | Align header with page content |
| S14 | — | V0.14 | Card & Tag background tones |
| S15 | — | V0.15 | Consistent page copy in content |
| S16 | — | V0.16 | Home hero uses shared Container |
| S17 | — | V0.17 | Live reload on WSL |
| S18 | — | V0.18 | About skill tags use tone prop |
| S19 | — | V0.19 | 404 page & per-page metadata |
| S20 | D1 | V0.20 | Workflow diagrams |
| S21 | D2 | V0.21 | Behind the Scenes page |
| S22 | D2 | V0.22 | Behind the Scenes nav link |
| S23 | D3 | V0.23 | Space palette & typography (always dark) |
| S24 | D5 | V0.24 | Animated space background |
| S25 | D4 | V0.25 | Space-styled components & layout |
| S26 | D6 | V0.26 | Showpiece scenes: solar system & black hole |
| S27 | D7 | V0.27 | Remaining page scenes |
| S28 | D8 | V0.28 | Pages fitted to the space theme |
| S29 | — | V0.29 | Scene engine follow-ups |
| S30 | — | V0.30 | Space-themed favicon & OG image |
| S31 | — | V0.31 | Nebula & sun scenes build incrementally |
| S32 | D9 | V0.32 | Brighter space background |
| S33 | D10 | V0.33 | Snappier scene changes between pages |
| S34 | D11 | V0.34 | Version numbers and batched docs |
