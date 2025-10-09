# CrimeTrend

A live crime event mapping application that displays real-time crime events on an interactive map with detailed information including radio feed communications.

## Features

- **Live Event Display**: Crime events appear as pins on an interactive Google Map
- **Real-time Updates**: Events update automatically every 5 seconds with new incidents
- **Event Details**: Click on any pin to view comprehensive information including:
  - Event type and severity
  - Location and address
  - Timestamp
  - Description
  - Live radio feed communications
- **Event Filtering**: Filter events by type (robbery, assault, theft, burglary, vandalism)
- **Severity Indicators**: Color-coded markers based on severity:
  - 🔴 Red: High severity
  - 🟠 Orange: Medium severity
  - 🟢 Green: Low severity
- **Dark Theme**: Professional dark-themed interface optimized for monitoring
- **Responsive Design**: Works on desktop and mobile devices

## Setup Instructions

### Prerequisites
- A Google Maps API key with Maps JavaScript API enabled

### Getting Your Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the "Maps JavaScript API"
4. Create credentials (API Key)
5. Copy your API key

### Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/74Thirsty/CrimeTrend.git
   cd CrimeTrend
   ```

2. Open `index.html` and replace `YOUR_API_KEY` with your Google Maps API key:
   ```html
   <script src="https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY&callback=initMap" async defer></script>
   ```

3. Open `index.html` in a web browser or serve it using a local web server:
   ```bash
   # Using Python 3
   python -m http.server 8000
   
   # Using Node.js
   npx http-server
   ```

4. Navigate to `http://localhost:8000` in your browser

## Usage

### Viewing Events
- The map loads with sample crime events displayed as colored pins
- Each pin's color indicates the severity of the event
- Hover over pins to see the event type
- Click on any pin to view detailed information including the radio feed

### Controlling Updates
- **Pause/Resume Updates**: Click the "Pause Updates" button to stop automatic event updates
- **Filter Events**: Use the dropdown menu to filter events by type
- **Event Counter**: View the number of active events in the header

### Understanding the Display
- **Info Windows**: Click on any marker to see:
  - Event type and severity level
  - Exact location and address
  - Time of occurrence
  - Event description
  - Radio feed communications from responding units

## File Structure

```
CrimeTrend/
├── index.html          # Main HTML structure
├── styles.css          # Styling and theme
├── app.js             # Application logic and map integration
└── README.md          # Documentation
```

## Customization

### Adding Real Data Source
To connect to a real crime data feed, modify the `simulateNewEvent()` function in `app.js` to fetch from your API:

```javascript
async function fetchRealEvents() {
    const response = await fetch('YOUR_API_ENDPOINT');
    const data = await response.json();
    // Process and add events to the map
}
```

### Changing Map Style
Edit the `styles` array in the `initMap()` function in `app.js` to customize the map appearance.

### Adjusting Update Frequency
Change the interval in `startAutoUpdate()` function:
```javascript
setInterval(() => {
    // Update logic
}, 5000); // Change 5000 to desired milliseconds
```

## Technologies Used

- **Google Maps JavaScript API**: Interactive map display
- **Vanilla JavaScript**: Core functionality
- **CSS3**: Styling and animations
- **HTML5**: Structure and layout

## Future Enhancements

- Integration with real crime data APIs (e.g., city police departments)
- Historical event playback
- Heat map visualization
- Custom alert zones
- Audio streaming of actual radio feeds
- User-submitted incident reports
- Multi-city support

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the MIT License.

## Disclaimer

This is a demonstration application. Sample data is simulated and not based on real crime events. For actual crime data, integrate with official law enforcement APIs or public safety databases.
