#!/usr/bin/env node
/**
 * Picks one public IDC example per row of the DICOM support matrix and writes
 * src/data/idc-examples.json. Uses the IDC REST API (POST /v3/sql), the
 * no-install path of github.com/ImagingDataCommons/imaging-data-commons-skill,
 * and checks every UID on the IDC public DICOMweb proxy.
 *
 *   node scripts/find-idc-examples.mjs            curate and write the JSON
 *   node scripts/find-idc-examples.mjs --verify   re-check the committed JSON
 *
 * --verify exits 1 when an example stops resolving or a row without an
 * example (Labelmap) gains public data, and writes a Markdown report to
 * $IDC_REPORT_PATH when set.
 */
import { readFile, writeFile } from 'node:fs/promises'

const API = 'https://api.imaging.datacommons.cancer.gov/v3'
const PROXY =
  process.env.IDC_PROXY_URL ??
  'https://proxy.imaging.datacommons.cancer.gov/current/viewer-only-no-downloads-see-tinyurl-dot-com-slash-3j3d9jyp/dicomWeb'
const OUTPUT = new URL('../src/data/idc-examples.json', import.meta.url)

const SOP = {
  wsi: '1.2.840.10008.5.1.4.1.1.77.1.6',
  sr3d: '1.2.840.10008.5.1.4.1.1.88.34',
  seg: '1.2.840.10008.5.1.4.1.1.66.4',
  labelmap: '1.2.840.10008.5.1.4.1.1.66.7',
  ann: '1.2.840.10008.5.1.4.1.1.91.1',
  pmap: '1.2.840.10008.5.1.4.1.1.30',
  abps: '1.2.840.10008.5.1.4.1.1.11.8',
}

/** Derived objects open via their own series: Slim loads the referenced slide */
const SLIDE_SIZE = 'src.series_size_MB BETWEEN 80 AND 400'

/**
 * One row per matrix entry. `preferred` UIDs come from the README or a
 * previous curation run; `fallback` SQL is used when they no longer resolve.
 */
const ROWS = [
  {
    id: 'brightfield',
    caption: 'H&E brightfield slide',
    preferred: {
      series: '1.3.6.1.4.1.5962.99.1.208792987.352384958.1640886332827.2.0',
    },
    fallback: `SELECT i.StudyInstanceUID, i.SeriesInstanceUID FROM sm_index s
      JOIN index i ON i.SeriesInstanceUID = s.SeriesInstanceUID
      WHERE array_to_string(s.staining_usingSubstance_CodeMeaning, ',') LIKE '%eosin%'
        AND i.license_short_name LIKE 'CC BY%' AND i.series_size_MB BETWEEN 80 AND 400
      ORDER BY i.series_size_MB DESC LIMIT 1`,
  },
  {
    id: 'fluorescence',
    caption: 'Cyclic immunofluorescence (t-CyCIF), multiplexed channels',
    preferred: {
      series: '1.3.6.1.4.1.5962.99.1.2339926922.537408935.1655902368650.4.0',
    },
    fallback: `SELECT i.StudyInstanceUID, i.SeriesInstanceUID FROM sm_index s
      JOIN index i ON i.SeriesInstanceUID = s.SeriesInstanceUID
      WHERE s.illuminationType_CodeMeaning ILIKE '%fluorescence%'
        AND i.license_short_name LIKE 'CC BY%'
      ORDER BY i.series_size_MB LIMIT 1`,
  },
  {
    id: 'sr',
    caption: 'Expert region annotations stored as Comprehensive 3D SR',
    preferred: {
      series:
        '1.2.826.0.1.3680043.10.511.3.65352168153070950281170547035589843',
    },
    fallback: `SELECT i.StudyInstanceUID, i.SeriesInstanceUID FROM index i
      WHERE i.SOPClassUID = '${SOP.sr3d}' AND i.license_short_name LIKE 'CC BY%'
        AND i.StudyInstanceUID IN (SELECT StudyInstanceUID FROM index WHERE Modality = 'SM')
      LIMIT 1`,
  },
  {
    id: 'ann',
    caption: 'AI nuclei outlines as Microscopy Bulk Simple Annotations',
    preferred: {
      series:
        '1.2.826.0.1.3680043.10.511.3.65930042075829390210508226259517515',
    },
    fallback: `SELECT i.StudyInstanceUID, i.SeriesInstanceUID FROM ann_index a
      JOIN index i ON i.SeriesInstanceUID = a.SeriesInstanceUID
      JOIN index src ON src.SeriesInstanceUID = a.referenced_SeriesInstanceUID
      WHERE i.license_short_name LIKE 'CC BY%' AND ${SLIDE_SIZE}
      ORDER BY i.series_size_MB LIMIT 1`,
  },
  {
    id: 'seg-binary',
    caption: 'AI nuclei segmentation, binary DICOM SEG',
    preferred: {
      series:
        '1.2.826.0.1.3680043.10.511.3.76624010831157291367936127061121081',
    },
    fallback: `SELECT i.StudyInstanceUID, i.SeriesInstanceUID FROM seg_index seg
      JOIN index i ON i.SeriesInstanceUID = seg.SeriesInstanceUID
      JOIN index src ON src.SeriesInstanceUID = seg.segmented_SeriesInstanceUID
      WHERE src.Modality = 'SM' AND seg.SegmentationType = 'BINARY'
        AND i.license_short_name LIKE 'CC BY%' AND ${SLIDE_SIZE}
        AND i.series_size_MB BETWEEN 5 AND 200
      ORDER BY i.series_size_MB DESC LIMIT 1`,
  },
  {
    id: 'seg-fractional',
    caption: 'Tumor-infiltrating lymphocyte map, fractional DICOM SEG',
    preferred: {
      series:
        '1.2.826.0.1.3680043.10.511.3.80872271169752522514101601468878519',
    },
    fallback: `SELECT i.StudyInstanceUID, i.SeriesInstanceUID FROM seg_index seg
      JOIN index i ON i.SeriesInstanceUID = seg.SeriesInstanceUID
      JOIN index src ON src.SeriesInstanceUID = seg.segmented_SeriesInstanceUID
      WHERE src.Modality = 'SM' AND seg.SegmentationType = 'FRACTIONAL'
        AND i.license_short_name LIKE 'CC BY%' AND ${SLIDE_SIZE}
      ORDER BY src.series_size_MB DESC LIMIT 1`,
  },
  {
    id: 'labelmap',
    caption: 'Multi-class label map segmentation',
    preferred: null,
    fallback: `SELECT i.StudyInstanceUID, i.SeriesInstanceUID FROM index i
      WHERE i.SOPClassUID = '${SOP.labelmap}'
        AND i.StudyInstanceUID IN (SELECT StudyInstanceUID FROM index WHERE Modality = 'SM')
      ORDER BY i.license_short_name LIKE 'CC BY%' DESC LIMIT 1`,
  },
  {
    id: 'pmap',
    caption: 'Glioma aggressiveness score map, DICOM Parametric Map',
    preferred: {
      series:
        '1.2.826.0.1.3680043.10.511.3.57569487572611978100487359450084020',
    },
    fallback: `SELECT pm.StudyInstanceUID, pm.SeriesInstanceUID FROM index pm
      JOIN index sm ON sm.StudyInstanceUID = pm.StudyInstanceUID AND sm.Modality = 'SM'
      WHERE pm.SOPClassUID = '${SOP.pmap}' AND pm.license_short_name LIKE 'CC BY%'
      GROUP BY 1, 2 HAVING max(sm.series_size_MB) BETWEEN 100 AND 400
      ORDER BY count(sm.SeriesInstanceUID) LIMIT 1`,
  },
  {
    id: 'presentation-state',
    caption: 't-CyCIF slide with a saved Advanced Blending Presentation State',
    preferred: {
      series: '1.3.6.1.4.1.5962.99.1.2344794501.795090168.1655907236229.4.0',
      stateSeries:
        '1.2.826.0.1.3680043.10.511.3.91342853824883143715411628225851002',
      stateInstance:
        '1.2.826.0.1.3680043.10.511.3.79630386778396943986328353882008803',
    },
    fallback: `SELECT sm.StudyInstanceUID, sm.SeriesInstanceUID, pr.SeriesInstanceUID AS stateSeries
      FROM index pr JOIN index sm ON sm.StudyInstanceUID = pr.StudyInstanceUID AND sm.Modality = 'SM'
      WHERE pr.SOPClassUID = '${SOP.abps}' AND pr.license_short_name LIKE 'CC BY%'
      ORDER BY sm.series_size_MB LIMIT 1`,
  },
]

async function sql(query, maxRows = 50) {
  const response = await fetch(`${API}/sql`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sql: query, max_rows: maxRows }),
  })
  if (!response.ok) {
    throw new Error(
      `IDC SQL failed (${response.status}): ${await response.text()}`,
    )
  }
  return (await response.json()).rows ?? []
}

async function qido(path) {
  const response = await fetch(`${PROXY}${path}`, {
    headers: { accept: 'application/dicom+json' },
  })
  if (response.status === 204) return []
  if (!response.ok) throw new Error(`QIDO ${path} failed (${response.status})`)
  return response.json()
}

const tagValue = (dataset, tag) => dataset?.[tag]?.Value?.[0]

async function seriesMetadata(seriesUIDs) {
  const list = seriesUIDs.map((uid) => `'${uid}'`).join(',')
  const rows =
    await sql(`SELECT collection_id, StudyInstanceUID, SeriesInstanceUID, Modality,
      SOPClassUID, sop_class_name, license_short_name, round(series_size_MB, 1) AS size_mb,
      SeriesDescription, source_DOI
    FROM index WHERE SeriesInstanceUID IN (${list})`)
  return new Map(rows.map((row) => [row.SeriesInstanceUID, row]))
}

async function collectionName(collectionId) {
  const response = await fetch(`${API}/collections/${collectionId}`)
  if (!response.ok) return collectionId
  return (await response.json()).collection_name ?? collectionId
}

async function existsOnProxy(studyUID, seriesUID) {
  const results = await qido(
    `/studies/${studyUID}/series?SeriesInstanceUID=${seriesUID}`,
  )
  return results.length === 1
}

async function annotationSummary(seriesUID) {
  const rows =
    await sql(`SELECT AnnotationGroupLabel, NumberOfAnnotations, GraphicType, AlgorithmName
    FROM ann_group_index WHERE SeriesInstanceUID = '${seriesUID}'`)
  if (rows.length === 0) return undefined
  const total = rows.reduce(
    (sum, row) => sum + Number(row.NumberOfAnnotations),
    0,
  )
  return `${total.toLocaleString('en-US')} ${rows[0].GraphicType.toLowerCase()} annotations (${rows
    .map((row) => row.AnnotationGroupLabel)
    .join(', ')})`
}

async function segmentationSummary(seriesUID) {
  const rows =
    await sql(`SELECT SegmentationType, total_segments, AlgorithmName,
      SegmentedPropertyType_CodeMeanings AS types
    FROM seg_index WHERE SeriesInstanceUID = '${seriesUID}'`)
  const row = rows[0]
  if (!row) return undefined
  return `${row.AlgorithmName ?? 'Segmentation'}: ${row.types?.join(', ') ?? ''}`.trim()
}

async function presentationStateInstance(
  studyUID,
  stateSeries,
  preferredInstance,
) {
  const instances = await qido(
    `/studies/${studyUID}/series/${stateSeries}/instances`,
  )
  const uids = instances.map((instance) => tagValue(instance, '00080018'))
  if (preferredInstance && uids.includes(preferredInstance))
    return preferredInstance
  return uids[0]
}

async function resolveRow(row) {
  let target = row.preferred
  if (target) {
    const metadata = await seriesMetadata([target.series])
    if (!metadata.has(target.series)) target = null
  }
  if (!target) {
    const [found] = await sql(row.fallback, 1)
    if (!found) return { id: row.id, caption: row.caption, available: false }
    target = { series: found.SeriesInstanceUID, stateSeries: found.stateSeries }
  }

  const metadata = await seriesMetadata([target.series])
  const series = metadata.get(target.series)
  const study = series.StudyInstanceUID

  if (!(await existsOnProxy(study, target.series))) {
    throw new Error(
      `${row.id}: series ${target.series} does not resolve on the proxy`,
    )
  }

  /** @type {Record<string, unknown>} */
  const example = {
    id: row.id,
    caption: row.caption,
    available: true,
    collection: series.collection_id,
    collectionName: await collectionName(series.collection_id),
    modality: series.Modality,
    sopClassUID: series.SOPClassUID,
    sopClassName: series.sop_class_name,
    license: series.license_short_name,
    sizeMB: series.size_mb,
    sourceDOI: series.source_DOI ?? null,
    studyInstanceUID: study,
    seriesInstanceUID: target.series,
  }

  if (series.Modality === 'ANN')
    example.detail = await annotationSummary(target.series)
  if (series.Modality === 'SEG')
    example.detail = await segmentationSummary(target.series)
  if (series.SeriesDescription)
    example.seriesDescription = series.SeriesDescription

  if (target.stateSeries) {
    example.stateSeriesInstanceUID = target.stateSeries
    example.stateInstanceUID = await presentationStateInstance(
      study,
      target.stateSeries,
      target.stateInstance,
    )
    if (!example.stateInstanceUID) {
      throw new Error(
        `${row.id}: no instances in presentation state series ${target.stateSeries}`,
      )
    }
  }

  return example
}

async function curate() {
  const [version] = await fetch(`${API}/version`).then((response) =>
    response.json().then((v) => [v]),
  )
  const examples = []
  for (const row of ROWS) {
    process.stdout.write(`${row.id} ... `)
    const example = await resolveRow(row)
    examples.push(example)
    console.log(
      example.available
        ? `${example.collection} ${example.seriesInstanceUID}`
        : 'no public example',
    )
  }
  const data = {
    generatedAt: new Date().toISOString().slice(0, 10),
    idcVersion: version.idc_version,
    proxy: PROXY,
    examples,
  }
  await writeFile(OUTPUT, `${JSON.stringify(data, null, 2)}\n`)
  console.log(
    `\nWrote ${examples.length} examples for IDC ${version.idc_version}`,
  )
}

async function verify() {
  const data = JSON.parse(await readFile(OUTPUT, 'utf8'))
  const problems = []
  const news = []

  for (const example of data.examples) {
    if (example.available) {
      const ok = await existsOnProxy(
        example.studyInstanceUID,
        example.seriesInstanceUID,
      ).catch(() => false)
      if (!ok)
        problems.push(
          `\`${example.id}\`: series ${example.seriesInstanceUID} no longer resolves`,
        )
      if (example.stateInstanceUID) {
        const instance = await presentationStateInstance(
          example.studyInstanceUID,
          example.stateSeriesInstanceUID,
          example.stateInstanceUID,
        ).catch(() => undefined)
        if (instance !== example.stateInstanceUID) {
          problems.push(
            `\`${example.id}\`: presentation state ${example.stateInstanceUID} is missing`,
          )
        }
      }
    } else {
      const row = ROWS.find((candidate) => candidate.id === example.id)
      const [found] = row ? await sql(row.fallback, 1) : []
      if (found)
        news.push(
          `\`${example.id}\`: public data now available (${found.SeriesInstanceUID})`,
        )
    }
    console.log(`${example.id}: checked`)
  }

  const lines = []
  if (problems.length)
    lines.push('### Broken examples', '', ...problems.map((p) => `- ${p}`), '')
  if (news.length)
    lines.push(
      '### New examples available',
      '',
      ...news.map((n) => `- ${n}`),
      '',
    )
  if (lines.length) {
    lines.push(
      'Run `pnpm --filter slim-website find-idc-examples` and commit the result.',
    )
  }
  const report = lines.join('\n')

  if (process.env.IDC_REPORT_PATH)
    await writeFile(process.env.IDC_REPORT_PATH, report)
  if (report) {
    console.error(`\n${report}`)
    process.exitCode = 1
  } else {
    console.log(`\nAll ${data.examples.length} examples are current.`)
  }
}

await (process.argv.includes('--verify') ? verify() : curate())
