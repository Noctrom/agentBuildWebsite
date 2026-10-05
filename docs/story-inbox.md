# Story inbox

Drafted by the story-writer from conversations with Chris. The leader moves `ready` stories into `BACKLOG.md` (assigning `S` ids and owners) and removes them from here.

### D8 — Pages fitted to the space theme
**Status:** draft · **Suggested owner:** dev-2 · **Depends on:** D4, D6 · **Drafted:** 2026-10-04

*As a visitor, I want every page laid out to work with its space scene so that content and background feel composed together.*

After the new components (D4) and showpiece scenes (D6) land, each page needs a pass so content and scene don't fight. Page and content files only.

- [ ] Home hero leaves room for the solar system scene so the sun/planets frame the text instead of sitting behind it
- [ ] Every page (Home, About, Projects, Resume, Contact, Behind the Scenes, 404) checked over its scene: no page-level leftovers from the light theme, text readable, spacing works with the frosted panels
- [ ] Anything that needs a component or scene change is reported to the leader, not built in the page
- [ ] Works at 375px and desktop; `npm run build` and `npm run lint` pass

**Open questions:** None.
