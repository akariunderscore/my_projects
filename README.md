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
- **sticky bit.** on ~2% of bytes (p = 5/256) the lowest bit gets forced to 1. nothing goes missing, so the red stuff stays quiet.
  who notices, redone properly this time:
  a) chi-square: every odd value is up by N·p/256 per roll and every even one down by the same, so it drifts up by
  N·p² = 25 per roll (exactly 25, because 5/256 squared times 65536 is 25, which is a nice accident).
  starts around 255, red line is 340, so red from about roll four (noise wobbles that by a roll or so)
  b) pooled monobit: half the bytes already had the low bit set, so the excess is N·p/2 = 640 ones per roll against
  an sd of ~362, z ≈ 1.77·√rolls. yellow (2.58) from roll ~3, red (3.9) from roll ~5
  c) histogram comb: z ≈ 0.3·√rolls per bar, so basically invisible, which is its own lesson
  d) runs barely cares
- **pair plot.** byte i on x, byte i+1 on y, pooled over every roll. mid grey (128) means "hit about as often as expected",
  brighter/darker is z-score. after 16 rolls (~16 expected hits per cell) any cell that has *never* been hit goes red.
  honest die: chance a given cell is still empty is e^-16, times 65536 cells ≈ 0.0074, so a false alarm roughly 1 time in 135.
  a chipped one gets a red top row and a red left column, every time, and they stay red forever, because nothing will ever land there
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

still done-ish. the sticky bit mode already exists (past me was ahead of the todo list, for once), so tonight was
re-checking the maths instead: the 1-in-135, the 25 per roll on chi-square, the z ≈ 1.77 on monobit all hold up.
the page copy was a bit pessimistic about the sticky bit (said chi red "around five", monobit red "by ten", it's
more like four and five), so that's fixed

what I still haven't done is sit and watch the cross go red with my own eyes. rendering confirmed in firefox,
not by me. the 128 grey vs 110 call also needs eyes, not arithmetic. so the flip to done waits for that, again,
and yes I can see the pattern, thank you

one file, `index.html`, plain js, no dependencies
