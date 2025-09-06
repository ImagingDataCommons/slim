# Logger Configuration

The SLIM viewer now includes a configurable logger utility that can be controlled through the application configuration files.

## Configuration Options

The logger can be configured in any of the config files (`public/config/*.js`) by adding a `logger` section:

```javascript
window.config = {
  // ... other config options ...
  logger: {
    level: 'DEBUG', // DEBUG, LOG, WARN, ERROR, NONE
    enableInProduction: false,
    enableInDevelopment: true
  }
}
```

### Log Levels

- `DEBUG` - Shows all log messages (most verbose)
- `LOG` - Shows log, warn, and error messages
- `WARN` - Shows only warning and error messages
- `ERROR` - Shows only error messages
- `NONE` - Disables all logging

### Environment Settings

- `enableInProduction` - Whether to enable logging in production environment
- `enableInDevelopment` - Whether to enable logging in development environment

## Usage in Code

The logger is automatically imported and used throughout the application:

```typescript
import { logger } from '../utils/logger'

// Use the logger methods
logger.debug('Debug message')
logger.log('Info message')
logger.warn('Warning message')
logger.error('Error message')
```

## Default Configuration

If no logger configuration is provided, the following defaults are used:

- **Development**: `DEBUG` level, logging enabled
- **Production**: `ERROR` level, logging disabled

## Example Configurations

### Development (Verbose Logging)
```javascript
logger: {
  level: 'DEBUG',
  enableInProduction: false,
  enableInDevelopment: true
}
```

### Production (Minimal Logging)
```javascript
logger: {
  level: 'ERROR',
  enableInProduction: true,
  enableInDevelopment: false
}
```

### Disable All Logging
```javascript
logger: {
  level: 'NONE',
  enableInProduction: false,
  enableInDevelopment: false
}
```
