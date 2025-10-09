// Global variables
let map;
let markers = [];
let events = [];
let updateInterval;
let isUpdating = true;
let currentFilter = 'all';

// Sample crime event data
const sampleEvents = [
    {
        id: 1,
        type: 'robbery',
        severity: 'high',
        location: { lat: 34.0522, lng: -118.2437 },
        address: '123 Main St, Los Angeles, CA',
        time: new Date().toLocaleTimeString(),
        description: 'Armed robbery in progress',
        radioFeed: 'Units 5-Adam-12 and 6-Lincoln-9 responding. Suspect described as male, 6ft, wearing dark clothing. Last seen heading eastbound on Main Street.'
    },
    {
        id: 2,
        type: 'assault',
        severity: 'medium',
        location: { lat: 34.0622, lng: -118.2537 },
        address: '456 Oak Ave, Los Angeles, CA',
        time: new Date().toLocaleTimeString(),
        description: 'Physical altercation reported',
        radioFeed: 'Unit 3-David-7 on scene. Two individuals involved in verbal and physical confrontation. Requesting backup and medical assistance.'
    },
    {
        id: 3,
        type: 'theft',
        severity: 'low',
        location: { lat: 34.0422, lng: -118.2337 },
        address: '789 Elm St, Los Angeles, CA',
        time: new Date().toLocaleTimeString(),
        description: 'Vehicle theft reported',
        radioFeed: 'Unit 2-King-4 taking report. Blue Honda Civic stolen from parking lot. License plate tracking initiated. No suspects at this time.'
    },
    {
        id: 4,
        type: 'burglary',
        severity: 'medium',
        location: { lat: 34.0722, lng: -118.2237 },
        address: '321 Pine Rd, Los Angeles, CA',
        time: new Date().toLocaleTimeString(),
        description: 'Residential burglary in progress',
        radioFeed: 'Units 4-Mary-3 and 7-Henry-5 responding to silent alarm. Homeowner reports seeing suspects inside residence via security camera. Perimeter being established.'
    },
    {
        id: 5,
        type: 'vandalism',
        severity: 'low',
        location: { lat: 34.0522, lng: -118.2137 },
        address: '654 Maple Dr, Los Angeles, CA',
        time: new Date().toLocaleTimeString(),
        description: 'Property damage reported',
        radioFeed: 'Unit 8-Sam-6 on scene. Multiple vehicles vandalized with spray paint. Witnesses report seeing group of juveniles flee the area northbound.'
    }
];

// Initialize map
function initMap() {
    // Default center (Los Angeles)
    const center = { lat: 34.0522, lng: -118.2437 };
    
    map = new google.maps.Map(document.getElementById('map'), {
        zoom: 12,
        center: center,
        styles: [
            {
                "elementType": "geometry",
                "stylers": [{"color": "#212121"}]
            },
            {
                "elementType": "labels.icon",
                "stylers": [{"visibility": "off"}]
            },
            {
                "elementType": "labels.text.fill",
                "stylers": [{"color": "#757575"}]
            },
            {
                "elementType": "labels.text.stroke",
                "stylers": [{"color": "#212121"}]
            },
            {
                "featureType": "administrative",
                "elementType": "geometry",
                "stylers": [{"color": "#757575"}]
            },
            {
                "featureType": "poi",
                "elementType": "labels.text.fill",
                "stylers": [{"color": "#757575"}]
            },
            {
                "featureType": "road",
                "elementType": "geometry.fill",
                "stylers": [{"color": "#2c2c2c"}]
            },
            {
                "featureType": "road",
                "elementType": "labels.text.fill",
                "stylers": [{"color": "#8a8a8a"}]
            },
            {
                "featureType": "water",
                "elementType": "geometry",
                "stylers": [{"color": "#000000"}]
            },
            {
                "featureType": "water",
                "elementType": "labels.text.fill",
                "stylers": [{"color": "#3d3d3d"}]
            }
        ]
    });
    
    // Initialize with sample events
    events = [...sampleEvents];
    updateMarkers();
    updateEventCount();
    
    // Start auto-update
    startAutoUpdate();
    
    // Setup controls
    setupControls();
}

// Create marker for event
function createMarker(event) {
    const markerColor = getMarkerColor(event.severity);
    const icon = {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: markerColor,
        fillOpacity: 0.8,
        strokeColor: '#ffffff',
        strokeWeight: 2
    };
    
    const marker = new google.maps.Marker({
        position: event.location,
        map: map,
        icon: icon,
        title: event.type.toUpperCase(),
        animation: google.maps.Animation.DROP
    });
    
    // Create info window
    const infoWindow = new google.maps.InfoWindow({
        content: createInfoWindowContent(event)
    });
    
    marker.addListener('click', () => {
        // Close all other info windows
        markers.forEach(m => {
            if (m.infoWindow) {
                m.infoWindow.close();
            }
        });
        infoWindow.open(map, marker);
    });
    
    marker.infoWindow = infoWindow;
    marker.eventData = event;
    
    return marker;
}

// Create info window content
function createInfoWindowContent(event) {
    const severityClass = `severity-${event.severity}`;
    return `
        <div class="info-window">
            <h3>${event.type.toUpperCase()}</h3>
            <div class="info-detail"><strong>Severity:</strong> <span class="${severityClass}">${event.severity.toUpperCase()}</span></div>
            <div class="info-detail"><strong>Location:</strong> ${event.address}</div>
            <div class="info-detail"><strong>Time:</strong> ${event.time}</div>
            <div class="info-detail"><strong>Description:</strong> ${event.description}</div>
            <div class="radio-feed">
                <h4>📻 Radio Feed</h4>
                <p>${event.radioFeed}</p>
            </div>
        </div>
    `;
}

// Get marker color based on severity
function getMarkerColor(severity) {
    switch(severity) {
        case 'high':
            return '#e74c3c';
        case 'medium':
            return '#f39c12';
        case 'low':
            return '#2ecc71';
        default:
            return '#3498db';
    }
}

// Update markers on map
function updateMarkers() {
    // Clear existing markers
    markers.forEach(marker => marker.setMap(null));
    markers = [];
    
    // Filter events
    const filteredEvents = currentFilter === 'all' 
        ? events 
        : events.filter(e => e.type === currentFilter);
    
    // Create new markers
    filteredEvents.forEach(event => {
        const marker = createMarker(event);
        markers.push(marker);
    });
}

// Update event count
function updateEventCount() {
    const count = currentFilter === 'all' 
        ? events.length 
        : events.filter(e => e.type === currentFilter).length;
    document.getElementById('event-count').textContent = `${count} Active Event${count !== 1 ? 's' : ''}`;
    document.getElementById('last-update').textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
}

// Simulate new events
function simulateNewEvent() {
    const types = ['robbery', 'assault', 'theft', 'burglary', 'vandalism'];
    const severities = ['low', 'medium', 'high'];
    const streets = ['Main St', 'Oak Ave', 'Elm St', 'Pine Rd', 'Maple Dr', 'Cedar Ln', 'Birch Way'];
    
    // Random location near Los Angeles
    const lat = 34.0522 + (Math.random() - 0.5) * 0.1;
    const lng = -118.2437 + (Math.random() - 0.5) * 0.1;
    
    const type = types[Math.floor(Math.random() * types.length)];
    const severity = severities[Math.floor(Math.random() * severities.length)];
    const street = streets[Math.floor(Math.random() * streets.length)];
    
    const descriptions = {
        robbery: ['Armed robbery in progress', 'Store robbery reported', 'Street robbery with weapon'],
        assault: ['Physical altercation reported', 'Domestic disturbance', 'Assault in progress'],
        theft: ['Vehicle theft reported', 'Shoplifting in progress', 'Bicycle theft'],
        burglary: ['Residential burglary in progress', 'Commercial break-in', 'Burglary alarm activated'],
        vandalism: ['Property damage reported', 'Graffiti in progress', 'Vehicle vandalism']
    };
    
    const radioFeeds = {
        robbery: 'All units, robbery in progress. Suspects may be armed. Use caution when approaching.',
        assault: 'Units responding to assault call. Victim requesting medical assistance.',
        theft: 'Theft report being taken. Suspect vehicle description being broadcast.',
        burglary: 'Silent alarm activated. Units establishing perimeter.',
        vandalism: 'Vandalism reported. Witnesses providing suspect descriptions.'
    };
    
    const newEvent = {
        id: Date.now(),
        type: type,
        severity: severity,
        location: { lat, lng },
        address: `${Math.floor(Math.random() * 999) + 100} ${street}, Los Angeles, CA`,
        time: new Date().toLocaleTimeString(),
        description: descriptions[type][Math.floor(Math.random() * descriptions[type].length)],
        radioFeed: radioFeeds[type]
    };
    
    events.unshift(newEvent);
    
    // Keep only last 20 events
    if (events.length > 20) {
        events = events.slice(0, 20);
    }
    
    updateMarkers();
    updateEventCount();
}

// Start auto-update
function startAutoUpdate() {
    updateInterval = setInterval(() => {
        if (isUpdating) {
            // Randomly add new events (30% chance every 5 seconds)
            if (Math.random() < 0.3) {
                simulateNewEvent();
            } else {
                updateEventCount();
            }
        }
    }, 5000);
}

// Setup controls
function setupControls() {
    const toggleBtn = document.getElementById('toggle-updates');
    const filterSelect = document.getElementById('event-filter');
    
    toggleBtn.addEventListener('click', () => {
        isUpdating = !isUpdating;
        toggleBtn.textContent = isUpdating ? 'Pause Updates' : 'Resume Updates';
        toggleBtn.classList.toggle('paused');
    });
    
    filterSelect.addEventListener('change', (e) => {
        currentFilter = e.target.value;
        updateMarkers();
        updateEventCount();
    });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Map will be initialized when Google Maps API loads
    });
} else {
    // DOM already loaded
    if (typeof google !== 'undefined') {
        initMap();
    }
}
