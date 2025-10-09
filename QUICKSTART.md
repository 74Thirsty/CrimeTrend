# CrimeTrend - Quick Start Guide

## 📁 Files Overview

| File | Purpose | Lines |
|------|---------|-------|
| `index.html` | Main application page with Google Maps integration | 40 |
| `app.js` | Core application logic, event handling, and map controls | 327 |
| `styles.css` | Dark theme styling and responsive design | 181 |
| `demo.html` | Demo version that works without API key | 196 |
| `setup.html` | Comprehensive setup and configuration guide | 181 |
| `README.md` | Full documentation and usage instructions | 142 |

## 🚀 Quick Start

1. **Get API Key**: Visit [Google Cloud Console](https://console.cloud.google.com/)
2. **Enable API**: Enable "Maps JavaScript API"
3. **Configure**: Replace `YOUR_API_KEY` in `index.html`
4. **Run**: `python -m http.server 8000`
5. **Open**: Navigate to `http://localhost:8000`

## 🎯 Key Features

- ✅ Live event markers on Google Maps
- ✅ Color-coded severity indicators (Red/Orange/Green)
- ✅ Click pins to view event details and radio feed
- ✅ Filter events by type
- ✅ Pause/Resume real-time updates
- ✅ Dark themed professional UI
- ✅ Fully responsive design

## 🗺️ Event Types

- **Robbery** - Armed or unarmed robbery incidents
- **Assault** - Physical altercations and attacks
- **Theft** - Vehicle theft, shoplifting, etc.
- **Burglary** - Break-ins and unauthorized entry
- **Vandalism** - Property damage and graffiti

## 🎨 Severity Levels

- 🔴 **High** - Immediate threat, armed incidents
- 🟠 **Medium** - Potential danger, requires attention
- 🟢 **Low** - Non-violent, property crimes

## 📻 Radio Feed

Each event includes simulated radio communications showing:
- Unit responses
- Suspect descriptions
- Situation updates
- Backup requests

## 🔧 Customization

To connect to real crime data:

```javascript
// In app.js, modify:
async function fetchRealEvents() {
    const response = await fetch('YOUR_API_ENDPOINT');
    const data = await response.json();
    // Process and display events
}
```

## 📱 Browser Compatibility

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Mobile browsers: ✅ Responsive design

## 🛠️ Technology Stack

- **Frontend**: Vanilla JavaScript (ES6+)
- **Maps**: Google Maps JavaScript API
- **Styling**: CSS3 with custom dark theme
- **Data**: Simulated event data (customizable)

## 📊 Demo Mode

Visit `demo.html` to see the application without needing an API key. This demonstrates:
- UI/UX design
- Event markers
- Info windows
- Radio feed display

## 🔐 API Key Security

⚠️ **Important**: For production use:
- Restrict your API key by HTTP referrer
- Set daily quota limits
- Monitor usage in Google Cloud Console
- Never commit API keys to version control

## 📈 Future Enhancements

Potential additions:
- Real crime data API integration
- Historical event playback
- Heat map visualization
- Audio streaming of radio feeds
- User-submitted reports
- Multi-city support
- Custom alert zones

## 📞 Support

For issues or questions:
- Check `README.md` for detailed documentation
- Review `setup.html` for configuration help
- Test with `demo.html` for UI preview

---

**Note**: This application uses simulated data for demonstration purposes. For production use, integrate with official law enforcement APIs or public safety databases.
