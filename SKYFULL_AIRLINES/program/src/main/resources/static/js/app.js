const API_URL = '/api';

// --- Utils ---
function showToast(message, type = 'success') {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        document.body.appendChild(toast);
    }
    toast.className = `toast ${type} show`;
    toast.textContent = message;
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

async function apiRequest(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        }
    };
    if (body) options.body = JSON.stringify(body);

    try {
        const response = await fetch(`${API_URL}${endpoint}`, options);
        if (!response.ok) {
            const text = await response.text();
            throw new Error(text || 'API Error');
        }
        // If content-type is json, parse it, else text
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            return await response.json();
        } else {
            return await response.text();
        }
    } catch (error) {
        showToast(error.message, 'error');
        throw error;
    }
}

// --- Tabs ---
function openTab(tabId, btnElement) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

    const tab = document.getElementById(tabId);
    if (tab) tab.classList.add('active');

    if (btnElement) btnElement.classList.add('active');
}

async function performPublicCheckIn() {
    const pnr = document.getElementById('checkin-pnr').value;
    const surname = document.getElementById('checkin-surname').value;

    if (!pnr || !surname) {
        showToast('Please enter Ticket Number and Surname', 'error');
        return;
    }

    const btn = document.querySelector('#tab-checkin button');
    const oldText = btn.innerText;
    btn.innerText = 'Checking in...';
    btn.disabled = true;

    try {
        const response = await apiRequest('/bookings/checkin/public', 'POST', {
            bookingId: pnr,
            surname: surname
        });
        // API returns a simple string message on success
        showToast(response, 'success');

        // Reset inputs
        document.getElementById('checkin-pnr').value = '';
        document.getElementById('checkin-surname').value = '';

    } catch (e) {
        console.error(e);
        // Error toast is handled by apiRequest typically, but if not:
        // if (!document.querySelector('.toast.show.error')) showToast(e.message, 'error');
    } finally {
        btn.innerText = oldText;
        btn.disabled = false;
    }
}

// --- Auth ---
async function login(username, password) {
    try {
        const user = await apiRequest('/auth/login', 'POST', { username, password });
        localStorage.setItem('user', JSON.stringify(user));
        showToast(`Welcome back, ${user.fullName}`);

        // Redirect based on role
        if (user.role === 'ADMIN') window.location.href = 'admin.html';
        else if (user.role === 'OWNER') window.location.href = 'owner.html';
        else window.location.href = 'user.html'; // Default user
    } catch (e) {
        console.error(e);
    }
}

async function register(user) { // user object
    try {
        await apiRequest('/auth/register', 'POST', user);
        showToast('Registration successful! Please login.');
        setTimeout(() => window.location.href = 'login.html', 1500);
    } catch (e) {
        console.error(e);
    }
}

function logout() {
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}

function requireAuth(role = null) {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = 'login.html';
        return null;
    }
    if (role && user.role !== role) {
        alert('Unauthorized access');
        window.location.href = 'index.html';
        return null;
    }
    return user;
}

// --- Manage Booking ---
async function performManageBooking() {
    const pnr = document.getElementById('manage-pnr').value;
    const surname = document.getElementById('manage-surname').value;
    const resultsContainer = document.getElementById('managed-booking-results');

    if (!pnr || !surname) {
        showToast('Please enter Ticket Number and Surname', 'error');
        return;
    }

    const btn = document.querySelector('#tab-manage button');
    const oldText = btn.innerText;
    btn.innerText = 'Searching...';
    btn.disabled = true;
    resultsContainer.innerHTML = ''; // Clear previous

    try {
        const response = await apiRequest(`/bookings/manage/public?bookingId=${pnr}&surname=${surname}`, 'GET');

        // Response is expected to be a detailed object:
        // { bookingId, flightCode, origin, dest, depTime, seat, status, price, passengerName, type }

        if (!response) throw new Error('Booking not found.');

        resultsContainer.innerHTML = `
            <div class="glass-card" style="border:1px solid var(--accent);">
                <h4 style="color:var(--accent); margin-bottom:1rem; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:0.5rem;">
                    Booking Details #${response.bookingId}
                </h4>
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap:1rem;">
                    <div>
                        <small style="color:#ccc;">Passenger</small>
                        <div style="font-weight:bold; font-size:1.1rem;">${response.passengerName}</div>
                        <span style="font-size:0.8rem; background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:4px;">${response.type}</span>
                    </div>
                    <div>
                        <small style="color:#ccc;">Flight</small>
                        <div style="font-weight:bold;">${response.flightCode}</div>
                        <div>${response.origin} ➝ ${response.dest}</div>
                    </div>
                    <div>
                         <small style="color:#ccc;">Time</small>
                         <div>${new Date(response.depTime).toLocaleString()}</div>
                    </div>
                    <div>
                        <small style="color:#ccc;">Seat</small>
                        <div style="font-size:1.2rem; color:var(--accent);">${response.seat}</div>
                    </div>
                    <div>
                        <small style="color:#ccc;">Status</small>
                        <div style="font-weight:bold; color:${getStatusColor(response.status)}">${response.status}</div>
                    </div>
                </div>
                ${response.status === 'CONFIRMED' ? `
                    <div style="margin-top:1.5rem; text-align:right; border-top:1px solid rgba(255,255,255,0.1); padding-top:1rem;">
                        <button class="btn btn-outline" onclick="performPublicCheckInFromManage('${response.bookingId}', '${surname}')">Check-In Now</button>
                    </div>
                ` : ''}
            </div>
        `;

    } catch (e) {
        console.error(e);
        resultsContainer.innerHTML = `<div style="text-align:center; color:var(--danger); padding:1rem;">${e.message || 'Booking not found matching these details.'}</div>`;
    } finally {
        btn.innerText = oldText;
        btn.disabled = false;
    }
}

function performPublicCheckInFromManage(id, surname) {
    // Switch to check-in tab and auto-fill
    openTab('tab-checkin');

    // Find the button reference correctly for the tab switch to highlight
    const checkinBtn = document.querySelector(`.tab-btn[onclick*="tab-checkin"]`);
    if (checkinBtn) openTab('tab-checkin', checkinBtn);

    document.getElementById('checkin-pnr').value = id;
    document.getElementById('checkin-surname').value = surname;
    // Optionally auto-submit: performPublicCheckIn();
}

// --- Flight Status ---
async function performCheckStatus() {
    const code = document.getElementById('status-flight').value;
    const date = document.getElementById('status-date').value;
    const resultsContainer = document.getElementById('status-results');

    if (!code || !date) {
        showToast('Please enter Flight Number and Date', 'error');
        return;
    }

    const btn = document.querySelector('#tab-status button');
    const oldText = btn.innerText;
    btn.innerText = 'Checking...';
    btn.disabled = true;
    if (resultsContainer) resultsContainer.innerHTML = '';

    try {
        const response = await apiRequest(`/flights/status/public?flightCode=${code}&date=${date}`, 'GET');

        if (!response) throw new Error('Flight not found.');

        // Show result
        if (!resultsContainer) {
            // If container missing (should be added in html), alert fallback or create dynamic
            alert(`Flight ${response.flightCode}\nStatus: ${response.status}\nDep: ${new Date(response.depTime).toLocaleString()}`);
        } else {
            resultsContainer.innerHTML = `
                <div class="glass-card" style="border:1px solid ${getStatusColor(response.status)}; margin-top:1rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div>
                             <h3 style="color:var(--accent);">${response.flightCode}</h3>
                             <p>${response.origin} ➝ ${response.dest}</p>
                             <small>Aircraft: ${response.aircraft}</small>
                        </div>
                        <div style="text-align:right;">
                             <div style="font-size:1.5rem; font-weight:bold; color:${getStatusColor(response.status)}">${response.status}</div>
                             <div>${new Date(response.depTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                    </div>
                </div>
             `;
        }

    } catch (e) {
        console.error(e);
        if (resultsContainer) resultsContainer.innerHTML = `<div style="text-align:center; color:var(--danger); padding:1rem;">${e.message || 'Flight not found.'}</div>`;
        else showToast(e.message || 'Flight not found', 'error');
    } finally {
        btn.innerText = oldText;
        btn.disabled = false;
    }
}

// --- Flights ---
async function loadPublicFlights() {
    try {
        const flights = await apiRequest('/flights/public');
        window.publicFlightsData = flights; // Store for filtering

        // Don't render on load. Wait for search.
        const container = document.getElementById('flights-container');
        if (container) {
            container.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:3rem; opacity:0.7;">Please use the search panel above to find flights.</div>';
        }
    } catch (e) {
        console.error(e);
    }
}

function renderFlights(flights) {
    const container = document.getElementById('flights-container');
    const section = document.getElementById('flights-section');

    if (section) section.style.display = 'block'; // Show section on search
    if (!container) return;

    if (flights.length === 0) {
        container.innerHTML = '<div style="grid-column: 1/-1; text-align:center;">No flights found matching your criteria.</div>';
        return;
    }

    container.innerHTML = flights.map(f => {
        const user = JSON.parse(localStorage.getItem('user'));
        const isAdmin = user && user.role === 'ADMIN';
        const btnHtml = isAdmin
            ? ``
            : `<button class="btn btn-primary" onclick="startBooking('${f[0]}', ${f[5]})">Book Now</button>`;

        return `
            <div class="glass-card">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <h3 style="color:var(--accent)">${f[0]}</h3>
                        <p>${f[1]} <i style="margin:0 10px;">✈</i> ${f[2]}</p>
                        <small>${new Date(f[3]).toLocaleString()} • ⏱ ${f[8] || '?'}</small>
                    </div>
                    <div style="text-align:right;">
                        <h2>$${f[5]}</h2>
                        <p>${f[6]} Seats Left</p>
                        ${btnHtml}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function toggleReturnDate() {
    const isRound = document.querySelector('input[name="tripType"]:checked').value === 'roundTrip';
    const retInput = document.getElementById('search-ret');
    if (isRound) {
        retInput.disabled = false;
        retInput.style.opacity = '1';
        retInput.style.cursor = 'text';
    } else {
        retInput.disabled = true;
        retInput.style.opacity = '0.5';
        retInput.style.cursor = 'not-allowed';
        retInput.value = '';
    }
}

function normalizeSearch(str) {
    if (!str) return "";
    return str.toLocaleLowerCase('tr-TR')
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ı/g, 'i')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c');
}

function filterFlights() {
    const fromEl = document.getElementById('search-from');
    const toEl = document.getElementById('search-to');
    const dateEl = document.getElementById('search-date');
    const countEl = document.getElementById('search-passengers');

    const fromVal = fromEl ? normalizeSearch(fromEl.value) : '';
    const toVal = toEl ? normalizeSearch(toEl.value) : '';
    const dateVal = dateEl ? dateEl.value : '';
    // Default to 1 if element missing (Admin view)
    const paxCount = countEl ? (parseInt(countEl.value) || 1) : 1;

    if (!window.publicFlightsData) return;

    const filtered = window.publicFlightsData.filter(f => {
        // f structure: [id, origin, dest, depTime, arrTime, price, seats] or similar from View
        // Actually view is: FlightCode, Origin, Destination, DepartureTime, Status, BasePrice, AvailableSeats
        // f[1]=Origin, f[2]=Dest, f[3]=DepTime, f[6]=AvailableSeats

        // Normalize DB data too (Origin and Dest)
        const origin = normalizeSearch(f[1]);
        const dest = normalizeSearch(f[2]);
        const depTime = f[3];
        const seats = f[6];

        if (!origin.includes(fromVal)) return false;
        if (!dest.includes(toVal)) return false;
        if (dateVal && !depTime.startsWith(dateVal)) return false;
        if (seats < paxCount) return false;

        return true;
    });

    renderFlights(filtered);
}

// --- Booking Flow ---
let currentFlightCode = null;
let currentPrice = 0;
let selectedSeat = null; // Will define a single seat for now, strictly per request or simple flow
// For multi-pax, ideally we select multiple seats.
let selectedPassengerTypes = ['ADULT'];

function renderPaxTypeInputs() {
    const countInput = document.getElementById('search-passengers');
    if (!countInput) return; // Not on search page

    const count = parseInt(countInput.value) || 1;
    const container = document.getElementById('pax-types-container');
    if (!container) return;

    container.innerHTML = '';

    for (let i = 1; i <= count; i++) {
        const div = document.createElement('div');
        div.style.flex = '1';
        div.style.minWidth = '120px';
        div.innerHTML = `
            <label style="font-size:0.8rem; color:var(--text-light);">Passenger ${i}</label>
            <select class="pax-type-select" style="width:100%; padding:0.5rem; border-radius:8px; border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.05); color:white;">
                <option value="ADULT" style="color:black;">Adult</option>
                <option value="STUDENT" style="color:black;">Student</option>
                <option value="CHILD" style="color:black;">Child</option>
            </select>
        `;
        container.appendChild(div);
    }
}

async function startBooking(flightCode, price) {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        showToast('Please login to book', 'error');
        setTimeout(() => window.location.href = 'login.html', 1500);
        return;
    }

    currentFlightCode = flightCode;
    currentPrice = price;
    selectedSeat = null;

    // Fix: Set selectedFlight data for Seat Map capacity
    if (window.publicFlightsData) {
        // Backend now returns: [Code, Origin, Dest, DepTime, Status, Price, AvailSeats, TotalSeats]
        const f = window.publicFlightsData.find(flight => flight[0] === flightCode);
        if (f) {
            window.selectedFlight = {
                flightCode: f[0],
                totalSeats: f[7] || 150
            };
        } else {
            window.selectedFlight = { totalSeats: 150 };
        }
    } else {
        window.selectedFlight = { totalSeats: 150 };
    }

    // Dynamic Pax Types Generation
    const paxCountInput = document.getElementById('search-passengers');
    const paxCount = paxCountInput ? parseInt(paxCountInput.value) : 1;

    selectedPassengerTypes = Array(paxCount).fill('ADULT');

    const typeContainer = document.getElementById('pax-type-selection-container');
    if (typeContainer) {
        typeContainer.innerHTML = '';
        for (let i = 0; i < paxCount; i++) {
            const wrapper = document.createElement('div');
            wrapper.style.marginBottom = '5px';
            wrapper.innerHTML = `<small style="display:block;color:var(--text-light)">Passenger ${i + 1}</small>`;

            const select = document.createElement('select');
            select.className = 'form-control pax-type-select';
            select.style.padding = '5px';
            select.style.fontSize = '0.9rem';
            select.innerHTML = `
                <option value="ADULT">Adult</option>
                <option value="STUDENT">Student</option>
                <option value="CHILD">Child</option>
            `;
            select.onchange = () => {
                selectedPassengerTypes[i] = select.value;
                if (window.currentSelectedSeats && window.currentSelectedSeats.length > 0) {
                    updateSeatDisplay(window.currentSelectedSeats);
                }
            };
            wrapper.appendChild(select);
            typeContainer.appendChild(wrapper);
        }
    }

    // Fetch occupied seats
    try {
        const occ = await apiRequest(`/flights/${flightCode}/occupied-seats`);
        window.occupiedSeats = occ || [];
    } catch (e) { window.occupiedSeats = []; }

    document.getElementById('modal-flight-code').innerText = flightCode;
    const summary = selectedPassengerTypes.length > 1 ? `${selectedPassengerTypes.length} Passengers` : selectedPassengerTypes[0];
    document.getElementById('modal-flight-dest').innerText = `Booking for ${summary}`;

    document.getElementById('booking-modal').style.display = 'block';

    renderSeatMap();
    updateSeatDisplay();
}

function closeBookingModal() {
    document.getElementById('booking-modal').style.display = 'none';
}

function renderSeatMap() {
    const container = document.getElementById('seat-map-container');
    if (!container) return;
    container.innerHTML = '';

    const cols = ['A', 'B', 'C', 'D', 'E', 'F'];

    try {
        // --- BUSINESS CLASS (Rows 1-4) ---
        const headerBus = document.createElement('div');
        headerBus.innerHTML = '<span style="color:#FFD700; font-weight:bold;">Business Class</span> <small>(+50%)</small>';
        headerBus.style.gridColumn = 'span 6';
        headerBus.style.textAlign = 'center';
        headerBus.style.marginBottom = '10px';
        container.appendChild(headerBus);

        for (let r = 1; r <= 4; r++) {
            cols.forEach(c => {
                const seatNum = `${r}${c}`;
                const seatDiv = document.createElement('div');
                seatDiv.className = 'seat business';
                seatDiv.innerText = seatNum;

                if (window.occupiedSeats && window.occupiedSeats.includes(seatNum)) {
                    seatDiv.classList.add('occupied');
                    seatDiv.style.opacity = '0.3';
                    seatDiv.style.cursor = 'not-allowed';
                    seatDiv.style.background = 'var(--danger)';
                } else {
                    seatDiv.onclick = () => selectSeat(seatNum, seatDiv, true);
                }
                container.appendChild(seatDiv);
            });
        }

        // --- ECONOMY CLASS (Rows 5-30) ---
        const headerEco = document.createElement('div');
        headerEco.innerText = 'Economy Class';
        headerEco.style.gridColumn = 'span 6';
        headerEco.style.textAlign = 'center';
        headerEco.style.marginTop = '20px';
        headerEco.style.marginBottom = '10px';
        headerEco.style.borderTop = '1px dashed rgba(255,255,255,0.2)';
        headerEco.style.paddingTop = '10px';
        container.appendChild(headerEco);

        // Dynamic Rows Calculation (Max 150 Seats)
        let capacity = (window.selectedFlight && window.selectedFlight.totalSeats) ? parseInt(window.selectedFlight.totalSeats) : 150;

        // Cap at 150 for visual consistency
        if (capacity > 150) capacity = 150;

        let totalRows = Math.ceil(capacity / 6);

        // Ensure at least 15 rows (90 seats) are shown for aesthetics, even for very small planes
        if (totalRows < 15) totalRows = 15;

        for (let r = 5; r <= totalRows; r++) {
            cols.forEach(c => {
                const seatNum = `${r}${c}`;
                const seatDiv = document.createElement('div');
                seatDiv.className = 'seat'; // Default economy class
                seatDiv.innerText = seatNum;

                if (window.occupiedSeats && window.occupiedSeats.includes(seatNum)) {
                    seatDiv.classList.add('occupied');
                    seatDiv.style.background = 'var(--danger)'; // Explicit red
                    seatDiv.style.opacity = '0.5';
                    seatDiv.style.cursor = 'not-allowed';
                } else {
                    seatDiv.onclick = () => selectSeat(seatNum, seatDiv, false);
                }
                container.appendChild(seatDiv);
            });
        }
    } catch (e) {
        console.error("Seat Map Render Error:", e);
        container.innerHTML += `<div style="color:red; grid-column:span 6;">Error: ${e.message}</div>`;
    }
}

function selectSeat(seatNum, element, isBusiness) {
    if (!selectedPassengerTypes) selectedPassengerTypes = ['ADULT']; // Safety

    // Check if seat already selected
    // Note: selectedSeats is typically just the array of chosen objects
    // Since we used 'selectedSeat' (singular) before, let's assume we initialize a fresh array in startBooking
    // But since I can't guarantee startBooking ran with new logic yet, let's initialize if null.
    if (!window.currentSelectedSeats) window.currentSelectedSeats = [];

    const index = window.currentSelectedSeats.findIndex(s => s.seatNum === seatNum);

    if (index > -1) {
        // Deselect
        window.currentSelectedSeats.splice(index, 1);
        element.classList.remove('selected');
    } else {
        // Select
        if (window.currentSelectedSeats.length >= selectedPassengerTypes.length) {
            showToast(`You can only select ${selectedPassengerTypes.length} seats.`, 'warning');
            return;
        }

        window.currentSelectedSeats.push({ seatNum, isBusiness });
        element.classList.add('selected');
    }

    updateSeatDisplay();
}

function updateSeatDisplay() {
    const display = document.getElementById('selected-seat-display');
    const seats = window.currentSelectedSeats || [];

    if (seats.length === 0) {
        display.innerText = 'No seat selected';
        return;
    }

    let total = 0;
    let detailsHtml = '';

    // Match seat i to passenger i
    seats.forEach((seat, i) => {
        const type = selectedPassengerTypes[i] || 'ADULT';
        let price = currentPrice;

        // Class Multiplier
        if (seat.isBusiness) price *= 1.5;

        // Type Discount
        if (type === 'STUDENT') price *= 0.8;
        if (type === 'CHILD') price *= 0.5;

        total += price;
        // Short detail string
        detailsHtml += ` <small title="${type} in ${seat.isBusiness ? 'Business' : 'Economy'}">[${seat.seatNum}:${type.substr(0, 1)}]</small>`;
    });

    display.innerHTML = `
        <div style="line-height:1.4;">
            Selected: <b style="color:var(--accent)">${seats.map(s => s.seatNum).join(', ')}</b>
            <br>
            Total: <b>$${total.toFixed(2)}</b> ${detailsHtml}
        </div>`;
}


function proceedToPayment() {
    if (!window.currentSelectedSeats || window.currentSelectedSeats.length !== selectedPassengerTypes.length) {
        showToast(`Please select exactly ${selectedPassengerTypes.length} seats.`, 'warning');
        return;
    }

    document.getElementById('booking-modal').style.display = 'none';
    const paxModal = document.getElementById('pax-details-modal');
    paxModal.style.display = 'block';

    const container = document.getElementById('pax-details-form-container');
    container.innerHTML = '';

    const user = JSON.parse(localStorage.getItem('user'));

    selectedPassengerTypes.forEach((type, index) => {
        const div = document.createElement('div');
        div.style.marginBottom = '1.5rem';
        div.style.background = 'rgba(255,255,255,0.03)';
        div.style.padding = '1rem';
        div.style.borderRadius = '8px';

        const isMe = (index === 0 && user);
        const defaultName = isMe ? user.fullName : '';

        div.innerHTML = `
            <h4 style="margin-bottom:0.5rem; color:var(--accent);">Passenger ${index + 1} (${type})</h4>
            <div class="form-group">
                <label>Full Name</label>
                <input type="text" class="pax-name-input" value="${defaultName}" placeholder="Name Surname" required>
            </div>
        `;
        container.appendChild(div);
    });
}

function closePaxModal() {
    document.getElementById('pax-details-modal').style.display = 'none';
    document.getElementById('booking-modal').style.display = 'block';
}

// Global storage for booking payload
window.pendingPassengers = [];

function submitPaxDetails() {
    const inputs = document.querySelectorAll('.pax-name-input');
    const seats = window.currentSelectedSeats || [];

    // Validation
    let valid = true;
    inputs.forEach(input => {
        if (!input.value.trim()) {
            input.style.border = '1px solid var(--danger)';
            valid = false;
        } else {
            input.style.border = '';
        }
    });

    if (!valid) {
        showToast('Please fill all passenger names.', 'error');
        return;
    }

    // Build the robust payload here
    window.pendingPassengers = [];
    inputs.forEach((input, i) => {
        // Double check index bounds
        if (i < seats.length) {
            window.pendingPassengers.push({
                seat: seats[i].seatNum,
                type: selectedPassengerTypes[i] || 'ADULT',
                name: input.value.trim()
            });
        }
    });

    // UI Logic
    document.getElementById('pax-details-modal').style.display = 'none';
    const payModal = document.getElementById('payment-modal');
    payModal.style.display = 'block';

    document.getElementById('pay-flight').innerText = currentFlightCode;
    document.getElementById('pay-pax-count').innerText = window.pendingPassengers.length;

    // Calculate Total based on the FINALIZED list
    let total = 0;
    const seatMap = window.currentSelectedSeats; // reuse for row info

    window.pendingPassengers.forEach((pax, idx) => {
        let price = currentPrice;
        // Find row from seat number (e.g. 1A)
        const row = parseInt(pax.seat.match(/\d+/)[0]);

        if (row <= 4) price *= 1.5; // Business logic
        if (pax.type === 'STUDENT') price *= 0.8;
        else if (pax.type === 'CHILD') price *= 0.5;

        total += price;
    });

    document.getElementById('pay-total').innerText = `$${total.toFixed(2)} `;
}

function closePaymentModal() {
    document.getElementById('payment-modal').style.display = 'none';
}

async function processPayment() {
    // START VALIDATION
    const modal = document.getElementById('payment-modal');
    const inputs = modal.querySelectorAll('input');
    // Expected order: 0: Name, 1: Card Number, 2: Expiry, 3: CVV

    if (inputs.length >= 4) {
        const cardInput = inputs[1];
        const expiryInput = inputs[2];
        const cvvInput = inputs[3];

        // Card Check (16 digits)
        const cardVal = cardInput.value.replace(/\D/g, '');
        if (cardVal.length !== 16) {
            showToast('Card number must be 16 digits', 'error');
            cardInput.focus();
            cardInput.style.border = '1px solid var(--danger)';
            return;
        } else cardInput.style.border = '';

        // Expiry Check (MM/YY)
        const expVal = expiryInput.value.trim();
        if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expVal)) {
            showToast('Expiry must be MM/YY (e.g. 12/26)', 'error');
            expiryInput.focus();
            expiryInput.style.border = '1px solid var(--danger)';
            return;
        } else expiryInput.style.border = '';

        // CVV Check (3 digits)
        const cvvVal = cvvInput.value.replace(/\D/g, '');
        if (cvvVal.length !== 3) {
            showToast('CVV must be 3 digits', 'error');
            cvvInput.focus();
            cvvInput.style.border = '1px solid var(--danger)';
            return;
        } else cvvInput.style.border = '';
    }
    // END VALIDATION

    const btn = document.querySelector('#payment-modal button[type="submit"]');
    const originalText = btn.innerText;
    btn.innerText = "Processing...";
    btn.disabled = true;

    setTimeout(async () => {
        try {
            await confirmBooking(); // Calls backend
            btn.style.background = 'var(--success)';
            btn.innerText = 'Payment Successful!';

            setTimeout(() => {
                closePaymentModal();
                btn.innerText = originalText;
                btn.disabled = false;
                btn.style.background = '';
            }, 1000);
        } catch (e) {
            console.error(e);
            btn.innerText = 'Payment Failed';
            btn.style.background = 'var(--danger)';
            setTimeout(() => {
                btn.innerText = originalText;
                btn.disabled = false;
                btn.style.background = '';
            }, 2000);
        }
    }, 1500);
}

async function confirmBooking() {
    const seats = window.currentSelectedSeats || [];
    if (seats.length !== selectedPassengerTypes.length) {
        showToast(`Please select ${selectedPassengerTypes.length} seats (Selected: ${seats.length})`, 'error');
        return;
    }

    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) return;

    try {
        // Use the robust payload built in submitPaxDetails
        let passengers = window.pendingPassengers;

        // Fallback safety
        if (!passengers || passengers.length === 0) {
            passengers = seats.map((seat, i) => ({
                seat: seat.seatNum,
                type: selectedPassengerTypes[i] || 'ADULT',
                name: null
            }));
        }

        const payload = {
            userId: user.userId,
            flightCode: currentFlightCode,
            passengers: passengers
        };

        await apiRequest('/bookings', 'POST', payload);
        showToast('Booking Successful!', 'success');
        closeBookingModal();
        loadPublicFlights();
        if (location.pathname.includes('user.html')) loadUserBookings();
    } catch (e) {
        console.error(e);
        showToast(e.message || 'Booking failed', 'error');
    }
}



// Close modal if clicking outside
window.onclick = function (event) {
    const modal = document.getElementById('booking-modal');
    if (event.target == modal) {
        closeBookingModal();
    }
}

async function loadUserBookings() {
    const user = requireAuth();
    if (!user) return;

    try {
        const bookings = await apiRequest(`/my-bookings?userId=${user.userId}`);
        const container = document.getElementById('my-bookings');
        if (!container) return;

        // bookings item: [BookingID, FlightCode, Origin, Dest, DepTime, SeatNumber, Status, TicketPrice, PassengerName]

        // Filter into Active and Past
        const now = new Date();
        const activeBookings = bookings.filter(b => {
            const flightTime = new Date(b[4]);
            return flightTime > now && b[6] !== 'CANCELLED' && b[6] !== 'COMPLETED';
        });

        const pastBookings = bookings.filter(b => {
            const flightTime = new Date(b[4]);
            return flightTime <= now || b[6] === 'CANCELLED' || b[6] === 'COMPLETED';
        });

        let html = '';

        // Active Section
        html += `<h3 style="color:var(--accent); margin-bottom:1rem; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:0.5rem;">Active Flights</h3>`;
        if (activeBookings.length > 0) {
            html += activeBookings.map(b => renderBookingCard(b, true)).join('');
        } else {
            html += `<p style="color:#ccc; margin-bottom:2rem; font-style:italic;">No active flights found.</p>`;
        }

        // Past Section
        html += `<h3 style="color:#999; margin-top:3rem; margin-bottom:1rem; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:0.5rem;">Past Flights</h3>`;
        if (pastBookings.length > 0) {
            html += pastBookings.map(b => renderBookingCard(b, false)).join('');
        } else {
            html += `<p style="color:#ccc; font-style:italic;">No past flights found.</p>`;
        }

        container.innerHTML = html;

    } catch (e) {
        console.error(e);
        const c = document.getElementById('my-bookings');
        if (c) c.innerHTML = '<div style="color:red; text-align:center">Failed to load bookings.</div>';
    }
}

function renderBookingCard(b, isActive) {
    // b structure: [BookingID, FlightCode, Origin, Dest, DepTime, SeatNumber, Status, Price, PassengerName]
    return `
        <div class="glass-card" style="margin-bottom:1rem; border-left: 4px solid ${getStatusColor(b[6])}; opacity: ${isActive ? 1 : 0.7}; filter: ${isActive ? 'none' : 'grayscale(0.6)'};">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <h4 style="color:var(--accent); margin-bottom:5px;">${b[2]} <i style="font-size:0.8rem">✈</i> ${b[3]}</h4>
                    <p style="font-size:0.9rem; margin-bottom:5px;"><b>${b[1]}</b> | Ticket No: <b style="color:var(--accent)">#${b[0]}</b> | Seat: <b style="color:var(--text-light)">${b[5]}</b></p>
                    <p style="font-size:0.9rem; margin-bottom:5px;">Passenger: <b style="color:#fff;">${b[8] || 'Self'}</b></p>
                    <small>${new Date(b[4]).toLocaleString()} | Price: $${b[7]}</small>
                    <div style="margin-top:5px;">Status: <b style="color:${getStatusColor(b[6])}">${b[6]}</b></div>
                </div>
                ${isActive && b[6] === 'CONFIRMED' ? `
                <div style="display:flex; flex-direction:column; gap:5px;">
                     <button class="btn btn-outline" style="font-size:0.8rem; padding:0.5rem;" onclick="checkInRedirect('${b[0]}', '${b[8] || ''}')">Check-In</button>
                     <button class="btn btn-primary" style="background:var(--danger); font-size:0.8rem; padding:0.5rem;" onclick="cancelBooking(${b[0]})">Cancel</button>
                </div>
                ` : isActive && b[6] === 'CHECKED_IN' ? `
                 <div style="text-align:right;">
                    <span style="background:var(--success); color:#fff; padding:5px 10px; border-radius:4px; font-size:0.8rem;">Checked In</span>
                 </div>
                ` : ''}
            </div>
        </div>
    `;
}

function checkInRedirect(id, name) {
    // Redirect to home check-in tab
    // We pass data via URL fragment or query param, then app.js on index.html needs to read it. 
    // BUT since we are on user.html, we go to index.html
    // Let's use simple query params
    let surname = name ? name.trim().split(' ').pop() : '';
    window.location.href = `index.html?tab=checkin&pnr=${id}&surname=${surname}`;
}

function getStatusColor(status) {
    if (status === 'CONFIRMED') return 'var(--accent)';
    if (status === 'CHECKED_IN') return 'var(--success)';
    return 'var(--danger)';
}

let bookingIdToCancel = null;

function cancelBooking(id) {
    bookingIdToCancel = id;
    document.getElementById('cancel-modal').style.display = 'block';
}

function closeCancelModal() {
    bookingIdToCancel = null;
    document.getElementById('cancel-modal').style.display = 'none';
}

async function confirmCancel() {
    if (!bookingIdToCancel) return;

    try {
        await apiRequest(`/ bookings / ${bookingIdToCancel}/cancel`, 'POST');
        showToast('Booking Cancelled');
        loadUserBookings();
        closeCancelModal();
    } catch (e) {
        console.error(e);
        closeCancelModal();
    }
}

async function checkIn(id) {
    try {
        await apiRequest(`/bookings/${id}/checkin`, 'POST');
        showToast('Checked In Successfully!');
        loadUserBookings();
    } catch (e) {
        console.error(e);
        showToast(e.message || 'Check-in failed', 'error');
    }
}

// --- Admin/Owner ---
async function loadOwnerStats() {
    try {
        const stats = await apiRequest('/owner/dashboard/stats');

        // Success DEBUG removed
        if (!stats || stats.length === 0) {
            showToast('Warning: No stats data returned', 'error');
            return;
        }

        let totalRev = 0;
        let totalPax = 0;
        let totalAdult = 0;
        let totalStudent = 0;
        let totalChild = 0;
        let activeFlightCount = 0;

        // 1. Calculate Aggregates
        stats.forEach(row => {
            // [FlightCode, Status, TotalBookings, TotalRevenue, Adult, Student, Child, FlightID]
            const status = row[1];
            const bookings = parseInt(row[2]) || 0;
            const revenue = parseFloat(row[3]) || 0;
            const adult = parseInt(row[4]) || 0;
            const student = parseInt(row[5]) || 0;
            const child = parseInt(row[6]) || 0;

            totalRev += revenue;
            totalPax += bookings;
            totalAdult += adult;
            totalStudent += student;
            totalChild += child;

            // Active Flight Logic: If not completed/cancelled, count it.
            // Note: SQL might return trailing spaces for status if CHAR type. Clean it.
            const cleanStatus = status ? status.trim() : '';
            if (cleanStatus !== 'COMPLETED' && cleanStatus !== 'CANCELLED') {
                activeFlightCount++;
            }
        });

        // 2. Update Overview KPIs (Always present in owner.html)
        const kpiRev = document.getElementById('kpi-revenue');
        const kpiPax = document.getElementById('kpi-pax');
        const kpiFlights = document.getElementById('kpi-flights');

        if (kpiRev) kpiRev.innerText = `$${totalRev.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
        if (kpiPax) kpiPax.innerText = totalPax;
        if (kpiFlights) kpiFlights.innerText = activeFlightCount;

        // 3. Update Demographics (Always present in owner.html)
        const demoAdult = document.getElementById('demo-adult');
        const demoStudent = document.getElementById('demo-student');
        const demoChild = document.getElementById('demo-child');

        if (demoAdult) demoAdult.innerText = totalAdult;
        if (demoStudent) demoStudent.innerText = totalStudent;
        if (demoChild) demoChild.innerText = totalChild;

        // 4. Update Financials Table (If element exists)
        const financialBody = document.getElementById('financials-body');
        if (financialBody) {
            financialBody.innerHTML = stats.map(row => {
                const revenue = parseFloat(row[3]) || 0;
                const bookings = parseInt(row[2]) || 0;
                return `
               <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                   <td style="padding:1rem;"><b>${row[0]}</b></td>
                   <td><span style="color:${getStatusColor(row[1])}">${row[1]}</span></td>
                   <td>${bookings}</td>
                   <td style="color:var(--success); font-weight:bold;">$${revenue.toFixed(2)}</td>
               </tr>`;
            }).join('');
        }

        // 5. Update Analytics (If element exists)
        const analyticsContainer = document.getElementById('analytics-occupancy-container');
        if (analyticsContainer) {
            analyticsContainer.innerHTML = stats.map(row => {
                const bookings = parseInt(row[2]) || 0;
                const maxPax = 150; // Use a reasonable standard capacity for visual scaling
                let width = (bookings / maxPax) * 100;
                if (width > 100) width = 100;
                if (bookings > 0 && width < 5) width = 5; // Min visibility

                return `
                <div style="margin-bottom:1rem;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:5px; align-items:flex-end;">
                        <span><b style="color:var(--accent);">${row[0]}</b> <small style="opacity:0.7">(${row[1]})</small></span>
                        <span style="font-weight:bold;">${bookings} <small style="font-weight:normal;">/ ~${maxPax} Pax</small></span>
                    </div>
                    <div style="background:rgba(255,255,255,0.1); border-radius:10px; height:20px; width:100%; overflow:hidden;">
                        <div style="background: linear-gradient(90deg, var(--accent), var(--success)); width:${width}%; height:100%; border-radius:10px; transition: width 1s;"></div>
                    </div>
                </div>`;
            }).join('');
        }

    } catch (e) {
        console.error(e);
        showToast('Error loading stats: ' + e.message, 'error');
    }
}

function openOwnerTab(tabName, btn) {
    // Hide all
    document.querySelectorAll('.owner-tab-content').forEach(el => el.style.display = 'none');
    document.querySelector('#owner-overview').style.display = 'none'; // Ensure default is hidden too if needed

    // Show target
    document.getElementById(`owner-${tabName}`).style.display = 'block';

    // Update buttons
    document.querySelectorAll('.owner-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

async function createFlightFunc() {
    const data = {
        flightCode: document.getElementById('f-code').value,
        originCode: document.getElementById('f-origin').value,
        destCode: document.getElementById('f-dest').value,
        departureTime: document.getElementById('f-dep').value,
        arrivalTime: document.getElementById('f-arr').value,
        aircraftType: document.getElementById('f-aircraft').value,
        totalSeats: document.getElementById('f-seats').value,
        basePrice: document.getElementById('f-price').value,
        priceStudent: document.getElementById('f-price-student').value,
        priceChild: document.getElementById('f-price-child').value
    };

    // UI Validation for Seats
    if (parseInt(data.totalSeats) > 150) {
        showToast('Maximum seat capacity is 150!', 'warning');
        return;
    }

    // UI Validation for Date (Prevent Past Flights)
    if (new Date(data.departureTime) < new Date()) {
        showToast('Departure time cannot be in the past!', 'warning');
        return;
    }

    try {
        await apiRequest('/admin/flight', 'POST', data);
        showToast('Flight Created!');
        document.getElementById('create-flight-form').reset();
    } catch (e) { console.error(e); }
}

async function loadPassengers() {
    const flightCode = document.getElementById('p-flight-code').value;
    if (!flightCode) return showToast('Enter Flight Code', 'error');

    try {
        const passengers = await apiRequest(`/admin/flights/code/${flightCode}/passengers`);
        const tbody = document.getElementById('passenger-list-body');
        if (!tbody) return;

        if (passengers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center">No passengers found</td></tr>';
            return;
        }

        tbody.innerHTML = passengers.map(p => `
            <tr>
                <td>${p[0]}</td>
                <td>${p[1]}</td>
                <td><small style="background:var(--accent-gradient); padding:2px 5px; border-radius:4px; color:white;">${p[2] || 'ADULT'}</small></td>
                <td>${p[3]}</td>
                <td><b style="color:${getStatusColor(p[4])}">${p[4]}</b></td>
                <td>
                    ${p[4] !== 'CANCELLED' ?
                `<button class="btn btn-primary" style="background:var(--danger); font-size:0.7rem; padding:0.3rem 0.6rem;" onclick="adminCancelBooking(${p[0]})">Cancel</button>`
                : '<span style="color:var(--text-light); font-size:0.8rem;">-</span>'}
                </td>
            </tr>
        `).join('');
    } catch (e) { console.error(e); }
}

async function adminCancelBooking(id) {
    const modal = document.getElementById('confirmation-modal'); // Changed from 'flight-confirm-modal' for consistency with closeConfirmModal
    if (!modal) {
        // Fallback if modal missing
        if (!confirm('Are you sure you want to cancel this passenger ticket?')) return;
        executeCancel(id);
        return;
    }

    // Update Modal text
    document.getElementById('confirm-title').innerText = 'Cancel Ticket?';
    document.getElementById('confirm-msg').innerText = 'Are you sure you want to cancel this passenger ticket? This action cannot be undone.';

    const confirmBtn = document.getElementById('confirm-btn-action');

    // Clone to clean listeners
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);

    newBtn.onclick = () => {
        closeConfirmModal();
        executeCancel(id);
    };

    modal.style.display = 'flex';
}

async function executeCancel(id) {
    try {
        await apiRequest(`/bookings/${id}/cancel`, 'POST');
        showToast('Booking Cancelled', 'success');
        loadPassengers();
    } catch (e) { console.error(e); showToast('Error cancelling booking', 'error'); }
}

async function loadAdminFlights() {
    try {
        // We reuse the public endpoint or create a new admin one that returns IDs too
        // The public one returns: [Code, Origin, Dest, DepTime, Status, Price, Seats]
        // BUT we need FlightID to update status. 
        // Let's create a new lightweight admin endpoint or use existing logic if possible.
        // Actually, let's assume we update ApiController to return FlightID in public schedule or make a new one.
        // The View 'vw_PublicFlightSchedule' does NOT include FlightID. 
        // Quick fix: Add FlightID to 'vw_PublicFlightSchedule' or new query.

        // Wait, for now let's use a new endpoint or raw query from JS? No.
        // Let's call a new endpoint: GET /admin/flights
        const flights = await apiRequest('/admin/flights');

        // Global store for admin flights to help with editing
        window.adminFlightsData = flights;

        const tbody = document.getElementById('admin-flights-body');
        if (!tbody) return;

        tbody.innerHTML = flights.map(f => {
            const isCancelled = f.status === 'CANCELLED';
            const rowStyle = isCancelled ? 'opacity:0.6; background:rgba(255,50,50,0.05);' : '';

            let actionsHtml = '';
            if (isCancelled) {
                actionsHtml = `<span style="color:var(--danger); font-weight:bold; font-size:0.9rem;">🚫 Cancelled</span>`;
            } else {
                actionsHtml = `
                    <button class="btn btn-outline" style="padding:5px 10px; font-size:0.8rem; margin-right:5px;" onclick="openEditFlight(${f.flightId})">Edit</button>
                    ${f.status !== 'COMPLETED' ? `<button class="btn btn-primary" style="background:var(--danger); padding:5px 10px; font-size:0.8rem;" onclick="updateFlightStatus(${f.flightId}, 'CANCELLED')">Cancel</button>` : ''}
                    ${f.status !== 'COMPLETED' ? `<button class="btn btn-outline" style="padding:5px 10px; font-size:0.8rem;" onclick="updateFlightStatus(${f.flightId}, 'COMPLETED')">Complete</button>` : ''}
                `;
            }

            return `
            <tr style="${rowStyle}">
                <td style="${isCancelled ? 'text-decoration:line-through' : ''}">${f.flightCode}</td>
                <td><span style="color:var(--accent); font-weight:bold;">${f.originCode}</span> <small>to</small> <span style="color:var(--accent); font-weight:bold;">${f.destCode}</span></td>
                <td>${new Date(f.departureTime).toLocaleString()}</td>
                <td><b style="color:${isCancelled ? 'var(--danger)' : getStatusColor(f.status)}">${f.status}</b></td>
                <td>
                    ${actionsHtml}
                </td>
            </tr>
            `;
        }).join('');

    } catch (e) { console.error(e); }
}

function filterAdminFlights() {
    const dateVal = document.getElementById('admin-date-filter').value;
    const tbody = document.getElementById('admin-flights-body');

    if (!window.adminFlightsData || !tbody) return;

    let filtered = window.adminFlightsData;

    if (dateVal) {
        filtered = filtered.filter(f => f.departureTime.startsWith(dateVal));
    }

    tbody.innerHTML = filtered.map(f => {
        const isCancelled = f.status === 'CANCELLED';
        const rowStyle = isCancelled ? 'opacity:0.6; background:rgba(255,50,50,0.05);' : '';

        let actionsHtml = '';
        if (isCancelled) {
            actionsHtml = `<span style="color:var(--danger); font-weight:bold; font-size:0.9rem;">🚫 Cancelled</span>`;
        } else {
            actionsHtml = `
                <button class="btn btn-outline" style="padding:5px 10px; font-size:0.8rem; margin-right:5px;" onclick="openEditFlight(${f.flightId})">Edit</button>
                ${f.status !== 'COMPLETED' ? `<button class="btn btn-primary" style="background:var(--danger); padding:5px 10px; font-size:0.8rem;" onclick="updateFlightStatus(${f.flightId}, 'CANCELLED')">Cancel</button>` : ''}
                ${f.status !== 'COMPLETED' ? `<button class="btn btn-outline" style="padding:5px 10px; font-size:0.8rem;" onclick="updateFlightStatus(${f.flightId}, 'COMPLETED')">Complete</button>` : ''}
            `;
        }

        return `
        <tr style="${rowStyle}">
            <td style="${isCancelled ? 'text-decoration:line-through' : ''}">${f.flightCode}</td>
            <td><span style="color:var(--accent); font-weight:bold;">${f.originCode}</span> <small>to</small> <span style="color:var(--accent); font-weight:bold;">${f.destCode}</span></td>
            <td>${new Date(f.departureTime).toLocaleString()}</td>
            <td><b style="color:${isCancelled ? 'var(--danger)' : getStatusColor(f.status)}">${f.status}</b></td>
            <td>
                ${actionsHtml}
            </td>
        </tr>
        `;
    }).join('');
}

function openEditFlight(id) {
    const flight = window.adminFlightsData.find(f => f.flightId === id);
    if (!flight) return;

    document.getElementById('edit-flight-id').value = flight.flightId;
    document.getElementById('edit-flight-info').innerText = `Editing ${flight.flightCode} (${flight.originId || ''} -> ${flight.destinationId || ''})`; // Note: originId is technically ID unless mapped, but let's assume raw or mapped.

    // Format dates for datetime-local input (YYYY-MM-DDTHH:mm)
    document.getElementById('edit-dep').value = flight.departureTime ? flight.departureTime.slice(0, 16) : '';
    document.getElementById('edit-arr').value = flight.arrivalTime ? flight.arrivalTime.slice(0, 16) : '';

    document.getElementById('edit-price').value = flight.basePrice;
    document.getElementById('edit-aircraft').value = flight.aircraftType;

    document.getElementById('edit-flight-modal').style.display = 'block';
}

function closeEditModal() {
    document.getElementById('edit-flight-modal').style.display = 'none';
}

async function submitEditFlight() {
    const id = document.getElementById('edit-flight-id').value;
    const data = {
        departureTime: document.getElementById('edit-dep').value,
        arrivalTime: document.getElementById('edit-arr').value,
        basePrice: document.getElementById('edit-price').value,
        aircraftType: document.getElementById('edit-aircraft').value
    };

    try {
        await apiRequest(`/admin/flights/${id}`, 'PUT', data);
        showToast('Flight Updated Successfully');
        closeEditModal();
        loadAdminFlights();
    } catch (e) { console.error(e); }
}

function closeConfirmModal() {
    document.getElementById('confirmation-modal').style.display = 'none';
}

function updateFlightStatus(id, newStatus) {
    const modal = document.getElementById('confirmation-modal');
    if (!modal) {
        // Fallback if modal not present (e.g. other pages)
        if (!confirm(`Mark flight as ${newStatus}?`)) return;
        updateStatusApi(id, newStatus);
        return;
    }

    document.getElementById('confirm-title').innerText = `Mark as ${newStatus}?`;
    document.getElementById('confirm-msg').innerText = `Are you sure you want to update flight status to ${newStatus}?`;

    const confirmBtn = document.getElementById('confirm-btn-action');

    // Clone to remove old listeners
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);

    newBtn.onclick = () => {
        closeConfirmModal();
        updateStatusApi(id, newStatus);
    };

    modal.style.display = 'flex';
}

async function updateStatusApi(id, newStatus) {
    try {
        await apiRequest(`/admin/flights/${id}/status`, 'POST', { status: newStatus });
        showToast('Status Updated', 'success');
        loadAdminFlights();
    } catch (e) {
        console.error(e);
        showToast('Error updating status', 'error');
    }
}

async function loadAirportOptions() {
    try {
        const airports = await apiRequest('/airports'); // [Code, City, Name]
        const originSelect = document.getElementById('f-origin');
        const destSelect = document.getElementById('f-dest');

        if (!originSelect || !destSelect) return;

        const options = airports.map(a => `<option value="${a[0]}" style="color:black;">${a[1]} (${a[0]}) - ${a[2]}</option>`).join('');

        originSelect.innerHTML = '<option value="" disabled selected style="color:black;">Select Origin</option>' + options;
        destSelect.innerHTML = '<option value="" disabled selected style="color:black;">Select Destination</option>' + options;

    } catch (e) { console.error(e); }
}

document.addEventListener('DOMContentLoaded', () => {
    // Simple routing check
    if (location.pathname.includes('admin.html')) {
        loadAdminFlights();
        loadAirportOptions();
        if (typeof loadPassengers === 'function') loadPassengers();
    } else if (location.pathname.includes('owner.html')) {
        // loadOwnerDashboard();
    } else if (location.pathname.includes('user.html')) {
        // Load bookings if on user page
        if (typeof loadUserBookings === 'function') loadUserBookings();
    } else {
        // Index / Home Page
        if (typeof loadPublicFlights === 'function') loadPublicFlights();

        // Check for URL Params (Redirect from User Dashboard)
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        if (tab) {
            // Find matching button to activate tab properly
            const btn = document.querySelector(`.tab-btn[onclick*="'${tab}'"]`) || document.querySelector(`.tab-btn[onclick*="'tab-${tab}'"]`);
            // Construct ID might vary, openTab expects tabId 'tab-checkin'
            const tabId = tab.startsWith('tab-') ? tab : `tab-${tab}`;
            if (btn) openTab(tabId, btn);
            else openTab(tabId); // Fallback

            // Pre-fill fields if available
            const pnr = params.get('pnr');
            const surname = params.get('surname');

            if (tab === 'checkin' && pnr && surname) {
                const pnrInput = document.getElementById('checkin-pnr');
                const surnameInput = document.getElementById('checkin-surname');
                if (pnrInput) pnrInput.value = pnr;
                if (surnameInput) surnameInput.value = surname;

                // Clean URL
                window.history.replaceState({}, document.title, window.location.pathname);

                // Show a small toast
                showToast('Booking details loaded. Click Continue to proceed.', 'success');
            }
        }


        const user = JSON.parse(localStorage.getItem('user'));
        if (user && user.role === 'ADMIN') {
            const searchSec = document.getElementById('search-section');
            if (searchSec) {
                searchSec.innerHTML = `
                    <div class="glass-card">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                            <h3>Admin Quick Search</h3>
                            <a href="admin.html" class="btn btn-outline" style="font-size:0.8rem;">Go to Dashboard &rarr;</a>
                        </div>
                        <div style="display:flex; gap:1rem; align-items:flex-end;">
                            <div class="form-group" style="flex:1; margin-bottom:0;">
                                <label>From</label>
                                <input type="text" id="search-from" placeholder="Origin" oninput="filterFlights()">
                            </div>
                            <div class="form-group" style="flex:1; margin-bottom:0;">
                                <label>To</label>
                                <input type="text" id="search-to" placeholder="Destination" oninput="filterFlights()">
                            </div>
                            <div class="form-group" style="flex:1; margin-bottom:0;">
                                <label>Date</label>
                                <input type="date" id="search-date" onchange="filterFlights()">
                            </div>
                            <button class="btn btn-primary" onclick="filterFlights()">Search</button>
                        </div>
                    </div>
                `;
            }
        }
    }
});
