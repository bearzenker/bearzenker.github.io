# Mission Statement
We are creating an Air Traffic Control (ATC) simulator game as an exercise to teach agentic coding practices to experienced developers. The application will run in a browser. There will be no backend. The application will be developed in sprints. This instruction will describe a minimal viable product. Later sprints will add features.

Use Javascript. You may import any publically available libraries or frameworks.

The game will progress through multiple levels. Each level will be timed. The controller will get points for the number of plane they land. They will lose points for a "near miss" where aircraft get within 2 blocks of each other.  If two aircraft collide, it is "game over. "

Level one will last 60 turns. It will start with two aircraft entering the screen. Every 5 turns a new aircraft will enter. There will be a total of 6 aircraft. 

The level one airport almost sea level, so all altitudes are above ground level.

## The Screen
The "controller" (player) will have an 800x800 square radar screen. On the left side will be a "flight list" displaying aircraft in the controller's sector. On the right side will be a chat window where aircraft will announce their arrival. At the bottom of the chat window is a command prompt for controller to give aircraft instructions. In the middle of the display is the airport.

The radar screen will be divided into blocks. Block size is set by a variable. The default will be 10 pixels.

## Aircraft
Aircraft will be displayed as a dot. A line will extend from the tail of the plane pointing in the direction (heading) of travel. on the other end of the line will be the flight number (as displayed in the "flight list". Under the flight number is the altitude in "Angles" (thousands of feet), where 9=9,000 feet and 11=11,000 feet. Aircraft can pass through the same map pixel as long as they are at different altitudes.

## The Airport
The airport will be displayed as runways represented as a line. At each end of the runway is a runway number. At the airport there will be a wind direction pointer. Airplane must land flying into the wind. If the wind is blowing east, the planes must land heading west. The runways have V shaped final approach vectors shown as dotted lines. If a plane is directed into the approach vector, the plan will announce in chat "On final approach" and automatically make any changes needed to land.

# Game Play
Aircraft will appear at the edges of the radar screen. They will have a random altitude between 5 and 20. They will have a heading the would point them directly toward the airport. They will announce their flight number in chat and "Permission to land". Every time a message appears in chat there will be chime and a flash indicator in the upper left corner of the radar screen.

## Flight Dynamics
Each aircraft will have variables for flight number, type, speed, heading, altitude, current position and destination. Later sprints may add more variables. The flight number is two letters, and up to four numbers. The type will default to "airliner". The current position and destination are X-Y coordinates.

Aircraft movement will happen "per turn". At the end of each turn there will be a pause, defined by variable. The default pause is 5 seconds. The 800 pixel wide screen will have 80 blocks. An aircraft on heading 90 (due east) with a speed of 1 will cross the radar screen in 80 turns, but an Air Force fighter with speed of 2 will cross in 40 turns.

Aircraft default physics:
- speed of one block per turn
- change altitude at a rate of 2 Angels per turn
- turn at 30 degrees of heading per turn

## Landing
The runway will be a line 3 blocks long. The Landing vector will be 10 blocks long extending 3 blocks above and 3 block below the runway. Planes will auto pilot to landing if:
- they enter the 7 block vector (3 above + 1 runway + 3 below) zone, and
- they are on the runway heading, or within 30 degrees of heading of the runway, and
- they are at of below altitude Angles 5 (5,000 feet)
When an airplane is in the landing vector, they announce in chat: "<flight number> on final approach".

If two planes enter final approach on the same turn, it is considered a collision, and is "game over".

Planes on final approach will have their destination changed to "approach" and their current position changed to 5. In the "flight list" screen they will be tagged as "approach". They disappear from the radar screen, because they are now under control of the tower. Each turn planes in approach will have their current position decremented. When they reach 0 their destination is changed to "landed" and they are removed from the flight list.

## Control
The controller can give aircraft orders even during the pause phase.

The controller will click on the radar screen to select an aircraft. If they are within 2 blocks, the plane is considered selected. The aircraft will be highlighted. The controller will click a destination. The selection's destination will be set to the destination. The aircraft will confirm the order in chat: "<flight number> to position X,Y".

The controller can also will give instructions in the chat window. They will give the flight number, and a command. The commands are:
- L<compass heading> to turn left
- R<compass heading> to turn right
- H<compass heading> if they do not care about the direction of turn
- C<altitude above sea level> to increase altitude
- D<altitude above sea level> to lower altitude
Additional command may be added in later sprints.

## Lost Aircraft
When an aircraft reaches its destination, it states in chat "<flight number> request heading". It will continue on its previous heading until the controller responds. If the aircraft flies off the screen it is "lost" and removed from the flight list. This will be counted against the controller's score.

