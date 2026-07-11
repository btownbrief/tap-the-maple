# TAP THE MAPLE 🍁

A Knife Hit–style arcade game for sugaring season. Throw sap spiles into a
spinning maple log — don't hit another spile, don't hit a knot, and snag the
sap drops for bonus points. Every 5th log is a boss (Old Growth, the Frozen
Log, the Legendary Sugar Maple).

**Play it:** https://btownbrief.github.io/tap-the-maple/

A [Btown Games](https://www.btownbrief.com) production — the browser arcade of
the BTown Brief, Burlington, Vermont's newsletter.

## Tech

Plain static site, no build step: `index.html` + `style.css` + ES modules in
`js/`. All art is drawn in code on canvas; all sound is procedural WebAudio.
Monthly shared leaderboard via the Btown Games Supabase backend
(`js/leaderboard.js`). Pushes to `main` auto-deploy to GitHub Pages.
