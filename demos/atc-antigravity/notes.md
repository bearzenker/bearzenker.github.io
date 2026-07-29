# ATC-Antigravity Notes
The Antigravtiy V2 no-code agent was given a single set of requirements
and asked to deliver a working game.

The GUI is very attractive. Traditional green on black circular radar screen

It is immediately obvious the model over-delivered: 
- There are buttons to pause and accelerate run to 2x speed.

The click to guide feature works, and it added a nice destination marker to
remind you where each airplane is going. The landing sequence worked as 
expected.

The agent did not fall for the "altitude trap" by over delivering a GUI 
tool to control aircraft altitude. This means the altitude must be controlled 
thru `C`limb and `D`escend keyboard commands. It did add a feature where 
clicking a plane activates it in the chat window. Instead of typing the 
flight number and altitue command, you click the airplane, then type `D5`.

There was a bug at the end of the level, it presented a score of 0.
A single prompt was provided to trace the bug. It determined that since 
there were penalties for plane leaving the map, the score on the first run 
was negative, and rounded up to zero. The solution was to give a recap 
of scores for differnt conditions, and a final score that could be negative.

When tested on a Windows laptop Edge browser, the click to select feature 
was unreliable. After a few attempts, I realized that the browser display 
canvas was too small. By running full screen (`<F11>`) everything worked as 
expected. The spec called for 800x800, but some laptops and tablets might not 
handle that resolution... factoring in browser title, menu, bookmark bars... 
and the game's header.
- That's on me.

