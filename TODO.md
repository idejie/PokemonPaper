# TODO / Backlog

Ideas for PokemonPaper, roughly ordered by value. This is a backlog, not a
commitment; effort is **S** (< 1 day), **M** (1–3 days), **L** (> 3 days).

## Next up

- [x] **Share card PNG** — export a paper as a card image (sprite, level, type,
      moves, trainer) for X / 朋友圈. Reuses existing data; best growth loop. `S`
- [x] **Three-stage evolution** — unread → reading → read is only the first arc;
      add annotated / reproduced stages and a real juvenile–adult–final sprite
      per seed, so lighting up actually evolves the creature. `M`
- [x] **Daily wild paper** — one recommended arXiv paper per day ("a wild paper
      appeared"), double XP if read; answers "what should I read today". `M`
- [x] **Category gyms** — 12 gyms by arXiv top-level field; read N papers and
      write notes to earn the badge. Gives the 155 categories a long-term goal. `M`

## A. Growth

- [x] **Bond / 羁绊值** — notes, revisits and reading time raise bond; unlock
      accessories and idle animations. `S`
- [ ] **8-bit cries** — deterministic WebAudio cry per arXiv ID, played when a
      paper lights up. No audio assets needed. `S`
- [ ] **Shiny variants** — highly cited / top-venue / classic papers get a shiny
      palette with particles; ordinary papers 1/64. `S`

## B. Dex

- [ ] **Regional dex** — group papers by year or venue into regions and show
      per-region completion. `M`
- [ ] **Dex entries** — two AI-generated flavour lines per paper, Pokémon-dex
      style; can be turned off. `S`
- [ ] **Move set** — extract four moves from title / method
      (Attention, Diffusion, RLHF…) for cards and the share image. `S`

## C. Social

- [ ] **Trading** — trade a paper (with notes) to another user; their dex +1.
      Useful for reading groups. `M`
- [ ] **Party of six** — pin six papers as your party, shown on profile and
      leaderboard; display only, no combat stats. `S`
- [ ] **Gym leaders** — monthly crown for the top reader in each category. `M`

## D. Reading tools

- [ ] **Breeding / cross-paper ideas** — pick two papers to "breed"; the model
      proposes a cross-field research gap and the UI shows a hybrid sprite.
      Turns collecting into a topic-generation tool. `L`
- [ ] **Paper eggs** — queue papers you want to read but have no time for; open
      the abstract to start incubation, finish reading to hatch. `S`

## E. Docs & UI gaps

- [ ] **New screenshots** — AI artwork, leaderboard likes column, stats page and
      guide page; current `docs/*.png` predate these features. `S`
- [ ] **Batch artwork UI** — `POST /api/sprites/generate` exists, but the UI only
      has the per-paper button; add a batch action with progress. `S`
- [x] **Likes in profile** — show "likes received" in the trainer profile, not
      just on the leaderboard. `S`
- [ ] **English README parity** — the Chinese section still has the data model,
      account section and more screenshots than the English one. `S`

## Not doing

- **PvP battles** — papers are not comparable by strength; it would mislead.
- **Stamina / daily check-in / streaks** — conflicts with a serious reading tool.
- **Paid gacha** — would break the current restrained design.
