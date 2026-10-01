/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import type React from 'react'
import { useEffect, useMemo, useRef } from 'react'

import {
  describeEvaluations,
  notifyMeasurementReportWarnings,
  type ParsedMeasurementReport,
  parseMeasurementReport,
} from '../utils/measurementReport'
import Description from './Description'
import Patient from './Patient'
import Study from './Study'

export interface ReportProps {
  dataset: dmv.metadata.Comprehensive3DSR
}

/** Labelled horizontal rule between report sections */
function SectionDivider({ label }: { label: string }): React.ReactElement {
  return (
    <div className="my-4 flex items-center gap-4">
      <span className="whitespace-nowrap text-sm font-medium text-ink-muted">
        {label}
      </span>
      <div className="h-px flex-1 bg-line" />
    </div>
  )
}

/**
 * DICOM SR measurement report: patient, study, specimen and observer context
 * plus the evaluations of each region of interest.
 */
function Report({ dataset }: ReportProps): React.ReactElement {
  const report = useMemo(() => parseMeasurementReport(dataset), [dataset])
  /** StrictMode replays effects; warnings must be reported once per parse */
  const notifiedReport = useRef<ParsedMeasurementReport>()

  useEffect(() => {
    if (notifiedReport.current === report) return
    notifiedReport.current = report
    notifyMeasurementReportWarnings(report.warnings)
  }, [report])

  return (
    <div>
      <SectionDivider label="Patient" />
      <Patient metadata={dataset} />
      <SectionDivider label="Case" />
      <Study metadata={dataset} />
      <SectionDivider label="Slide" />
      <Description
        items={[{ label: 'ID', value: report.ContainerIdentifier }]}
      />
      <SectionDivider label="Specimen" />
      <Description
        items={[{ label: 'ID', value: report.SpecimenIdentifier }]}
      />
      <SectionDivider label="Observer" />
      <Description
        items={[{ label: 'Name', value: report.PersonObserverName }]}
      />
      <SectionDivider label="Annotations" />
      {report.ROIs.map((roi, index) => (
        <Description
          key={roi.uid}
          header={`Region ${index + 1}`}
          items={describeEvaluations(roi.evaluations)}
        />
      ))}
    </div>
  )
}

export default Report
