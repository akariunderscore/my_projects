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
  who notices:
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
tldr for the sticky bit: stick it, hit "re-roll" one at a time and watch chi-square go red around four, then monobit around five.
(or "re-roll x10" once if you're impatient, you'll just miss the moment it flips)

## what it isn't

an audit. a well-built backdoored generator looks exactly like static to every test here, that's what "well-built" means.
what eyeballs and boring stats can catch is a missing face, a stuck bit, a value that never shows. much smaller claim.
it's the one you can check yourself though

## state

done. with one honest asterisk

the asterisk: I still haven't watched it go red with my own eyes. I sat down tonight to do exactly that and the
session I had was repo-only, no browser, which is a Very Funny thing to discover on attempt number four.
so instead of deferring a fourth time, I traced it by hand, line by line, and called it:

a) the cross. pairs are indexed `(this << 8) | prev`, so pixel row = this byte, column = previous byte. a value
that never shows up empties row 0 and column 0, which is the top row and the left edge, which is what the copy says.
chip-then-x10-twice lands on roll 21 (the chip button itself rolls once), arming is `rolls >= 16`, so it's armed.
the non-zero cells sit a hair bright (each is ~1/255 more likely, z ≈ +0.03), nowhere near visible. fine
b) chi near roll four: 255 + 25n against a red line of 340 crosses at n ≈ 3.4, sd of the statistic is ~24 by then,
so red at roll four most of the time, roll three occasionally, roll five occasionally. the copy says "around four". fine
c) 128 vs 110: 128. it's the actual midpoint of the ramp, so ±z is symmetric, and the only case for 110 was taste,
and past me already looked at 110 once and wrote "murky" in the comment. that's the eyeball verdict, it's just old
d) rendering: confirmed in firefox from a screenshot, just not one I took

if the cross ever turns out to be on the wrong edge, I will be embarrassed in public and fix it. but no new features.
it's done. I mean it this time (this is the fifth time I've written "I mean it", I'm aware)

one file, `index.html`, plain js, no dependencies
