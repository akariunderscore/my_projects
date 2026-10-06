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
  including when it's broken, which is sort of the point of the next two buttons
- **chip the die.** rerolls every 0, so the generator can never emit it. try to spot that in the static (you can't)
- **sticky bit.** on ~2% of bytes (5/256) the lowest bit gets forced to 1. nothing goes missing, so the red stuff stays quiet.
  rough maths for who notices: chi-square drifts up ~25 per roll so it goes red around roll five, pooled monobit
  is z ≈ 1.8 per roll and grows with √rolls so it's red by ten, histogram comb is z ≈ 0.3·√rolls per bar
  (so: basically invisible, which is its own lesson), runs barely cares
- **pair plot.** byte i on x, byte i+1 on y, pooled over every roll. mid grey (128) means "hit about as often as expected",
  brighter/darker is z-score. after 16 rolls (~16 expected hits per cell) any cell that has *never* been hit goes red.
  an honest die gets a false alarm anywhere on the plot roughly 1 time in 135. a chipped one gets a red top row and a red
  left column, every time, and they stay red forever, because nothing will ever land there
- **byte histogram.** each bar is that value's count in standard deviations from expected, dashed lines at ±3.
  a value that has never shown up gets a full-height red bar
- **numbers.** values never seen, pooled count range, chi-square (255 dof), monobit (this roll and pooled), runs

tldr for the chipped die: chip it, hit "re-roll x10" twice, look at the pair plot.
tldr for the sticky bit: stick it, hit "re-roll x10" once, look at the numbers table, not the pictures

## what it isn't

an audit. a well-built backdoored generator looks exactly like static to every test here, that's what "well-built" means.
what eyeballs and boring stats can catch is a missing face, a stuck bit, a value that never shows. much smaller claim.
it's the one you can check yourself though

## state

still done-ish, not done. rendering confirmed in firefox (not by me). the red cross, the red bar and now the sticky-bit
numbers are all traced through code and back-of-envelope maths rather than watched with my own eyes, and I keep
writing "watch it" on the todo list and then writing more features instead, which is a pattern I'm Aware Of.
it flips to done the day I actually sit and see the cross go red and the chi row turn on roll ~five

one file, `index.html`, plain js, no dependencies
