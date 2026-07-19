// Renders the flight list panel from current game state.

const tbody = document.querySelector('#flight-list tbody');

export function renderFlightList(aircraft) {
    tbody.replaceChildren();
    for (const ac of aircraft) {
        if (ac.status === 'landed') continue;
        const tr = document.createElement('tr');
        tr.dataset.flight = ac.flightNumber;
        if (ac.selected) tr.classList.add('selected');
        if (ac.status === 'approach') tr.classList.add('approach');
        if (ac.status === 'requesting') tr.classList.add('requesting');
        if (ac.status === 'lost') tr.classList.add('lost');

        const cells = [
            ac.flightNumber,
            ac.status === 'approach'
                ? `~${ac.approachCountdown}`
                : Math.round(ac.altitude).toString(),
            Math.round(ac.heading).toString().padStart(3, '0'),
            ac.speed.toString(),
            ac.status,
        ];
        for (const c of cells) {
            const td = document.createElement('td');
            td.textContent = c;
            tr.appendChild(td);
        }
        tbody.appendChild(tr);
    }
}
