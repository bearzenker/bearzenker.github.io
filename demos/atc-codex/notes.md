# ATC-Codex
The Codex display is a simple green on black circular display with rounded 
green themed information displays. 

Point and click works as specified. Flight dynamics work as specified.
The agent did not fall got the "altitude trap".

Codex was using OpenAI's least powerful GPT-5.6 model, Luna. From a 
requirements standpoint it was perfect out of the box. Where Luna had 
problems was with the information displays. The chat window was acting as 
a viewport and the text would "overflow" outside of the viewing area and be 
"hidden" by the frame. This is not an unusual CSS problem.

It took three chats to talk Luna thru the CSS changes. Looking at this from 
the perspective of a "vide coder", this was the most difficult bug to fix. 
It is likely a person with no HTML/CSS+Javascript experience might not have
been able to resolve this. In the real world, a novice might have thought to 
screenshot the problem and attach it to the chat, but I'd guess it still 
would have take several attempts.

Other than the GUI issues, Luna did strictly adhere to the Minimal Viable 
Product requirements.

