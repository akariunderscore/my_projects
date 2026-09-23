# chipped dice

a single page that pulls 65536 bytes out of `crypto.getRandomValues` in your own browser and draws them at you.

step one (now): greyscale bitmap, one byte per pixel, re-roll button, running mean.
next: byte histogram, monobit, runs, and a 256x256 pair-frequency plot that lights up if any value pair never shows.

it won't catch a real backdoor. it'll catch a missing face.
