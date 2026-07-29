# ATC - Fable
This version of the Air Traffic Control simulator was performed as a pure vibe coding exercise with as little input as I though reasonably possible. The model, Claude Fable 5, was given this prompt:
```
I want a browser based Air Traffic Control simulation game. The game 
has to run on a laptop browser screen and should be realistic. There 
needs to be an instructions page. Aircraft will enter the map and the 
player will direct them to the airport in the middle of the map. When 
the plane approaches the runway, the tower will take over and the pilot 
will land. There will be levels that start with 5 planes and a time limit 
and a score for landings, but the player can let planes crash. Each level 
gets more challenging.
```

I acknowledge the prompt could have been just the first sentence, but the extra details seemed appropriate to keep the results aligned "in spirit" with the previous contenders.

## The Model
At the start of July 2025, Fable 5 was Anthropic's 5 was the most powerful coding agent. Some benchmarks gave OpenAI GPT-5.6 Sol a point above Fable,  but most gave Fable the lead by a point. By the end of July, Anthropic Opus 5 beat Fable across the board and beat or tied Sol.

Even though Opus 5 had been available for 48 hours when this experiment was run, Fable was chosen because it was only available by pay-per-token. The Gemini and Claude Sonnet versions were developed on a subscription plan and the OpenAI Luna version was a free plan.

Using a pay-per-token model offers an additional insight from the experiment: 
- How much does this *really* cost?  **$14.18**
- *Important*: Anthropic is typically the most expesive model, per token.


## The Outcome
First, the application was flawless out of the box. 

Second, almost impossible to *play*. It is **work**. Complicated work.
- Aircraft airspeed, things happen fast
- Mixed aircraft from Boeing 777 to Cessna
- Relative headings, turn left or right 30 degrees
- Must actively issue "clear to land" instructions


It took at least four tries to land one airplane.

The collision alerts are fun. 

Fable introduced other features like fuel status and "mayday" conditions.

## Final Analysis
