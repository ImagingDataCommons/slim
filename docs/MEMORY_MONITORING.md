# Memory Monitoring in Slim

## Overview

Slim includes memory monitoring capabilities to help track and manage browser memory usage, which is particularly important when viewing large DICOM whole slide images (WSI) that can consume significant amounts of memory.

## Features

- **Automatic memory monitoring**: Monitors memory usage every 5 seconds
- **Multiple API support**: 
  - Modern API (`performance.measureUserAgentSpecificMemory()`) when cross-origin isolation is enabled
  - Chrome-specific fallback (`performance.memory`) in Chrome/Edge browsers
- **Visual indicators**: Memory status shown in the footer with color-coded tags
- **Automatic warnings**: Notifications when memory usage is high (>80%) or critical (>90%)
- **Real-time updates**: Memory information updates automatically as usage changes

## Accessing Memory Information

The memory monitor appears in the footer at the bottom of all pages. It displays:

- Used memory
- Heap limit
- Usage percentage
- Remaining memory
- Color-coded status (green/orange/red)

## Memory Warnings

The application automatically shows warnings when:

- **High usage** (>80%): A warning notification appears
- **Critical usage** (>90%): A critical warning notification appears with recommendations to refresh the page

Warnings are only shown when the status changes to avoid spamming users with repeated notifications.

## API Methods

### Modern API (Recommended)

Uses `performance.measureUserAgentSpecificMemory()` which provides accurate memory measurements including breakdowns by context (main thread, workers, etc.).

**Requirements**:
- Browser support (Chrome 89+, Edge 89+)
- Cross-origin isolation enabled via HTTP headers:
  - `Cross-Origin-Opener-Policy: same-origin`
  - `Cross-Origin-Embedder-Policy: require-corp`

**Status**: Already configured in `firebase.json` for production deployments.

### Chrome Fallback API

Uses the deprecated but still functional `performance.memory` API available in Chrome/Edge browsers. This provides basic memory statistics without requiring cross-origin isolation.

**Limitations**:
- Only shows JavaScript heap usage
- Doesn't include WebGL or WebAssembly memory
- Deprecated (may be removed in future browser versions)

### Unavailable

If neither API is available, memory monitoring will be disabled and the footer will not display memory information.

## Configuration

### Enable/Disable Memory Monitoring

Memory monitoring can be enabled or disabled through the application configuration:

```javascript
window.config = {
  // ... other config options ...
  enableMemoryMonitoring: true, // Set to true to enable memory monitoring footer
};
```

- **Default**: Memory monitoring is disabled by default (`enableMemoryMonitoring: false` or undefined)
- **Enable**: Set `enableMemoryMonitoring: true` to show the memory footer and start monitoring

When enabled, the memory footer appears at the bottom of all pages and monitors memory usage every 5 seconds. When disabled, the memory footer will not appear and memory monitoring will not start, reducing overhead.

### Cross-Origin Isolation Setup

For local development with the modern API, you need to configure HTTP headers. The nginx configuration in `etc/nginx/conf.d/local.conf` should include:

```nginx
add_header Cross-Origin-Opener-Policy "same-origin" always;
add_header Cross-Origin-Embedder-Policy "require-corp" always;
```

**Note**: Cross-origin isolation may break some third-party integrations or embeds. Test thoroughly if enabling locally.

### Monitoring Interval

The default monitoring interval is 5 seconds. This can be changed by modifying the `updateInterval` in `MemoryMonitor.ts` or when calling `memoryMonitor.startMonitoring(interval)`.

### Thresholds

Memory warning thresholds can be adjusted in `MemoryMonitor.ts`:
- `highUsageThreshold`: 0.80 (80%)
- `criticalUsageThreshold`: 0.90 (90%)

## Technical Details

### Memory Monitor Service

Located in `src/services/MemoryMonitor.ts`, this service provides:

- Singleton pattern for application-wide memory monitoring
- Subscription-based updates for components
- Automatic API detection and fallback
- Utility functions for formatting and status messages

### Integration Points

1. **MemoryFooter Component**: 
   - Displays memory info in the footer
   - Subscribes to memory updates
   - Shows warnings when memory is high

2. **Notification Middleware**: 
   - Publishes memory warnings as toast notifications
   - Integrated with existing error/warning system

## Best Practices

1. **Monitor during development**: Check memory usage when testing with large images
2. **Watch for leaks**: If memory steadily increases without user interaction, investigate potential memory leaks
3. **Consider cleanup**: The viewer's `cleanup()` method can be called to explicitly free memory
4. **Browser DevTools**: Use Chrome DevTools Memory profiler for detailed analysis

## Troubleshooting

### Memory monitoring shows "unavailable"

**Chrome/Edge**: The Chrome fallback API should work. Check that you're using a supported browser version.

**Other browsers**: The modern API requires cross-origin isolation. Ensure your server is sending the correct headers.

### Cross-origin isolation breaks my app

If enabling cross-origin isolation causes issues:
- Check console for blocked resources
- Ensure all third-party scripts are compatible
- Consider using the Chrome fallback API instead (works without isolation)

### Memory keeps increasing

This could indicate a memory leak:
1. Check if tiles are being properly disposed
2. Verify web workers are being terminated when not needed
3. Ensure image blobs are being revoked after use
4. Use Chrome DevTools Memory profiler to identify leaks

## References

- [MDN: measureUserAgentSpecificMemory()](https://developer.mozilla.org/en-US/docs/Web/API/Performance/measureUserAgentSpecificMemory)
- [Chrome Memory API](https://developer.chrome.com/docs/devtools/memory-problems/)
