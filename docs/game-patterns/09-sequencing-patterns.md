---
title: "Sequencing Patterns"
category: "Sequencing Patterns"
tags: [game-programming, sequencing-patterns]
source: "Game Programming Patterns - Robert Nystrom"
---

Sequencing Patterns

# Sequencing Patterns

Videogames are exciting in large part because they take us somewhere else. For a
few minutes (or, let’s be honest with ourselves, much longer), we become
inhabitants of a virtual world. Creating these worlds is one of the supreme
delights of being a game programmer.

One aspect that most of these game worlds feature is *time* — the artificial
world lives and breathes at its own cadence. As world builders, we must invent
time and craft the gears that drive our game’s great clock.

The patterns in this section are tools for doing just that. A [Game
Loop](game_loop.html) is the central axle that the clock spins on. Objects hear
its ticking through [Update Methods](update_method.html). We can hide the
computer’s sequential nature behind a facade of snapshots of moments in time
using [Double Buffering](double_buffer.html) so that the world appears to
update simultaneously.

## The Patterns

- [Double Buffer](double_buffer.html)

- [Game Loop](game_loop.html)

- [Update Method](update_method.html)
