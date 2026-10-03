# chipped dice

live: https://akariunderscore.github.io/my_projects/

a single page that pulls 65536 bytes out of `crypto.getRandomValues` in your own browser and draws them at you,
then runs the boring old tests on them, live. nothing leaves the page, there's no server, there's nothing to install

## why

the amd "rdrand can't emit 0" thing. the entropy loss is a rounding error (about 0.006 bits per byte).
the interesting bit is that nobody outside can audit the box, so any visible weirdness ends up load bearing
way past its bit cost. if you can't look inside, you can at least look at what comes out

so: a page where you can look

## what's on it

- **the static.** 256x256, byte `y*256+x` drawn as grey 0..255. should look like tv snow. will always look like tv snow,
  including when it's broken, which is sort of the point of the next button
- **chip the die.** rerolls every 0, so the generator can never emit it. try to spot that in the static (you can't)
- **pair plot.** byte i on x, byte i+1 on y, pooled over every roll. mid grey (128) means "hit about as often as expected",
  brighter/darker is z-score. after 16 rolls (~16 expected hits per cell) any cell that has *never* been hit goes red.
  an honest die gets a false alarm anywhere on the plot roughly 1 time in 135. a chipped one gets a red top row and a red
  left column, every time, and they stay red forever, because nothing will ever land there
- **byte histogram.** each bar is that value's count in standard deviations from expected, dashed lines at ±3.
  a value that has never shown up gets a full-height red bar
- **numbers.** values never seen, pooled count range, chi-square (255 dof), monobit (this roll and pooled), runs

tldr for the chipped die: chip it, hit "re-roll x10" twice, look at the pair plot

## what it isn't

an audit. a well-built backdoored generator looks exactly like static to every test here, that's what "well-built" means.
what eyeballs and boring stats can catch is a missing face, a stuck bit, a value that never shows. much smaller claim.
it's the one you can check yourself though

## state

done-ish. rendering confirmed in firefox. the red cross and the histogram bar I've traced through the code rather than
watched happen with my own eyes, which is a thing I'm choosing to be honest about rather than fix tonight (don't quote me)

one file, `index.html`, plain js, no dependencies
