# Multi-Color Segment Support

This document describes the new multi-color segment support feature in Slim, which allows segments to be displayed with distinct colors instead of the previous single yellow color.

## Overview

Previously, all segments in a segmentation were displayed with the same yellow color, making it difficult to distinguish between different segments when multiple segments were visible simultaneously. The new feature provides:

1. **Automatic Color Assignment**: Each segment gets a distinct color from a predefined palette
2. **DICOM Color Hint Support**: Reads `RecommendedDisplayCIELabValue` from segment metadata when available
3. **User Color Customization**: Allows users to change segment colors through the UI
4. **Visual Color Indicators**: Shows the current color for each segment in the UI

## Features

### Automatic Color Generation

Segments are automatically assigned colors from a carefully chosen palette that provides good contrast and visual distinction:

- **Primary Colors**: Red, Green, Blue, Yellow, Magenta, Cyan
- **Extended Colors**: Orange, Purple, Teal, Olive
- **Light Variants**: Light Red, Light Green, Light Blue, Light Yellow, Light Magenta, Light Cyan

The palette wraps around if there are more segments than colors, ensuring every segment gets a unique color.

### DICOM Metadata Integration

The system automatically reads color hints from DICOM segmentation files when available:

- Looks for `RecommendedDisplayCIELabValue` in the Segment Sequence
- Converts CIELab color space to RGB for display
- Falls back to generated colors if no metadata is available

### User Interface

The segment settings panel now includes:

- **RGB Color Sliders**: Individual sliders for Red, Green, and Blue values (0-255)
- **Color Preview**: Visual indicator showing the current segment color
- **Real-time Updates**: Color changes are applied immediately to the viewer

## Technical Implementation

### Color Utility Functions

The `src/utils/segmentColors.ts` file provides:

- `generateSegmentColor(index)`: Generates distinct colors for segments
- `extractSegmentColorFromMetadata(metadata, segmentNumber)`: Extracts colors from DICOM metadata
- `getSegmentColor(metadata, segmentNumber, fallbackIndex)`: Gets the best available color

### Component Updates

- **SegmentItem**: Enhanced with color picker controls and visual color indicators
- **SlideViewer**: Updated to apply colors to segments and manage color state
- **SegmentList**: Modified to support color properties in segment styles

### DICOM Integration

Colors are applied to segments using the dicom-microscopy-viewer's `setSegmentStyle` method with custom palette color lookup tables created by the viewer's built-in `createSegmentPaletteColorLookupTable` method.

## Usage

### Viewing Segments with Colors

1. Load a study with segmentation data
2. Navigate to the "Segmentations" section in the sidebar
3. Each segment will be displayed with a distinct color
4. Toggle segments on/off to see multiple colored segments simultaneously

### Customizing Segment Colors

1. Click the settings button (gear icon) next to any segment
2. Use the RGB sliders to adjust the color
3. Changes are applied immediately
4. The color preview shows the current selection

### DICOM Color Hints

If your segmentation files contain `RecommendedDisplayCIELabValue` metadata, these colors will be automatically used instead of generated colors. This ensures consistency with the original segmentation data.

## Benefits

1. **Better Visualization**: Multiple segments can be viewed simultaneously with clear distinction
2. **Improved Analysis**: Researchers can better analyze segment relationships and distributions
3. **Professional Appearance**: Presentations and reports look more polished
4. **User Control**: Users can customize colors to match their preferences or requirements
5. **Standards Compliance**: Respects DICOM color recommendations when available

## Future Enhancements

Potential improvements for future versions:

- **Color Scheme Presets**: Predefined color schemes for different types of analysis
- **Color Export/Import**: Save and load custom color configurations
- **Accessibility**: Ensure color choices meet accessibility standards
- **Advanced Color Models**: Support for additional color spaces beyond RGB
- **Batch Color Operations**: Apply color changes to multiple segments at once

## Technical Notes

- Colors are stored as RGB values (0-255 range)
- The system automatically clamps values to valid ranges
- Color changes trigger immediate viewer updates
- All color operations are performed client-side for performance
- The feature is backward compatible with existing segmentation data
