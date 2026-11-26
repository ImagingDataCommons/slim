"""
Build the synthetic LABELMAP Segmentation served by e2e/labelmap.ts.

IDC has no LABELMAP segmentation of a slide microscopy image yet, so the
suite serves this one into the RMS study it already uses (studies.rmsSr). It
is made the way highdicom makes every LABELMAP: Segment Number 0 is the
"Background" segment coded (DCM, 125040), Pixel Padding Value is 0, and the
segments carry no Recommended Display CIELab Value, so the viewer picks
their colors.

Run from the repository root:

    uv run --with highdicom==0.29.0 python e2e/data/labelmap/generate.py

It reads the slide metadata from the public IDC proxy and writes, next to
this script, the instance's DICOM JSON metadata (labelmap-seg.json, Pixel
Data as a BulkDataURI) and its frames, uncompressed and concatenated
(labelmap-seg-frames.bin.gz), which the spec serves as DICOMweb responses.
"""

import gzip
import io
import json
import urllib.request
from pathlib import Path

import highdicom as hd
import numpy as np
from pydicom import Dataset, dcmread
from pydicom.sr.codedict import codes

PROXY = (
    'https://proxy.imaging.datacommons.cancer.gov/current/'
    'viewer-only-no-downloads-see-tinyurl-dot-com-slash-3j3d9jyp/dicomWeb'
)
STUDY = '2.25.266314239954879564284639768519696615904'
SLIDE_SERIES = '1.3.6.1.4.1.5962.99.1.3501356587.1328342165.1687128569387.4.0'
"""Smallest VOLUME level of the slide (3361 x 2685, 240 px tiles)"""
SOURCE_INSTANCE = '1.3.6.1.4.1.5962.99.1.3501356587.1328342165.1687128569387.37.0'

"""Fixed UIDs so the specs can address the series across regenerations"""
SERIES_UID = '2.25.311830398573532846355960215441962914001'
INSTANCE_UID = '2.25.311830398573532846355960215441962914002'

LABELS = ['NECROSIS', 'STROMA', 'ERMS', 'ARMS']

METADATA_OUTPUT = Path(__file__).with_name('labelmap-seg.json')
FRAMES_OUTPUT = Path(__file__).with_name('labelmap-seg-frames.bin.gz')


def read_source_image() -> Dataset:
    with urllib.request.urlopen(
        f'{PROXY}/studies/{STUDY}/series/{SLIDE_SERIES}/metadata'
    ) as response:
        instances = json.load(response)
    for item in instances:
        if item['00080018']['Value'][0] == SOURCE_INSTANCE:
            return Dataset.from_json(
                item, bulk_data_uri_handler=lambda *_: b''
            )
    raise LookupError(f'instance {SOURCE_INSTANCE} not found')


def label_image(rows: int, columns: int) -> np.ndarray:
    """
    Four vertical bands inside a centred ellipse; 0 (background) outside it,
    so a drawn background floods the corners of the slide.
    """
    y, x = np.mgrid[0:rows, 0:columns]
    cy, cx = rows / 2, columns / 2
    inside = ((y - cy) / (rows * 0.4)) ** 2 + ((x - cx) / (columns * 0.4)) ** 2 <= 1
    band = np.clip(((x - columns * 0.1) / (columns * 0.8) * 4).astype(int), 0, 3)
    labels = np.where(inside, band + 1, 0).astype(np.uint8)
    return labels[np.newaxis, ...]


def main() -> None:
    source = read_source_image()
    algorithm = hd.AlgorithmIdentificationSequence(
        name='Slim e2e fixture',
        version='1',
        family=codes.cid7162.ArtificialIntelligence,
    )
    descriptions = [
        hd.seg.SegmentDescription(
            segment_number=number,
            segment_label=label,
            segmented_property_category=codes.SCT.MorphologicallyAbnormalStructure,
            segmented_property_type=codes.SCT.Neoplasm,
            algorithm_type=hd.seg.SegmentAlgorithmTypeValues.AUTOMATIC,
            algorithm_identification=algorithm,
        )
        for number, label in enumerate(LABELS, start=1)
    ]
    segmentation = hd.seg.Segmentation(
        source_images=[source],
        pixel_array=label_image(
            int(source.TotalPixelMatrixRows),
            int(source.TotalPixelMatrixColumns),
        ),
        segmentation_type=hd.seg.SegmentationTypeValues.LABELMAP,
        segment_descriptions=descriptions,
        series_instance_uid=SERIES_UID,
        series_number=900,
        sop_instance_uid=INSTANCE_UID,
        instance_number=1,
        manufacturer='Slim',
        manufacturer_model_name='e2e fixture',
        software_versions='1',
        device_serial_number='0',
        series_description='Synthetic labelmap (e2e)',
        tile_pixel_array=True,
        omit_empty_frames=False,
        dimension_organization_type=hd.DimensionOrganizationTypeValues.TILED_FULL,
    )
    """A write and read back turns highdicom's Python values into plain DICOM values"""
    buffer = io.BytesIO()
    segmentation.save_as(buffer)
    buffer.seek(0)
    segmentation = dcmread(buffer)
    frames = segmentation.PixelData
    metadata = segmentation.to_json_dict(
        bulk_data_element_handler=lambda _: 'frames',
    )
    """DICOMweb metadata carries the transfer syntax as Available Transfer Syntax UID"""
    metadata['00083002'] = {
        'vr': 'UI',
        'Value': [segmentation.file_meta.TransferSyntaxUID],
    }
    METADATA_OUTPUT.write_text(json.dumps(metadata, indent=1, sort_keys=True) + '\n')
    """mtime=0 keeps the archive byte-identical across runs"""
    FRAMES_OUTPUT.write_bytes(gzip.compress(frames, mtime=0))
    for path in (METADATA_OUTPUT, FRAMES_OUTPUT):
        print(f'wrote {path} ({path.stat().st_size} bytes)')


if __name__ == '__main__':
    main()
