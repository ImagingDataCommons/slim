# Validation Context

This module provides a validation context for running validations and showing dialogs throughout the application.

## Overview

The ValidationProvider is set up at the study viewer level in `App.tsx`, so it's available throughout the study viewer components where slides data is available.

## Usage

### 1. Setup ValidationProvider

The ValidationProvider is automatically set up in the study viewer components with the proper study context:

```tsx
<ValidationProvider clients={clients} studyInstanceUID={studyInstanceUID}>
  <CaseViewer
    clients={clients}
    studyInstanceUID={studyInstanceUID}
    // ... other props
  />
</ValidationProvider>
```

### 2. Use validation functions in components

Since the ValidationProvider is set up at the study viewer level, you can use validation functions anywhere within the study viewer components:

```tsx
import { useValidation } from '../contexts/ValidationContext'

const MyComponent = () => {
  const { runValidations } = useValidation()
  
  const handleAction = () => {
    const result = runValidations({ 
      dialog: true, 
      context: { annotationGroup, slide } 
    })
    if (result.isValid) {
      // proceed with action
    }
  }
  
  return <button onClick={handleAction}>Perform Action</button>
}
```

### 3. Use ValidationWarning component

The ValidationWarning component automatically shows warnings based on validation results:

```tsx
import ValidationWarning from './ValidationWarning'

const MyComponent = ({ slide, annotationGroup }) => {
  return (
    <div>
      <ValidationWarning slide={slide} annotationGroup={annotationGroup} />
      {/* rest of component */}
    </div>
  )
}
```

## Validation Types

The validation system supports several types of validations:

- **Multi-resolution pyramid validation**: Checks if slides have proper multi-resolution pyramids
- **Annotation group association validation**: Verifies that annotation groups are associated with valid slides

## API Reference

### ValidationProvider Props

- `children`: React components to wrap
- `clients`: DICOM web clients for fetching slides data
- `studyInstanceUID`: Study instance UID for the current study

### useValidation Hook

Returns an object with:
- `runValidations(options)`: Function to run validations with options

### runValidations Options

- `dialog`: Whether to show validation dialog (default: false)
- `context`: Object containing:
  - `annotationGroup`: Annotation group to validate
  - `slide`: Slide to validate

### ValidationResult

- `isValid`: Boolean indicating if validation passed
- `message`: Optional validation message
- `type`: Validation type ('warning', 'error', 'info') 