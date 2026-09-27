# chipped dice

a single page that pulls 65536 bytes out of `crypto.getRandomValues` in your own browser and draws them at you.

there's a greyscale bitmap (one byte per pixel), a pooled byte histogram in z-scores, monobit / runs / chi-square,
and a 256x256 pair plot (byte i vs byte i+1). the pair plot marks never-hit cells in red once there are ~16 expected hits per cell.

the "chip the die" button makes the generator unable to emit 0, which is roughly the shape of that amd rng thread.
you can't see it in the static. you can see it in the pair plot: a red row and a red column.

it won't catch a real backdoor. it'll catch a missing face.

rendering and maths are checked on paper, not in a browser yet.
